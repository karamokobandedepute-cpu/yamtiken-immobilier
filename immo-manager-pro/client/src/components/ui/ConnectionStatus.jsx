import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Server, Database, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'http://54.36.209.70:5000/api' : '/api');

export const ConnectionStatus = ({ showLabel = true, compact = false }) => {
  const [status, setStatus] = useState({
    backend: 'checking',
    database: 'checking',
    lastCheck: null
  });

  const checkConnection = async () => {
    try {
      // Vérifier le backend
      const backendStart = Date.now();
      const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
      const backendTime = Date.now() - backendStart;

      setStatus({
        backend: response.status === 200 ? 'connected' : 'disconnected',
        database: response.data?.database === 'connected' ? 'connected' : 'disconnected',
        backendTime,
        lastCheck: new Date()
      });
    } catch (error) {
      setStatus({
        backend: 'disconnected',
        database: 'disconnected',
        error: error.message,
        lastCheck: new Date()
      });
    }
  };

  useEffect(() => {
    // Vérification initiale
    checkConnection();

    // Vérification toutes les 10 secondes
    const interval = setInterval(checkConnection, 10000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (state) => {
    switch (state) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-red-500';
      case 'checking': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (state) => {
    switch (state) {
      case 'connected': return 'Connecté';
      case 'disconnected': return 'Déconnecté';
      case 'checking': return 'Vérification...';
      default: return 'Inconnu';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(status.backend)}`} />
          {status.backend === 'connected' && (
            <div className={`absolute inset-0 w-2 h-2 rounded-full ${getStatusColor(status.backend)} animate-ping`} />
          )}
        </div>
        {showLabel && (
          <span className="text-xs text-gray-600 hidden sm:inline">
            {getStatusText(status.backend)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Bouton principal */}
      <button
        onClick={checkConnection}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          status.backend === 'connected'
            ? 'bg-green-50 text-green-700 hover:bg-green-100'
            : status.backend === 'disconnected'
            ? 'bg-red-50 text-red-700 hover:bg-red-100'
            : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
        }`}
      >
        <div className="relative">
          {status.backend === 'connected' ? (
            <Wifi className="w-4 h-4" />
          ) : status.backend === 'disconnected' ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4 animate-pulse" />
          )}
          {status.backend === 'connected' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        {showLabel && (
          <span className="text-sm font-medium hidden sm:inline">
            {getStatusText(status.backend)}
          </span>
        )}
      </button>

      {/* Tooltip détaillé */}
      <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Server className="w-4 h-4" />
          État de la connexion
        </h4>

        {/* Backend */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">Backend API</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(status.backend)}`} />
            <span className={`text-xs font-medium ${
              status.backend === 'connected' ? 'text-green-600' : 'text-red-600'
            }`}>
              {getStatusText(status.backend)}
            </span>
          </div>
        </div>

        {/* Database */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">Base de données</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(status.database)}`} />
            <span className={`text-xs font-medium ${
              status.database === 'connected' ? 'text-green-600' : 'text-red-600'
            }`}>
              {getStatusText(status.database)}
            </span>
          </div>
        </div>

        {/* Infos supplémentaires */}
        {status.backendTime && (
          <div className="text-xs text-gray-500 mb-2">
            Temps de réponse: {status.backendTime}ms
          </div>
        )}

        {status.lastCheck && (
          <div className="text-xs text-gray-500">
            Dernière vérification: {status.lastCheck.toLocaleTimeString('fr-FR')}
          </div>
        )}

        {status.error && (
          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
            {status.error}
          </div>
        )}

        <button
          onClick={checkConnection}
          className="mt-3 w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors"
        >
          Vérifier maintenant
        </button>
      </div>
    </div>
  );
};

// Version mini pour la navbar
export const ConnectionDot = () => {
  return <ConnectionStatus showLabel={false} compact={true} />;
};
