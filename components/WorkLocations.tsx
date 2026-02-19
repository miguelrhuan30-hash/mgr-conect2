import React, { useState, useEffect } from 'react';
import firebase from '../firebase';
import { db } from '../firebase';
import { CollectionName, WorkLocation } from '../types';
import { MapPin, Plus, Trash2, Save, Loader2 } from 'lucide-react';

const WorkLocations: React.FC = () => {
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = db.collection(CollectionName.WORK_LOCATIONS).orderBy('name', 'asc');
    
    // Added error handling to onSnapshot
    const unsubscribe = q.onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as WorkLocation[];
      setLocations(data);
      setLoading(false);
    }, (error: any) => {
      // Suppress permission-denied errors as they are expected for unauthorized users
      if (error?.code !== 'permission-denied') {
        console.error("Error fetching locations:", error);
      }
      // Handle permission errors gracefully
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLat(position.coords.latitude.toString());
        setLng(position.coords.longitude.toString());
      }, (error) => {
        alert("Erro ao obter localização: " + error.message);
      });
    } else {
      alert("Geolocalização não suportada neste navegador.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !lat || !lng) return;

    setIsSubmitting(true);
    try {
      await db.collection(CollectionName.WORK_LOCATIONS).add({
        name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius: parseInt(radius),
        active: true
      });
      setName('');
      setLat('');
      setLng('');
      setRadius('100');
    } catch (error) {
      console.error("Error saving location:", error);
      alert("Erro ao salvar local.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Remover este local?")) {
      await db.collection(CollectionName.WORK_LOCATIONS).doc(id).delete();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locais de Trabalho (Cercas Virtuais)</h1>
          <p className="text-gray-500">Defina onde os funcionários podem registrar o ponto.</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={20} className="text-brand-600"/> Adicionar Novo Local
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Local</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Sede, Obra X" className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
            <input required type="text" value={lat} onChange={e => setLat(e.target.value)} placeholder="-23.5505" className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
          </div>
          <div className="md:col-span-1">
             <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
             <input required type="text" value={lng} onChange={e => setLng(e.target.value)} placeholder="-46.6333" className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
          </div>
          <div className="md:col-span-1">
             <label className="block text-xs font-medium text-gray-700 mb-1">Raio (metros)</label>
             <input required type="number" value={radius} onChange={e => setRadius(e.target.value)} placeholder="100" className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
          </div>
          
          <div className="md:col-span-2 flex gap-2">
             <button type="button" onClick={getCurrentLocation} className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium w-full">
               <MapPin size={16} className="mr-2"/> Usar GPS Atual
             </button>
          </div>
          <div className="md:col-span-2">
             <button type="submit" disabled={isSubmitting} className="flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium w-full disabled:opacity-70">
               {isSubmitting ? <Loader2 className="animate-spin w-4 h-4"/> : <Save size={16} className="mr-2"/>} Salvar Local
             </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <table className="min-w-full divide-y divide-gray-200">
           <thead className="bg-gray-50">
             <tr>
               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coordenadas</th>
               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raio</th>
               <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-200">
             {locations.map(loc => (
               <tr key={loc.id}>
                 <td className="px-6 py-4 text-sm font-medium text-gray-900">{loc.name}</td>
                 <td className="px-6 py-4 text-xs text-gray-500">{loc.latitude}, {loc.longitude}</td>
                 <td className="px-6 py-4 text-sm text-gray-900">{loc.radius}m</td>