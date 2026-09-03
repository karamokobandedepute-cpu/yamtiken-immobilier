-- Migration manuelle : Ajout des colonnes isDemo manquantes
-- À exécuter directement dans l'interface Supabase SQL Editor

-- 1. Ajouter isDemo à la table unites si elle n'existe pas
ALTER TABLE unites 
ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- 2. Ajouter isDemo à la table buildings si elle n'existe pas
ALTER TABLE buildings 
ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- 3. Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('unites', 'buildings')
AND column_name = 'isDemo';
