import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Client } from '../types';
import { 
  Building, Plus, Trash2, Search, Phone, MapPin, User, Loader2, Save, X 
} from 'lucide-react';

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [document, setDocument] = useState('');

  useEffect(() => {
    const q = query(collection(db, CollectionName.CLIENTS), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
      setClients(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este cliente?')) {
      try {
        await deleteDoc(doc(db, CollectionName.CLIENTS, id));
      } catch (error) {
        console.error("Error deleting client:", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, CollectionName.CLIENTS), {
        name: name.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        document: document.trim(),
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error adding client:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setContactName('');
    setPhone('');
    setAddress('');
    setDocument('');
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.contactName && c.contactName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carteira de Clientes</h1>
          <p className="text-gray-500">Gerencie empresas e contatos para abertura de O.S.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Cliente
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm"
          placeholder="Buscar por nome da empresa ou contato..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Building className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum cliente encontrado</h3>
              <p className="text-gray-500">Cadastre um novo cliente para começar.</p>
            </div>
          )}
          
          {filteredClients.map(client => (
            <div key={client.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col relative group">
              <button 
                onClick={() => handleDelete(client.id)}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">{client.name}</h3>
                  {client.document && <p className="text-xs text-gray-500">{client.document}</p>}
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 flex-1">
                {client.contactName && (
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 mt-0.5 text-gray-400" />
                    <span>{client.contactName}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 mt-0.5 text-gray-400" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400" />
                    <span className="line-clamp-2">{client.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">Novo Cliente</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-gray-500" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa / Cliente *</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border-gray-300" placeholder="Ex: Tech Solutions Ltda" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ / CPF</label>
                  <input type="text" value={document} onChange={e => setDocument(e.target.value)} className="w-full rounded-lg border-gray-300" placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-lg border-gray-300" placeholder="(11) 99999-9999" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full rounded-lg border-gray-300" placeholder="Ex: João da Silva" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                <textarea rows={3} value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border-gray-300 resize-none" placeholder="Rua, Número, Bairro, Cidade - UF" />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-75">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Save className="mr-2 w-4 h-4" />} Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;