-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- NIVEAU 1 — BASE DE DONNÉES (Supabase SQL)
-- Yamtiken Behemoth · Portes, Attribution & Loyer Automatique
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ================================================================
-- A) TABLE batiments (modification existante)
-- ================================================================
ALTER TABLE batiments 
ADD COLUMN IF NOT EXISTS total_portes INTEGER DEFAULT 0;

COMMENT ON COLUMN batiments.total_portes IS 'Total des portes définies dans ce bâtiment (auto-calculé)';

-- ================================================================
-- B) TABLE type_portes (nouvelle)
-- ================================================================
CREATE TABLE IF NOT EXISTS type_portes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batiment_id UUID NOT NULL REFERENCES batiments(id) ON DELETE CASCADE,
  type_nom TEXT NOT NULL CHECK (type_nom IN ('magasin', 'studio', 'chambre', 'salon', 'entrepot', 'bureau')),
  quantite_totale INTEGER NOT NULL DEFAULT 0 CHECK (quantite_totale >= 0),
  quantite_disponible INTEGER NOT NULL DEFAULT 0 CHECK (quantite_disponible >= 0),
  prix_mensuel NUMERIC NOT NULL DEFAULT 0 CHECK (prix_mensuel >= 0),
  surface_m2 NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Contraintes de cohérence (anti-fraude)
  CONSTRAINT quantite_positive CHECK (quantite_disponible >= 0),
  CONSTRAINT coherence_stock CHECK (quantite_disponible <= quantite_totale),
  CONSTRAINT prix_positif CHECK (prix_mensuel >= 0)
);

COMMENT ON TABLE type_portes IS 'Définition des types de portes par bâtiment avec stock et prix';

-- Index sur type_portes
CREATE INDEX IF NOT EXISTS idx_type_portes_batiment ON type_portes(batiment_id);
CREATE INDEX IF NOT EXISTS idx_type_portes_type ON type_portes(type_nom);

-- ================================================================
-- C) TABLE attributions (nouvelle)
-- ================================================================
CREATE TABLE IF NOT EXISTS attributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  batiment_id UUID NOT NULL REFERENCES batiments(id) ON DELETE RESTRICT,
  type_porte_id UUID NOT NULL REFERENCES type_portes(id) ON DELETE RESTRICT,
  quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
  date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
  date_fin DATE,
  statut TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'resilie', 'suspendu', 'en_attente')),
  montant_mensuel NUMERIC NOT NULL DEFAULT 0, -- Montant calculé au moment de l'attribution
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Contrainte: date_fin >= date_debut si présente
  CONSTRAINT dates_coherentes CHECK (date_fin IS NULL OR date_fin >= date_debut),
  CONSTRAINT quantite_attribution_positive CHECK (quantite > 0)
);

COMMENT ON TABLE attributions IS 'Attribution de portes aux clients avec suivi location';

-- Indexes sur attributions
CREATE INDEX IF NOT EXISTS idx_attributions_client ON attributions(client_id);
CREATE INDEX IF NOT EXISTS idx_attributions_batiment ON attributions(batiment_id);
CREATE INDEX IF NOT EXISTS idx_attributions_type_porte ON attributions(type_porte_id);
CREATE INDEX IF NOT EXISTS idx_attributions_statut ON attributions(statut);
CREATE INDEX IF NOT EXISTS idx_attributions_dates ON attributions(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_attributions_actives ON attributions(client_id, statut) WHERE statut = 'actif';

-- ================================================================
-- D) TRIGGERS SQL (anti-fraude automatique)
-- ================================================================

-- Trigger 1 : Décrémenter le stock à chaque attribution
CREATE OR REPLACE FUNCTION decrementer_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_dispo INTEGER;
  v_type_nom TEXT;
  v_batiment_nom TEXT;
BEGIN
  -- Vérifier le stock disponible
  SELECT tp.quantite_disponible, tp.type_nom, b.nom
    INTO v_dispo, v_type_nom, v_batiment_nom
    FROM type_portes tp
    JOIN batiments b ON b.id = tp.batiment_id
    WHERE tp.id = NEW.type_porte_id;

  IF v_dispo IS NULL THEN
    RAISE EXCEPTION 'Type de porte introuvable';
  END IF;

  IF v_dispo < NEW.quantite THEN
    RAISE EXCEPTION 'Stock insuffisant pour % dans % : seulement % disponible(s), % demandé(s)',
      v_type_nom, v_batiment_nom, v_dispo, NEW.quantite;
  END IF;

  -- Décrémenter le stock
  UPDATE type_portes
    SET quantite_disponible = quantite_disponible - NEW.quantite,
        updated_at = now()
    WHERE id = NEW.type_porte_id;

  -- Calculer et stocker le montant mensuel
  SELECT NEW.quantite * prix_mensuel INTO NEW.montant_mensuel
    FROM type_portes WHERE id = NEW.type_porte_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_attribuer_porte ON attributions;
