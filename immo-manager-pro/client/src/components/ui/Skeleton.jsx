import React from 'react';

export const Skeleton = ({
  className = '',
  width = '100%',
  height = '16px',
  rounded = false,
  circle = false,
}) => (
  <div
    className={`animate-pulse bg-gray-200 ${rounded ? 'rounded-lg' : ''} ${circle ? 'rounded-full' : ''} ${className}`}
    style={{ width, height }}
  />
);

// Skeleton d'une ligne de carte (avatar + texte + badge)
export const SkeletonCard = () => (
  <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
    <div className="flex items-center gap-4">
      {/* Avatar */}
      <Skeleton circle width="48px" height="48px" />
      
      {/* Texte */}
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height="20px" rounded />
        <Skeleton width="40%" height="16px" rounded />
      </div>
      
      {/* Badge */}
      <Skeleton width="80px" height="24px" rounded />
    </div>
    
    <div className="mt-4 space-y-2">
      <Skeleton width="100%" height="12px" rounded />
      <Skeleton width="80%" height="12px" rounded />
    </div>
  </div>
);

// Skeleton d'une ligne de tableau
export const SkeletonRow = () => (
  <tr className="border-b border-gray-100">
    {[1,2,3,4,5].map(i => (
      <td key={i} className="px-4 py-3">
        <Skeleton height="16px" rounded />
      </td>
    ))}
  </tr>
);

// Skeleton d'un tableau entier
export const SkeletonTable = ({ rows = 5 }) => (
  <div className="overflow-hidden rounded-lg border border-gray-200">
    <table className="w-full">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </tbody>
    </table>
  </div>
);

// Skeleton d'une carte stat (dashboard)
export const SkeletonStat = () => (
  <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-4">
      <Skeleton width="120px" height="16px" rounded />
      <Skeleton circle width="40px" height="40px" />
    </div>
    <Skeleton width="80px" height="32px" rounded />
    <div className="mt-2">
      <Skeleton width="60%" height="14px" rounded />
    </div>
  </div>
);
