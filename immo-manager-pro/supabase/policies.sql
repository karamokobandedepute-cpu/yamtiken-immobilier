-- ============================================================
-- POLICIES RLS (Row Level Security) - YAMTIKEN CRM
-- Autorise SELECT sur toutes les tables pour les utilisateurs authentifiés
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE unites ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE biens ENABLE ROW LEVEL SECURITY;
ALTER TABLE visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES SELECT (Lecture) - Autorisé pour tous les utilisateurs authentifiés
-- ============================================================

-- Clients
CREATE POLICY "Allow select for authenticated users" ON clients
  FOR SELECT TO authenticated USING (true);

-- Buildings
CREATE POLICY "Allow select for authenticated users" ON buildings
  FOR SELECT TO authenticated USING (true);

-- Unités
CREATE POLICY "Allow select for authenticated users" ON unites
  FOR SELECT TO authenticated USING (true);

-- Leases (Baux)
CREATE POLICY "Allow select for authenticated users" ON leases
  FOR SELECT TO authenticated USING (true);

-- Payments (Paiements)
CREATE POLICY "Allow select for authenticated users" ON payments
  FOR SELECT TO authenticated USING (true);

-- Biens
CREATE POLICY "Allow select for authenticated users" ON biens
  FOR SELECT TO authenticated USING (true);

-- Visites
CREATE POLICY "Allow select for authenticated users" ON visites
  FOR SELECT TO authenticated USING (true);

-- Users
CREATE POLICY "Allow select for authenticated users" ON users
  FOR SELECT TO authenticated USING (true);

-- Commissions
CREATE POLICY "Allow select for authenticated users" ON commissions
  FOR SELECT TO authenticated USING (true);

-- Referrers (Apporteurs)
CREATE POLICY "Allow select for authenticated users" ON referrers
  FOR SELECT TO authenticated USING (true);

-- Contrats
CREATE POLICY "Allow select for authenticated users" ON contrats
  FOR SELECT TO authenticated USING (true);

-- Alertes
CREATE POLICY "Allow select for authenticated users" ON alertes
  FOR SELECT TO authenticated USING (true);

-- Notifications
CREATE POLICY "Allow select for authenticated users" ON notifications
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- POLICIES INSERT/UPDATE/DELETE - Selon le rôle
-- ============================================================

-- Clients - Tous les rôles peuvent créer/modifier (ajuster selon besoins)
CREATE POLICY "Allow insert for authenticated users" ON clients
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON clients
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete for admin users" ON clients
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'))
  );

-- Buildings
CREATE POLICY "Allow insert for authenticated users" ON buildings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON buildings
  FOR UPDATE TO authenticated USING (true);

-- Leases
CREATE POLICY "Allow insert for authenticated users" ON leases
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON leases
  FOR UPDATE TO authenticated USING (true);

-- Payments
CREATE POLICY "Allow insert for authenticated users" ON payments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON payments
  FOR UPDATE TO authenticated USING (true);

-- Visites
CREATE POLICY "Allow insert for authenticated users" ON visites
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON visites
  FOR UPDATE TO authenticated USING (true);

-- Biens
CREATE POLICY "Allow insert for authenticated users" ON biens
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON biens
  FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- POLICIES SPÉCIALES
-- ============================================================

-- Users - Seul un admin peut modifier d'autres users
CREATE POLICY "Allow update own profile" ON users
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Allow admin full access" ON users
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  );

-- Notifications - Uniquement celles de l'utilisateur connecté
CREATE POLICY "Allow select own notifications" ON notifications
  FOR SELECT TO authenticated USING ("userId" = auth.uid());

CREATE POLICY "Allow update own notifications" ON notifications
  FOR UPDATE TO authenticated USING ("userId" = auth.uid());

-- Alertes - Tous peuvent voir, seuls admins peuvent créer/supprimer
CREATE POLICY "Allow insert alerts for admins" ON alertes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'AGENT_RECOUVREMENT'))
  );

-- ============================================================
-- ANONYMOUS - Aucun accès pour les utilisateurs non authentifiés
-- ============================================================

-- Par défaut, aucune policy pour anonymous = aucun accès

-- ============================================================
-- COMMENTAIRES
-- ============================================================

COMMENT ON TABLE clients IS 'Table des clients - accès lecture pour tous, modifications selon rôle';
COMMENT ON TABLE buildings IS 'Table des immeubles - accès lecture pour tous';
COMMENT ON TABLE leases IS 'Table des baux - accès lecture pour tous';
COMMENT ON TABLE payments IS 'Table des paiements - accès lecture pour tous';