CREATE TRIGGER tg_attribuer_porte
  BEFORE INSERT ON attributions
  FOR EACH ROW EXECUTE FUNCTION decrementer_stock();

-- Trigger 2 : Remettre le stock si attribution résiliée/supprimée
CREATE OR REPLACE FUNCTION restaurer_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Si passage de 'actif' à non-actif
  IF OLD.statut = 'actif' AND NEW.statut != 'actif' THEN
    UPDATE type_portes
      SET quantite_disponible = quantite_disponible + OLD.quantite,
          updated_at = now()
      WHERE id = OLD.type_porte_id;
  END IF;
  
  -- Si réactivation (non-actif vers actif) - vérifier stock
  IF OLD.statut != 'actif' AND NEW.statut = 'actif' THEN
    IF (SELECT quantite_disponible FROM type_portes WHERE id = OLD.type_porte_id) < OLD.quantite THEN
      RAISE EXCEPTION 'Stock insuffisant pour réactivation';
    END IF;
    
    UPDATE type_portes
      SET quantite_disponible = quantite_disponible - OLD.quantite,
          updated_at = now()
      WHERE id = OLD.type_porte_id;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_resilier_porte ON attributions;
CREATE TRIGGER tg_resilier_porte
  BEFORE UPDATE ON attributions
  FOR EACH ROW EXECUTE FUNCTION restaurer_stock();

-- Trigger 3 : Restaurer stock à la suppression (safety net)
CREATE OR REPLACE FUNCTION restaurer_stock_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut = 'actif' THEN
    UPDATE type_portes
      SET quantite_disponible = quantite_disponible + OLD.quantite,
          updated_at = now()
      WHERE id = OLD.type_porte_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tg_delete_attribution ON attributions;
CREATE TRIGGER tg_delete_attribution
  BEFORE DELETE ON attributions
  FOR EACH ROW EXECUTE FUNCTION restaurer_stock_delete();

-- Trigger 4 : Recalculer total_portes dans batiments
CREATE OR REPLACE FUNCTION sync_total_portes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_batiment_id UUID;
BEGIN
  v_batiment_id := COALESCE(NEW.batiment_id, OLD.batiment_id);
  
  IF v_batiment_id IS NOT NULL THEN
    UPDATE batiments
      SET total_portes = (
        SELECT COALESCE(SUM(quantite_totale), 0)
        FROM type_portes WHERE batiment_id = v_batiment_id
      ),
      updated_at = now()
      WHERE id = v_batiment_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_total ON type_portes;
CREATE TRIGGER tg_sync_total
  AFTER INSERT OR UPDATE OR DELETE ON type_portes
  FOR EACH ROW EXECUTE FUNCTION sync_total_portes();

-- Trigger 5 : Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_type_portes_updated_at ON type_portes;
CREATE TRIGGER tg_type_portes_updated_at
  BEFORE UPDATE ON type_portes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tg_attributions_updated_at ON attributions;
CREATE TRIGGER tg_attributions_updated_at
  BEFORE UPDATE ON attributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- E) VIEWS pour les requêtes fréquentes
-- ================================================================

-- Vue 1 : Résumé client (total portes + loyer mensuel)
CREATE OR REPLACE VIEW vue_client_summary AS
SELECT
  c.id AS client_id,
  c.nom,
  c.prenom,
  c.email,
  c.telephone,
  COUNT(DISTINCT a.id) AS nombre_attributions,
  COALESCE(SUM(CASE WHEN a.statut = 'actif' THEN a.quantite ELSE 0 END), 0) AS portes_actives,
  COALESCE(SUM(CASE WHEN a.statut = 'actif' THEN a.montant_mensuel ELSE 0 END), 0) AS loyer_mensuel_total,
  COALESCE(SUM(CASE WHEN a.statut = 'resilie' THEN a.quantite ELSE 0 END), 0) AS portes_resiliees,
  MIN(a.date_debut) AS date_premiere_attribution,
  MAX(a.date_debut) AS date_derniere_attribution
