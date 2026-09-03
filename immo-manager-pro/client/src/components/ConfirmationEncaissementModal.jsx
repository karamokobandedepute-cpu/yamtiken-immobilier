import { CheckCircle, Printer, X, FileText, Download } from 'lucide-react'
import { formatCurrency } from '../utils/formatters'

const ConfirmationEncaissementModal = ({ paymentData, onClose, onPrint, onDownload }) => {
  const { payment, stats } = paymentData

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-slideUp">
        {/* En-tête compact */}
        <div className="p-4 text-center" style={{ background: 'linear-gradient(135deg, #0D3B1F 0%, #1A6B35 100%)' }}>
          <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">
            ✅ Encaissement Enregistré
          </h2>
        </div>

        {/* Corps compact */}
        <div className="p-4 space-y-3">
          {/* Numéro de facture */}
          <div className="text-center p-3 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #10B981' }}>
            <p className="text-xs font-medium" style={{ color: '#6B7280' }}>N° Facture</p>
            <p className="text-lg font-bold" style={{ color: '#0D3B1F' }}>
              {payment.numeroFacture}
            </p>
          </div>

          {/* Client et Bail en une ligne */}
          <div className="p-3 rounded-lg" style={{ background: '#F9FAFB' }}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs" style={{ color: '#6B7280' }}>Client:</span>
              <span className="text-sm font-semibold" style={{ color: '#0D3B1F' }}>
                {payment.lease.client.prenom} {payment.lease.client.nom}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: '#6B7280' }}>Bail:</span>
              <span className="text-sm font-semibold" style={{ color: '#0D3B1F' }}>
                {payment.lease.numeroBail}
              </span>
            </div>
          </div>

          {/* Montants compacts avec animation */}
          <div className="p-3 rounded-lg space-y-2" style={{ background: 'linear-gradient(135deg, #E8F5EC 0%, #F0FDF4 100%)', border: '1px solid #10B981' }}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium" style={{ color: '#6B7280' }}>💰 Montant payé</span>
              <span className="text-xl font-bold animate-pulse" style={{ color: '#10B981' }}>
                {formatCurrency(payment.montantVerse)}
              </span>
            </div>
            <div className="h-px" style={{ background: '#D1FAE5' }}></div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium" style={{ color: '#6B7280' }}>⏰ Reste à payer</span>
              <span className={`text-lg font-bold ${stats.resteDu > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {formatCurrency(stats.resteDu)}
              </span>
            </div>
          </div>

          {/* Statut rapide */}
          {stats.resteDu === 0 ? (
            <div className="p-2 rounded-lg text-center text-sm font-medium" style={{ background: '#ECFDF5', color: '#059669' }}>
              ✅ Bail entièrement réglé
            </div>
          ) : (
            <div className="p-2 rounded-lg text-center text-sm font-medium" style={{ background: '#FEF3C7', color: '#D97706' }}>
              ⚠️ Solde restant à recouvrer
            </div>
          )}
        </div>

        {/* Actions compactes */}
        <div className="p-4 pt-0 space-y-2">
          <button
            onClick={onPrint}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold rounded-lg transition-all transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #0D3B1F 0%, #1A6B35 100%)', color: 'white' }}
          >
            <Printer size={18} />
            🖨️ Imprimer le Reçu
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onDownload}
              className="flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-all"
              style={{ background: '#E8F5EC', color: '#0D3B1F' }}
            >
              <Download size={16} />
              Télécharger
            </button>

            <button
              onClick={onClose}
              className="flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-all"
              style={{ background: '#F3F4F6', color: '#6B7280' }}
            >
              <X size={16} />
              Fermer
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default ConfirmationEncaissementModal
