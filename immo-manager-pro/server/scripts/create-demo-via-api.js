import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';
const AUTH_TOKEN = 'YOUR_TOKEN_HERE'; // Remplacer par votre token

// Données de démonstration
const DEMO_DATA = {
  clients: [
    {
      nom: 'Kouassi', prenom: 'Adjoua', type: 'CLIENT',
      telephone: '+225 07 12 34 56 78', email: 'adjoua.kouassi@email.ci',
      adresse: 'Cocody Angré 8ème Tranche', profession: 'Cadre bancaire'
    },
    {
      nom: 'Traoré', prenom: 'Mamadou', type: 'CLIENT',
      telephone: '+225 07 23 45 67 89', email: 'mamadou.traore@email.ci',
      adresse: 'Yopougon Niangon', profession: 'Entrepreneur'
    },
    {
      nom: 'N\'Guessan', prenom: 'Marie-Claire', type: 'CLIENT',
      telephone: '+225 07 34 56 78 90', email: 'marie.nguessan@email.ci',
      adresse: 'Plateau Dokui', profession: 'Médecin'
    },
    {
      nom: 'Koné', prenom: 'Ibrahim', type: 'CLIENT',
      telephone: '+225 07 45 67 89 01', email: 'ibrahim.kone@email.ci',
      adresse: 'Marcory Zone 4', profession: 'Ingénieur'
    },
    {
      nom: 'Bamba', prenom: 'Fatou', type: 'CLIENT',
      telephone: '+225 07 56 78 90 12', email: 'fatou.bamba@email.ci',
      adresse: 'Abobo Gare', profession: 'Enseignante'
    }
  ],
  buildings: [
    {
      nom: 'Résidence Les Palmiers', type: 'IMMEUBLE',
      adresse: 'Cocody Riviera Palmeraie', commune: 'Cocody',
      quartier: 'Riviera Palmeraie', nombreEtages: 4
    },
    {
      nom: 'Villa Émeraude', type: 'VILLA',
      adresse: 'Marcory Zone 4C', commune: 'Marcory',
      quartier: 'Zone 4C', nombreEtages: 2
    },
    {
      nom: 'Complexe Harmonie', type: 'COMPLEXE',
      adresse: 'Yopougon Niangon', commune: 'Yopougon',
      quartier: 'Niangon', nombreEtages: 3
    },
    {
      nom: 'Immeuble Prestige', type: 'IMMEUBLE',
      adresse: 'Plateau Dokui', commune: 'Plateau',
      quartier: 'Dokui', nombreEtages: 5
    },
    {
      nom: 'Résidence Azur', type: 'RESIDENCE',
      adresse: 'Angré 8ème Tranche', commune: 'Cocody',
      quartier: 'Angré', nombreEtages: 3
    }
  ]
};

async function createDemoData() {
  console.log('🌱 Création des données de démonstration via API...\n');

  try {
    // 1. Créer les clients
    console.log('👥 Création des clients...');
    const clients = [];
    for (const clientData of DEMO_DATA.clients) {
      const response = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(clientData)
      });
      
      if (response.ok) {
        const client = await response.json();
        clients.push(client);
        console.log(`   ✅ ${clientData.prenom} ${clientData.nom}`);
      } else {
        console.error(`   ❌ Erreur: ${response.statusText}`);
      }
    }

    // 2. Créer les immeubles
    console.log('\n🏢 Création des immeubles...');
    const buildings = [];
    for (const buildingData of DEMO_DATA.buildings) {
      const response = await fetch(`${API_URL}/buildings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: JSON.stringify(buildingData)
      });
      
      if (response.ok) {
        const building = await response.json();
        buildings.push(building);
        console.log(`   ✅ ${buildingData.nom}`);
      } else {
        console.error(`   ❌ Erreur: ${response.statusText}`);
      }
    }

    console.log('\n✅ Données créées avec succès!');
    console.log(`   - ${clients.length} clients`);
    console.log(`   - ${buildings.length} immeubles`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

createDemoData();
