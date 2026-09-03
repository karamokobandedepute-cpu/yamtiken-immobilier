import { z } from 'zod';

// ============================================
// SCHÉMAS DE VALIDATION - IMMO MANAGER PRO
// ============================================

// --- Helpers ---
const positiveFloat = z.number().positive({ message: 'Le montant doit être positif' });
const futureDate = z.string().datetime({ message: 'Date invalide' }).refine(
  d => new Date(d) > new Date(), { message: 'La date doit être dans le futur' }
);
const optionalDate = z.string().datetime({ message: 'Date invalide' }).optional();
const fcfa = z.number().min(0, { message: 'Le montant ne peut pas être négatif' });

// ============================================
// PAYMENT (Nouveau modèle baux/paiements)
// ============================================
export const createPaymentSchema = z.object({
  leaseId: z.number().int().positive({ message: 'ID bail invalide' }),
  montantVerse: fcfa.max(50000000, { message: 'Montant max: 50 000 000 FCFA' }),
  datePaiement: z.string().datetime({ message: 'Date de paiement invalide' }).optional(),
  modePaiement: z.enum(['ESPECES', 'VIREMENT', 'MOBILE_MONEY', 'CHEQUE'], {
    message: 'Mode de paiement invalide'
  }).default('ESPECES'),
  notes: z.string().max(500, { message: 'Notes max 500 caractères' }).optional()
}).strict(); // Rejette les champs inconnus

export const updatePaymentSchema = z.object({
  montantVerse: fcfa.max(50000000).optional(),
  modePaiement: z.enum(['ESPECES', 'VIREMENT', 'MOBILE_MONEY', 'CHEQUE']).optional(),
  notes: z.string().max(500).optional()
}).strict();

// ============================================
// LEASE (Bail)
// ============================================
export const createLeaseSchema = z.object({
  clientId: z.number().int().positive({ message: 'ID client invalide' }),
  uniteId: z.number().int().positive({ message: 'ID unité invalide' }).optional(),
  buildingId: z.number().int().positive({ message: 'ID immeuble invalide' }).optional(),
  bienId: z.number().int().positive({ message: 'ID bien invalide' }).optional(),
  montantInitial: fcfa.max(100000000, { message: 'Montant max: 100 000 000 FCFA' }),
  montantLoyer: fcfa.max(10000000).optional(),
  caution: fcfa.max(50000000).optional(),
  droitsTerre: fcfa.max(1000000).optional(),
  chargesAnnexes: fcfa.max(1000000).optional(),
  dateDebut: z.string().min(1, { message: 'Date de début requise' }),
  dateFin: z.string().optional(),
  statut: z.enum(['actif', 'en_cours', 'expire', 'resilie', 'ACTIF', 'TERMINE', 'RESILIE']).default('en_cours'),
  notes: z.string().max(1000).optional()
}).refine(
  data => !data.dateFin || new Date(data.dateFin) > new Date(data.dateDebut),
  { message: 'La date de fin doit être après la date de début', path: ['dateFin'] }
);

export const updateLeaseSchema = z.object({
  montantInitial: fcfa.max(100000000).optional(),
  caution: fcfa.max(50000000).optional(),
  dateFin: z.string().datetime().optional(),
  statut: z.enum(['ACTIF', 'TERMINE', 'RESILIE']).optional()
}).strict();

// ============================================
// CLIENT
// ============================================
export const createClientSchema = z.object({
  type: z.enum(['SOUSCRIPTEUR', 'CLIENT']).default('CLIENT'),
  nom: z.string().min(2, { message: 'Nom min 2 caractères' }).max(50),
  prenom: z.string().min(2, { message: 'Prénom min 2 caractères' }).max(50),
  telephone: z.string().min(8, { message: 'Téléphone min 8 caractères' }).max(20),
  telephone2: z.string().max(20).optional(),
  email: z.string().email({ message: 'Email invalide' }).optional().or(z.literal('')),
  adresse: z.string().max(200).optional(),
  profession: z.string().max(100).optional(),
  numeroPiece: z.string().max(50).optional(),
  temoinId: z.number().int().positive().optional()
}).strict();

// ============================================
// BUILDING
// ============================================
export const createBuildingSchema = z.object({
  nom: z.string().min(2, { message: 'Nom min 2 caractères' }).max(100),
  type: z.enum(['R2', 'R3', 'R4', 'VILLA', 'COUR_COMMUNE'], { message: 'Type invalide' }),
  adresse: z.string().min(5, { message: 'Adresse min 5 caractères' }).max(200),
  commune: z.string().min(2).max(100),
  ville: z.string().max(100).default('Abidjan'),
  nombreEtages: z.number().int().min(1).max(20).default(1),
  valeurEstimee: fcfa.optional(),
  droitsTerre: z.string().max(100).optional(),
  chargesAnnexes: fcfa.optional(),
  notes: z.string().max(500).optional()
}).strict();

// ============================================
// UNITE
// ============================================
export const createUniteSchema = z.object({
  numeroPorte: z.string().min(1).max(20),
  typeUnite: z.enum(['STUDIO', 'CHAMBRE', 'CHAMBRE_SALON', 'MAGASIN'], { message: 'Type invalide' }),
  etage: z.number().int().min(0).max(20).default(0),
  loyerBase: fcfa.min(10000, { message: 'Loyer min 10 000 FCFA' }).max(5000000),
  buildingId: z.number().int().positive()
}).strict();

// ============================================
// REFERRER (Apporteur)
// ============================================
export const createReferrerSchema = z.object({
  nom: z.string().min(2).max(50),
  prenom: z.string().min(2).max(50),
  contact: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal('')),
  adresse: z.string().max(200).optional(),
  tauxCommission: z.number().min(0).max(100, { message: 'Taux max 100%' }),
  typeCommission: z.enum(['FIXE', 'POURCENTAGE']).default('POURCENTAGE')
}).strict();

// ============================================
// VISITE
// ============================================
export const createVisiteSchema = z.object({
  nomVisiteur: z.string().min(2).max(50),
  prenomVisiteur: z.string().min(2).max(50),
  contact: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal('')),
  bienVisiteId: z.number().int().positive(),
  motif: z.enum(['DECOUVERTE', 'NEGOCIATION', 'RECLAMATION', 'AUTRE']).default('DECOUVERTE'),
  responsable: z.string().max(100).optional(),
  compteRendu: z.string().max(2000).optional(),
  relanceSouhait: z.boolean().default(false),
  dateRelance: z.string().datetime().optional()
}).strict();

// ============================================
// AUTH (Login)
// ============================================
// Politique de mot de passe renforcée
const strongPassword = z.string()
  .min(8, { message: 'Minimum 8 caractères' })
  .regex(/[A-Z]/, { message: 'Au moins une majuscule requise' })
  .regex(/[0-9]/, { message: 'Au moins un chiffre requis' })
  .regex(/[^A-Za-z0-9]/, { message: 'Au moins un caractère spécial requis' });

export const loginSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(4, { message: 'Mot de passe min 4 caractères' })
}).strict();

// Schéma pour changement/création de mot de passe (politique forte)
export const passwordSchema = strongPassword;

// ============================================
// PAGINATION (query params)
// ============================================
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort: z.enum(['asc', 'desc']).default('desc')
});
