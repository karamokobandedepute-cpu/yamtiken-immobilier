import React, { useRef, useState } from 'react';
import { Camera, Loader2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function AvatarUpload({ entityId, entityType = 'user', currentPhotoUrl, onUploadSuccess }) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const { token, updateUser } = useAuthStore();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo.");
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    setLoading(true);
    try {
      const endpoint = entityType === 'user' 
        ? `${API_URL}/upload/user` 
        : `${API_URL}/upload/client/${entityId}`;
        
      const res = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      toast.success('Photo mise à jour avec succès');
      if (onUploadSuccess) {
        onUploadSuccess(res.data.photoUrl);
      }
      
      // Update global user state if it's the connected user
      if (entityType === 'user') {
        updateUser({ photoUrl: res.data.photoUrl });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Erreur lors de l'upload");
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const getFullImageUrl = (path) => {
    if (!path) return null;
    // Si l'URL commence par /uploads, on préfixe avec l'URL du backend
    if (path.startsWith('/uploads')) {
        const backendUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
        return `${backendUrl}${path}`;
    }
    return path;
  };

  return (
    <div className="relative group inline-block">
      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center relative">
        {currentPhotoUrl ? (
          <img 
            src={getFullImageUrl(currentPhotoUrl)} 
            alt="Profil" 
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-12 h-12 text-gray-400" />
        )}
        
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        )}
      </div>
      
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="absolute bottom-0 right-0 p-1.5 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        title="Modifier la photo"
      >
        <Camera className="w-4 h-4" />
      </button>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
