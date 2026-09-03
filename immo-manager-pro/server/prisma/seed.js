import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================
// UTILITAIRES
// ============================================
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[randomInt(0, arr.length - 1)];
const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

async function main() {
  console.log('🌱 Démarrage du seed IMMO MANAGER PRO...');

  // ============================================
  // 1. UTILISATEURS (non-demo, persistants)
  // ============================================
  const users = [
    { email: 'munokolive@gmail.com', password: '77916407@@Mu', nom: 'BEHEMOTH', prenom: 'SuperAdmin', telephone: '+225 0777916407', role: 'SUPER_ADMIN' },
    { email: 'secretaire@yamtiken.com', password: '77916407@@Mu', nom: 'YAMTIKEN', prenom: 'Secrétaire', telephone: '+225 01 02 03 05', role: 'SECRETAIRE' },
    { email: 'recouvrement@yamtiken.com', password: '77916407@@Mu', nom: 'YAMTIKEN', prenom: 'Recouvrement', telephone: '+225 01 02 03 06', role: 'AGENT_RECOUVREMENT' },
    { email: 'direction@yamtiken.com', password: '77916407@@Mu', nom: 'BEHEMOTH', prenom: 'Direction', telephone: '+225 01 02 03 07', role: 'DIRECTION' }
  ];

  const createdUsers = {};
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashed, nom: u.nom, prenom: u.prenom, telephone: u.telephone, role: u.role },
      create: { ...u, password: hashed }
    });
    createdUsers[u.role] = created;
    console.log(`✅ Utilisateur: ${u.prenom} (${u.role})`);
  }

  // Vérifier si données demo existent déjà
  const existingDemo = await prisma.building.count({ where: { isDemo: true } });
  if (existingDemo > 0) {
    console.log('⏭️  Données démo déjà présentes, skip...');
    console.log('✨ Seed terminé !');
    return;
  }

  // ============================================
  // 2. 4 IMMEUBLES FICTIFS
  // ============================================
  console.log('\n🏗️  Création des immeubles fictifs...');

  const buildingsData = [
    { nom: 'Immeuble Alpha', type: 'R3', adresse: 'Cocody Riviera 2', commune: 'Cocody', ville: 'Abidjan', nombreEtages: 3, valeurEstimee: 50000000, droitsTerre: '240000 FCFA/an', chargesAnnexes: 50000, notes: 'Immeuble R+3 avec 12 unités', isDemo: true },
    { nom: 'Résidence Bella', type: 'R2', adresse: 'Yopougon Siporex', commune: 'Yopougon', ville: 'Abidjan', nombreEtages: 2, valeurEstimee: 30000000, droitsTerre: '160000 FCFA/an', chargesAnnexes: 35000, notes: 'Résidence R+2 avec 8 unités', isDemo: true },
    { nom: 'Villa Soleil', type: 'VILLA', adresse: 'Bingerville Route du Nord', commune: 'Bingerville', ville: 'Bingerville', nombreEtages: 1, valeurEstimee: 25000000, droitsTerre: '120000 FCFA/an', chargesAnnexes: 20000, notes: 'Villa individuelle', isDemo: true },
    { nom: 'Cour Konan', type: 'COUR_COMMUNE', adresse: 'Adjamé Roxy', commune: 'Adjamé', ville: 'Abidjan', nombreEtages: 1, valeurEstimee: 15000000, droitsTerre: '100000 FCFA/an', chargesAnnexes: 25000, notes: 'Cour commune avec 6 unités', isDemo: true }
  ];

  const buildings = {};
  for (const bd of buildingsData) {
    const b = await prisma.building.create({ data: bd });
    buildings[bd.nom] = b;
    console.log(`✅ Immeuble: ${bd.nom}`);
  }

  // ============================================
  // 3. UNITÉS (12 + 8 + 1 + 6 = 27)
  // ============================================
  console.log('\n🏠 Création des unités...');

  const unitesData = {
    'Immeuble Alpha': [
      { numeroPorte: 'A1', typeUnite: 'STUDIO', etage: 0, loyerBase: 150000 },
      { numeroPorte: 'A2', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 80000 },
      { numeroPorte: 'A3', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 80000 },
      { numeroPorte: 'B1', typeUnite: 'CHAMBRE_SALON', etage: 1, loyerBase: 120000 },
      { numeroPorte: 'B2', typeUnite: 'CHAMBRE_SALON', etage: 1, loyerBase: 120000 },
      { numeroPorte: 'B3', typeUnite: 'CHAMBRE', etage: 1, loyerBase: 85000 },
      { numeroPorte: 'C1', typeUnite: 'CHAMBRE_SALON', etage: 2, loyerBase: 130000 },
      { numeroPorte: 'C2', typeUnite: 'CHAMBRE_SALON', etage: 2, loyerBase: 130000 },
      { numeroPorte: 'C3', typeUnite: 'CHAMBRE', etage: 2, loyerBase: 80000 },
      { numeroPorte: 'RDC1', typeUnite: 'MAGASIN', etage: 0, loyerBase: 200000 },
      { numeroPorte: 'RDC2', typeUnite: 'MAGASIN', etage: 0, loyerBase: 180000 },
      { numeroPorte: 'RDC3', typeUnite: 'STUDIO', etage: 0, loyerBase: 140000 }
    ],
    'Résidence Bella': [
      { numeroPorte: '1A', typeUnite: 'CHAMBRE_SALON', etage: 0, loyerBase: 110000 },
      { numeroPorte: '1B', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 75000 },
      { numeroPorte: '1C', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 75000 },
      { numeroPorte: '2A', typeUnite: 'CHAMBRE_SALON', etage: 1, loyerBase: 115000 },
      { numeroPorte: '2B', typeUnite: 'CHAMBRE', etage: 1, loyerBase: 78000 },
      { numeroPorte: '2C', typeUnite: 'CHAMBRE', etage: 1, loyerBase: 78000 },
      { numeroPorte: 'MAG1', typeUnite: 'MAGASIN', etage: 0, loyerBase: 175000 },
      { numeroPorte: 'MAG2', typeUnite: 'MAGASIN', etage: 0, loyerBase: 170000 }
    ],
    'Villa Soleil': [
      { numeroPorte: 'V1', typeUnite: 'CHAMBRE_SALON', etage: 0, loyerBase: 250000 }
    ],
    'Cour Konan': [
      { numeroPorte: 'K1', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 60000 },
      { numeroPorte: 'K2', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 60000 },
      { numeroPorte: 'K3', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 65000 },
      { numeroPorte: 'K4', typeUnite: 'CHAMBRE_SALON', etage: 0, loyerBase: 90000 },
      { numeroPorte: 'K5', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 55000 },
      { numeroPorte: 'K6', typeUnite: 'CHAMBRE', etage: 0, loyerBase: 55000 }
    ]
  };

  const allUnites = [];
  for (const [buildingNom, unites] of Object.entries(unitesData)) {
    const building = buildings[buildingNom];
    for (const u of unites) {
      const unite = await prisma.unite.create({
        data: { ...u, buildingId: building.id, isDemo: true }
      });
      allUnites.push({ ...unite, id: unite.id, buildingNom });
    }
    console.log(`✅ ${unites.length} unités pour ${buildingNom}`);
  }

  // ============================================
  // 4. 5 APPORTEURS FICTIFS
  // ============================================
  console.log('\n🤝 Création des apporteurs fictifs...');

  const referrersData = [
    { nom: 'DIALLO', prenom: 'Mamadou', contact: '+225 07 11 22 33', email: 'diallo.m@email.com', adresse: 'Cocody', tauxCommission: 5, typeCommission: 'POURCENTAGE', isDemo: true },
    { nom: 'KONÉ', prenom: 'Aminata', contact: '+225 05 44 55 66', email: 'kone.a@email.com', adresse: 'Plateau', tauxCommission: 10000, typeCommission: 'FIXE', isDemo: true },
    { nom: 'BAMBA', prenom: 'Seydou', contact: '+225 01 77 88 99', email: 'bamba.s@email.com', adresse: 'Yopougon', tauxCommission: 3, typeCommission: 'POURCENTAGE', isDemo: true },
    { nom: 'YAO', prenom: 'Adjoua', contact: '+225 07 22 33 44', email: 'yao.a@email.com', adresse: 'Marcory', tauxCommission: 15000, typeCommission: 'FIXE', isDemo: true },
    { nom: 'TOURÉ', prenom: 'Ibrahim', contact: '+225 05 55 66 77', email: 'touree.i@email.com', adresse: 'Adjamé', tauxCommission: 4, typeCommission: 'POURCENTAGE', isDemo: true }
  ];

  const referrers = [];
  for (const rd of referrersData) {
    const r = await prisma.referrer.create({ data: rd });
    referrers.push(r);
    console.log(`✅ Apporteur: ${rd.prenom} ${rd.nom}`);
  }

  // ============================================
  // 5. 10 CLIENTS FICTIFS
  // ============================================
  console.log('\n👥 Création des clients fictifs...');

  const clientsData = [
    { nom: 'KOUASSI', prenom: 'Amédée', telephone: '+225 07 11 22 33 44', email: 'amedee.k@email.com', adresse: 'Cocody Riviera', numeroPiece: 'DEMO-CI-001', profession: 'Commerçant', type: 'CLIENT', temoinId: referrers[0].id, isDemo: true },
    { nom: 'BAMBA', prenom: 'Fatoumata', telephone: '+225 05 22 33 44 55', email: 'fatou.b@email.com', adresse: 'Yopougon', numeroPiece: 'DEMO-CI-002', profession: 'Coiffeuse', type: 'CLIENT', temoinId: referrers[1].id, isDemo: true },
    { nom: 'TRA', prenom: 'Bi Emmanuel', telephone: '+225 01 33 44 55 66', email: 'tra.e@email.com', adresse: 'Cocody Angré', numeroPiece: 'DEMO-CI-003', profession: 'Enseignant', type: 'CLIENT', temoinId: referrers[2].id, isDemo: true },
    { nom: 'KONÉ', prenom: 'Mariam', telephone: '+225 07 44 55 66 77', email: 'kone.m@email.com', adresse: 'Adjamé', numeroPiece: 'DEMO-CI-004', profession: 'Ménagère', type: 'CLIENT', temoinId: referrers[3].id, isDemo: true },
    { nom: 'OUATTARA', prenom: 'Alassane', telephone: '+225 05 55 66 77 88', email: 'ouattara.a@email.com', adresse: 'Plateau', numeroPiece: 'DEMO-CI-005', profession: 'Informaticien', type: 'SOUSCRIPTEUR', temoinId: referrers[4].id, isDemo: true },
    { nom: 'COULIBALY', prenom: 'Awa', telephone: '+225 01 66 77 88 99', email: 'coulibaly.a@email.com', adresse: 'Marcory', numeroPiece: 'DEMO-CI-006', profession: 'Sage-femme', type: 'CLIENT', temoinId: referrers[0].id, isDemo: true },
    { nom: 'DIABATÉ', prenom: 'Moussa', telephone: '+225 07 77 88 99 00', email: 'diabate.m@email.com', adresse: 'Bingerville', numeroPiece: 'DEMO-CI-007', profession: 'Chauffeur', type: 'CLIENT', temoinId: referrers[1].id, isDemo: true },
    { nom: 'YAO', prenom: 'Koffi', telephone: '+225 05 88 99 00 11', email: 'yao.k@email.com', adresse: 'Cocody Riviera', numeroPiece: 'DEMO-CI-008', profession: 'Mécanicien', type: 'CLIENT', temoinId: referrers[2].id, isDemo: true },
    { nom: 'SANOGO', prenom: 'Fatou', telephone: '+225 01 99 00 11 22', email: 'sanogo.f@email.com', adresse: 'Yopougon', numeroPiece: 'DEMO-CI-009', profession: 'Couturière', type: 'CLIENT', temoinId: referrers[3].id, isDemo: true },
    { nom: 'CAMARA', prenom: 'Ibrahim', telephone: '+225 07 00 11 22 33', email: 'camara.i@email.com', adresse: 'Adjamé', numeroPiece: 'DEMO-CI-010', profession: 'Tailleur', type: 'SOUSCRIPTEUR', temoinId: referrers[4].id, isDemo: true }
  ];

  const clients = [];
  for (const cd of clientsData) {
    const c = await prisma.client.create({ data: cd });
    clients.push(c);
    console.log(`✅ Client: ${cd.prenom} ${cd.nom}`);
  }

  // ============================================
  // 6. BAUX (Leases) — 10 clients, 10 unités occupées
  // ============================================
  console.log('\n📝 Création des baux fictifs...');

  const leaseAssignments = [
    { clientIdx: 0, uniteIdx: 0, loyer: 150000 },   // KOUASSI → Studio A1
    { clientIdx: 1, uniteIdx: 9, loyer: 200000 },   // BAMBA F → Magasin RDC1
    { clientIdx: 2, uniteIdx: 4, loyer: 120000 },   // TRA → Chambre-Salon B2
    { clientIdx: 3, uniteIdx: 8, loyer: 80000 },    // KONÉ M → Chambre C3
    { clientIdx: 4, uniteIdx: 20, loyer: 250000 },  // OUATTARA → Villa V1
    { clientIdx: 5, uniteIdx: 13, loyer: 75000 },   // COULIBALY → Chambre 1B Bella
    { clientIdx: 6, uniteIdx: 21, loyer: 60000 },    // DIABATÉ → Chambre K1
    { clientIdx: 7, uniteIdx: 6, loyer: 130000 },    // YAO K → Chambre-Salon C1
    { clientIdx: 8, uniteIdx: 14, loyer: 78000 },    // SANOGO → Chambre 2B Bella
    { clientIdx: 9, uniteIdx: 23, loyer: 90000 }     // CAMARA → Chambre-Salon K4
  ];

  const adminUser = createdUsers['SUPER_ADMIN'];
  const leases = [];

  for (let i = 0; i < leaseAssignments.length; i++) {
    const la = leaseAssignments[i];
    const client = clients[la.clientIdx];
    const unite = allUnites[la.uniteIdx];
    const building = buildings[unite.buildingNom];
    const montantTotal = la.loyer * 12; // Bail annuel

    const lease = await prisma.lease.create({
      data: {
        numeroBail: `BAIL-2026-${String(i + 1).padStart(5, '0')}`,
        clientId: client.id,
        uniteId: unite.id,
        buildingId: building.id,
        montantInitial: montantTotal,
        caution: la.loyer * 2,
        droitsTerre: parseFloat(building.droitsTerre) || 0,
        chargesAnnexes: building.chargesAnnexes || 0,
        dateSignature: monthsAgo(6),
        dateDebut: monthsAgo(6),
        dateFin: new Date(new Date().getFullYear() + 1, 5, 30),
        statut: 'ACTIF'
        // ⚡ FIX Bug #7: isDemo retiré — champ absent du schéma Prisma Lease
      }
    });

    // Marquer l'unité comme occupée
    await prisma.unite.update({
      where: { id: unite.id },
      data: { statut: 'OCCUPE' }
    });

    leases.push({ ...la, lease, loyer: la.loyer });
    console.log(`✅ Bail: ${client.prenom} ${client.nom} → ${unite.numeroPorte} (${la.loyer} FCFA/mois)`);
  }

  // ============================================
  // 7. PAIEMENTS — 6 mois × 10 clients = 60 paiements
  // ============================================
  console.log('\n💰 Création des paiements fictifs...');

  const modes = ['ESPECES', 'VIREMENT', 'MOBILE_MONEY'];
  let paymentCount = 0;

  for (const ls of leases) {
    const monthsPaid = ls.clientIdx < 4
      ? [5, 4]  // 2 mois payés sur 6
      : ls.clientIdx < 7
        ? [5, 4, 3]  // 3 mois
        : [5, 4, 3, 2, 1]; // 5 mois

    for (const m of monthsPaid) {
      paymentCount++;
      await prisma.payment.create({
        data: {
          numeroFacture: `FAC-2026-${String(paymentCount).padStart(5, '0')}`,
          leaseId: ls.lease.id,
          datePaiement: monthsAgo(m),
          montantVerse: ls.loyer,
          modePaiement: randomItem(modes),
          agentId: adminUser.id,
          notes: `Loyer mois ${6 - m + 1}`,
          isDemo: true
        }
      });
    }
  }
  console.log(`✅ ${paymentCount} paiements créés`);

  // ============================================
  // 8. BIENS (créés AVANT les visites pour la FK)
  // ============================================
  console.log('\n🏠 Création des biens fictifs...');
  const firstClient = clients[0];
  const biensDemo = [
    { reference: 'DEMO-BIEN-001', titre: 'Immeuble Alpha - Cocody', type: 'APPARTEMENT', statut: 'LOUE', adresse: 'Cocody Riviera 2', ville: 'Abidjan', quartier: 'Riviera', surface: 120, nbPieces: 3, prixLocation: 150000, proprietaireId: firstClient.id },
    { reference: 'DEMO-BIEN-002', titre: 'Résidence Bella - Yopougon', type: 'APPARTEMENT', statut: 'LOUE', adresse: 'Yopougon Siporex', ville: 'Abidjan', quartier: 'Siporex', surface: 80, nbPieces: 2, prixLocation: 110000, proprietaireId: firstClient.id },
    { reference: 'DEMO-BIEN-003', titre: 'Villa Soleil - Bingerville', type: 'VILLA', statut: 'LOUE', adresse: 'Bingerville Route du Nord', ville: 'Bingerville', quartier: 'Centre', surface: 250, nbPieces: 5, prixLocation: 250000, proprietaireId: firstClient.id }
  ];
  const biens = [];
  for (const bd of biensDemo) {
    const existing = await prisma.bien.findUnique({ where: { reference: bd.reference } });
    const b = existing || await prisma.bien.create({ data: bd });
    biens.push(b);
  }
  console.log(`✅ ${biens.length} biens créés`);

  // ============================================
  // 9. COMMISSIONS pour les apporteurs
  // ============================================
  console.log('\n💵 Création des commissions fictives...');

  for (let i = 0; i < 5; i++) {
    const referrer = referrers[i];
    const client = clients[i];
    const lease = leases[i].lease;
    const montant = referrer.typeCommission === 'POURCENTAGE'
      ? Math.round(lease.montantInitial * referrer.tauxCommission / 100)
      : referrer.tauxCommission;

    // Commission payée
    await prisma.commission.create({
      data: {
        referrerId: referrer.id,
        clientId: client.id,
        montant,
        datePaiement: monthsAgo(3),
        statut: 'PAYEE',
        description: `Commission apport client ${client.prenom} ${client.nom}`,
        isDemo: true
      }
    });

    // Commission en attente
    await prisma.commission.create({
      data: {
        referrerId: referrer.id,
        clientId: clients[i + 5]?.id || client.id,
        montant: Math.round(montant * 0.8),
        statut: 'EN_ATTENTE',
        description: `Commission en attente - nouveau client`,
        isDemo: true
      }
    });
  }
  console.log(`✅ 10 commissions créées (5 payées + 5 en attente)`);

  // ============================================
  // 10. 8 VISITES FICTIVES (biens créés au step 8)
  // ============================================
  console.log('\n👀 Création des visites fictives...');

  const visitesData = [
    { nomVisiteur: 'AKA', prenomVisiteur: 'Jean-Marc', contact: '+225 07 12 34 56', email: 'aka.jm@email.com', bienVisiteId: biens[0].id, motif: 'DECOUVERTE', responsable: 'Agent Diallo', compteRendu: 'Client intéressé par le studio A1', relanceSouhait: true, dateRelance: new Date(Date.now() + 7 * 24 * 3600000), statutRelance: 'EN_ATTENTE', isDemo: true },
    { nomVisiteur: 'DOKO', prenomVisiteur: 'Aminata', contact: '+225 05 23 45 67', email: 'doko.a@email.com', bienVisiteId: biens[0].id, motif: 'NEGOCIATION', responsable: 'Agent Koné', compteRendu: 'Négociation en cours sur le magasin', relanceSouhait: true, dateRelance: new Date(Date.now() + 3 * 24 * 3600000), statutRelance: 'EN_ATTENTE', isDemo: true },
    { nomVisiteur: 'N\'GUESSAN', prenomVisiteur: 'Yao', contact: '+225 01 34 56 78', email: 'nguessan.y@email.com', bienVisiteId: biens[1].id, motif: 'RECLAMATION', responsable: 'Agent Bamba', compteRendu: 'Problème de plomberie signalé', relanceSouhait: false, isDemo: true },
    { nomVisiteur: 'BAJOU', prenomVisiteur: 'Marie', contact: '+225 07 45 67 89', email: 'bajou.m@email.com', bienVisiteId: biens[1].id, motif: 'DECOUVERTE', responsable: 'Agent Yao', compteRendu: 'Visite courtière, pas de suite', relanceSouhait: false, isDemo: true },
    { nomVisiteur: 'KOUADIO', prenomVisiteur: 'Serge', contact: '+225 05 56 78 90', email: 'kouadio.s@email.com', bienVisiteId: biens[0].id, motif: 'NEGOCIATION', responsable: 'Agent Touré', compteRendu: 'Client veut réduire le loyer', relanceSouhait: true, dateRelance: new Date(Date.now() + 5 * 24 * 3600000), statutRelance: 'EN_ATTENTE', isDemo: true },
    { nomVisiteur: 'GBLE', prenomVisiteur: 'Aimée', contact: '+225 01 67 89 01', email: 'gble.a@email.com', bienVisiteId: biens[2].id, motif: 'DECOUVERTE', responsable: 'Agent Diallo', compteRendu: 'Très intéressée par la chambre-salon', relanceSouhait: true, dateRelance: new Date(Date.now() + 10 * 24 * 3600000), statutRelance: 'EN_ATTENTE', isDemo: true },
    { nomVisiteur: 'AFFOU', prenomVisiteur: 'Appiah', contact: '+225 07 78 90 12', email: 'affou.a@email.com', bienVisiteId: biens[1].id, motif: 'AUTRE', responsable: 'Agent Koné', compteRendu: 'Visite de contrôle routine', relanceSouhait: false, isDemo: true },
    { nomVisiteur: 'ZADI', prenomVisiteur: 'Franck', contact: '+225 05 89 01 23', email: 'zadi.f@email.com', bienVisiteId: biens[2].id, motif: 'DECOUVERTE', responsable: 'Agent Bamba', compteRendu: 'Client cherche local commercial', relanceSouhait: true, dateRelance: new Date(Date.now() + 14 * 24 * 3600000), statutRelance: 'EN_ATTENTE', isDemo: true }
  ];

  for (const vd of visitesData) {
    await prisma.visite.create({ data: vd });
  }
  console.log(`✅ 8 visites créées`);

  console.log('\n✨ Seed terminé avec succès !');
  console.log('📊 Résumé :');
  console.log('   - 4 immeubles (27 unités)');
  console.log('   - 5 apporteurs');
  console.log('   - 10 clients');
  console.log('   - 10 baux actifs');
  console.log(`   - ${paymentCount} paiements`);
  console.log('   - 10 commissions');
  console.log('   - 8 visites');
  console.log('   - 3 biens');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
