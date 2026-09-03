import { SearchBar } from '../components/SearchBar';

export default function SearchTestPage() {
  const handleSelect = (item) => {
    console.log('Item sélectionné:', item);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔍 Recherche Universelle YAMTIKEN CRM
          </h1>
          <p className="text-gray-600 mb-8">
            Recherchez parmi les utilisateurs, clients, biens et contrats en temps réel
          </p>

          <SearchBar onSelect={handleSelect} />

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">✨ Fonctionnalités</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Recherche en temps réel (debounce 300ms)</li>
                <li>• 4 onglets: Utilisateurs, Clients, Biens, Contrats</li>
                <li>• Navigation clavier (↑↓ Enter Esc)</li>
                <li>• Surlignage des correspondances</li>
                <li>• Fiche détaillée au clic</li>
              </ul>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">🎯 Raccourcis</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• <kbd className="px-2 py-1 bg-white rounded border">↑</kbd> Suggestion précédente</li>
                <li>• <kbd className="px-2 py-1 bg-white rounded border">↓</kbd> Suggestion suivante</li>
                <li>• <kbd className="px-2 py-1 bg-white rounded border">Enter</kbd> Sélectionner</li>
                <li>• <kbd className="px-2 py-1 bg-white rounded border">Esc</kbd> Fermer</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>💡 Astuce:</strong> Tapez un nom, email, rôle ou ID pour commencer la recherche.
              Les résultats s'affichent automatiquement après 300ms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
