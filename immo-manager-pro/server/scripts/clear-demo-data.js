import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearDemoData() {
  console.log('🗑️  Suppression des données de démonstration...\n')

  try {
    // Supprimer dans l'ordre inverse des dépendances
    console.log('💰 Suppression des paiements...')
    const deletedPayments = await prisma.payment.deleteMany({
      where: {
        numeroFacture: {
          startsWith: 'FACT-2024-'
        }
      }
    })
    console.log(`   ✅ ${deletedPayments.count} paiements supprimés`)

    console.log('\n📄 Suppression des baux...')
    const deletedLeases = await prisma.lease.deleteMany({
      where: {
        numeroBail: {
          startsWith: 'BAIL-2024-'
        }
      }
    })
    console.log(`   ✅ ${deletedLeases.count} baux supprimés`)

    console.log('\n📋 Suppression des visites...')
    const deletedVisites = await prisma.visite.deleteMany({})
    console.log(`   ✅ ${deletedVisites.count} visites supprimées`)

    console.log('\n📦 Suppression des unités...')
    const deletedUnites = await prisma.unite.deleteMany({})
    console.log(`   ✅ ${deletedUnites.count} unités supprimées`)

    console.log('\n🏢 Suppression des immeubles...')
    const deletedBuildings = await prisma.building.deleteMany({})
    console.log(`   ✅ ${deletedBuildings.count} immeubles supprimés`)

    console.log('\n👥 Suppression des clients (sauf référents)...')
    const deletedClients = await prisma.client.deleteMany({
      where: {
        email: {
          endsWith: '@email.ci'
        }
      }
    })
    console.log(`   ✅ ${deletedClients.count} clients supprimés`)

    console.log('\n👨‍💼 Suppression des agents (sauf Super Admin)...')
    const deletedAgents = await prisma.user.deleteMany({
      where: {
        AND: [
          { role: { not: 'SUPER_ADMIN' } },
          { email: { endsWith: '@yamtiken.ci' } }
        ]
      }
    })
    console.log(`   ✅ ${deletedAgents.count} agents supprimés`)

    console.log('\n✅ Toutes les données de démonstration ont été supprimées!')
    console.log('🎯 La base de données est prête pour de vraies données.\n')

  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter le script
clearDemoData()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
