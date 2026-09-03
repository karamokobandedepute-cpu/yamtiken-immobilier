const axios = require('axios')

const API_URL = 'http://localhost:5000/api'

async function testLeaseCreation() {
  console.log('🧪 Test de création de bail...\n')
  
  try {
    // 1. Créer un client test
    console.log('1️⃣ Création client test...')
    const clientRes = await axios.post(`${API_URL}/clients`, {
      nom: 'Dupont',
      prenom: 'Jean',
      telephone: '0612345678',
      email: 'jean.dupont@test.com'
    })
    const clientId = clientRes.data.id
    console.log(`✅ Client créé: ID ${clientId}\n`)
    
    // 2. Créer un bail
    console.log('2️⃣ Création bail...')
    const leaseRes = await axios.post(`${API_URL}/leases`, {
      clientId,
      montantInitial: 150000,
      dateDebut: '2026-05-01',
      dateFin: '2027-04-30',
      statut: 'actif',
      typeContrat: 'location',
      frequencePaiement: 'mensuel'
    })
    console.log(`✅ Bail créé: ${leaseRes.data.numeroBail}\n`)
    
    // 3. Récupérer la liste
    console.log('3️⃣ Vérification liste baux...')
    const listRes = await axios.get(`${API_URL}/leases`)
    console.log(`✅ ${listRes.data.length} bail(x) dans la base\n`)
    
    console.log('🎉 TOUS LES TESTS PASSÉS!')
    
  } catch (error) {
    console.error('❌ ÉCHEC DU TEST:', error.response?.data || error.message)
    process.exit(1)
  }
}

testLeaseCreation()
