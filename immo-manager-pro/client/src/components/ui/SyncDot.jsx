import { useEffect, useState } from 'react';

export const SyncDot = () => {
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Écouter les événements de rafraîchissement SWR
    const interval = setInterval(() => {
      // Simuler la détection de rafraîchissement
      // En production, SWR expose isValidating via useSWRConfig
      setIsValidating(prev => !prev);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${isValidating ? 'bg-green-500' : 'bg-gray-300'}`} />
        {isValidating && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
        )}
      </div>
      <span className="hidden sm:inline">En direct</span>
    </div>
  );
};
