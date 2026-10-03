import React, { useState, useEffect } from 'react';
import { Home, Key, FileText, LogOut, CheckCircle, Clock } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ExtranetPortal() {
  const [step, setStep] = useState('LOGIN'); // LOGIN, OTP, DASHBOARD
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('extranet_token'));
  const [data, setData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchDashboard();
    }
  }, [token]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/extranet/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
      setStep('DASHBOARD');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      } else {
        toast.error("Erreur de chargement");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/extranet/login`, { email });
      setStep('OTP');
      toast.success("Si cet email existe, un code vous a été envoyé.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/extranet/verify-otp`, { email, code: otp });
      const newToken = res.data.token;
      localStorage.setItem('extranet_token', newToken);
      setToken(newToken);
      toast.success("Connexion réussie");
    } catch (err) {
      toast.error(err.response?.data?.message || "Code invalide");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('extranet_token');
    setToken(null);
    setStep('LOGIN');
    setData(null);
    setEmail('');
    setOtp('');
  };

  if (step === 'LOGIN' || step === 'OTP') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="bg-green-100 p-3 rounded-full">
              <Home className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Portail Locataire
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'LOGIN' ? 'Entrez votre email pour recevoir votre code' : 'Veuillez saisir le code reçu par email'}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {step === 'LOGIN' ? (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Adresse Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Envoi...' : 'Recevoir mon code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code à 6 chiffres</label>
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-green-500 focus:border-green-500"
                    maxLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Vérification...' : 'Se connecter'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-green-700 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 font-bold text-xl">
              <Home size={24} /> Mon Portail Immobilier
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 hover:bg-green-800 px-3 py-2 rounded-md transition-colors">
              <LogOut size={18} /> Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading && !data ? (
          <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto" /></div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Vos Contrats & Baux</h1>
            
            {data?.leases?.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun contrat</h3>
                <p className="mt-1 text-sm text-gray-500">Vous n'avez pas de contrat actif.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {data?.leases?.map(lease => (
                  <div key={lease.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-blue-900">{lease.numeroBail}</h3>
                        <p className="text-sm text-blue-700">{lease.bien?.designation || 'Bien'}</p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {lease.statut}
                      </span>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Loyer / Mensualité</p>
                          <p className="font-bold">{lease.montantInitial.toLocaleString()} FCFA</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date d'Effet</p>
                          <p className="font-medium">{lease.dateEntree ? new Date(lease.dateEntree).toLocaleDateString() : 'Non définie'}</p>
                        </div>
                      </div>

                      {!lease.dateEntree && lease.dateLivraisonPrevue && (
                        <div className="bg-amber-50 p-3 rounded-lg flex items-start gap-2 border border-amber-100">
                          <Clock className="text-amber-600 shrink-0 mt-0.5" size={16} />
                          <div>
                            <p className="text-amber-900 font-medium text-sm">Livraison prévue le :</p>
                            <p className="text-amber-700 text-sm">{new Date(lease.dateLivraisonPrevue).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}

                      {lease.cleRemise && (
                        <div className="bg-emerald-50 p-3 rounded-lg flex items-center gap-2 border border-emerald-100">
                          <CheckCircle className="text-emerald-600" size={16} />
                          <p className="text-emerald-900 text-sm font-medium">Clés remises</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Derniers Paiements</h4>
                      {lease.paiements?.slice(0, 3).map(p => (
                        <div key={p.id} className="flex justify-between items-center text-sm py-1">
                          <span className="text-gray-600">{new Date(p.datePaiement).toLocaleDateString()}</span>
                          <span className="font-medium text-green-600">+{p.montant.toLocaleString()} FCFA</span>
                        </div>
                      ))}
                      {(!lease.paiements || lease.paiements.length === 0) && (
                        <p className="text-sm text-gray-500">Aucun paiement récent.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
