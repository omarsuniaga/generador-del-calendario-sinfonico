
import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { CalendarCanvas } from './components/CalendarCanvas';
import { CalendarState, ActivityRange, ProgramType, DayStyle, Category, NotificationLog } from './types';
import { 
  Bell, Info, X, Flag, CheckCircle2, Menu, ChevronLeft, ChevronRight, 
  Sparkles, History, Calendar as CalendarIcon, Tag, HelpCircle, 
  Music, Mic, Disc, Piano, Guitar, Drum, Volume2, Users, Star, 
  Award, Heart, Coffee, Utensils, MapPin, AlertTriangle, Lightbulb
} from 'lucide-react';
import { format, isWithinInterval, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { analyzeCalendarConflicts } from './services/geminiService';

const STORAGE_KEY = 'sinfonia_calendar_data';

const App: React.FC = () => {
  const [state, setState] = useState<CalendarState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    
    return {
      config: {
        year: 2026,
        institutionalLogo: null,
        institutionName: "El Sistema Punta Cana",
        subtitle: "Calendario Sinfónico"
      },
      categories: [
        { id: 'cat-1', name: 'Actividades Regulares', color: '#fbbf24' },
        { id: 'cat-2', name: 'No Laborables', color: '#ef4444' },
        { id: 'cat-3', name: 'Actividades Administrativas', color: '#3b82f6' },
        { id: 'cat-4', name: 'Ensayos Puertas Cerradas', color: '#111827' },
        { id: 'cat-5', name: 'Temporada de Conciertos', color: '#22c55e' }
      ],
      activities: [],
      dayStyles: [],
      notifications: []
    };
  });

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showNotificationLog, setShowNotificationLog] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const removeNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id)
    }));
  }, []);

  const addNotification = useCallback((msg: string, type: NotificationLog['type'] = 'info') => {
    const id = Math.random().toString();
    const newNotif: NotificationLog = {
      id,
      timestamp: Date.now(),
      message: msg,
      type
    };
    setState(prev => ({
      ...prev,
      notifications: [newNotif, ...prev.notifications].slice(0, 50)
    }));
    setTimeout(() => removeNotification(id), 5000);
  }, [removeNotification]);

  const runAiAnalysis = async () => {
    if (state.activities.length === 0) return;
    setIsAnalyzing(true);
    const conflicts = await analyzeCalendarConflicts(state.activities);
    conflicts.forEach((c: any) => {
      addNotification(`IA: ${c.message}`, c.severity === 'warning' ? 'ai' : 'info');
    });
    setIsAnalyzing(false);
  };

  const handleUpdateConfig = (update: Partial<CalendarState['config']>) => {
    setState(prev => ({ ...prev, config: { ...prev.config, ...update } }));
  };

  const handleAddActivity = (activity: ActivityRange) => {
    setState(prev => ({ ...prev, activities: [...prev.activities, { ...activity, status: 'active' }] }));
    addNotification(`"${activity.title}" agregada`, 'success');
  };

  const handleUpdateActivity = (activity: ActivityRange) => {
    setState(prev => ({
      ...prev,
      activities: prev.activities.map(a => a.id === activity.id ? activity : a)
    }));
  };

  const handleRemoveActivity = (id: string) => {
    setState(prev => ({ ...prev, activities: prev.activities.filter(a => a.id !== id) }));
  };

  const handlePostponeActivity = (id: string, newStart: string, newEnd: string) => {
    setState(prev => {
      const activities = [...prev.activities];
      const idx = activities.findIndex(a => a.id === id);
      if (idx === -1) return prev;

      const original = activities[idx];
      const newActivityId = Math.random().toString(36).substr(2, 9);
      
      // Update original status
      activities[idx] = { ...original, status: 'postponed', rescheduledToId: newActivityId };
      
      // Add new rescheduled activity
      const rescheduled: ActivityRange = {
        ...original,
        id: newActivityId,
        startDate: newStart,
        endDate: newEnd,
        status: 'active',
        title: `${original.title} (Re-programado)`,
        rescheduledToId: undefined
      };

      return { ...prev, activities: [...activities, rescheduled] };
    });
    addNotification("Actividad pospuesta y reprogramada", "success");
  };

  const handleSuspendActivity = (id: string) => {
    setState(prev => ({
      ...prev,
      activities: prev.activities.map(a => a.id === id ? { ...a, status: 'suspended' } : a)
    }));
    addNotification("Actividad suspendida", "warning");
  };

  const handleReactivateActivity = (id: string) => {
    setState(prev => ({
      ...prev,
      activities: prev.activities.map(a => a.id === id ? { ...a, status: 'active' } : a)
    }));
    addNotification("Actividad reactivada", "success");
  };

  const handleAddCategory = (category: Category) => {
    setState(prev => ({ ...prev, categories: [...prev.categories, category] }));
  };

  const handleUpdateCategory = (category: Category) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === category.id ? category : c)
    }));
  };

  const handleRemoveCategory = (id: string) => {
    setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
  };

  const handleSelectDay = (date: string) => {
    const existing = state.dayStyles.find(s => {
        if (!s.endDate) return s.startDate === date;
        // Fixed: Replaced missing parseISO with native Date parsing for interval checking
        const d = new Date(date);
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return isWithinInterval(d, { start, end });
    });
    setEditingDayId(existing?.id || null);
    setEditingDate(date);
  };

  const updateDayStyle = (id: string | null, date: string, update: Partial<DayStyle>) => {
    setState(prev => {
      const newStyles = [...prev.dayStyles];
      if (id) {
        const idx = newStyles.findIndex(s => s.id === id);
        if (idx > -1) newStyles[idx] = { ...newStyles[idx], ...update };
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        newStyles.push({ id: newId, startDate: date, ...update });
        setEditingDayId(newId);
      }
      return { ...prev, dayStyles: newStyles };
    });
  };

  const currentDayStyle = editingDayId ? state.dayStyles.find(s => s.id === editingDayId) : null;

  const ICONS_LIBRARY = [
    { id: 'piano', icon: <Piano size={20} />, emoji: '🎹' },
    { id: 'violin', icon: <Guitar size={20} />, emoji: '🎻' },
    { id: 'trumpet', icon: <Volume2 size={20} />, emoji: '🎺' },
    { id: 'drum', icon: <Drum size={20} />, emoji: '🥁' },
    { id: 'masks', icon: <Users size={20} />, emoji: '🎭' },
    { id: 'art', icon: <Award size={20} />, emoji: '🎨' },
    { id: 'flag', icon: <Flag size={20} />, emoji: '🚩' },
    { id: 'star', icon: <Star size={20} />, emoji: '⭐' },
    { id: 'fire', icon: <Sparkles size={20} />, emoji: '🎆' },
    { id: 'check', icon: <CheckCircle2 size={20} />, emoji: '✅' },
    { id: 'pin', icon: <MapPin size={20} />, emoji: '📍' },
    { id: 'bell', icon: <Bell size={20} />, emoji: '🔔' },
    { id: 'coffee', icon: <Coffee size={20} />, emoji: '☕' },
    { id: 'food', icon: <Utensils size={20} />, emoji: '🍴' },
    { id: 'alert', icon: <AlertTriangle size={20} />, emoji: '⚠️' },
    { id: 'idea', icon: <Lightbulb size={20} />, emoji: '💡' },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#f3f4f6] overflow-hidden font-sans">
      
      {/* Sidebar Area */}
      <div 
        className={`fixed inset-0 z-40 md:relative md:inset-auto md:flex transition-all duration-500 ease-in-out ${
          isSidebarCollapsed ? 'md:w-0 overflow-hidden' : 'md:w-[28%] min-w-[320px]'
        } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="absolute inset-0 bg-black/20 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        <div className="h-full w-full shadow-2xl">
          <Sidebar 
            state={state} 
            onUpdateConfig={handleUpdateConfig}
            onAddActivity={handleAddActivity}
            onUpdateActivity={handleUpdateActivity}
            onRemoveActivity={handleRemoveActivity}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onRemoveCategory={handleRemoveCategory}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedActivityId={selectedActivityId}
            onSelectActivity={setSelectedActivityId}
            onPostponeActivity={handlePostponeActivity}
            onSuspendActivity={handleSuspendActivity}
            onReactivateActivity={handleReactivateActivity}
          />
        </div>
      </div>

      {/* Main App */}
      <div className={`flex-1 flex flex-col transition-all duration-500 bg-white relative`}>
        {/* Header bar */}
        <div className="bg-white border-b border-gray-50 h-16 flex items-center justify-between px-8 shrink-0 relative z-10">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                className="hidden md:flex p-2 hover:bg-gray-100 rounded-full text-indigo-600 transition-all bg-indigo-50"
                title={isSidebarCollapsed ? "Mostrar menú" : "Ocultar menú"}
              >
                {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2"><Menu /></button>
              <h1 className="text-[13px] font-black text-gray-900 uppercase tracking-[0.2em]">{state.config.institutionName}</h1>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="relative group">
                <button 
                  onClick={runAiAnalysis}
                  onMouseEnter={() => setShowAiHelp(true)}
                  onMouseLeave={() => setShowAiHelp(false)}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50"
                >
                  {isAnalyzing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full"></div> : <Sparkles size={14} />}
                  Analizar Agenda
                </button>
                {showAiHelp && (
                  <div className="absolute top-full mt-2 right-0 w-64 bg-gray-900 text-white p-4 rounded-2xl shadow-2xl text-[10px] font-bold leading-relaxed z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <p>La IA analiza conflictos de horarios, sobrecarga de ensayos y sugiere mejoras logísticas para tus programas musicales.</p>
                  </div>
                )}
              </div>
              <button onClick={() => setShowNotificationLog(true)} className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all relative">
                 <History size={22} />
                 {state.notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
              </button>
           </div>
        </div>

        <div className="flex-1 bg-gray-100/50 p-4 relative overflow-hidden">
          <CalendarCanvas 
            state={state} 
            selectedMonth={selectedMonth} 
            onSelectDay={handleSelectDay}
            selectedActivityId={selectedActivityId}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        </div>
      </div>

      {/* MODAL REDISEÑADO: Personalizar Día */}
      {editingDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[150] p-4 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 relative flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
            <button 
              onClick={() => {setEditingDate(null); setEditingDayId(null);}} 
              className="absolute top-8 right-8 text-gray-400 hover:text-gray-900 p-2 hover:bg-gray-100 rounded-full transition-all"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-[26px] font-black text-gray-900 mb-8 tracking-tighter">Personalizar Día</h2>
            
            <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar max-h-[70vh]">
               
               {/* BANNER FERIADO */}
               <div className="bg-red-50/50 p-5 rounded-[1.5rem] flex items-center justify-between border border-red-100/50 group hover:bg-red-50 transition-all cursor-pointer" onClick={() => updateDayStyle(editingDayId, editingDate, { isHoliday: !currentDayStyle?.isHoliday })}>
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500 p-2.5 rounded-xl shadow-lg shadow-red-100 group-hover:scale-110 transition-all">
                      <Flag className="text-white" size={18} />
                    </div>
                    <span className="text-[11px] font-black text-red-900 uppercase tracking-widest">Día Feriado / No Laborable</span>
                  </div>
                  <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${currentDayStyle?.isHoliday ? 'bg-red-500 border-red-500' : 'border-red-200 bg-white'}`}>
                    {currentDayStyle?.isHoliday && <X className="text-white" size={14} />}
                  </div>
               </div>

               {/* CATEGORÍA SELECTOR */}
               <div className="space-y-3">
                 <div className="flex items-center gap-2">
                    <Tag size={14} className="text-indigo-400" />
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Escoger Categoría</label>
                 </div>
                 <select 
                    value={currentDayStyle?.categoryId || ''}
                    onChange={(e) => updateDayStyle(editingDayId, editingDate, { categoryId: e.target.value })}
                    className="w-full px-5 py-4 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold bg-gray-50/50"
                 >
                   <option value="">Ninguna categoría</option>
                   {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>

               {/* RANGO DE FECHAS */}
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                      <CalendarIcon size={14} className="text-indigo-400" />
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-xs">Desde</label>
                   </div>
                   <input 
                    type="date" value={currentDayStyle?.startDate || editingDate}
                    onChange={(e) => updateDayStyle(editingDayId, editingDate, { startDate: e.target.value })}
                    className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-[11px] font-bold bg-gray-50/50"
                   />
                 </div>
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                      <CalendarIcon size={14} className="text-indigo-400" />
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-xs">Hasta (Opcional)</label>
                   </div>
                   <input 
                    type="date" value={currentDayStyle?.endDate || ''}
                    onChange={(e) => updateDayStyle(editingDayId, editingDate, { endDate: e.target.value })}
                    className="w-full px-5 py-4 border border-gray-100 rounded-2xl text-[11px] font-bold bg-gray-50/50"
                   />
                 </div>
               </div>

               {/* ETIQUETA DEL DÍA */}
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">Etiqueta del Día</label>
                 <input 
                  type="text" value={currentDayStyle?.label || ''}
                  onChange={(e) => updateDayStyle(editingDayId, editingDate, { label: e.target.value })}
                  placeholder="Ej: Día de la Independencia"
                  className="w-full px-5 py-4 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold shadow-inner bg-white"
                 />
               </div>

               {/* BIBLIOTECA DE ICONOS */}
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">Biblioteca de Iconos</label>
                  <div className="grid grid-cols-6 gap-3 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
                    {ICONS_LIBRARY.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => updateDayStyle(editingDayId, editingDate, { icon: item.emoji })}
                        className={`aspect-square flex flex-col items-center justify-center rounded-2xl transition-all ${
                          currentDayStyle?.icon === item.emoji 
                          ? 'bg-white shadow-xl shadow-indigo-100/50 border border-indigo-100 scale-110 ring-2 ring-indigo-50' 
                          : 'hover:bg-white hover:shadow-md hover:scale-105 opacity-60 hover:opacity-100'
                        }`}
                        title={item.id}
                      >
                        <span className="text-2xl mb-1">{item.emoji}</span>
                        <span className="text-[8px] font-black uppercase text-gray-400">{item.id}</span>
                      </button>
                    ))}
                  </div>
               </div>
            </div>
            
            <button 
              onClick={() => {setEditingDate(null); setEditingDayId(null); addNotification('Día actualizado correctamente', 'success');}}
              className="mt-10 bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[12px] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95"
            >
              Confirmar Cambios
            </button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
};

export default App;
