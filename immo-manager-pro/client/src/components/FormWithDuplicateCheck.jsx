import { useState } from 'react';
import { useDuplicateDetection, useTimestampedData } from '../hooks/useDuplicateDetection';
import { DuplicateWarning } from './DuplicateWarning';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Save, AlertCircle } from 'lucide-react';

// Exemple d'utilisation avec un formulaire client
export const FormWithDuplicateCheck = ({ onSuccess, initialData = null }) => {
  const [formData, setFormData] = useState(initialData || {
    nom: '',
    prenom: '',
    email: '',
    telephone: ''
  });
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { duplicates, isChecking, checkDuplicates } = useDuplicateDetection('clients', [
    'email',
    'telephone'
  ]);
  const { addTimestamps } = useTimestampedData();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Vérifier les doublons
    const result = await checkDuplicates(formData);

    if (result.hasDuplicates) {
      setShowDuplicateWarning(true);
      toast.warning(result.message);
      return;
    }

    // Pas de doublon, sauvegarder directement
    await saveData();
  };

  const saveData = async () => {
    setIsSaving(true);
    try {
      // Ajouter les timestamps automatiquement
      const dataWithTimestamps = addTimestamps(formData, !!initialData);

      let result;
      if (initialData?.id) {
        // Mise à jour
        result = await supabase
          .from('clients')
          .update(dataWithTimestamps)
          .eq('id', initialData.id);
      } else {
        // Création
        result = await supabase
          .from('clients')
          .insert([dataWithTimestamps]);
      }

      if (result.error) throw result.error;

      toast.success(initialData ? 'Client modifié avec succès' : 'Client créé avec succès');
      setShowDuplicateWarning(false);
      
      if (onSuccess) onSuccess(result.data);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDuplicate = async () => {
    await saveData();
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateWarning(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {initialData ? 'Modifier le client' : 'Nouveau client'}
          </h2>

          {/* Alerte anti-doublon */}
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Système anti-doublon actif</p>
                <p>
                  Les emails et téléphones seront vérifiés automatiquement. 
                  Chaque enregistrement est horodaté pour distinguer les anciens des nouveaux.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom *
              </label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onSuccess && onSuccess(null)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || isChecking}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving || isChecking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isChecking ? 'Vérification...' : 'Enregistrement...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Modal d'avertissement de doublon */}
      {showDuplicateWarning && (
        <DuplicateWarning
          duplicates={duplicates}
          newData={formData}
          onConfirm={handleConfirmDuplicate}
          onCancel={handleCancelDuplicate}
        />
      )}
    </>
  );
};
