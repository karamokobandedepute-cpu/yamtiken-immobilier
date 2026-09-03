import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Building2, Package, Briefcase, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TABS = [
  { id: 'users', label: 'Utilisateurs', icon: User, table: 'users' },
  { id: 'clients', label: 'Clients', icon: User, table: 'clients' },
  { id: 'buildings', label: 'Biens', icon: Building2, table: 'buildings' },
  { id: 'leases', label: 'Contrats', icon: Briefcase, table: 'leases' }
];

const STATUS_COLORS = {
  'ACTIF': 'bg-green-100 text-green-800',
  'INACTIF': 'bg-gray-100 text-gray-800',
  'EN_ATTENTE': 'bg-yellow-100 text-yellow-800',
  'TERMINE': 'bg-blue-100 text-blue-800',
  'DISPONIBLE': 'bg-green-100 text-green-800',
  'LOUE': 'bg-blue-100 text-blue-800',
  'MAINTENANCE': 'bg-orange-100 text-orange-800'
};

export const SearchBar = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      searchData(query, activeTab);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const searchData = async (searchQuery, tab) => {
    setIsLoading(true);
    try {
      const tabConfig = TABS.find(t => t.id === tab);
      const { data, error } = await supabase
        .from(tabConfig.table)
        .select('*')
        .or(`nom.ilike.%${searchQuery}%,prenom.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,role.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setResults(data || []);
      setIsOpen(true);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (item) => {
    setSelectedItem(item);
    setIsOpen(false);
    if (onSelect) onSelect(item);
  };

  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const parts = text.toString().split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 font-semibold">{part}</mark>
        : part
    );
  };

  const getInitials = (item) => {
    if (item.nom && item.prenom) {
      return `${item.prenom[0]}${item.nom[0]}`.toUpperCase();
    }
    if (item.nom) {
      return item.nom.substring(0, 2).toUpperCase();
    }
    return '??';
  };

  const getStatusBadge = (statut) => {
    if (!statut) return null;
    const colorClass = STATUS_COLORS[statut] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {statut.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setIsOpen(true)}
          placeholder="Rechercher par nom, email, rôle..."
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs - Masqués */}
      <div className="hidden">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (query) searchData(query, tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Recherche en cours...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    index === selectedIndex ? 'bg-gray-100' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold">
                    {getInitials(item)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">
                      {highlightMatch(`${item.prenom || ''} ${item.nom || item.titre || ''}`, query)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.role && highlightMatch(item.role, query)}
                      {item.email && ` • ${highlightMatch(item.email, query)}`}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.statut || item.status)}
                    <span className="text-xs text-gray-400">#{item.id}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              Aucun résultat trouvé
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center text-2xl font-bold">
                    {getInitials(selectedItem)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedItem.prenom} {selectedItem.nom || selectedItem.titre}
                    </h2>
                    <p className="text-gray-600">{selectedItem.role}</p>
                    {getStatusBadge(selectedItem.statut || selectedItem.status)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {Object.entries(selectedItem).map(([key, value]) => {
                if (key === 'id' || key === 'password' || !value) return null;
                return (
                  <div key={key} className="flex items-start gap-4">
                    <span className="text-sm font-medium text-gray-500 w-32 capitalize">
                      {key.replace('_', ' ')}:
                    </span>
                    <span className="text-sm text-gray-900 flex-1">
                      {typeof value === 'object' ? JSON.stringify(value) : value.toString()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  // Action personnalisée
                  console.log('Action sur:', selectedItem);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Voir le détail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