FROM clients c
LEFT JOIN attributions a ON a.client_id = c.id
GROUP BY c.id, c.nom, c.prenom, c.email, c.telephone;

COMMENT ON VIEW vue_client_summary IS 'Résumé complet client avec portes et loyers';

-- Vue 2 : Disponibilité par bâtiment
CREATE OR REPLACE VIEW vue_batiment_stock AS
SELECT
  b.id AS batiment_id,
  b.nom AS batiment_nom,
  b.adresse,
  b.total_portes,
  COALESCE(SUM(tp.quantite_totale), 0) AS portes_definies,
  COALESCE(SUM(tp.quantite_disponible), 0) AS portes_disponibles,
  COALESCE(SUM(tp.quantite_totale - tp.quantite_disponible), 0) AS portes_attribuees,
  COALESCE(SUM(tp.quantite_totale * tp.prix_mensuel), 0) AS potentiel_revenu_mensuel,
  COALESCE(SUM((tp.quantite_totale - tp.quantite_disponible) * tp.prix_mensuel), 0) AS revenu_actuel_mensuel,
  json_agg(
    json_build_object(
      'type', tp.type_nom,
      'total', tp.quantite_totale,
      'disponible', tp.quantite_disponible,
      'attribue', tp.quantite_totale - tp.quantite_disponible,
      'prix_mensuel', tp.prix_mensuel,
      'surface_m2', tp.surface_m2
    ) ORDER BY tp.type_nom
  ) AS detail_types
FROM batiments b
LEFT JOIN type_portes tp ON tp.batiment_id = b.id
GROUP BY b.id, b.nom, b.adresse, b.total_portes;

COMMENT ON VIEW vue_batiment_stock IS 'Stock complet par bâtiment avec détail par type';

-- Vue 3 : Détail des attributions actives
CREATE OR REPLACE VIEW vue_attributions_actives AS
SELECT
  a.id AS attribution_id,
  a.client_id,
  c.nom AS client_nom,
  c.prenom AS client_prenom,
  c.email AS client_email,
  c.telephone AS client_telephone,
  a.batiment_id,
  b.nom AS batiment_nom,
  a.type_porte_id,
  tp.type_nom,
  a.quantite,
  a.date_debut,
  a.date_fin,
  a.statut,
  a.montant_mensuel,
  a.notes,
  a.created_at,
  -- Calcul du loyer total pour cette attribution
  (a.quantite * tp.prix_mensuel) AS loyer_calcul,
  -- Statut de paiement (à compléter avec table paiements)
  'en_attente' AS statut_paiement_mois
FROM attributions a
JOIN clients c ON c.id = a.client_id
JOIN batiments b ON b.id = a.batiment_id
JOIN type_portes tp ON tp.id = a.type_porte_id
WHERE a.statut = 'actif';

COMMENT ON VIEW vue_attributions_actives IS 'Toutes les attributions actives avec infos complètes';

-- Vue 4 : Synthèse mensuelle par bâtiment (pour rapports)
CREATE OR REPLACE VIEW vue_batiment_revenus_mensuels AS
SELECT
  b.id AS batiment_id,
  b.nom AS batiment_nom,
  DATE_TRUNC('month', a.date_debut) AS mois,
  COUNT(DISTINCT a.client_id) AS nb_clients,
  SUM(a.quantite) AS total_portes_attribuees,
  SUM(a.montant_mensuel) AS total_loyers_mensuels,
  AVG(a.montant_mensuel / NULLIF(a.quantite, 0)) AS loyer_moyen_par_porte
FROM batiments b
JOIN attributions a ON a.batiment_id = b.id AND a.statut = 'actif'
GROUP BY b.id, b.nom, DATE_TRUNC('month', a.date_debut);

COMMENT ON VIEW vue_batiment_revenus_mensuels IS 'Revenus mensuels par bâtiment pour reporting';

-- ================================================================
-- F) RPC FUNCTIONS (actions UI en 1 requête)
-- ================================================================

