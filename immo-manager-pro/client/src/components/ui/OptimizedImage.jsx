import { useState, useEffect } from 'react';

// Cache d'images en mémoire
const imageCache = new Map();

export const OptimizedImage = ({ 
  src, 
  alt, 
  className = '', 
  fallback = '/placeholder.svg',
  lazy = true 
}) => {
  const [imageSrc, setImageSrc] = useState(imageCache.get(src) || fallback);
  const [isLoading, setIsLoading] = useState(!imageCache.has(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src || imageCache.has(src)) return;

    const img = new Image();
    img.src = src;

    img.onload = () => {
      imageCache.set(src, src);
      setImageSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return (
    <img
      src={hasError ? fallback : imageSrc}
      alt={alt}
      className={`${className} ${isLoading ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
    />
  );
};

// Préchargement d'images critiques
export const preloadImage = (src) => {
  if (imageCache.has(src)) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      imageCache.set(src, src);
      resolve();
    };
    img.onerror = reject;
  });
};

// Préchargement de plusieurs images
export const preloadImages = (srcs) => {
  return Promise.all(srcs.map(preloadImage));
};
