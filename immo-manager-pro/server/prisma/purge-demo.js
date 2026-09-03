import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function purgeDemo() {
  console.log('\n🗑️ PURGE DES DONNÉES DÉMO — YAMTIKEN\n')

  const demoBuildings = await prisma.building.findMany({ where: { isDemo: true }, select: { id: true } })
  const demoBuildingIds = demoBuildings.map(b => b.id)
  const demoClients = await prisma.client.findMany({ where: { isDemo: true }, select: { id: true } })
  const demoClientIds = demoClients.map(c => c.id)
  const demoReferrers = await prisma.referrer.findMany({ where: { isDemo: true }, select: { id: true } })
  const demoUnites = await prisma.unite.findMany({ where: { buildingId: { in: demoBuildingIds }, isDemo: true }, select: { id: true } })
  const demoLeases = await prisma.lease.findMany({
    where: { OR: [{ clientId: { in: demoClientIds } }, { buildingId: { in: demoBuildingIds } }] },
    select: { id: true }
  })
  const demoLeaseIds = demoLeases.map(l => l.id)
  const demoPayments = await prisma.payment.findMany({ where: { leaseId: { in: demoLeaseIds } }, select: { id: true } })
  const demoVisites = await prisma.visite.findMany({ where: { isDemo: true }, select: { id: true } })
  const demoCommissions = await prisma.commission.findMany({ where: { isDemo: true }, select: { id: true } })

  console.log('Immeubles:', demoBuildingIds.length, '| Unités:', demoUnites.length, '| Clients:', demoClientIds.length)
  console.log('Apporteurs:', demoReferrers.length, '| Baux:', demoLeases.length, '| Paiements:', demoPayments.length)
  console.log('Visites:', demoVisites.length, '| Commissions:', demoCommissions.length, '\n')

  if (!demoBuildingIds.length && !demoClientIds.length && !demoReferrers.length) {
    console.log('✅ Aucune donnée démo — base déjà propre !')
    return
  }

  if (demoCommissions.length) { await prisma.commission.deleteMany({ where: { isDemo: true } }); console.log('✅', demoCommissions.length, 'commission(s) supprimée(s)') }
  if (demoVisites.length)     { await prisma.visite.deleteMany({ where: { isDemo: true } });     console.log('✅', demoVisites.length, 'visite(s) supprimée(s)') }
  if (demoPayments.length)    { await prisma.payment.deleteMany({ where: { leaseId: { in: demoLeaseIds } } }); console.log('✅', demoPayments.length, 'paiement(s) supprimé(s)') }
  if (demoLeases.length)      { await prisma.lease.deleteMany({ where: { OR: [{ clientId: { in: demoClientIds } }, { buildingId: { in: demoBuildingIds } }] } }); console.log('✅', demoLeases.length, 'bail/baux supprimé(s)') }
  if (demoClientIds.length)   { await prisma.client.deleteMany({ where: { isDemo: true } });    console.log('✅', demoClientIds.length, 'client(s) supprimé(s)') }
  if (demoReferrers.length)   { await prisma.referrer.deleteMany({ where: { isDemo: true } });  console.log('✅', demoReferrers.length, 'apporteur(s) supprimé(s)') }
  if (demoUnites.length)      { await prisma.unite.deleteMany({ where: { buildingId: { in: demoBuildingIds }, isDemo: true } }); console.log('✅', demoUnites.length, 'unité(s) supprimée(s)') }
  if (demoBuildingIds.length) { await prisma.building.deleteMany({ where: { isDemo: true } });  console.log('✅', demoBuildingIds.length, 'immeuble(s) supprimé(s)') }

  console.log('\n✨ PURGE TERMINÉE — Données réelles préservées ✅\n')
}

purgeDemo()
  .catch(e => { console.error('❌ Erreur purge:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
