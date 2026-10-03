import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Save, FileSignature } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function EtatLieuxModal({ lease, onClose, onSuccess }) {
  const [type, setType] = useState('ENTREE');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Simulation: En production, on utiliserait un FormData avec multer pour les vrais fichiers.
  // Ici on simule une prise de photo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/etats-lieux', {
        leaseId: lease.id,
        type,
        description,
        photos: [] // On pourrait envoyer les URLs après upload
      });
      toast.success("L'État des Lieux a été généré et sécurisé !");
      onSuccess();
    } catch (err) {
      toast.error("Erreur lors de la création de l'état des lieux");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        
        <div className="bg-blue-600 flex justify-between items-center p-4 text-white">
          <div className="flex items-center gap-2">
            <FileSignature size={24} />
            <h2 className="text-xl font-bold">État des Lieux Numérique</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="font-semibold text-gray-800">Contrat: {lease.numeroBail}</p>
            <p className="text-sm text-gray-600">Locataire: {lease.client?.nom} {lease.client?.prenom}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'État des Lieux</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="ENTREE" checked={type === 'ENTREE'} onChange={() => setType('ENTREE')} className="text-blue-600 focus:ring-blue-500" />
                <span>À l'Entrée (Remise Clés)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="SORTIE" checked={type === 'SORTIE'} onChange={() => setType('SORTIE')} className="text-blue-600 focus:ring-blue-500" />
                <span>À la Sortie (Départ)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations / Remarques</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Ex: Quelques rayures sur la porte d'entrée. Peinture fraîche..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preuves Photographiques (Optionnel)</label>
            <div className="flex gap-4">
              <button type="button" className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors w-1/2">
                <Camera size={24} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Prendre une photo</span>
              </button>
              <button type="button" className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors w-1/2">
                <Upload size={24} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Importer galerie</span>
              </button>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
              <Save size={18} />
              {loading ? 'Enregistrement...' : 'Valider & Signer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
