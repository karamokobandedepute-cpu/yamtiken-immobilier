import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ============================================
// DONNÉES FICTIVES POUR DÉMONSTRATION
// ============================================

const DEMO_CLIENTS = [
  {
    nom: 'Kouassi',
    prenom: 'Adjoua',
    type: 'CLIENT',
    nationalite: 'Ivoirienne',
    dateNaissance: new Date('1985-03-15'),
    telephone: '+225 07 12 34 56 78',
    telephone2: '+225 05 98 76 54 32',
    email: 'adjoua.kouassi@email.ci',
    adresse: 'Cocody Angré 8ème Tranche',
    profession: 'Cadre bancaire SGBCI',
    actif: true
  },
  {
    nom: 'Traoré',
    prenom: 'Mamadou',
    type: 'CLIENT',
    nationalite: 'Ivoirienne',
    dateNaissance: new Date('1990-07-22'),
    telephone: '+225 07 23 45 67 89',
    email: 'mamadou.traore@email.ci',
    adresse: 'Yopougon Niangon',
    profession: 'Entrepreneur',
    actif: true
  },
  {
    nom: 'N\'Guessan',
    prenom: 'Marie-Claire',
    type: 'CLIENT',
    nationalite: 'Ivoirienne',
    dateNaissance: new Date('1988-11-30'),
    telephone: '+225 07 34 56 78 90',
    telephone2: '+225 01 23 45 67 89',
    email: 'marie.nguessan@email.ci',
    adresse: 'Plateau Dokui',
    profession: 'Médecin CHU Cocody',
    actif: true
  },
  {
    nom: 'Koné',
    prenom: 'Ibrahim',
    type: 'CLIENT',
    nationalite: 'Ivoirienne',
    dateNaissance: new Date('1982-05-18'),
    telephone: '+225 07 45 67 89 01',
    email: 'ibrahim.kone@email.ci',
    adresse: 'Marcory Zone 4',
    profession: 'Ingénieur CI-ENERGIES',
    actif: true
  },
  {
    nom: 'Bamba',
    prenom: 'Fatou',
    type: 'CLIENT',
    nationalite: 'Ivoirienne',
    dateNaissance: new Date('1995-09-12'),
    telephone: '+225 07 56 78 90 12',
    email: 'fatou.bamba@email.ci',
    adresse: 'Abobo Gare',
    profession: 'Enseignante',
    actif: true
  }
]

const DEMO_BUILDINGS = [
  {
    nom: 'Résidence Les Palmiers',
    type: 'IMMEUBLE',
    adresse: 'Cocody Riviera Palmeraie',
    commune: 'Cocody',
    quartier: 'Riviera Palmeraie',
    nombreEtages: 4,
    anneeConstruction: 2018,
    description: 'Immeuble moderne avec ascenseur et parking sécurisé'
  },
  {
    nom: 'Villa Émeraude',
    type: 'VILLA',
    adresse: 'Marcory Zone 4C',
    commune: 'Marcory',
    quartier: 'Zone 4C',
    nombreEtages: 2,
    anneeConstruction: 2020,
    description: 'Villa standing avec piscine et jardin'
  },
  {
    nom: 'Complexe Harmonie',
    type: 'COMPLEXE',
    adresse: 'Yopougon Niangon',
    commune: 'Yopougon',
    quartier: 'Niangon',
    nombreEtages: 3,
    anneeConstruction: 2019,
    description: 'Complexe résidentiel avec gardiennage 24h/24'
  },
  {
    nom: 'Immeuble Prestige',
    type: 'IMMEUBLE',
    adresse: 'Plateau Dokui',
    commune: 'Plateau',
    quartier: 'Dokui',
    nombreEtages: 5,
    anneeConstruction: 2021,
    description: 'Immeuble de standing au cœur du Plateau'
  },
  {
    nom: 'Résidence Azur',
    type: 'RESIDENCE',
    adresse: 'Angré 8ème Tranche',
    commune: 'Cocody',
    quartier: 'Angré',
    nombreEtages: 3,
    anneeConstruction: 2022,
    description: 'Résidence haut standing avec toutes commodités'
  }
]

