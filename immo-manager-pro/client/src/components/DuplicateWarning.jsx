import { AlertTriangle, Clock, X, Check } from 'lucide-react';
import { formatTimeDifference } from '../hooks/useDuplicateDetection';

export const DuplicateWarning = ({ duplicates, onConfirm, onCancel, newData }) => {
  if (!duplicates || duplicates.length === 0) return null;

  const formatDate = (date) => {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMatchingFields = (duplicate) => {
    const matches = [];
    Object.keys(newData).forEach(key => {
      if (newData[key] && duplicate[key] === newData[key]) {
        matches.push(key);
      }
    });
    return matches;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-yellow-50">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                ⚠️ Doublon(s) Détecté(s)
              </h2>
              <p className="text-sm text-gray-600">
                {duplicates.length} enregistrement{duplicates.length > 1 ? 's similaire' : ' similaire'} trouvé{duplicates.length > 1 ? 's' : ''} dans la base de données
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body - Liste des doublons */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Information :</strong> Des enregistrements similaires existent déjà. 
              Vérifiez les dates de création pour distinguer les anciens des nouveaux.
            </p>
          </div>

          {duplicates.map((duplicate, index) => {
            const matchingFields = getMatchingFields(duplicate);
            const createdAt = duplicate.created_at || duplicate.date_creation;
            const updatedAt = duplicate.updated_at || duplicate.derniere_modification;
            
            return (
              <div
                key={duplicate.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-yellow-400 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                      #{index + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {duplicate.nom || duplicate.titre || 'Enregistrement'}
                        {duplicate.prenom && ` ${duplicate.prenom}`}
                      </h3>
                      <p className="text-xs text-gray-500">ID: {duplicate.id}</p>
                    </div>
                  </div>
                  
                  {/* Badge ancien/récent */}
                  <div className="flex flex-col items-end gap-1">
                    {createdAt && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                        {formatTimeDifference(createdAt, new Date())}
                      </span>
                    )}
                    {updatedAt && updatedAt !== createdAt && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                        Modifié {formatTimeDifference(updatedAt, new Date())}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dates détaillées */}
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  {createdAt && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <div>
                        <span className="font-medium">Créé le:</span>
                        <br />
                        {formatDate(createdAt)}
                      </div>
                    </div>
                  )}
                  {updatedAt && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <div>
                        <span className="font-medium">Modifié le:</span>
                        <br />
                        {formatDate(updatedAt)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Champs correspondants */}
                {matchingFields.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      Champs identiques:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchingFields.map(field => (
                        <span
                          key={field}
                          className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded"
                        >
                          {field}: {duplicate[field]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Voulez-vous continuer malgré les doublons détectés ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                <X className="w-4 h-4 inline mr-2" />
                Annuler
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
              >
                <Check className="w-4 h-4 inline mr-2" />
                Continuer quand même
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
