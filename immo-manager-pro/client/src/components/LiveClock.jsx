import { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

const LiveClock = ({ showSeconds = true, showDate = true, className = '' }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    if (showSeconds) {
      return `${hours}:${minutes}:${seconds}`;
    }
    return `${hours}:${minutes}`;
  };

  const formatDate = (date) => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName} ${day} ${month} ${year}`;
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {showDate && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg" 
             style={{ background: '#E8F5EC' }}>
          <Calendar size={18} style={{ color: '#1A6B35' }} />
          <span className="font-medium" style={{ color: '#0D3B1F' }}>
            {formatDate(currentTime)}
          </span>
        </div>
      )}
      
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg" 
           style={{ background: '#0D3B1F' }}>
        <Clock size={18} style={{ color: '#C8960C' }} />
        <span className="font-bold text-lg" style={{ color: '#FFFFFF', fontFamily: 'monospace' }}>
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
};

export default LiveClock;
