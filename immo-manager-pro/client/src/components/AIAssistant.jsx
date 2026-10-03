import React, { useState } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import api from '../utils/api';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Bonjour ! Je suis Yamtiken AI, votre assistant intelligent. Je peux résumer vos baux, identifier les impayés ou analyser vos revenus. Que puis-je faire pour vous aujourd'hui ?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  if (!user) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      setTimeout(async () => {
        let responseText = "Je suis en cours d'apprentissage sur ce sujet. Pouvez-vous préciser ?";
        
        const lowerInput = userMsg.toLowerCase();
        
        if (lowerInput.includes('retard') || lowerInput.includes('impay')) {
          try {
            const res = await api.get('/recouvrement/clients-retard');
            const retards = res.data.clientsRetard || [];
            responseText = `J'ai analysé vos données. Vous avez actuellement ${retards.length} locataires en retard de paiement. Allez dans le module Recouvrement pour les relancer.`;
          } catch(e) { responseText = "Impossible de récupérer les impayés actuellement."; }
        } 
        else if (lowerInput.includes('baux') || lowerInput.includes('locataires')) {
          try {
            const res = await api.get('/dashboard/kpi');
            responseText = `Vous avez ${res.data.bauxActifs} baux actifs en cours de gestion, avec un taux d'occupation de ${res.data.tauxOccupation}%.`;
          } catch(e) { responseText = "Impossible d'accéder aux statistiques."; }
        }
        else if (lowerInput.includes('bonjour') || lowerInput.includes('salut')) {
          responseText = `Bonjour ${user.prenom} ! Prêt à gérer l'immobilier aujourd'hui ?`;
        }
        else {
          responseText = "C'est noté. En tant qu'IA intégrée à Yamtiken, je veille sur vos données en temps réel. Bientôt, je pourrai générer vos contrats automatiquement !";
        }

        setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Oups, une erreur de connexion est survenue.' }]);
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-green-700 text-white p-4 rounded-full shadow-2xl hover:bg-green-800 transition-all flex items-center gap-2 hover:pr-6 group"
        >
          <Sparkles size={24} />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-medium">
            Assistant IA
          </span>
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xl border w-80 sm:w-96 overflow-hidden flex flex-col" style={{ height: '500px' }}>
          <div className="bg-green-700 text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot size={24} />
              <h3 className="font-bold">Yamtiken AI</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-green-600 p-1 rounded-full"><X size={20}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-green-700 text-white rounded-br-none' : 'bg-white border text-gray-800 shadow-sm rounded-bl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border p-3 rounded-2xl shadow-sm text-gray-500 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t bg-white flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Posez une question..."
              className="flex-1 px-4 py-2 border rounded-full text-sm outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
            />
            <button type="submit" disabled={!input.trim() || loading} className="p-2 bg-green-700 text-white rounded-full hover:bg-green-800 disabled:opacity-50">
              <Send size={18} className="ml-1" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