-- Fonction 1 : Attribuer des portes à un client
CREATE OR REPLACE FUNCTION attribuer_portes(
  p_client_id UUID,
  p_type_porte_id UUID,
  p_quantite INTEGER DEFAULT 1,
  p_date_debut DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_batiment_id UUID;
  v_dispo INTEGER;
  v_prix NUMERIC;
  v_type_nom TEXT;
  v_batiment_nom TEXT;
  v_client_nom TEXT;
  v_id UUID;
  v_montant_total NUMERIC;
BEGIN
  -- Récupérer les infos
  SELECT 
    tp.batiment_id, 
    tp.quantite_disponible, 
    tp.prix_mensuel,
    tp.type_nom,
    b.nom,
    c.nom || ' ' || c.prenom
    INTO v_batiment_id, v_dispo, v_prix, v_type_nom, v_batiment_nom, v_client_nom
  FROM type_portes tp
  JOIN batiments b ON b.id = tp.batiment_id
  CROSS JOIN clients c
  WHERE tp.id = p_type_porte_id AND c.id = p_client_id;

  IF v_batiment_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Type de porte ou client introuvable'
    );
  END IF;

  -- Vérifier si client a déjà ce type (éviter doublon)
  IF EXISTS (
    SELECT 1 FROM attributions 
    WHERE client_id = p_client_id 
    AND type_porte_id = p_type_porte_id 
    AND statut = 'actif'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ce client a déjà ce type de porte attribué',
      'suggestion', 'Augmentez la quantité de l\'attribution existante'
    );
  END IF;

  IF v_dispo < p_quantite THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Stock insuffisant pour %s : seulement %s disponible(s)', v_type_nom, v_dispo),
      'disponible', v_dispo,
      'demande', p_quantite
    );
  END IF;

  v_montant_total := p_quantite * v_prix;

  -- Créer l'attribution
  INSERT INTO attributions(
    client_id, batiment_id, type_porte_id,
    quantite, date_debut, notes, montant_mensuel
  ) VALUES (
    p_client_id, v_batiment_id, p_type_porte_id,
    p_quantite, p_date_debut, p_notes, v_montant_total
  ) RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'attribution_id', v_id,
    'client', v_client_nom,
    'batiment', v_batiment_nom,
    'type', v_type_nom,
    'quantite', p_quantite,
    'loyer_mensuel', v_montant_total,
    'message', format('%s porte(s) %s attribuée(s) à %s', p_quantite, v_type_nom, v_client_nom)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION attribuer_portes TO authenticated;