const DEMO_UNITES = [
  // Résidence Les Palmiers (5 unités)
  { numeroPorte: 'A101', typeUnite: 'STUDIO', etage: 1, loyerBase: 150000, statut: 'OCCUPE' },
  { numeroPorte: 'A201', typeUnite: 'F2', etage: 2, loyerBase: 250000, statut: 'OCCUPE' },
  { numeroPorte: 'A301', typeUnite: 'F3', etage: 3, loyerBase: 350000, statut: 'OCCUPE' },
  { numeroPorte: 'A401', typeUnite: 'F4', etage: 4, loyerBase: 450000, statut: 'RESERVE' },
  { numeroPorte: 'A402', typeUnite: 'F4', etage: 4, loyerBase: 450000, statut: 'VACANT' },
  
  // Villa Émeraude (1 unité)
  { numeroPorte: 'VILLA', typeUnite: 'VILLA', etage: 0, loyerBase: 800000, statut: 'OCCUPE' },
  
  // Complexe Harmonie (4 unités)
  { numeroPorte: 'B101', typeUnite: 'F2', etage: 1, loyerBase: 200000, statut: 'OCCUPE' },
  { numeroPorte: 'B201', typeUnite: 'F3', etage: 2, loyerBase: 300000, statut: 'OCCUPE' },
  { numeroPorte: 'B301', typeUnite: 'F3', etage: 3, loyerBase: 300000, statut: 'VACANT' },
  { numeroPorte: 'B302', typeUnite: 'F2', etage: 3, loyerBase: 200000, statut: 'RESERVE' },
  
  // Immeuble Prestige (3 unités)
  { numeroPorte: 'P101', typeUnite: 'STUDIO', etage: 1, loyerBase: 180000, statut: 'OCCUPE' },
  { numeroPorte: 'P201', typeUnite: 'F2', etage: 2, loyerBase: 280000, statut: 'OCCUPE' },
  { numeroPorte: 'P301', typeUnite: 'F3', etage: 3, loyerBase: 380000, statut: 'VACANT' },
  
  // Résidence Azur (2 unités)
  { numeroPorte: 'R101', typeUnite: 'F3', etage: 1, loyerBase: 400000, statut: 'OCCUPE' },
  { numeroPorte: 'R201', typeUnite: 'F4', etage: 2, loyerBase: 500000, statut: 'VACANT' }
]

