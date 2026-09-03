import { useState } from 'react';
import { FormWithDuplicateCheck } from '../components/FormWithDuplicateCheck';
import { Shield, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

export default function DuplicateTestPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🛡️ Système Anti-Doublon YAMTIKEN
              </h1>
              <p className="text-gray-600">
                Protection automatique contre les doublons avec différenciation par date et heure
              </p>
            </div>
          </div>

          {/* Fonctionnalités */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Détection Automatique</h3>
              </div>
              <p className="text-sm text-blue-700">
                Vérification en temps réel avant chaque insertion
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Horodatage Précis</h3>
              </div>
              <p className="text-sm text-green-700">
                Chaque enregistrement avec date/heure de création et modification
              </p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-yellow-900">Différenciation</h3>
              </div>
              <p className="text-sm text-yellow-700">
                Distinction claire entre anciens et nouveaux enregistrements
              </p>
            </div>
          </div>
        </div>

        {/* Détails techniques */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              🔍 Champs Vérifiés
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <strong>Email:</strong> Détection des emails identiques
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <strong>Téléphone:</strong> Détection des numéros identiques
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <strong>Nom complet:</strong> Vérification optionnelle
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <strong>Adresse:</strong> Pour les biens immobiliers
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              ⏱️ Informations Temporelles
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <strong>created_at:</strong> Date de création
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <strong>updated_at:</strong> Dernière modification
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <strong>Âge relatif:</strong> "il y a X heures/jours"
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <strong>Comparaison:</strong> Ancien vs Nouveau
              </li>
            </ul>
          </div>
        </div>

        {/* Workflow */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            🔄 Workflow de Détection
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 text-center p-4 bg-blue-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                1
              </div>
              <h3 className="font-semibold text-blue-900 mb-1">Saisie</h3>
              <p className="text-sm text-blue-700">Utilisateur remplit le formulaire</p>
            </div>

            <div className="text-gray-400">→</div>

            <div className="flex-1 text-center p-4 bg-yellow-50 rounded-lg">
              <div className="w-12 h-12 bg-yellow-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                2
              </div>
              <h3 className="font-semibold text-yellow-900 mb-1">Vérification</h3>
              <p className="text-sm text-yellow-700">Recherche de doublons (300ms)</p>
            </div>

            <div className="text-gray-400">→</div>

            <div className="flex-1 text-center p-4 bg-orange-50 rounded-lg">
              <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                3
              </div>
              <h3 className="font-semibold text-orange-900 mb-1">Alerte</h3>
              <p className="text-sm text-orange-700">Affichage des doublons trouvés</p>
            </div>

            <div className="text-gray-400">→</div>

            <div className="flex-1 text-center p-4 bg-green-50 rounded-lg">
              <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
                4
              </div>
              <h3 className="font-semibold text-green-900 mb-1">Décision</h3>
              <p className="text-sm text-green-700">Continuer ou annuler</p>
            </div>
          </div>
        </div>

        {/* Bouton de test */}
        <div className="text-center">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg shadow-lg"
          >
            {showForm ? 'Masquer le formulaire' : '🧪 Tester le système'}
          </button>
        </div>

        {/* Formulaire de test */}
        {showForm && (
          <div className="mt-6">
            <FormWithDuplicateCheck
              onSuccess={(data) => {
                console.log('Success:', data);
                setShowForm(false);
              }}
            />
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-2">
            💡 Comment tester :
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
            <li>Cliquez sur "Tester le système"</li>
            <li>Remplissez le formulaire avec un email existant (ex: test@example.com)</li>
            <li>Cliquez sur "Enregistrer"</li>
            <li>Le système détectera le doublon et affichera une alerte</li>
            <li>Vous verrez la différence de temps entre l'ancien et le nouveau</li>
            <li>Vous pouvez choisir de continuer ou d'annuler</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
