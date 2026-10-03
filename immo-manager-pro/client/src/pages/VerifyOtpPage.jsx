import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ShieldCheck, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const { pendingVerification, clearPendingVerification, user } = useAuthStore();
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputs = useRef([]);

  useEffect(() => {
    // Si l'utilisateur est déjà connecté, redirection vers home
    if (user) {
      navigate('/');
    }
    // Si aucun compte n'est en attente de vérification, retour au login
    if (!pendingVerification) {
      navigate('/login');
    }
  }, [user, pendingVerification, navigate]);

  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/[^0-9]/g, '');
    const newCode = [...code];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);
    if (pastedData.length === 6) {
      inputs.current[5].focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otp = code.join('');
    if (otp.length < 6) {
      setError('Veuillez entrer les 6 chiffres');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/auth/verify-otp`, {
        userId: pendingVerification.userId,
        code: otp
      });

      const { token, refreshToken, user } = res.data;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      useAuthStore.setState({
        user,
        token,
        refreshToken,
        isAuthenticated: true,
        isLoading: false
      });
      clearPendingVerification();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la vérification');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await axios.post(`${API_URL}/auth/resend-otp`, { userId: pendingVerification.userId });
      setResendCooldown(60);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du renvoi du code');
    }
  };

  if (!pendingVerification) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-green-100 p-3 rounded-full">
            <ShieldCheck className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Vérification de sécurité
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Un code de vérification à 6 chiffres a été envoyé à 
          <span className="font-medium text-gray-900"> {pendingVerification.email}</span>.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 text-center mb-4">
                Entrez le code
              </label>
              <div className="flex justify-between items-center gap-2 max-w-xs mx-auto" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm transition-all"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 py-2 rounded-md font-medium">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Vérifier mon compte'}
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-sm font-medium text-green-600 hover:text-green-500 disabled:text-gray-400"
              >
                {resendCooldown > 0 
                  ? `Renvoyer le code dans ${resendCooldown}s` 
                  : 'Renvoyer un nouveau code'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
