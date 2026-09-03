import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Server } from 'lucide-react';

const ServerStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('/api/health', { 
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        setIsOnline(response.ok);
      } catch {
        setIsOnline(false);
      }
    };

    // Vérifier immédiatement
    checkServer();
    
    // Puis toutes les 30 secondes
    const interval = setInterval(checkServer, 30000);
    
    // Écouter les événements online/offline du navigateur
    const handleOnline = () => checkServer();
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/health', { 
        method: 'GET',
        cache: 'no-store'
      });
      setIsOnline(response.ok);
      if (response.ok) {
        window.location.reload();
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <WifiOff className="w-10 h-10 text-red-600" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">
            Serveur injoignable
          </h2>
          <p className="text-gray-600">
            Impossible de se connecter au serveur YAMTIKEN. 
            Vérifiez votre connexion internet ou réessayez.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <Server className="w-5 h-5" />
            <span className="font-medium">État du serveur</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">
            Le serveur est temporairement indisponible. 
            Les données ne seront pas perdues.
          </p>
        </div>

        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isChecking ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Vérification...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Réessayer la connexion
            </>
          )}
        </button>

        <p className="text-xs text-gray-500">
          Si le problème persiste, contactez le support technique.
        </p>
      </div>
    </div>
  );
};

export default ServerStatus;
