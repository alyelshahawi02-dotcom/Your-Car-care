import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Car, Fuel, Wrench, MapPin, Plus, LogOut, ChevronRight, Fuel as FuelIcon, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { findNearbyShops } from './services/geminiService';

// --- Types ---
interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  currentMileage: number;
  userId: string;
}

interface MaintenanceLog {
  id: string;
  vehicleId: string;
  serviceType: string;
  cost: number;
  date: string;
  mileage: number;
  notes?: string;
}

interface FuelLog {
  id: string;
  vehicleId: string;
  volume: number;
  totalCost: number;
  date: string;
  mileage: number;
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'logs' | 'shops' | 'upgrades'>('vehicles');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isAddingLog, setIsAddingLog] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vehicles'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicle) {
        setSelectedVehicle(vList[0]);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles'));
    return () => unsubscribe();
  }, [user]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white font-mono uppercase">Initializing_System...</div>;

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto border border-zinc-700">
            <Car className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-sans font-bold tracking-tighter text-white">AUTOTRAC</h1>
          <p className="text-zinc-400 max-w-xs mx-auto">Manage your fleet, track mileage, and find verified local mechanics with ease.</p>
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            SIGN IN WITH GOOGLE
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans overflow-hidden flex flex-col uppercase">
      {/* Header */}
      <header className="p-6 border-zinc-800 flex justify-between items-center bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AUTOTRAC</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">{activeTab}</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsAddingLog(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              <Plus className="w-5 h-5 text-white" />
           </button>
           <button onClick={() => auth.signOut()} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
             <LogOut className="w-5 h-5 text-zinc-400" />
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'vehicles' && <VehiclesView vehicles={vehicles} onSelect={setSelectedVehicle} selected={selectedVehicle} />}
          {activeTab === 'logs' && <LogsView vehicle={selectedVehicle} />}
          {activeTab === 'shops' && <ShopsView vehicle={selectedVehicle} />}
          {activeTab === 'upgrades' && <UpgradesView vehicle={selectedVehicle} />}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {isAddingLog && selectedVehicle && (
          <AddLogModal vehicle={selectedVehicle} onClose={() => setIsAddingLog(false)} />
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800">
        <div className="max-w-md mx-auto flex justify-around">
          <NavButton icon={Car} label="Garage" active={activeTab === 'vehicles'} onClick={() => setActiveTab('vehicles')} />
          <NavButton icon={History} label="History" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <NavButton icon={MapPin} label="Service" active={activeTab === 'shops'} onClick={() => setActiveTab('shops')} />
          <NavButton icon={Wrench} label="Upgrades" active={activeTab === 'upgrades'} onClick={() => setActiveTab('upgrades')} />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-white/10' : ''}`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}

// --- Views ---

function VehiclesView({ vehicles, onSelect, selected }: { vehicles: Vehicle[], onSelect: (v: Vehicle) => void, selected: Vehicle | null }) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-sans">MY GARAGE</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="p-3 bg-white text-black rounded-xl hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {vehicles.length === 0 && (
          <div className="p-8 border-2 border-dashed border-zinc-800 rounded-3xl text-center text-zinc-500">
            <Car className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No vehicles in your garage yet.</p>
          </div>
        )}
        {vehicles.map(v => (
          <motion.div 
            key={v.id}
            onClick={() => onSelect(v)}
            className={`p-5 rounded-3xl border transition-all cursor-pointer ${selected?.id === v.id ? 'bg-white/5 border-white/20' : 'bg-transparent border-zinc-800 hover:border-zinc-700'}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter mb-1">{v.year} {v.make}</p>
                <h3 className="text-2xl font-bold tracking-tight">{v.model}</h3>
              </div>
              <div className="px-3 py-1 bg-zinc-800 rounded-lg text-[10px] font-mono border border-zinc-700">
                {v.licensePlate}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Current Mileage</p>
                <p className="text-lg font-mono">{v.currentMileage.toLocaleString()} <span className="text-xs">KM</span></p>
              </div>
              <div className="p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800 flex items-center justify-center">
                <ChevronRight className="w-5 h-5 text-zinc-700" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <AddVehicleModal onClose={() => setIsAdding(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AddVehicleModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({ make: '', model: '', year: new Date().getFullYear(), licensePlate: '', currentMileage: 0 });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const path = 'vehicles';
    try {
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, path), {
        ...formData,
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        exit={{ y: 100 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl"
      >
        <h3 className="text-xl font-bold mb-6">ADD NEW VEHICLE</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="MAKE" value={formData.make} onChange={v => setFormData({ ...formData, make: v })} placeholder="e.g. BMW" />
            <Input label="MODEL" value={formData.model} onChange={v => setFormData({ ...formData, model: v })} placeholder="e.g. M3" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="YEAR" type="number" value={formData.year.toString()} onChange={v => setFormData({ ...formData, year: parseInt(v) })} />
            <Input label="LICENCE PLATE" value={formData.licensePlate} onChange={v => setFormData({ ...formData, licensePlate: v })} placeholder="ABC-123" />
          </div>
          <Input label="CURRENT MILEAGE" type="number" value={formData.currentMileage.toString()} onChange={v => setFormData({ ...formData, currentMileage: parseInt(v) })} />
          
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-bold">CANCEL</button>
            <button type="submit" disabled={submitting} className="flex-1 py-4 bg-white text-black rounded-2xl font-bold">
              {submitting ? 'ADDING...' : 'ADD VEHICLE'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function AddLogModal({ vehicle, onClose }: { vehicle: Vehicle, onClose: () => void }) {
  const [logType, setLogType] = useState<'maintenance' | 'fuel'>('maintenance');
  const [formData, setFormData] = useState({ 
    serviceType: '', 
    cost: '', 
    mileage: vehicle.currentMileage.toString(), 
    location: '', 
    notes: '',
    volume: '',
    totalCost: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    let currentPath = '';
    try {
      const { addDoc, collection, doc, updateDoc } = await import('firebase/firestore');
      const common = {
        vehicleId: vehicle.id,
        date: new Date().toISOString(),
        mileage: parseInt(formData.mileage),
        location: formData.location
      };

      if (logType === 'maintenance') {
        currentPath = 'maintenanceLogs';
        await addDoc(collection(db, currentPath), {
          ...common,
          serviceType: formData.serviceType,
          cost: parseFloat(formData.cost),
          notes: formData.notes
        });
      } else {
        currentPath = 'fuelLogs';
        await addDoc(collection(db, currentPath), {
          ...common,
          volume: parseFloat(formData.volume),
          totalCost: parseFloat(formData.totalCost)
        });
      }

      // Update vehicle's current mileage if the log mileage is higher
      if (parseInt(formData.mileage) > vehicle.currentMileage) {
        currentPath = `vehicles/${vehicle.id}`;
        await updateDoc(doc(db, 'vehicles', vehicle.id), {
          currentMileage: parseInt(formData.mileage)
        });
      }

      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, currentPath);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <motion.div 
        initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">ADD {(logType === 'maintenance' ? 'SERVICE' : 'FUEL')} LOG</h3>
          <div className="flex bg-zinc-800 p-1 rounded-lg">
            <button type="button" onClick={() => setLogType('maintenance')} className={`px-3 py-1 rounded text-[10px] font-bold ${logType === 'maintenance' ? 'bg-zinc-700' : ''}`}>SERVICE</button>
            <button type="button" onClick={() => setLogType('fuel')} className={`px-3 py-1 rounded text-[10px] font-bold ${logType === 'fuel' ? 'bg-zinc-700' : ''}`}>FUEL</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="MILEAGE (KM)" type="number" value={formData.mileage} onChange={v => setFormData({ ...formData, mileage: v })} />
          
          {logType === 'maintenance' ? (
            <>
              <Input label="SERVICE TYPE" value={formData.serviceType} onChange={v => setFormData({ ...formData, serviceType: v })} placeholder="e.g. Oil Change" />
              <Input label="COST ($)" type="number" value={formData.cost} onChange={v => setFormData({ ...formData, cost: v })} />
              <Input label="NOTES" value={formData.notes || ''} onChange={v => setFormData({ ...formData, notes: v })} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="VOLUME (L)" type="number" value={formData.volume} onChange={v => setFormData({ ...formData, volume: v })} />
                <Input label="TOTAL COST ($)" type="number" value={formData.totalCost} onChange={v => setFormData({ ...formData, totalCost: v })} />
              </div>
            </>
          )}
          
          <Input label="LOCATION" value={formData.location} onChange={v => setFormData({ ...formData, location: v })} placeholder="Shop or Station Name" />

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-zinc-800 text-white rounded-2xl font-bold">CANCEL</button>
            <button type="submit" disabled={submitting} className="flex-1 py-4 bg-white text-black rounded-2xl font-bold">
              {submitting ? 'SAVING...' : 'SAVE LOG'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function LogsView({ vehicle }: { vehicle: Vehicle | null }) {
  const [logs, setLogs] = useState<(MaintenanceLog | FuelLog)[]>([]);
  const [type, setType] = useState<'all' | 'maintenance' | 'fuel'>('all');

  useEffect(() => {
    if (!vehicle) return;
    const qM = query(collection(db, 'maintenanceLogs'), where('vehicleId', '==', vehicle.id));
    const qF = query(collection(db, 'fuelLogs'), where('vehicleId', '==', vehicle.id));
    
    const unsubM = onSnapshot(qM, (s) => {
       const mList = s.docs.map(d => ({ id: d.id, type: 'maintenance', ...d.data() }));
       setLogs(prev => [...prev.filter(l => (l as any).type !== 'maintenance'), ...mList as any]);
    });
    
    const unsubF = onSnapshot(qF, (s) => {
       const fList = s.docs.map(d => ({ id: d.id, type: 'fuel', ...d.data() }));
       setLogs(prev => [...prev.filter(l => (l as any).type !== 'fuel'), ...fList as any]);
    });

    return () => { unsubM(); unsubF(); };
  }, [vehicle]);

  const fuelLogsSorted = logs.filter(l => (l as any).type === 'fuel').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) as FuelLog[];
  
  const getEfficiency = (log: FuelLog, index: number) => {
    if (index === 0) return null;
    const prevLog = fuelLogsSorted[index - 1];
    const dist = log.mileage - prevLog.mileage;
    if (dist <= 0) return null;
    const efficiency = (log.volume / dist) * 100;
    return efficiency.toFixed(1) + " L/100km";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">VEHICLE LOGS</h2>
          <p className="text-zinc-500 font-mono text-xs">{vehicle?.model} - {vehicle?.licensePlate}</p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl">
        <TabButton active={type === 'all'} onClick={() => setType('all')} label="All" />
        <TabButton active={type === 'maintenance'} onClick={() => setType('maintenance')} label="Service" />
        <TabButton active={type === 'fuel'} onClick={() => setType('fuel')} label="Fuel" />
      </div>

      <div className="space-y-3">
        {logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(log => {
          if (type === 'all') return true;
          return (log as any).type === type;
        }).map(log => {
          const fuelIndex = fuelLogsSorted.findIndex(f => f.id === log.id);
          const efficiency = (log as any).type === 'fuel' ? getEfficiency(log as FuelLog, fuelIndex) : null;

          return (
            <div key={log.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex gap-4">
              <div className={`p-3 rounded-xl h-fit ${(log as any).type === 'maintenance' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                {(log as any).type === 'maintenance' ? <Wrench className="w-5 h-5" /> : <FuelIcon className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{(log as any).type === 'maintenance' ? (log as MaintenanceLog).serviceType : 'Fuel Refill'}</p>
                    {efficiency && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                        {efficiency}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-sm">${(log as MaintenanceLog).cost || (log as FuelLog).totalCost}</p>
                </div>
                <p className="text-xs text-zinc-500 font-medium">
                  {new Date(log.date).toLocaleDateString()} • {log.mileage.toLocaleString()} KM
                </p>
                {(log as MaintenanceLog).notes && <p className="mt-2 text-xs text-zinc-400">{(log as MaintenanceLog).notes}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ShopsView({ vehicle }: { vehicle: Vehicle | null }) {
  const [shops, setShops] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [location, setLocation] = useState('');
  const [specialty, setSpecialty] = useState('general maintenance');

  const specialties = [
    { label: 'General', value: 'general maintenance' },
    { label: 'Wheels & Tires', value: 'wheel fit, alignment and tire fix' },
    { label: 'Engine/Motor', value: 'engine diagnostics and motor conflict handlers' },
    { label: 'Brakes', value: 'brake system repair' },
    { label: 'Body', value: 'body work and paint' }
  ];

  const handleSearch = async () => {
    if (!location || !vehicle) return;
    setSearching(true);
    const results = await findNearbyShops(location, `${vehicle.year} ${vehicle.make} ${vehicle.model}`, specialty);
    setShops(results);
    setSearching(false);
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`);
      });
    }
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <header>
        <h2 className="text-2xl font-bold">SERVICE FINDER</h2>
        <p className="text-zinc-500 text-sm">Finding specialists for your {vehicle?.model}</p>
      </header>

      <div className="space-y-4">
        <div className="relative group">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-white transition-colors" />
          <input 
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Enter location or use GPS"
            className="w-full bg-zinc-900 border border-zinc-800 p-4 pl-12 rounded-2xl focus:outline-none focus:border-white transition-all font-medium"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {specialties.map(s => (
            <button
              key={s.value}
              onClick={() => setSpecialty(s.value)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${specialty === s.value ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button 
          onClick={handleSearch}
          disabled={searching}
          className="w-full py-4 bg-white text-black font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {searching ? 'SEARCHING...' : 'FIND VERIFIED SPECIALISTS'}
        </button>
      </div>

      <div className="space-y-4">
        {shops.length === 0 && !searching && (
          <div className="p-12 text-center text-zinc-600">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-sm italic">Search to discover local experts near you.</p>
          </div>
        )}
        {shops.map((shop, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold">{shop.name}</h3>
                  {shop.verified && <div className="p-1 bg-green-500/20 text-green-500 rounded text-[8px] font-bold uppercase">Verified</div>}
                </div>
                <p className="text-xs text-zinc-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {shop.address}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Specialties</p>
                <div className="flex flex-wrap gap-2">
                  {shop.specialties.map((s: string) => (
                    <span key={s} className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-medium text-zinc-300">{s}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Prices</p>
                  <p className="text-xs font-medium text-zinc-200">{shop.priceInfo}</p>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Advantage</p>
                  <p className="text-xs font-medium text-zinc-200">{shop.advantage}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

import { getCarUpgrades } from './services/geminiService';

function UpgradesView({ vehicle }: { vehicle: Vehicle | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState('');

  const handleFetch = async () => {
    if (!vehicle) return;
    setLoading(true);
    const res = await getCarUpgrades(`${vehicle.year} ${vehicle.make} ${vehicle.model}`, location);
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`);
      });
    }
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <header>
        <h2 className="text-2xl font-bold">UPGRADE GUIDE</h2>
        <p className="text-zinc-500 text-sm">Enhance your {vehicle?.model} responsibly.</p>
      </header>

      <div className="flex gap-2">
        <input 
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Location for local shops"
          className="flex-1 bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-xs"
        />
        <button 
          onClick={handleFetch}
          disabled={loading || !vehicle}
          className="px-6 bg-white text-black font-bold rounded-xl text-xs disabled:opacity-50"
        >
          {loading ? 'ANALYZING...' : 'GET ADVICE'}
        </button>
      </div>

      {data && (
        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Recommended Upgrades</h3>
            <div className="space-y-3">
              {data.performanceUpgrades?.map((up: any, i: number) => (
                <div key={i} className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800">
                  <p className="font-bold text-white mb-1">{up.name}</p>
                  <p className="text-[10px] text-green-500 mb-2 uppercase font-bold">Benefit: {up.benefit}</p>
                  <p className="text-xs text-zinc-400 italic">Risk: {up.risk}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">Risky / Harmful Upgrades</h3>
            <div className="space-y-3">
              {data.riskyUpgrades?.map((up: any, i: number) => (
                <div key={i} className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
                  <p className="font-bold text-red-400 mb-1">{up.name}</p>
                  <p className="text-xs text-zinc-300">{up.warning}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Professional Advice</h3>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <p className="text-xs text-zinc-300 leading-relaxed">{data.professionals}</p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Where to Go</h3>
            <div className="space-y-3">
              {data.locations?.length > 0 ? (
                data.locations.map((loc: any, i: number) => (
                  <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">{loc.name}</p>
                      <p className="text-[10px] text-zinc-500">{loc.address}</p>
                    </div>
                    {loc.distance && <span className="text-[10px] text-white/50 font-mono">{loc.distance}</span>}
                  </div>
                ))
              ) : (
                <div className="p-4 border border-dashed border-zinc-800 rounded-2xl text-center text-xs text-zinc-500">
                  No local specialized shops found. Check nearest metropolitan automotive hubs.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </motion.div>
  );
}

// --- Helpers ---

function Input({ label, value, onChange, type = 'text', placeholder = '' }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string }) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700/50 p-4 rounded-2xl focus:outline-none focus:border-white transition-all font-mono text-sm"
      />
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
      {label}
    </button>
  );
}
