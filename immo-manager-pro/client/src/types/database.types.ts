export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerte: {
        Row: {
          createdAt: string
          dateEcheance: string
          dateEnvoiEmail: string | null
          dateTraitement: string | null
          description: string
          emailEnvoye: boolean
          estLue: boolean
          estTraitee: boolean
          id: number
          referenceId: number | null
          referenceType: string | null
          titre: string
          type: Database["public"]["Enums"]["TypeAlerte"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          dateEcheance: string
          dateEnvoiEmail?: string | null
          dateTraitement?: string | null
          description: string
          emailEnvoye?: boolean
          estLue?: boolean
          estTraitee?: boolean
          id?: number
          referenceId?: number | null
          referenceType?: string | null
          titre: string
          type: Database["public"]["Enums"]["TypeAlerte"]
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          dateEcheance?: string
          dateEnvoiEmail?: string | null
          dateTraitement?: string | null
          description?: string
          emailEnvoye?: boolean
          estLue?: boolean
          estTraitee?: boolean
          id?: number
          referenceId?: number | null
          referenceType?: string | null
          titre?: string
          type?: Database["public"]["Enums"]["TypeAlerte"]
          updatedAt?: string
        }
        Relationships: []
      }
      attributions: {
        Row: {
          batiment_id: number | null
          client_id: number | null
          created_at: string | null
          date_debut: string
          date_fin: string | null
          id: number
          notes: string | null
          quantite: number
          statut: string | null
          type_porte_id: number | null
          updated_at: string | null
        }
        Insert: {
          batiment_id?: number | null
          client_id?: number | null
          created_at?: string | null
          date_debut: string
          date_fin?: string | null
          id?: number
          notes?: string | null
          quantite?: number
          statut?: string | null
          type_porte_id?: number | null
          updated_at?: string | null
        }
        Update: {
          batiment_id?: number | null
          client_id?: number | null
          created_at?: string | null
          date_debut?: string
          date_fin?: string | null
          id?: number
          notes?: string | null
          quantite?: number
          statut?: string | null
          type_porte_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_batiment_id_fkey"
            columns: ["batiment_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_batiment_id_fkey"
            columns: ["batiment_id"]
            isOneToOne: false
            referencedRelation: "vue_batiment_stock"
            referencedColumns: ["batiment_id"]
          },
          {
            foreignKeyName: "attributions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vue_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "attributions_type_porte_id_fkey"
            columns: ["type_porte_id"]
            isOneToOne: false
            referencedRelation: "type_portes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          createdAt: string
          id: number
          ipAddress: string | null
          newData: Json | null
          oldData: Json | null
          recordId: number
          tableName: string
          userAgent: string | null
          userId: number
        }
        Insert: {
          action: string
          createdAt?: string
          id?: number
          ipAddress?: string | null
          newData?: Json | null
          oldData?: Json | null
          recordId: number
          tableName: string
          userAgent?: string | null
          userId: number
        }
        Update: {
          action?: string
          createdAt?: string
          id?: number
          ipAddress?: string | null
          newData?: Json | null
          oldData?: Json | null
          recordId?: number
          tableName?: string
          userAgent?: string | null
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      biens: {
        Row: {
          adresse: string
          caution: number | null
          charges: number | null
          codePostal: string | null
          createdAt: string
          description: string | null
          equipements: string[] | null
          etage: number | null
          id: number
          nbChambres: number | null
          nbPieces: number | null
          nbSallesBain: number | null
          photos: string[] | null
          prixLocation: number | null
          prixVente: number | null
          proprietaireId: number
          quartier: string | null
          reference: string
          statut: Database["public"]["Enums"]["StatutBien"]
          surface: number | null
          titre: string
          type: Database["public"]["Enums"]["TypeBien"]
          updatedAt: string
          ville: string
        }
        Insert: {
          adresse: string
          caution?: number | null
          charges?: number | null
          codePostal?: string | null
          createdAt?: string
          description?: string | null
          equipements?: string[] | null
          etage?: number | null
          id?: number
          nbChambres?: number | null
          nbPieces?: number | null
          nbSallesBain?: number | null
          photos?: string[] | null
          prixLocation?: number | null
          prixVente?: number | null
          proprietaireId: number
          quartier?: string | null
          reference: string
          statut?: Database["public"]["Enums"]["StatutBien"]
          surface?: number | null
          titre: string
          type: Database["public"]["Enums"]["TypeBien"]
          updatedAt?: string
          ville: string
        }
        Update: {
          adresse?: string
          caution?: number | null
          charges?: number | null
          codePostal?: string | null
          createdAt?: string
          description?: string | null
          equipements?: string[] | null
          etage?: number | null
          id?: number
          nbChambres?: number | null
          nbPieces?: number | null
          nbSallesBain?: number | null
          photos?: string[] | null
          prixLocation?: number | null
          prixVente?: number | null
          proprietaireId?: number
          quartier?: string | null
          reference?: string
          statut?: Database["public"]["Enums"]["StatutBien"]
          surface?: number | null
          titre?: string
          type?: Database["public"]["Enums"]["TypeBien"]
          updatedAt?: string
          ville?: string
        }
        Relationships: [
          {
            foreignKeyName: "biens_proprietaireId_fkey"
            columns: ["proprietaireId"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biens_proprietaireId_fkey"
            columns: ["proprietaireId"]
            isOneToOne: false
            referencedRelation: "vue_client_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      buildings: {
        Row: {
          adresse: string
          chargesAnnexes: number | null
          commune: string
          createdAt: string
          dateAcquisition: string | null
          droitsTerre: string | null
          id: number
          is_demo: boolean
          nom: string
          nombreEtages: number
          notes: string | null
          type: Database["public"]["Enums"]["TypeBuilding"]
          updatedAt: string
          valeurEstimee: number | null
          ville: string
        }
        Insert: {
          adresse: string
          chargesAnnexes?: number | null
          commune: string
          createdAt?: string
          dateAcquisition?: string | null
          droitsTerre?: string | null
          id?: number
          is_demo?: boolean
          nom: string
          nombreEtages?: number
          notes?: string | null
          type: Database["public"]["Enums"]["TypeBuilding"]
          updatedAt?: string
          valeurEstimee?: number | null
          ville?: string
        }
        Update: {
          adresse?: string
          chargesAnnexes?: number | null
          commune?: string
          createdAt?: string
          dateAcquisition?: string | null
          droitsTerre?: string | null
          id?: number
          is_demo?: boolean
          nom?: string
          nombreEtages?: number
          notes?: string | null
          type?: Database["public"]["Enums"]["TypeBuilding"]
          updatedAt?: string
          valeurEstimee?: number | null
          ville?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          actif: boolean
          adresse: string | null
          createdAt: string
          dateNaissance: string | null
          email: string | null
          id: number
          isDemo: boolean
          nationalite: string | null
          nom: string
          numeroPiece: string | null
          photoUrl: string | null
          pieceUrl: string | null
          prenom: string
          profession: string | null
          telephone: string
          telephone2: string | null
          temoinId: number | null
          type: Database["public"]["Enums"]["TypeClient"]
          updatedAt: string
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          createdAt?: string
          dateNaissance?: string | null
          email?: string | null
          id?: number
          isDemo?: boolean
          nationalite?: string | null
          nom: string
          numeroPiece?: string | null
          photoUrl?: string | null
          pieceUrl?: string | null
          prenom: string
          profession?: string | null
          telephone: string
          telephone2?: string | null
          temoinId?: number | null
          type?: Database["public"]["Enums"]["TypeClient"]
          updatedAt?: string
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          createdAt?: string
          dateNaissance?: string | null
          email?: string | null
          id?: number
          isDemo?: boolean
          nationalite?: string | null
          nom?: string
          numeroPiece?: string | null
          photoUrl?: string | null
          pieceUrl?: string | null
          prenom?: string
          profession?: string | null
          telephone?: string
          telephone2?: string | null
          temoinId?: number | null
          type?: Database["public"]["Enums"]["TypeClient"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_temoinId_fkey"
            columns: ["temoinId"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          clientId: number
          createdAt: string
          datePaiement: string | null
          description: string | null
          id: number
          isDemo: boolean
          montant: number
          referrerId: number
          statut: Database["public"]["Enums"]["StatutCommission"]
          updatedAt: string
        }
        Insert: {
          clientId: number
          createdAt?: string
          datePaiement?: string | null
          description?: string | null
          id?: number
          isDemo?: boolean
          montant: number
          referrerId: number
          statut?: Database["public"]["Enums"]["StatutCommission"]
          updatedAt?: string
        }
        Update: {
          clientId?: number
          createdAt?: string
          datePaiement?: string | null
          description?: string | null
          id?: number
          isDemo?: boolean
          montant?: number
          referrerId?: number
          statut?: Database["public"]["Enums"]["StatutCommission"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "vue_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commissions_referrerId_fkey"
            columns: ["referrerId"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
        ]
      }
      contrats: {
        Row: {
          bien_id: number | null
          conditions: string | null
          created_at: string | null
          cree_par_id: number | null
          date_debut: string
          date_fin: string | null
          date_signature: string | null
          frequence_paiement: string | null
          id: number
          indexation: boolean | null
          locataire_id: number | null
          montant_loyer: number | null
          montant_vente: number | null
          proprietaire_id: number | null
          reference: string
          statut: string | null
          taux_indexation: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          bien_id?: number | null
          conditions?: string | null
          created_at?: string | null
          cree_par_id?: number | null
          date_debut: string
          date_fin?: string | null
          date_signature?: string | null
          frequence_paiement?: string | null
          id?: number
          indexation?: boolean | null
          locataire_id?: number | null
          montant_loyer?: number | null
          montant_vente?: number | null
          proprietaire_id?: number | null
          reference: string
          statut?: string | null
          taux_indexation?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          bien_id?: number | null
          conditions?: string | null
          created_at?: string | null
          cree_par_id?: number | null
          date_debut?: string
          date_fin?: string | null
          date_signature?: string | null
          frequence_paiement?: string | null
          id?: number
          indexation?: boolean | null
          locataire_id?: number | null
          montant_loyer?: number | null
          montant_vente?: number | null
          proprietaire_id?: number | null
          reference?: string
          statut?: string | null
          taux_indexation?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrats_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "vue_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contrats_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrats_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "vue_client_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      documents: {
        Row: {
          categorie: string | null
          chemin: string
          clientId: number | null
          contratId: number | null
          createdAt: string
          description: string | null
          id: number
          nom: string
          taille: number | null
          type: string
          updatedAt: string
        }
        Insert: {
          categorie?: string | null
          chemin: string
          clientId?: number | null
          contratId?: number | null
          createdAt?: string
          description?: string | null
          id?: number
          nom: string
          taille?: number | null
          type?: string
          updatedAt?: string
        }
        Update: {
          categorie?: string | null
          chemin?: string
          clientId?: number | null
          contratId?: number | null
          createdAt?: string
          description?: string | null
          id?: number
          nom?: string
          taille?: number | null
          type?: string
          updatedAt?: string
        }
        Relationships: []
      }
      factures: {
        Row: {
          agentId: number
          clientId: number
          contenu: string
          dateGeneration: string
          id: number
          leaseId: number
          numeroFacture: string
        }
        Insert: {
          agentId: number
          clientId: number
          contenu: string
          dateGeneration?: string
          id?: number
          leaseId: number
          numeroFacture: string
        }
        Update: {
          agentId?: number
          clientId?: number
          contenu?: string
          dateGeneration?: string
          id?: number
          leaseId?: number
          numeroFacture?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_agentId_fkey"
            columns: ["agentId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          buildingId: number
          caution: number | null
          chargesAnnexes: number | null
          clientId: number
          createdAt: string
          dateDebut: string
          dateFin: string | null
          dateSignature: string
          droitsTerre: number | null
          id: number
          isDemo: boolean
          montantInitial: number
          numeroBail: string
          statut: Database["public"]["Enums"]["StatutLease"]
          uniteId: number
          updatedAt: string
        }
        Insert: {
          buildingId: number
          caution?: number | null
          chargesAnnexes?: number | null
          clientId: number
          createdAt?: string
          dateDebut: string
          dateFin?: string | null
          dateSignature?: string
          droitsTerre?: number | null
          id?: number
          isDemo?: boolean
          montantInitial: number
          numeroBail: string
          statut?: Database["public"]["Enums"]["StatutLease"]
          uniteId: number
          updatedAt?: string
        }
        Update: {
          buildingId?: number
          caution?: number | null
          chargesAnnexes?: number | null
          clientId?: number
          createdAt?: string
          dateDebut?: string
          dateFin?: string | null
          dateSignature?: string
          droitsTerre?: number | null
          id?: number
          isDemo?: boolean
          montantInitial?: number
          numeroBail?: string
          statut?: Database["public"]["Enums"]["StatutLease"]
          uniteId?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_buildingId_fkey"
            columns: ["buildingId"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_buildingId_fkey"
            columns: ["buildingId"]
            isOneToOne: false
            referencedRelation: "vue_batiment_stock"
            referencedColumns: ["batiment_id"]
          },
          {
            foreignKeyName: "leases_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_clientId_fkey"
            columns: ["clientId"]
            isOneToOne: false
            referencedRelation: "vue_client_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leases_uniteId_fkey"
            columns: ["uniteId"]
            isOneToOne: false
            referencedRelation: "unites"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          createdAt: string
          estLue: boolean
          id: number
          lien: string | null
          message: string
          titre: string
          type: string
          userId: number
        }
        Insert: {
          createdAt?: string
          estLue?: boolean
          id?: number
          lien?: string | null
          message: string
          titre: string
          type?: string
          userId: number
        }
        Update: {
          createdAt?: string
          estLue?: boolean
          id?: number
          lien?: string | null
          message?: string
          titre?: string
          type?: string
          userId?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          commentaire: string | null
          contrat_id: number | null
          created_at: string | null
          cree_par_id: number | null
          date_paiement: string | null
          id: number
          locataire_id: number | null
          mode_paiement: string | null
          montant: number
          periode_debut: string | null
          periode_fin: string | null
          reference: string
          reference_transaction: string | null
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          commentaire?: string | null
          contrat_id?: number | null
          created_at?: string | null
          cree_par_id?: number | null
          date_paiement?: string | null
          id?: number
          locataire_id?: number | null
          mode_paiement?: string | null
          montant: number
          periode_debut?: string | null
          periode_fin?: string | null
          reference: string
          reference_transaction?: string | null
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          commentaire?: string | null
          contrat_id?: number | null
          created_at?: string | null
          cree_par_id?: number | null
          date_paiement?: string | null
          id?: number
          locataire_id?: number | null
          mode_paiement?: string | null
          montant?: number
          periode_debut?: string | null
          periode_fin?: string | null
          reference?: string
          reference_transaction?: string | null
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_contrat_id_fkey"
            columns: ["contrat_id"]
            isOneToOne: false
            referencedRelation: "contrats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_cree_par_id_fkey"
            columns: ["cree_par_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_locataire_id_fkey"
            columns: ["locataire_id"]
            isOneToOne: false
            referencedRelation: "vue_client_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      payments: {
        Row: {
          agentId: number
          createdAt: string
          datePaiement: string
          id: number
          isDemo: boolean
          leaseId: number
          modePaiement: Database["public"]["Enums"]["ModePaiement"]
          montantVerse: number
          notes: string | null
          numeroFacture: string
        }
        Insert: {
          agentId: number
          createdAt?: string
          datePaiement?: string
          id?: number
          isDemo?: boolean
          leaseId: number
          modePaiement?: Database["public"]["Enums"]["ModePaiement"]
          montantVerse: number
          notes?: string | null
          numeroFacture: string
        }
        Update: {
          agentId?: number
          createdAt?: string
          datePaiement?: string
          id?: number
          isDemo?: boolean
          leaseId?: number
          modePaiement?: Database["public"]["Enums"]["ModePaiement"]
          montantVerse?: number
          notes?: string | null
          numeroFacture?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_agentId_fkey"
            columns: ["agentId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_leaseId_fkey"
            columns: ["leaseId"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      referrers: {
        Row: {
          adresse: string | null
          contact: string
          createdAt: string
          email: string | null
          id: number
          isActive: boolean
          isDemo: boolean
          nom: string
          photoUrl: string | null
          prenom: string
          tauxCommission: number
          typeCommission: Database["public"]["Enums"]["TypeCommission"]
          updatedAt: string
        }
        Insert: {
          adresse?: string | null
          contact: string
          createdAt?: string
          email?: string | null
          id?: number
          isActive?: boolean
          isDemo?: boolean
          nom: string
          photoUrl?: string | null
          prenom: string
          tauxCommission?: number
          typeCommission?: Database["public"]["Enums"]["TypeCommission"]
          updatedAt?: string
        }
        Update: {
          adresse?: string | null
          contact?: string
          createdAt?: string
          email?: string | null
          id?: number
          isActive?: boolean
          isDemo?: boolean
          nom?: string
          photoUrl?: string | null
          prenom?: string
          tauxCommission?: number
          typeCommission?: Database["public"]["Enums"]["TypeCommission"]
          updatedAt?: string
        }
        Relationships: []
      }
      relances: {
        Row: {
          created_at: string | null
          date_envoi: string | null
          destinataire: string
          id: number
          message: string
          reference_id: number | null
          reference_type: string | null
          statut: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          date_envoi?: string | null
          destinataire: string
          id?: number
          message: string
          reference_id?: number | null
          reference_type?: string | null
          statut?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          date_envoi?: string | null
          destinataire?: string
          id?: number
          message?: string
          reference_id?: number | null
          reference_type?: string | null
          statut?: string | null
          type?: string
        }
        Relationships: []
      }
      type_portes: {
        Row: {
          batiment_id: number | null
          created_at: string | null
          description: string | null
          id: number
          prix_mensuel: number
          quantite_disponible: number | null
          quantite_totale: number | null
          surface_m2: number | null
          type_nom: string
          updated_at: string | null
        }
        Insert: {
          batiment_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          prix_mensuel: number
          quantite_disponible?: number | null
          quantite_totale?: number | null
          surface_m2?: number | null
          type_nom: string
          updated_at?: string | null
        }
        Update: {
          batiment_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          prix_mensuel?: number
          quantite_disponible?: number | null
          quantite_totale?: number | null
          surface_m2?: number | null
          type_nom?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "type_portes_batiment_id_fkey"
            columns: ["batiment_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "type_portes_batiment_id_fkey"
            columns: ["batiment_id"]
            isOneToOne: false
            referencedRelation: "vue_batiment_stock"
            referencedColumns: ["batiment_id"]
          },
        ]
      }
      unites: {
        Row: {
          buildingId: number
          createdAt: string
          etage: number
          id: number
          isDemo: boolean
          loyerBase: number
          numeroPorte: string
          statut: Database["public"]["Enums"]["StatutUnite"]
          typeUnite: Database["public"]["Enums"]["TypeUnite"]
          updatedAt: string
        }
        Insert: {
          buildingId: number
          createdAt?: string
          etage?: number
          id?: number
          isDemo?: boolean
          loyerBase: number
          numeroPorte: string
          statut?: Database["public"]["Enums"]["StatutUnite"]
          typeUnite: Database["public"]["Enums"]["TypeUnite"]
          updatedAt?: string
        }
        Update: {
          buildingId?: number
          createdAt?: string
          etage?: number
          id?: number
          isDemo?: boolean
          loyerBase?: number
          numeroPorte?: string
          statut?: Database["public"]["Enums"]["StatutUnite"]
          typeUnite?: Database["public"]["Enums"]["TypeUnite"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "unites_buildingId_fkey"
            columns: ["buildingId"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unites_buildingId_fkey"
            columns: ["buildingId"]
            isOneToOne: false
            referencedRelation: "vue_batiment_stock"
            referencedColumns: ["batiment_id"]
          },
        ]
      }
      users: {
        Row: {
          actif: boolean
          createdAt: string
          dernierConnexion: string | null
          email: string
          id: number
          nom: string
          password: string
          prenom: string
          role: Database["public"]["Enums"]["Role"]
          telephone: string | null
          updatedAt: string
        }
        Insert: {
          actif?: boolean
          createdAt?: string
          dernierConnexion?: string | null
          email: string
          id?: number
          nom: string
          password: string
          prenom: string
          role?: Database["public"]["Enums"]["Role"]
          telephone?: string | null
          updatedAt?: string
        }
        Update: {
          actif?: boolean
          createdAt?: string
          dernierConnexion?: string | null
          email?: string
          id?: number
          nom?: string
          password?: string
          prenom?: string
          role?: Database["public"]["Enums"]["Role"]
          telephone?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      visites: {
        Row: {
          compteRendu: string | null
          contact: string
          createdAt: string
          creeParId: number | null
          dateRelance: string | null
          dateVisite: string
          email: string | null
          id: number
          isDemo: boolean
          motif: Database["public"]["Enums"]["MotifVisite"]
          nomVisiteur: string
          prenomVisiteur: string
          relanceSouhait: boolean
          responsable: string | null
          statutRelance: Database["public"]["Enums"]["StatutRelance"]
          updatedAt: string
          bienVisiteId: number
        }
        Insert: {
          compteRendu?: string | null
          contact: string
          createdAt?: string
          creeParId?: number | null
          dateRelance?: string | null
          dateVisite?: string
          email?: string | null
          id?: number
          isDemo?: boolean
          motif?: Database["public"]["Enums"]["MotifVisite"]
          nomVisiteur: string
          prenomVisiteur: string
          relanceSouhait?: boolean
          responsable?: string | null
          statutRelance?: Database["public"]["Enums"]["StatutRelance"]
          updatedAt?: string
          bienVisiteId: number
        }
        Update: {
          compteRendu?: string | null
          contact?: string
          createdAt?: string
          creeParId?: number | null
          dateRelance?: string | null
          dateVisite?: string
          email?: string | null
          id?: number
          isDemo?: boolean
          motif?: Database["public"]["Enums"]["MotifVisite"]
          nomVisiteur?: string
          prenomVisiteur?: string
          relanceSouhait?: boolean
          responsable?: string | null
          statutRelance?: Database["public"]["Enums"]["StatutRelance"]
          updatedAt?: string
          bienVisiteId?: number
        }
        Relationships: [
          {
            foreignKeyName: "visites_bienVisiteId_fkey"
            columns: ["bienVisiteId"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visites_creeParId_fkey"
            columns: ["creeParId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vue_batiment_stock: {
        Row: {
          batiment_id: number | null
          batiment_nom: string | null
          nombre_attributions_actives: number | null
          nombre_types_portes: number | null
          portes_disponibles: number | null
          portes_occupees: number | null
          total_portes: number | null
        }
        Relationships: []
      }
      vue_client_summary: {
        Row: {
          client_id: number | null
          client_nom: string | null
          client_prenom: string | null
          date_premiere_attribution: string | null
          loyer_mensuel_total: number | null
          nombre_baux: number | null
          nombre_portes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      attribuer_portes: {
        Args: {
          p_client_id: number
          p_date_debut: string
          p_notes?: string
          p_quantite: number
          p_type_porte_id: number
        }
        Returns: Json
      }
      resilier_attribution: {
        Args: { p_attribution_id: number; p_date_fin: string; p_motif?: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_type_porte: {
        Args: {
          p_batiment_id: number
          p_description?: string
          p_prix_mensuel: number
          p_quantite_totale: number
          p_surface_m2?: number
          p_type_nom: string
        }
        Returns: Json
      }
    }
    Enums: {
      ModePaiement: "ESPECES" | "VIREMENT" | "MOBILE_MONEY" | "CHEQUE"
      MotifVisite: "DECOUVERTE" | "NEGOCIATION" | "RECLAMATION" | "AUTRE"
      Role: "SUPER_ADMIN" | "ADMIN" | "SECRETAIRE" | "AGENT_RECOUVREMENT" | "DIRECTION"
      StatutBien: "DISPONIBLE" | "LOUE" | "VENDU" | "EN_RENOVATION" | "RESERVE"
      StatutCommission: "EN_ATTENTE" | "PAYEE"
      StatutContrat: "ACTIF" | "RESILIE" | "TERMINE" | "EN_COURS"
      StatutLease: "ACTIF" | "TERMINE" | "RESILIE"
      StatutPaiement: "PAYE" | "EN_RETARD" | "PARTIEL" | "EN_ATTENTE"
      StatutRelance: "EN_ATTENTE" | "EFFECTUEE" | "ANNULEE"
      StatutUnite: "VACANT" | "OCCUPE" | "RESERVE"
      TypeAlerte: "PAIEMENT_ECHEANCE" | "BAIL_EXPIRATION" | "RELANCE_VISITE" | "GENERAL"
      TypeBien: "APPARTEMENT" | "MAISON" | "VILLA" | "STUDIO" | "BUREAU" | "COMMERCE" | "ENTREPOT" | "TERRAIN"
      TypeBuilding: "R2" | "R3" | "R4" | "VILLA" | "COUR_COMMUNE"
      TypeClient: "SOUSCRIPTEUR" | "CLIENT"
      TypeCommission: "FIXE" | "POURCENTAGE"
      TypeContrat: "LOCATION" | "VENTE"
      TypeUnite: "STUDIO" | "CHAMBRE" | "CHAMBRE_SALON" | "MAGASIN"
    }
    CompositeTypes: {}
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ModePaiement: ["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"],
      MotifVisite: ["DECOUVERTE", "NEGOCIATION", "RECLAMATION", "AUTRE"],
      Role: ["SUPER_ADMIN", "ADMIN", "SECRETAIRE", "AGENT_RECOUVREMENT", "DIRECTION"],
      StatutBien: ["DISPONIBLE", "LOUE", "VENDU", "EN_RENOVATION", "RESERVE"],
      StatutCommission: ["EN_ATTENTE", "PAYEE"],
      StatutContrat: ["ACTIF", "RESILIE", "TERMINE", "EN_COURS"],
      StatutLease: ["ACTIF", "TERMINE", "RESILIE"],
      StatutPaiement: ["PAYE", "EN_RETARD", "PARTIEL", "EN_ATTENTE"],
      StatutRelance: ["EN_ATTENTE", "EFFECTUEE", "ANNULEE"],
      StatutUnite: ["VACANT", "OCCUPE", "RESERVE"],
      TypeAlerte: ["PAIEMENT_ECHEANCE", "BAIL_EXPIRATION", "RELANCE_VISITE", "GENERAL"],
      TypeBien: ["APPARTEMENT", "MAISON", "VILLA", "STUDIO", "BUREAU", "COMMERCE", "ENTREPOT", "TERRAIN"],
      TypeBuilding: ["R2", "R3", "R4", "VILLA", "COUR_COMMUNE"],
      TypeClient: ["SOUSCRIPTEUR", "CLIENT"],
      TypeCommission: ["FIXE", "POURCENTAGE"],
      TypeContrat: ["LOCATION", "VENTE"],
      TypeUnite: ["STUDIO", "CHAMBRE", "CHAMBRE_SALON", "MAGASIN"],
    },
  },
} as const
