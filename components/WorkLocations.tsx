import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, QuerySnapshot, DocumentData, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, WorkLocation, UserProfile, Client } from '../types';
import { MapPin, Plus, Trash2, Save, Loader2, Navigation, Search, Eye, Pencil, X, Check, Users, Building2, ChevronDown } from 'lucide-react';

/* ════════════════════════════════════════════════════════════════
   Google Maps API declaration
   ════════════════════════════════════════════════════════════════ */
declare const google: any;

/* ════════════════════════════════════════════════════════════════
   RADIUS MAP VIEWER — Visualizar raio de check-in no mapa
   ════════════════════════════════════════════════════════════════ */
interface RadiusMapProps {
  /** Todos os locais cadastrados */
  locations: WorkLocation[];
  /** Local em destaque (selecionado) */
  highlighted?: WorkLocation | null;
  /** Callback ao selecionar posição no mapa */
  onSelectPosition?: (lat: number, lng: number, address: string) => void;
  /** Modo (view = só ver raios / pick = escolher novo ponto) */
  mode?: 'view' | 'pick';
  /** Raio para usar quando em modo pick */
  pickRadius?: number;
  /** Centralizar o mapa em coordenadas específicas (ex: coordenadas do cliente) */
  panTo?: { lat: number; lng: number } | null;
}

const DEFAULT_LAT = -23.1024;
const DEFAULT_LNG = -47.2094;