async function seedDemoData() {
  console.log('🌱 Début du remplissage des données de démonstration...\n')

  try {
    // 1. Créer les clients
    console.log('👥 Création des clients...')
    const clients = []
    for (const clientData of DEMO_CLIENTS) {
      const client = await prisma.client.create({ data: clientData })
      clients.push(client)
      console.log(`   ✅ ${client.prenom} ${client.nom}`)
    }

    // 2. Créer les immeubles avec leurs unités
    console.log('\n🏢 Création des immeubles et unités...')
    const buildings = []
    let uniteIndex = 0
    
    for (let i = 0; i < DEMO_BUILDINGS.length; i++) {
      const buildingData = DEMO_BUILDINGS[i]
      const building = await prisma.building.create({ data: buildingData })
      buildings.push(building)
      console.log(`   ✅ ${building.nom}`)

      // Créer les unités pour cet immeuble
      const unitesCount = i === 0 ? 5 : i === 1 ? 1 : i === 2 ? 4 : i === 3 ? 3 : 2
      for (let j = 0; j < unitesCount; j++) {
        const uniteData = DEMO_UNITES[uniteIndex]
        await prisma.unite.create({
          data: {
            ...uniteData,
            buildingId: building.id
          }
        })
        console.log(`      📦 ${uniteData.numeroPorte} - ${uniteData.typeUnite} (${uniteData.statut})`)
        uniteIndex++
      }
    }

    // 3. Récupérer toutes les unités créées
    const unites = await prisma.unite.findMany({
      include: { building: true }
    })

    // 4. Créer des baux pour les unités occupées
    console.log('\n📄 Création des baux...')
    const leases = []
    const occupiedUnites = unites.filter(u => u.statut === 'OCCUPE')
    
    for (let i = 0; i < occupiedUnites.length && i < clients.length; i++) {
      const unite = occupiedUnites[i]
      const client = clients[i]
      
      const dateDebut = new Date('2024-01-01')
      dateDebut.setMonth(dateDebut.getMonth() + i) // Décaler les dates de début
      
      const dateFin = new Date(dateDebut)
      dateFin.setFullYear(dateFin.getFullYear() + 1) // Bail d'1 an
      
      const montantLoyer = unite.loyerBase
      const caution = montantLoyer * 2 // 2 mois de caution
      const montantInitial = (montantLoyer * 12) + caution // 12 mois + caution
      
      const lease = await prisma.lease.create({
        data: {
          numeroBail: `BAIL-2024-${String(i + 1).padStart(4, '0')}`,
          clientId: client.id,
          buildingId: unite.buildingId,
          uniteId: unite.id,
          dateDebut,
          dateFin,
          montantInitial,
          montantLoyer,
          caution,
          statut: 'ACTIF',
          typeContrat: 'LOCATION',
          modePaiement: i % 2 === 0 ? 'MENSUEL' : 'TRIMESTRIEL'
        }
      })
      leases.push(lease)
      console.log(`   ✅ ${lease.numeroBail} - ${client.prenom} ${client.nom} → ${unite.numeroPorte}`)
    }

    // 5. Créer des paiements pour chaque bail
    console.log('\n💰 Création des paiements...')
    let totalPaiements = 0
    
    for (const lease of leases) {
      const nombrePaiements = Math.floor(Math.random() * 3) + 2 // 2 à 4 paiements
      
      for (let i = 0; i < nombrePaiements; i++) {
        const datePaiement = new Date(lease.dateDebut)
        datePaiement.setMonth(datePaiement.getMonth() + i)
        
        const montantVerse = lease.montantLoyer
        const modePaiement = ['ESPECES', 'VIREMENT', 'CHEQUE', 'MOBILE_MONEY'][Math.floor(Math.random() * 4)]
        
        await prisma.payment.create({
          data: {
            numeroFacture: `FACT-2024-${String(totalPaiements + 1).padStart(6, '0')}`,
            leaseId: lease.id,
            datePaiement,
            montantVerse,
            modePaiement,
            notes: `Paiement ${i + 1}/${nombrePaiements}`
          }
        })
        totalPaiements++
      }
      console.log(`   ✅ ${nombrePaiements} paiement(s) pour ${lease.numeroBail}`)
    }

    // 6. Créer des visites (secrétariat)
    console.log('\n📋 Création des visites...')
    const visitesData = [
      {
        nomVisiteur: 'Diallo',
        prenomVisiteur: 'Aminata',
        contact: '+225 07 11 22 33 44',
        email: 'aminata.diallo@email.ci',
        bienVisiteId: buildings[0].id,
        motif: 'LOCATION',
        responsable: 'Agent commercial',
        compteRendu: 'Cliente intéressée par un F3, budget 350k',
        relanceSouhait: true,
        dateRelance: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        statutRelance: 'EN_ATTENTE'
      },
      {
        nomVisiteur: 'Yao',
        prenomVisiteur: 'Kouadio',
        contact: '+225 07 22 33 44 55',
        bienVisiteId: buildings[1].id,
        motif: 'ACHAT',
        responsable: 'Directeur commercial',
        compteRendu: 'Très intéressé par la villa, demande financement',
        relanceSouhait: true,
        dateRelance: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        statutRelance: 'EN_ATTENTE'
      },
      {
        nomVisiteur: 'Coulibaly',
        prenomVisiteur: 'Mariam',
        contact: '+225 07 33 44 55 66',
        email: 'mariam.c@email.ci',
        bienVisiteId: buildings[2].id,
        motif: 'DECOUVERTE',
        responsable: 'Secrétaire',
        compteRendu: 'Simple visite de découverte, pas de projet immédiat',
        relanceSouhait: false,
        statutRelance: 'TERMINE'
      }
    ]

    for (const visiteData of visitesData) {
      await prisma.visite.create({ data: visiteData })
      console.log(`   ✅ Visite de ${visiteData.prenomVisiteur} ${visiteData.nomVisiteur}`)
    }

    // 7. Créer des agents (administration)
    console.log('\n👨‍💼 Création des agents...')
    const agentsData = [
      {
        nom: 'Admin',
        prenom: 'Super',
        email: 'admin@yamtiken.ci',
        password: await bcrypt.hash('Admin@2024', 10),
        telephone: '+225 07 00 00 00 00',
        role: 'SUPER_ADMIN',
        actif: true
      },
      {
        nom: 'Soro',
        prenom: 'Karim',
        email: 'karim.soro@yamtiken.ci',
        password: await bcrypt.hash('Agent@2024', 10),
        telephone: '+225 07 11 11 11 11',
        role: 'AGENT',
        actif: true
      },
      {
        nom: 'Konan',
        prenom: 'Aya',
        email: 'aya.konan@yamtiken.ci',
        password: await bcrypt.hash('Secret@2024', 10),
        telephone: '+225 07 22 22 22 22',
        role: 'SECRETAIRE',
        actif: true
      }
    ]

    for (const agentData of agentsData) {
      const agent = await prisma.user.create({ data: agentData })
      console.log(`   ✅ ${agent.prenom} ${agent.nom} (${agent.role})`)
    }

    console.log('\n✅ Données de démonstration créées avec succès!')
    console.log('\n📊 Résumé:')
    console.log(`   - ${clients.length} clients`)
    console.log(`   - ${buildings.length} immeubles`)
    console.log(`   - ${unites.length} unités`)
    console.log(`   - ${leases.length} baux`)
    console.log(`   - ${totalPaiements} paiements`)
    console.log(`   - ${visitesData.length} visites`)
    console.log(`   - ${agentsData.length} agents`)
    console.log('\n🎉 Base de données prête pour la démonstration!\n')

  } catch (error) {
    console.error('❌ Erreur lors du remplissage:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter le script
seedDemoData()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
