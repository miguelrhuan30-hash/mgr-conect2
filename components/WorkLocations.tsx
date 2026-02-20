import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
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
    const q = query(collection(db, CollectionName.WORK_LOCATIONS), orderBy('name', 'asc'));
    
    // Added error handling to onSnapshot
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
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
      await addDoc(collection(db, CollectionName.WORK_LOCATIONS), {
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
      console.error("Error adding location:", error);
      alert("Erro ao adicionar local.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(window.confirm("Tem certeza que deseja remover este local?")) {
          try {
              await deleteDoc(doc(db, CollectionName.WORK_LOCATIONS, id));
          } catch(e) {
              console.error(e);
              alert("Erro ao remover local.");
          }
      }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locais de Trabalho</h1>
          <p className="text-gray-500">Defina os perímetros (Geofence) onde o ponto é permitido.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-brand-600"/> Adicionar Local
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Local</label>
                          <input 
                            required
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)}
                            className="w-full rounded-lg border-gray-300 bg-white text-gray-900" 
                            placeholder="Ex: Matriz Indaiatuba"
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                              <input 
                                required
                                type="text" 
                                value={lat} 
                                onChange={e => setLat(e.target.value)}
                                className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                              <input 
                                required
                                type="text" 
                                value={lng} 
                                onChange={e => setLng(e.target.value)}
                                className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" 
                              />
                          </div>
                      </div>

                      <button 
                        type="button" 
                        onClick={getCurrentLocation}
                        className="w-full py-2 text-sm bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 flex items-center justify-center gap-2"
                      >
                          <MapPin size={16} /> Usar Localização Atual
                      </button>

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Raio (metros)</label>
                          <input 
                            type="number" 
                            value={radius} 
                            onChange={e => setRadius(e.target.value)}
                            className="w-full rounded-lg border-gray-300 bg-white text-gray-900" 
                          />
                          <p className="text-xs text-gray-400 mt-1">Distância máxima permitida para o registro.</p>
                      </div>

                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar
                      </button>
                  </form>
              </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {loading ? (
                      <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-600"/></div>
                  ) : locations.length === 0 ? (
                      <div className="text-center p-12 text-gray-500">Nenhum local cadastrado.</div>
                  ) : (
                      <div className="divide-y divide-gray-100">
                          {locations.map(loc => (
                              <div key={loc.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center group">
                                  <div className="flex items-start gap-3">
                                      <div className="mt-1 bg-brand-100 text-brand-600 p-2 rounded-lg">
                                          <MapPin size={20} />
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-gray-900">{loc.name}</h4>
                                          <div className="text-xs text-gray-500 font-mono mt-1">
                                              {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                              Raio: {loc.radius}m
                                          </div>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleDelete(loc.id)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  >
                                      <Trash2 size={18} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default WorkLocations;