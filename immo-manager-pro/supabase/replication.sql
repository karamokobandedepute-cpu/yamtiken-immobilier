-- ============================================================
-- ACTIVATION REALTIME SUR TOUTES LES TABLES
-- YAMTIKEN CRM - Supabase Realtime Configuration
-- ============================================================

-- ============================================================
-- ÉTAPE 1 : ACTIVER REPLICA IDENTITY FULL
-- Nécessaire pour que Supabase Realtime envoie toutes les données
-- ============================================================

-- Tables principales
ALTER TABLE clients REPLICA IDENTITY FULL;
ALTER TABLE buildings REPLICA IDENTITY FULL;
ALTER TABLE unites REPLICA IDENTITY FULL;
ALTER TABLE leases REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;
ALTER TABLE biens REPLICA IDENTITY FULL;
ALTER TABLE visites REPLICA IDENTITY FULL;
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE commissions REPLICA IDENTITY FULL;
ALTER TABLE referrers REPLICA IDENTITY FULL;
ALTER TABLE contrats REPLICA IDENTITY FULL;
ALTER TABLE alertes REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Tables annexes
ALTER TABLE audit_logs REPLICA IDENTITY FULL;
ALTER TABLE historique_modifications REPLICA IDENTITY FULL;
ALTER TABLE fournisseurs REPLICA IDENTITY FULL;
ALTER TABLE bons_commande REPLICA IDENTITY FULL;
ALTER TABLE factures_fournisseurs REPLICA IDENTITY FULL;
ALTER TABLE mouvements_stock REPLICA IDENTITY FULL;

-- ============================================================
-- ÉTAPE 2 : PUBLICATION SUPABASE REALTIME
-- Ajoute les tables à la publication pour le realtime
-- ============================================================

-- Supprimer la publication existante si elle existe
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Créer une nouvelle publication pour toutes les tables
CREATE PUBLICATION supabase_realtime FOR TABLE 
  clients,
  buildings,
  unites,
  leases,
  payments,
  biens,
  visites,
  users,
  commissions,
  referrers,
  contrats,
  alertes,
  notifications,
  audit_logs,
  historique_modifications,
  fournisseurs,
  bons_commande,
  factures_fournisseurs,
  mouvements_stock;

-- Alternative : publication pour TOUTES les tables (option plus simple)
-- CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

-- ============================================================
-- ÉTAPE 3 : CONFIGURATION ADDITIONNELLE
-- ============================================================

-- Vérifier que le slot de réplication est actif
SELECT * FROM pg_replication_slots WHERE slot_name LIKE 'supabase_realtime%';

-- Vérifier la configuration WAL
SHOW wal_level;  -- Doit être 'logical'
SHOW max_replication_slots;  -- Doit être >= 10
SHOW max_wal_senders;  -- Doit être >= 10

-- ============================================================
-- ÉTAPE 4 : VÉRIFICATION
-- ============================================================

-- Vérifier les tables avec replica identity
SELECT 
  schemaname,
  tablename,
  relreplident
FROM pg_tables
JOIN pg_class ON pg_class.relname = pg_tables.tablename
WHERE schemaname = 'public'
AND tablename IN (
  'clients', 'buildings', 'unites', 'leases', 'payments',
  'biens', 'visites', 'users', 'commissions', 'referrers',
  'contrats', 'alertes', 'notifications'
);

-- ============================================================
-- ÉTAPE 5 : TEST REALTIME (optionnel - à exécuter après configuration)
-- ============================================================

-- Insérer un test pour vérifier le realtime
-- INSERT INTO clients (nom, prenom, type, email) 
-- VALUES ('TEST', 'Realtime', 'CLIENT', 'test.realtime@example.com');

-- Supprimer le test
-- DELETE FROM clients WHERE email = 'test.realtime@example.com';

-- ============================================================
-- NOTES IMPORTANTES
-- ============================================================

/*
1. REPLICA IDENTITY FULL : Envoie TOUTES les colonnes lors des changements
   - Nécessaire pour que le client reçoive les données complètes
   - Augmente légèrement la taille des messages WAL

2. PUBLICATION : Définit quelles tables sont surveillées par realtime
   - Sans publication, aucun changement n'est envoyé
   - On peut utiliser FOR ALL TABLES pour tout surveiller

3. Permissions : L'utilisateur supabase_admin doit avoir les droits
   - SELECT sur toutes les tables
   - REPLICATION privilege

4. Performance : Surveiller uniquement les tables nécessaires
   - Trop de tables = surcharge du réseau
   - Privilégier les tables critiques pour l'UI

5. Tables critiques pour le realtime :
   - clients (affichage liste clients)
   - leases (tableau de bord baux)
   - payments (paiements temps réel)
   - visites (calendrier visites)
   - alertes (notifications instantanées)
*/
