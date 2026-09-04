import prisma from '../lib/prisma.js';

/**
 * GET /api/clients/:id/rapport-complet
 * 
 * Retourne un rapport complet pour un client incluant :
 * - Informations personnelles
 * - Patrimoine et unité assignés
 * - Détails du bail (durée, dates, montants)
 * - Historique des paiements
 * - Solde restant
 * - Statistiques de recouvrement
 */
export const getRapportCompletClient = async (req, res) => {
  try {
    const { id } = req.params
    
    // Récupérer le client avec toutes ses relations
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
      include: {
        leases: {
          where: { statut: 'ACTIF' },
          include: {
            building: {
              select: {
                id: true,
                nom: true,
                type: true,
                adresse: true,
                commune: true,
                ville: true
              }
            },
            unite: {
              select: {
                id: true,
                numeroPorte: true,
                typeUnite: true,
                etage: true,
                loyerBase: true,
                statut: true
              }
            },
            payments: {
              orderBy: { datePaiement: 'desc' },
              select: {
                id: true,
                numeroFacture: true,
                datePaiement: true,
                montantVerse: true,
                modePaiement: true,
                statut: true,
                notes: true
              }
            }
          }
        }
      }
    })
    
    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' })
    }
    
    // Construire le rapport
    const rapport = {
      client: {
        id: client.id,
        type: client.type,
        nom: client.nom,
        prenom: client.prenom,
        nomComplet: `${client.prenom} ${client.nom}`,
        nationalite: client.nationalite,
        dateNaissance: client.dateNaissance,
        age: client.dateNaissance ? 
          Math.floor((new Date() - new Date(client.dateNaissance)) / (365.25 * 24 * 60 * 60 * 1000)) : null,
        telephone: client.telephone,
        telephone2: client.telephone2,
        email: client.email,
        adresse: client.adresse,
        profession: client.profession,
        numeroPiece: client.numeroPiece,
        actif: client.actif,
        dateInscription: client.createdAt
      },
      baux: []
    }
    
    // Traiter chaque bail
    for (const bail of client.leases) {
      const dateDebut = new Date(bail.dateDebut)
      const dateFin = new Date(bail.dateFin)
      const aujourdhui = new Date()
      
      // Calculer la durée du bail
      const dureeTotaleJours = Math.ceil((dateFin - dateDebut) / (1000 * 60 * 60 * 24))
      const dureeTotaleMois = Math.ceil(dureeTotaleJours / 30)
      const dureeTotaleAnnees = (dureeTotaleMois / 12).toFixed(1)
      
      // Calculer le temps écoulé et restant
      const joursEcoules = Math.max(0, Math.ceil((aujourdhui - dateDebut) / (1000 * 60 * 60 * 24)))
      const joursRestants = Math.max(0, Math.ceil((dateFin - aujourdhui) / (1000 * 60 * 60 * 24)))
      const pourcentageEcoule = ((joursEcoules / dureeTotaleJours) * 100).toFixed(2)
      
      // Calculer les montants
      const loyerMensuel = parseFloat(bail.montantLoyer || 0)
      const caution = parseFloat(bail.montantCaution || 0)
      const montantInitial = parseFloat(bail.montantInitial || 0)
      
      // Calculer les paiements
      const totalPaye = bail.payments.reduce((sum, p) => sum + parseFloat(p.montantVerse || 0), 0)
      const resteDu = montantInitial - totalPaye
      const tauxPaiement = montantInitial > 0 ? ((totalPaye / montantInitial) * 100).toFixed(2) : 0
      
      // Calculer les paiements attendus vs réels
      const moisEcoules = Math.ceil(joursEcoules / 30)
      const montantAttendu = Math.min(loyerMensuel * moisEcoules, montantInitial - caution)
      const retard = Math.max(0, montantAttendu - totalPaye)
      const avance = Math.max(0, totalPaye - montantAttendu)
      
      // Statut du bail
      let statutBail = 'ACTIF'
      if (dateFin < aujourdhui) {
        statutBail = 'EXPIRÉ'
      } else if (joursRestants <= 30) {
        statutBail = 'BIENTÔT_EXPIRÉ'
      }
      
      const bailRapport = {
        bail: {
          id: bail.id,
          numeroBail: bail.numeroBail,
          statut: statutBail,
          statutOriginal: bail.statut
        },
        patrimoine: bail.building ? {
          id: bail.building.id,
          nom: bail.building.nom,
          type: bail.building.type,
          adresse: bail.building.adresse,
          commune: bail.building.commune,
          ville: bail.building.ville,
          adresseComplete: `${bail.building.adresse}, ${bail.building.commune}, ${bail.building.ville}`
        } : null,
        unite: bail.unite ? {
          id: bail.unite.id,
          numeroPorte: bail.unite.numeroPorte,
          typeUnite: bail.unite.typeUnite,
          etage: bail.unite.etage,
          loyerBase: bail.unite.loyerBase,
          statut: bail.unite.statut,
          description: `${bail.unite.typeUnite} - Porte ${bail.unite.numeroPorte} - Étage ${bail.unite.etage || 'RDC'}`
        } : null,
        duree: {
          dateDebut: dateDebut.toISOString(),
          dateFin: dateFin.toISOString(),
          dateDebutFormatee: dateDebut.toLocaleDateString('fr-FR'),
          dateFinFormatee: dateFin.toLocaleDateString('fr-FR'),
          dureeTotaleJours,
          dureeTotaleMois,
          dureeTotaleAnnees: parseFloat(dureeTotaleAnnees),
          joursEcoules,
          joursRestants,
          pourcentageEcoule: parseFloat(pourcentageEcoule),
          estExpire: dateFin < aujourdhui,
          bientotExpire: joursRestants <= 30 && joursRestants > 0
        },
        finances: {
          loyerMensuel,
          caution,
          montantInitial,
          totalPaye,
          resteDu,
          tauxPaiement: parseFloat(tauxPaiement),
          montantAttendu,
          retard,
          avance,
          enRetard: retard > 0,
          enAvance: avance > 0,
          nombrePaiements: bail.payments.length
        },
        paiements: bail.payments.map(p => ({
          id: p.id,
          numeroFacture: p.numeroFacture,
          date: p.datePaiement,
          dateFormatee: new Date(p.datePaiement).toLocaleDateString('fr-FR'),
          montant: parseFloat(p.montantVerse),
          modePaiement: p.modePaiement,
          statut: p.statut,
          notes: p.notes
        }))
      }
      
      rapport.baux.push(bailRapport)
    }
    
    // Ajouter un résumé global
    rapport.resume = {
      nombreBaux: rapport.baux.length,
      bailActif: rapport.baux.length > 0,
      totalDu: rapport.baux.reduce((sum, b) => sum + b.finances.montantInitial, 0),
      totalPaye: rapport.baux.reduce((sum, b) => sum + b.finances.totalPaye, 0),
      totalResteDu: rapport.baux.reduce((sum, b) => sum + b.finances.resteDu, 0),
      totalRetard: rapport.baux.reduce((sum, b) => sum + b.finances.retard, 0),
      nombrePaiementsTotal: rapport.baux.reduce((sum, b) => sum + b.finances.nombrePaiements, 0)
    }
    
    res.json({
      success: true,
      data: rapport,
      genereLe: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Erreur getRapportCompletClient:', error)
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors de la génération du rapport',
      error: error.message 
    })
  }
}

export default { getRapportCompletClient }
