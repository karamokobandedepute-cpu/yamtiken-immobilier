import React, { useState } from 'react';
import { Key, Calendar as CalendarIcon, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const PrisePossessionModal = ({ lease, onClose, onSuccess }) => {
  const [dateEntree, setDateEntree] = useState(new Date().toISOString().split('T')[0]);
  const [dureeMois, setDureeMois] = useState(12);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/leases/${lease.id}/prise-possession`, {
        dateEntree,
        dureeMois: parseInt(dureeMois)
      });
      toast.success('Clés remises avec succès ! Le recouvrement est activé.');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la remise des clés');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/40 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header (Glassmorphism look) */}
        <div className="relative h-32 bg-gradient-to-br from-green-600 to-emerald-800 flex flex-col items-center justify-center text-white p-6">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
          
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-2 shadow-inner border border-white/30">
            <Key size={32} className="text-white drop-shadow-md" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Remise des Clés</h2>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center mb-2">
            <p className="text-sm text-gray-500">
              Validez la prise de possession du bail <span className="font-bold text-gray-800">{lease.numeroBail}</span>.
            </p>
            <p className="text-xs text-amber-600 font-medium mt-1">
              Le recouvrement des loyers démarrera à partir de la date d'entrée.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Date d'entrée réelle
              </label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="date"
                  required
                  value={dateEntree}
                  onChange={(e) => setDateEntree(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Durée du contrat (Mois)
              </label>
              <select
                value={dureeMois}
                onChange={(e) => setDureeMois(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white"
              >
                <option value={1}>1 mois (Essai)</option>
                <option value={3}>3 mois (Saisonnier)</option>
                <option value={6}>6 mois (Semestre)</option>
                <option value={12}>12 mois (1 an - Standard)</option>
                <option value={24}>24 mois (2 ans)</option>
                <option value={36}>36 mois (3 ans - Commercial)</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-70"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle size={18} />
                  Valider
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrisePossessionModal;