-- Fonction 2 : Résilier une attribution
CREATE OR REPLACE FUNCTION resilier_attribution(
  p_attribution_id UUID,
  p_date_fin DATE DEFAULT CURRENT_DATE,
  p_motif TEXT DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_nom TEXT;
  v_type_nom TEXT;
  v_quantite INTEGER;
BEGIN
  -- Récupérer infos avant modification
  SELECT 
    c.nom || ' ' || c.prenom,
    tp.type_nom,
    a.quantite
  INTO v_client_nom, v_type_nom, v_quantite
  FROM attributions a
  JOIN clients c ON c.id = a.client_id
  JOIN type_portes tp ON tp.id = a.type_porte_id
  WHERE a.id = p_attribution_id AND a.statut = 'actif';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Attribution introuvable ou déjà résiliée'
    );
  END IF;

  UPDATE attributions
    SET 
      statut = 'resilie', 
      date_fin = p_date_fin,
      notes = COALESCE(notes || E'\n', '') || 'Résilié le ' || p_date_fin || ': ' || COALESCE(p_motif, 'Non spécifié'),
      updated_at = now()
    WHERE id = p_attribution_id;

  RETURN json_build_object(
    'success', true,
    'attribution_id', p_attribution_id,
    'client', v_client_nom,
    'type', v_type_nom,
    'quantite_liberee', v_quantite,
    'message', format('Attribution résiliée : %s %s(s) libérée(s)', v_quantite, v_type_nom)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION resilier_attribution TO authenticated;

-- Fonction 3 : Modifier quantité d'une attribution
CREATE OR REPLACE FUNCTION modifier_quantite_attribution(
  p_attribution_id UUID,
  p_nouvelle_quantite INTEGER
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_quantite INTEGER;
  v_type_porte_id UUID;
  v_diff INTEGER;
  v_dispo INTEGER;
  v_client_nom TEXT;
  v_type_nom TEXT;
BEGIN
  -- Récupérer l'attribution actuelle
  SELECT 
    a.quantite, 
    a.type_porte_id,
    c.nom || ' ' || c.prenom,
    tp.type_nom,
    tp.quantite_disponible
  INTO v_old_quantite, v_type_porte_id, v_client_nom, v_type_nom, v_dispo
  FROM attributions a
  JOIN clients c ON c.id = a.client_id
  JOIN type_portes tp ON tp.id = a.type_porte_id
  WHERE a.id = p_attribution_id AND a.statut = 'actif';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Attribution introuvable ou inactive');
  END IF;

  v_diff := p_nouvelle_quantite - v_old_quantite;

  -- Si augmentation, vérifier stock
  IF v_diff > 0 THEN
    IF v_dispo < v_diff THEN
      RETURN json_build_object(
        'success', false,
        'error', format('Stock insuffisant : %s disponible(s), besoin de %s', v_dispo, v_diff),
        'disponible', v_dispo,
        'besoin', v_diff
      );
    END IF;
    -- Décrémenter le stock supplémentaire
    UPDATE type_portes 
      SET quantite_disponible = quantite_disponible - v_diff
      WHERE id = v_type_porte_id;
  ELSIF v_diff < 0 THEN
    -- Restituer le stock
    UPDATE type_portes 
      SET quantite_disponible = quantite_disponible + ABS(v_diff)
      WHERE id = v_type_porte_id;
  END IF;

  -- Mettre à jour l'attribution
  UPDATE attributions
    SET 
      quantite = p_nouvelle_quantite,
      montant_mensuel = (SELECT prix_mensuel FROM type_portes WHERE id = v_type_porte_id) * p_nouvelle_quantite,
      updated_at = now()
    WHERE id = p_attribution_id;

  RETURN json_build_object(
    'success', true,
    'ancienne_quantite', v_old_quantite,
    'nouvelle_quantite', p_nouvelle_quantite,
    'difference', v_diff,
    'client', v_client_nom,
    'type', v_type_nom,
    'message', format('Quantité modifiée : %s → %s %s(s)', v_old_quantite, p_nouvelle_quantite, v_type_nom)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION modifier_quantite_attribution TO authenticated;

-- Fonction 4 : Liste des portes disponibles pour attribution
CREATE OR REPLACE FUNCTION get_portes_disponibles(p_batiment_id UUID DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'type_porte_id', tp.id,
      'type_nom', tp.type_nom,
      'batiment_id', tp.batiment_id,
      'batiment_nom', b.nom,
      'prix_mensuel', tp.prix_mensuel,
      'surface_m2', tp.surface_m2,
      'quantite_disponible', tp.quantite_disponible,
      'quantite_totale', tp.quantite_totale,
      'disponible', tp.quantite_disponible > 0
    ) ORDER BY b.nom, tp.type_nom
  )
  INTO v_result
  FROM type_portes tp
  JOIN batiments b ON b.id = tp.batiment_id
  WHERE tp.quantite_disponible > 0
  AND (p_batiment_id IS NULL OR tp.batiment_id = p_batiment_id);

  RETURN json_build_object(
    'success', true,
    'data', COALESCE(v_result, '[]'::json),
    'count', COALESCE(json_array_length(v_result), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_portes_disponibles TO authenticated;

-- Fonction 5 : Résumé complet pour dashboard
CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_batiments INTEGER;
  v_total_portes INTEGER;
  v_portes_disponibles INTEGER;
  v_portes_attribuees INTEGER;
  v_total_clients INTEGER;
  v_clients_actifs INTEGER;
  v_revenu_mensuel_total NUMERIC;
BEGIN
  SELECT 
    COUNT(*),
    COALESCE(SUM(total_portes), 0)
  INTO v_total_batiments, v_total_portes
  FROM batiments;

  SELECT 
    COALESCE(SUM(quantite_disponible), 0),
    COALESCE(SUM(quantite_totale - quantite_disponible), 0)
  INTO v_portes_disponibles, v_portes_attribuees
  FROM type_portes;

  SELECT 
    COUNT(*),
    COUNT(DISTINCT a.client_id)
  INTO v_total_clients, v_clients_actifs
  FROM clients c
  LEFT JOIN attributions a ON a.client_id = c.id AND a.statut = 'actif';

  SELECT COALESCE(SUM(montant_mensuel), 0)
  INTO v_revenu_mensuel_total
  FROM attributions
  WHERE statut = 'actif';

  RETURN json_build_object(
    'success', true,
    'batiments', json_build_object(
      'total', v_total_batiments,
      'portes_totales', v_total_portes
    ),
    'portes', json_build_object(
      'total_definies', v_portes_disponibles + v_portes_attribuees,
      'disponibles', v_portes_disponibles,
      'attribuees', v_portes_attribuees,
      'taux_occupation', CASE 
        WHEN (v_portes_disponibles + v_portes_attribuees) = 0 THEN 0
        ELSE ROUND(v_portes_attribuees * 100.0 / (v_portes_disponibles + v_portes_attribuees), 2)
      END
    ),
    'clients', json_build_object(
      'total', v_total_clients,
      'avec_attribution', v_clients_actifs
    ),
    'financier', json_build_object(
      'revenu_mensuel_total', v_revenu_mensuel_total,
      'revenu_annuel_potentiel', v_revenu_mensuel_total * 12
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_summary TO authenticated;

-- Fonction 6 : Créer ou mettre à jour un type de porte
CREATE OR REPLACE FUNCTION upsert_type_porte(
  p_batiment_id UUID,
  p_type_nom TEXT,
  p_quantite_totale INTEGER,
  p_prix_mensuel NUMERIC,
  p_surface_m2 NUMERIC DEFAULT 0,
  p_description TEXT DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
  v_existant_id UUID;
  v_old_total INTEGER;
  v_old_dispo INTEGER;
BEGIN
  -- Vérifier si ce type existe déjà pour ce bâtiment
  SELECT id, quantite_totale, quantite_disponible
  INTO v_existant_id, v_old_total, v_old_dispo
  FROM type_portes
  WHERE batiment_id = p_batiment_id AND type_nom = p_type_nom;

  IF v_existant_id IS NOT NULL THEN
    -- Mise à jour
    UPDATE type_portes
      SET 
        quantite_totale = p_quantite_totale,
        quantite_disponible = p_quantite_totale - (v_old_total - v_old_dispo),
        prix_mensuel = p_prix_mensuel,
        surface_m2 = p_surface_m2,
        description = COALESCE(p_description, description),
        updated_at = now()
      WHERE id = v_existant_id
      RETURNING id INTO v_id;

    RETURN json_build_object(
      'success', true,
      'id', v_id,
      'action', 'updated',
      'type', p_type_nom,
      'message', format('Type %s mis à jour : %s portes', p_type_nom, p_quantite_totale)
    );
  ELSE
    -- Création
    INSERT INTO type_portes(
      batiment_id, type_nom, quantite_totale, quantite_disponible,
      prix_mensuel, surface_m2, description
    ) VALUES (
      p_batiment_id, p_type_nom, p_quantite_totale, p_quantite_totale,
      p_prix_mensuel, p_surface_m2, p_description
    ) RETURNING id INTO v_id;

    RETURN json_build_object(
      'success', true,
      'id', v_id,
      'action', 'created',
      'type', p_type_nom,
      'message', format('Type %s créé : %s portes', p_type_nom, p_quantite_totale)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_type_porte TO authenticated;

-- ================================================================
-- G) SÉCURITÉ RLS (Row Level Security)
-- ================================================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE type_portes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributions ENABLE ROW LEVEL SECURITY;

-- Politique pour type_portes : lecture pour tous auth
CREATE POLICY type_portes_select ON type_portes
  FOR SELECT TO authenticated USING (true);

-- Politique pour type_portes : modification admin/secretaire
CREATE POLICY type_portes_modify ON type_portes
  FOR ALL TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'SECRETAIRE', 'GERANT')
  ));

-- Politique pour attributions : lecture pour tous auth
CREATE POLICY attributions_select ON attributions
  FOR SELECT TO authenticated USING (true);

-- Politique pour attributions : modification admin/secretaire
CREATE POLICY attributions_modify ON attributions
  FOR ALL TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'SECRETAIRE', 'GERANT')
  ));

-- ================================================================
-- H) ACTIVER REALTIME
-- ================================================================

-- Ajouter tables à la publication realtime
ALTER PUBLICATION supabase_realtime ADD TABLE type_portes;
ALTER PUBLICATION supabase_realtime ADD TABLE attributions;

COMMENT ON PUBLICATION supabase_realtime IS 'Realtime pour toutes les tables critiques';

-- ================================================================
-- 🎉 MIGRATION TERMINÉE
-- ================================================================
SELECT 'Migration 001_portes_attributions_loyer terminée avec succès!' AS result;
