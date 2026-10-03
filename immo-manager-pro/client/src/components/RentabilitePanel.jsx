import React, { useState, useEffect } from 'react';
import { Building2, TrendingUp, DollarSign } from 'lucide-react';
import api from '../../utils/api';

export default function RentabilitePanel() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/caisse/rentabilite');
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement de la rentabilité...</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map(b => (
          <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-blue-100 flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <Building2 className="text-blue-600" size={20} />
              </div>
              <h3 className="font-bold text-gray-900">{b.nom}</h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Revenus (Encaissements)</span>
                <span className="font-bold text-green-600">+{b.revenus.toLocaleString()} F</span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Dépenses & Charges</span>
                <span className="font-bold text-red-500">-{b.depenses.toLocaleString()} F</span>
              </div>
              
              <div className="pt-3 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Bénéfice Net</span>
                  <span className={`font-bold ${b.rentabiliteNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {b.rentabiliteNet > 0 ? '+' : ''}{b.rentabiliteNet.toLocaleString()} F
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className={b.roi >= 0 ? 'text-green-500' : 'text-red-500'} />
                  <span className="text-sm font-medium text-gray-700">Marge de rentabilité</span>
                </div>
                <span className={`font-bold ${b.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {b.roi}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