const RadiusMapViewer: React.FC<RadiusMapProps> = ({
  locations, highlighted, onSelectPosition, mode = 'view', pickRadius = 100, panTo,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const pickerMarkerRef = useRef<any>(null);
  const pickerCircleRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const autocompleteInitRef = useRef(false);
  const [apiReady, setApiReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gettingGPS, setGettingGPS] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Check Google Maps API
  useEffect(() => {
    const check = () => {
      if (typeof google !== 'undefined' && google.maps) { setApiReady(true); return; }
      setTimeout(check, 250);
    };
    check();
  }, []);

  // Clear existing overlays
  const clearOverlays = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null));
    circlesRef.current.forEach(c => c.setMap(null));
    markersRef.current = [];
    circlesRef.current = [];
  }, []);

  // Initialize + draw map
  useEffect(() => {
    if (!apiReady || !mapContainerRef.current) return;

    const center = highlighted
      ? { lat: highlighted.latitude, lng: highlighted.longitude }
      : locations.length > 0
      ? { lat: locations[0].latitude, lng: locations[0].longitude }
      : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };

    const map = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom: highlighted ? 17 : locations.length > 0 ? 14 : 12,
      mapTypeControl: true,
      mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU },
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
    });
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();
    setLoading(false);

    // Draw all locations with radius circles
    clearOverlays();
    locations.forEach(loc => {
      const isHighlighted = highlighted?.id === loc.id;
      const pos = { lat: loc.latitude, lng: loc.longitude };

      // Marker
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: `${loc.name} — Raio: ${loc.radius}m`,
        icon: isHighlighted ? undefined : {
          url: 'data:image/svg+xml,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${isHighlighted ? '#7c3aed' : '#3b82f6'}" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
          ),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 32),
        },
        zIndex: isHighlighted ? 100 : 10,
      });
      markersRef.current.push(marker);

      // Info window
      const info = new google.maps.InfoWindow({
        content: `
          <div style="padding:8px;font-family:system-ui;max-width:220px">
            <strong style="font-size:14px;color:#1f2937">${loc.name}</strong>
            <div style="margin-top:6px;font-size:12px;color:#6b7280">
              📍 ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}<br/>
              📏 Raio: <strong style="color:#7c3aed">${loc.radius}m</strong>
            </div>
          </div>
        `,
      });
      marker.addListener('click', () => info.open(map, marker));

      // Radius circle
      const circle = new google.maps.Circle({
        center: pos,
        radius: loc.radius,
        map,
        fillColor: isHighlighted ? '#7c3aed' : '#3b82f6',
        fillOpacity: isHighlighted ? 0.20 : 0.10,
        strokeColor: isHighlighted ? '#7c3aed' : '#3b82f6',
        strokeWeight: isHighlighted ? 2.5 : 1.5,
        strokeOpacity: isHighlighted ? 0.8 : 0.4,
        clickable: false,
      });
      circlesRef.current.push(circle);
    });

    // Fit bounds to show all locations
    if (locations.length > 1 && !highlighted) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => bounds.extend({ lat: loc.latitude, lng: loc.longitude }));
      map.fitBounds(bounds, 60);
    }

    // ── Mode: Pick — click to set new marker ──
    if (mode === 'pick') {
      // Draggable picker marker
      const pickerMarker = new google.maps.Marker({
        position: center,
        map,
        draggable: true,
        animation: google.maps.Animation.DROP,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
          ),
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 36),
        },
        zIndex: 200,
        title: 'Arraste para posicionar o novo local',
      });
      pickerMarkerRef.current = pickerMarker;

      const pickerCircle = new google.maps.Circle({
        center,
        radius: pickRadius,
        map,
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        strokeColor: '#ef4444',
        strokeWeight: 2,
        strokeOpacity: 0.6,
        clickable: false,
      });
      pickerCircleRef.current = pickerCircle;

      // Update on drag
      pickerMarker.addListener('dragend', () => {
        const pos = pickerMarker.getPosition();
        if (pos) {
          pickerCircle.setCenter({ lat: pos.lat(), lng: pos.lng() });
          geocoderRef.current?.geocode({ location: { lat: pos.lat(), lng: pos.lng() } }, (results: any[], status: string) => {
            const addr = status === 'OK' && results?.[0] ? results[0].formatted_address : '';
            onSelectPosition?.(pos.lat(), pos.lng(), addr);
          });
        }
      });

      // Click to move picker
      map.addListener('click', (e: any) => {
        if (!e.latLng) return;
        pickerMarker.setPosition(e.latLng);
        pickerCircle.setCenter(e.latLng);
        geocoderRef.current?.geocode({ location: { lat: e.latLng.lat(), lng: e.latLng.lng() } }, (results: any[], status: string) => {
          const addr = status === 'OK' && results?.[0] ? results[0].formatted_address : '';
          onSelectPosition?.(e.latLng.lat(), e.latLng.lng(), addr);
        });
      });
    }

    // Setup Places Autocomplete for pick mode
    if (mode === 'pick' && searchInputRef.current && !autocompleteInitRef.current) {
      autocompleteInitRef.current = true;
      const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'br' },
        fields: ['geometry', 'formatted_address', 'name'],
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          map.panTo({ lat, lng });
          map.setZoom(17);
          if (pickerMarkerRef.current) pickerMarkerRef.current.setPosition({ lat, lng });
          if (pickerCircleRef.current) pickerCircleRef.current.setCenter({ lat, lng });
          const addr = place.name && !place.formatted_address?.startsWith(place.name)
            ? `${place.name} — ${place.formatted_address}`
            : place.formatted_address || '';
          onSelectPosition?.(lat, lng, addr);
        }
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, locations, highlighted, mode, pickRadius]);

  // Update picker circle radius when pickRadius changes
  useEffect(() => {
    if (pickerCircleRef.current) {
      pickerCircleRef.current.setRadius(pickRadius);
    }
  }, [pickRadius]);

  // Pan to specific coordinates (e.g. when a client is selected)
  useEffect(() => {
    if (!panTo || !mapRef.current) return;
    const { lat, lng } = panTo;
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(17);
    if (pickerMarkerRef.current) pickerMarkerRef.current.setPosition({ lat, lng });
    if (pickerCircleRef.current) pickerCircleRef.current.setCenter({ lat, lng });
    geocoderRef.current?.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      const addr = status === 'OK' && results?.[0] ? results[0].formatted_address : '';
      onSelectPosition?.(lat, lng, addr);
    });
  }, [panTo, onSelectPosition]);

  // GPS: Minha Localização
  const handleMyLocation = () => {
    if (!navigator.geolocation) { alert('Geolocalização não suportada.'); return; }
    setGettingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(17);
        if (mode === 'pick' && pickerMarkerRef.current && pickerCircleRef.current) {
          pickerMarkerRef.current.setPosition({ lat, lng });
          pickerCircleRef.current.setCenter({ lat, lng });
          geocoderRef.current?.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
            const addr = status === 'OK' && results?.[0] ? results[0].formatted_address : '';
            onSelectPosition?.(lat, lng, addr);
          });
        }
        setGettingGPS(false);
      },
      () => { alert('Não foi possível obter localização.'); setGettingGPS(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Search bar (pick mode only) */}
      {mode === 'pick' && (
        <div className="px-4 py-3 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Buscar endereço ou nome do estabelecimento..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 focus:border-violet-400 outline-none"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
            <MapPin size={10} /> Digite o nome do local ou endereço. Depois ajuste arrastando o pin vermelho.
          </p>
        </div>
      )}
      {(loading || !apiReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Carregando mapa...</span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full" style={{ height: '420px' }} />
      {/* GPS button overlay */}
      <button onClick={handleMyLocation} disabled={gettingGPS}
        className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl shadow-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
        <Navigation size={16} className="text-blue-500" />
        {gettingGPS ? 'Buscando...' : 'Minha Localização'}
      </button>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
const WorkLocations: React.FC = () => {
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlighted, setHighlighted] = useState<WorkLocation | null>(null);
  const [showMap, setShowMap] = useState(true);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('100');
  const [pickedAddress, setPickedAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRadius, setEditRadius] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  // Users State (for collaborator picker)
  const [allUsers, setAllUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Client State
  const [allClients, setAllClients] = useState<(Client & { id: string })[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [mapPanTo, setMapPanTo] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const q = query(collection(db, CollectionName.WORK_LOCATIONS), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as WorkLocation[];
      setLocations(data);
      setLoading(false);
    }, (error: any) => {
      if (error?.code !== 'permission-denied') console.error("Error fetching locations:", error);
      setLoading(false);
    });

    // Load all users
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, CollectionName.USERS));
        const users = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as (UserProfile & { id: string })[];
        setAllUsers(users.filter(u => (u as any).active !== false).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
      } catch (err) { console.error('Error loading users:', err); }
    };
    loadUsers();

    // Load all clients
    const loadClients = async () => {
      try {
        const snap = await getDocs(collection(db, CollectionName.CLIENTS));
        const clients = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as (Client & { id: string })[];
        setAllClients(clients.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      } catch (err) { console.error('Error loading clients:', err); }
    };
    loadClients();

    return () => unsubscribe();
  }, []);

  const handleMapSelect = (newLat: number, newLng: number, address: string) => {
    setLat(newLat.toFixed(6));
    setLng(newLng.toFixed(6));
    setPickedAddress(address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !lat || !lng) return;
    setIsSubmitting(true);
    try {
      const locData: Record<string, any> = {
        name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius: parseInt(radius) || 100,
        active: true,
      };
      if (selectedClientId) {
        locData.clientId = selectedClientId;
        locData.clientName = selectedClientName;
      } else {
        locData.clientId = null;
        locData.clientName = null;
      }

      if (editingLocationId) {
        // ── UPDATE existing location ──
        await updateDoc(doc(db, CollectionName.WORK_LOCATIONS, editingLocationId), locData);

        // Sync collaborators: remove old, add new
        const prevAssigned = allUsers.filter(u => u.allowedLocationIds?.includes(editingLocationId));
        for (const u of prevAssigned) {
          if (!selectedUserIds.includes(u.id)) {
            await updateDoc(doc(db, CollectionName.USERS, u.id), {
              allowedLocationIds: arrayRemove(editingLocationId),
            });
          }
        }
        for (const uid of selectedUserIds) {
          await updateDoc(doc(db, CollectionName.USERS, uid), {
            allowedLocationIds: arrayUnion(editingLocationId),
          });
        }
      } else {
        // ── CREATE new location ──
        const docRef = await addDoc(collection(db, CollectionName.WORK_LOCATIONS), locData);
        if (selectedUserIds.length > 0) {
          for (const uid of selectedUserIds) {
            await updateDoc(doc(db, CollectionName.USERS, uid), {
              allowedLocationIds: arrayUnion(docRef.id),
            });
          }
        }
      }

      resetForm();
    } catch (error) {
      console.error("Error saving location:", error);
      alert("Erro ao salvar local.");
    } finally { setIsSubmitting(false); }
  };

  const clearFormFields = () => {
    setName(''); setLat(''); setLng(''); setRadius('100');
    setPickedAddress(''); setSelectedUserIds([]); setUserSearch('');
    setSelectedClientId(''); setSelectedClientName(''); setClientSearch(''); setShowClientDropdown(false);
    setMapPanTo(null); setEditingLocationId(null);
  };

  const resetForm = () => {
    clearFormFields();
    setShowForm(false);
  };

  const handleEditLocation = (loc: WorkLocation) => {
    setEditingLocationId(loc.id);
    setName(loc.name);
    setLat(loc.latitude.toFixed(6));
    setLng(loc.longitude.toFixed(6));
    setRadius(String(loc.radius));
    setPickedAddress('');
    setSelectedClientId(loc.clientId || '');
    setSelectedClientName(loc.clientName || '');
    setClientSearch('');
    setShowClientDropdown(false);
    // Pre-select collaborators assigned to this location
    const assigned = allUsers.filter(u => u.allowedLocationIds?.includes(loc.id)).map(u => u.id);
    setSelectedUserIds(assigned);
    setUserSearch('');
    setMapPanTo({ lat: loc.latitude, lng: loc.longitude });
    setShowForm(true);
    setShowMap(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover este local?")) return;
    try { await deleteDoc(doc(db, CollectionName.WORK_LOCATIONS, id)); }
    catch { alert("Erro ao remover local."); }
  };

  const handleUpdateRadius = async (loc: WorkLocation) => {
    const newRadius = parseInt(editRadius);
    if (isNaN(newRadius) || newRadius <= 0) return;
    try {
      await updateDoc(doc(db, CollectionName.WORK_LOCATIONS, loc.id), { radius: newRadius });
      setEditingId(null);
    } catch { alert("Erro ao atualizar raio."); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-violet-500" size={28} /> Locais de Trabalho & Check-in
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie os perímetros (geofence) onde o registro de ponto é permitido. Aplicável ao ponto fixo da sede e à liberação de ponto por O.S.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 transition-colors">
            <Eye size={16} /> {showMap ? 'Ocultar Mapa' : 'Ver Mapa'}
          </button>
          <button onClick={() => { if (showForm) { resetForm(); } else { clearFormFields(); setShowForm(true); setShowMap(true); } }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-violet-600 rounded-xl hover:bg-violet-700 transition-colors shadow-sm">
            <Plus size={16} /> Novo Local
          </button>
        </div>
      </div>

      {/* Map */}
      {showMap && (
        <RadiusMapViewer
          locations={locations}
          highlighted={highlighted}
          mode={showForm ? 'pick' : 'view'}
          pickRadius={parseInt(radius) || 100}
          onSelectPosition={showForm ? handleMapSelect : undefined}
          panTo={mapPanTo}
        />
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              {editingLocationId ? <Pencil className="w-5 h-5 text-violet-600" /> : <Plus className="w-5 h-5 text-violet-600" />}
              {editingLocationId ? 'Editar Local de Trabalho' : 'Adicionar Novo Local'}
            </h3>
            <button onClick={resetForm} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X size={18} /></button>
          </div>

          {pickedAddress && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
              <MapPin size={16} className="text-violet-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-violet-700">Endereço selecionado no mapa</p>
                <p className="text-sm text-violet-900 mt-0.5">{pickedAddress}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Local</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none"
                  placeholder="Ex: Sede MGR Indaiatuba" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raio de Permissão (metros)</label>
                <input type="number" value={radius} onChange={e => setRadius(e.target.value)} min="10" max="5000"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none" />
                <p className="text-xs text-gray-400 mt-1">Distância máxima permitida para o check-in. O círculo no mapa será atualizado em tempo real.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                <input required type="text" value={lat} onChange={e => setLat(e.target.value)} readOnly
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                <input required type="text" value={lng} onChange={e => setLng(e.target.value)} readOnly
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-600 font-mono" />
              </div>
            </div>

            {/* Client Selector */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Building2 size={16} className="text-violet-500" /> Cliente Vinculado
                </label>
                {selectedClientId && (
                  <button type="button" onClick={() => { setSelectedClientId(''); setSelectedClientName(''); setClientSearch(''); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium">Remover</button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Vincule este local a um cliente cadastrado. Opcional — se nenhum for selecionado, o local ficará sem vínculo.
              </p>
              {selectedClientId ? (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-center gap-2">
                  <Building2 size={14} className="text-violet-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-violet-800">{selectedClientName}</span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text" value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="Buscar cliente pelo nome..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300 outline-none pr-8"
                  />
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  {showClientDropdown && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[200px] overflow-y-auto">
                      {allClients
                        .filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.nomeFantasia?.toLowerCase().includes(clientSearch.toLowerCase()))
                        .map(c => (
                          <button key={c.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors flex items-center justify-between gap-2"
                            onClick={() => {
                              setSelectedClientId(c.id);
                              setSelectedClientName(c.name || c.nomeFantasia || '');
                              setClientSearch('');
                              setShowClientDropdown(false);
                              // Auto-center map if client has geolocation
                              const geo = c.geolocalizacao || c.geo;
                              if (geo) {
                                const cLat = (geo as any).latitude ?? (geo as any).lat;
                                const cLng = (geo as any).longitude ?? (geo as any).lng;
                                if (cLat && cLng) setMapPanTo({ lat: cLat, lng: cLng });
                              }
                            }}
                          >
                            <div className="min-w-0">
                              <span className="font-medium text-gray-800">{c.name || c.nomeFantasia}</span>
                              {c.nomeFantasia && c.name !== c.nomeFantasia && (
                                <span className="text-[10px] text-gray-400 ml-1.5">{c.nomeFantasia}</span>
                              )}
                              {c.address && <p className="text-[10px] text-gray-400 truncate">{c.address}</p>}
                            </div>
                            {(c.geolocalizacao || c.geo) && (
                              <span title="Tem geolocalização"><MapPin size={12} className="text-green-500 flex-shrink-0" /></span>
                            )}
                          </button>
                        ))}
                      {allClients.filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.nomeFantasia?.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-3">Nenhum cliente encontrado.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-violet-600 font-medium flex items-center gap-1">
              <MapPin size={12} /> Clique no mapa acima ou arraste o marcador vermelho para selecionar a posição
            </p>

            {/* Collaborator Selector */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Users size={16} className="text-violet-500" /> Colaboradores Permitidos
                </label>
                <span className="text-xs text-gray-400">
                  {selectedUserIds.length === 0 ? 'Todos podem acessar' : `${selectedUserIds.length} selecionado(s)`}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Selecione os colaboradores que podem fazer check-in neste local. Se nenhum for selecionado, todos poderão acessar.
              </p>
              <input
                type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Buscar colaborador..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-300 outline-none"
              />
              <div className="max-h-[200px] overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
                {allUsers
                  .filter(u => !userSearch || u.displayName?.toLowerCase().includes(userSearch.toLowerCase()))
                  .map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedUserIds(prev => [...prev, u.id]);
                          else setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                        }}
                        className="rounded accent-violet-600"
                      />
                      <span className="text-sm text-gray-800">{u.displayName || u.email}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{u.role}</span>
                    </label>
                  ))}
                {allUsers.filter(u => !userSearch || u.displayName?.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">Nenhum colaborador encontrado.</p>
                )}
              </div>
            </div>

            <button type="submit" disabled={isSubmitting || !lat || !lng}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-sm">
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSubmitting ? 'Salvando...' : editingLocationId ? 'Salvar Alterações' : 'Salvar Local'}
            </button>
          </form>
        </div>
      )}

      {/* Locations list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Locais Cadastrados ({locations.length})</h3>
          <p className="text-xs text-gray-400">Clique em um local para destacar no mapa</p>
        </div>
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-violet-600" /></div>
        ) : locations.length === 0 ? (
          <div className="text-center p-12 text-gray-400">
            <MapPin size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum local cadastrado.</p>
            <p className="text-sm mt-1">Clique em "Novo Local" para adicionar um ponto de check-in.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {locations.map(loc => (
              <div key={loc.id}
                onClick={() => setHighlighted(highlighted?.id === loc.id ? null : loc)}
                className={`p-4 flex items-center justify-between transition-all cursor-pointer group ${
                  highlighted?.id === loc.id ? 'bg-violet-50 border-l-4 border-violet-500' : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 p-2 rounded-lg ${highlighted?.id === loc.id ? 'bg-violet-500 text-white' : 'bg-violet-100 text-violet-600'}`}>
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-900">{loc.name}</h4>
                    {loc.clientName && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building2 size={11} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{loc.clientName}</span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </div>
                    {/* Show assigned users */}
                    {(() => {
                      const assigned = allUsers.filter(u => u.allowedLocationIds?.includes(loc.id));
                      return assigned.length > 0 ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users size={11} className="text-violet-400" />
                          <span className="text-[10px] text-violet-600 font-medium">
                            {assigned.length} colaborador(es): {assigned.slice(0, 3).map(u => u.displayName?.split(' ')[0]).join(', ')}{assigned.length > 3 ? ` +${assigned.length - 3}` : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users size={11} className="text-gray-300" />
                          <span className="text-[10px] text-gray-400">Todos podem acessar</span>
                        </div>
                      );
                    })()}

                    {/* Radius display/edit */}
                    {editingId === loc.id ? (
                      <div className="flex items-center gap-2 mt-1.5">
                        <input type="number" value={editRadius} onChange={e => setEditRadius(e.target.value)}
                          min="10" max="5000" className="w-24 border border-violet-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-violet-300 outline-none"
                          onClick={e => e.stopPropagation()} />
                        <span className="text-xs text-gray-400">metros</span>
                        <button onClick={e => { e.stopPropagation(); handleUpdateRadius(loc); }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors">
                          <Check size={14} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setEditingId(null); }}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          loc.radius <= 50 ? 'bg-red-100 text-red-700' :
                          loc.radius <= 200 ? 'bg-violet-100 text-violet-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          📏 Raio: {loc.radius}m
                        </span>
                        <button onClick={e => { e.stopPropagation(); setEditingId(loc.id); setEditRadius(String(loc.radius)); }}
                          className="p-1 text-gray-300 hover:text-violet-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar raio">
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); handleEditLocation(loc); }}
                    className="p-2 text-gray-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Editar local"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(loc.id); }}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkLocations;