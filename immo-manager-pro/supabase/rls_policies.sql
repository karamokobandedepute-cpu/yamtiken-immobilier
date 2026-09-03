-- ============================================================
-- RLS POLICIES - Row Level Security pour Multi-Platform
-- Desktop (Electron) + Web (VPS) synchronisation sécurisée
-- ============================================================

-- Activer RLS sur toutes les tables critiques
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLITIQUE 1: Accès authentifié depuis n'importe quelle origine
-- Autorise Desktop (localhost) + Web (domaine VPS)
-- ============================================================

-- Politique pour SELECT (lecture)
CREATE POLICY "Authenticated users can read all data" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read all data" ON leases
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read all data" ON payments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Politique pour INSERT (création)
CREATE POLICY "Authenticated users can insert data" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert data" ON leases
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert data" ON payments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique pour UPDATE (modification)
CREATE POLICY "Authenticated users can update data" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update data" ON leases
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update data" ON payments
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Politique pour DELETE (suppression)
CREATE POLICY "Authenticated users can delete data" ON clients
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete data" ON leases
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete data" ON payments
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- POLITIQUE 2: Accès par rôle (Admin vs Agent)
-- ============================================================

-- Exemple: Seuls les admins peuvent supprimer
CREATE POLICY "Only admins can delete users" ON users
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'ADMIN'
    )
  );

-- Exemple: Agents ne peuvent voir que leurs propres commissions
CREATE POLICY "Agents see own commissions" ON commissions
  FOR SELECT USING (
    agent_id = auth.uid() OR 
    auth.uid() IN (SELECT id FROM users WHERE role = 'ADMIN')
  );

-- ============================================================
-- REALTIME - Activer la réplication pour les tables
-- ============================================================

-- Ajouter les tables à la publication supabase_realtime
BEGIN;
  -- D'abord, s'assurer que la publication existe
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END $$;

  -- Ajouter les tables à la publication
  ALTER PUBLICATION supabase_realtime ADD TABLE clients;
  ALTER PUBLICATION supabase_realtime ADD TABLE leases;
  ALTER PUBLICATION supabase_realtime ADD TABLE payments;
  ALTER PUBLICATION supabase_realtime ADD TABLE buildings;
  ALTER PUBLICATION supabase_realtime ADD TABLE users;
  ALTER PUBLICATION supabase_realtime ADD TABLE commissions;
  ALTER PUBLICATION supabase_realtime ADD TABLE visites;
  ALTER PUBLICATION supabase_realtime ADD TABLE contrats;
COMMIT;

-- ============================================================
-- FONCTION: Journalisation des changements
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at automatique
CREATE TRIGGER on_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_leases_updated
  BEFORE UPDATE ON leases
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ============================================================
-- INDEX: Optimisation pour Realtime
-- ============================================================

-- Index sur created_at pour le tri temps réel
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leases_created_at ON leases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Index sur les clés étrangères pour les jointures rapides
CREATE INDEX IF NOT EXISTS idx_leases_client_id ON leases(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_lease_id ON payments(lease_id);
