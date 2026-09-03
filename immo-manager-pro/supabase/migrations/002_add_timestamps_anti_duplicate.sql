-- Migration pour ajouter les colonnes de timestamp et système anti-doublon
-- Date: 2026-05-10

-- Fonction pour ajouter les colonnes de timestamp à toutes les tables
DO $$
DECLARE
    table_name text;
    tables_to_update text[] := ARRAY[
        'users', 'clients', 'buildings', 'leases', 'payments', 
        'biens', 'contrats', 'visites', 'documents', 'notifications',
        'alertes', 'commissions', 'portes', 'attributions'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_update
    LOOP
        -- Ajouter created_at si elle n'existe pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_name 
            AND column_name = 'created_at'
        ) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()', table_name);
        END IF;

        -- Ajouter updated_at si elle n'existe pas
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_name 
            AND column_name = 'updated_at'
        ) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()', table_name);
        END IF;

        -- Ajouter date_creation si elle n'existe pas (alias de created_at)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_name 
            AND column_name = 'date_creation'
        ) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN date_creation TIMESTAMPTZ DEFAULT NOW()', table_name);
        END IF;

        -- Ajouter derniere_modification si elle n'existe pas (alias de updated_at)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_name 
            AND column_name = 'derniere_modification'
        ) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN derniere_modification TIMESTAMPTZ DEFAULT NOW()', table_name);
        END IF;

        RAISE NOTICE 'Colonnes timestamp ajoutées à la table %', table_name;
    END LOOP;
END $$;

-- Créer une fonction trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.derniere_modification = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger à toutes les tables
DO $$
DECLARE
    table_name text;
    tables_to_update text[] := ARRAY[
        'users', 'clients', 'buildings', 'leases', 'payments', 
        'biens', 'contrats', 'visites', 'documents', 'notifications',
        'alertes', 'commissions', 'portes', 'attributions'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_update
    LOOP
        -- Supprimer le trigger s'il existe déjà
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', table_name, table_name);
        
        -- Créer le trigger
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        ', table_name, table_name);

        RAISE NOTICE 'Trigger créé pour la table %', table_name;
    END LOOP;
END $$;

-- Créer une vue pour détecter les doublons potentiels dans clients
CREATE OR REPLACE VIEW vue_doublons_clients AS
SELECT 
    c1.id as id1,
    c2.id as id2,
    c1.email,
    c1.telephone,
    c1.nom,
    c1.prenom,
    c1.created_at as date_creation_1,
    c2.created_at as date_creation_2,
    EXTRACT(EPOCH FROM (c2.created_at - c1.created_at)) / 3600 as heures_difference,
    CASE 
        WHEN c1.created_at < c2.created_at THEN 'c1 est plus ancien'
        ELSE 'c2 est plus ancien'
    END as plus_ancien
FROM clients c1
JOIN clients c2 ON (
    (c1.email = c2.email OR c1.telephone = c2.telephone)
    AND c1.id < c2.id
)
ORDER BY c1.created_at DESC;

-- Créer une fonction pour obtenir les doublons d'une table
CREATE OR REPLACE FUNCTION get_duplicates(
    p_table_name text,
    p_field_name text,
    p_field_value text
)
RETURNS TABLE(
    id uuid,
    created_at timestamptz,
    updated_at timestamptz,
    age_en_heures numeric,
    est_recent boolean
) AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT 
            id,
            created_at,
            updated_at,
            EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as age_en_heures,
            (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) < 24 as est_recent
        FROM %I
        WHERE %I = $1
        ORDER BY created_at DESC
    ', p_table_name, p_field_name)
    USING p_field_value;
END;
$$ LANGUAGE plpgsql;

-- Créer des index pour optimiser la recherche de doublons
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_telephone ON clients(telephone);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

CREATE INDEX IF NOT EXISTS idx_biens_adresse ON biens(adresse);
CREATE INDEX IF NOT EXISTS idx_biens_created_at ON biens(created_at);

CREATE INDEX IF NOT EXISTS idx_contrats_numero ON contrats(numero_contrat);
CREATE INDEX IF NOT EXISTS idx_contrats_created_at ON contrats(created_at);

-- Ajouter un commentaire sur les tables
COMMENT ON COLUMN clients.created_at IS 'Date et heure de création de l''enregistrement';
COMMENT ON COLUMN clients.updated_at IS 'Date et heure de la dernière modification';
COMMENT ON COLUMN clients.date_creation IS 'Alias de created_at pour compatibilité';
COMMENT ON COLUMN clients.derniere_modification IS 'Alias de updated_at pour compatibilité';

-- Créer une fonction pour formater la différence de temps
CREATE OR REPLACE FUNCTION format_time_difference(p_date timestamptz)
RETURNS text AS $$
DECLARE
    diff_seconds integer;
    diff_minutes integer;
    diff_hours integer;
    diff_days integer;
BEGIN
    diff_seconds := EXTRACT(EPOCH FROM (NOW() - p_date))::integer;
    diff_minutes := diff_seconds / 60;
    diff_hours := diff_minutes / 60;
    diff_days := diff_hours / 24;

    IF diff_days > 0 THEN
        RETURN diff_days || ' jour' || CASE WHEN diff_days > 1 THEN 's' ELSE '' END;
    ELSIF diff_hours > 0 THEN
        RETURN diff_hours || ' heure' || CASE WHEN diff_hours > 1 THEN 's' ELSE '' END;
    ELSIF diff_minutes > 0 THEN
        RETURN diff_minutes || ' minute' || CASE WHEN diff_minutes > 1 THEN 's' ELSE '' END;
    ELSE
        RETURN diff_seconds || ' seconde' || CASE WHEN diff_seconds > 1 THEN 's' ELSE '' END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Exemple d'utilisation:
-- SELECT *, format_time_difference(created_at) as age FROM clients;
-- SELECT * FROM get_duplicates('clients', 'email', 'test@example.com');
-- SELECT * FROM vue_doublons_clients;
