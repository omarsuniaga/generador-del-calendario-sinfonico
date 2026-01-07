
import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { CalendarCanvas } from './components/CalendarCanvas.tsx';
import { CalendarState, ActivityRange, ProgramType, DayStyle, Category, NotificationLog } from './types.ts';
import { 
  Menu, ChevronLeft, ChevronRight, 
  Sparkles, RotateCcw, AlignLeft,
  X, CalendarClock, Flag, Circle, LayoutList, Check
} from 'lucide-react';
import { format, isWithinInterval, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { analyzeCalendarConflicts } from './services/geminiService.ts';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { useTheme } from './contexts/ThemeContext.tsx';

const STORAGE_KEY = 'sinfonia_calendar_data';

const App: React.FC = () => {
  const { theme } = useTheme();
  const [state, setState] = useState<CalendarState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Error loading state from localStorage", e);
    }
    
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
  const [highlightedActivityIds, setHighlightedActivityIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Modal Activity State
  const [modalActivityTitle, setModalActivityTitle] = useState('');
  const [modalActivityDescription, setModalActivityDescription] = useState('');
  const [modalActivityProgram, setModalActivityProgram] = useState<ProgramType>('General');
  const [modalActivityCategoryId, setModalActivityCategoryId] = useState('');
  const [modalActivityStartDate, setModalActivityStartDate] = useState('');
  const [modalActivityEndDate, setModalActivityEndDate] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addNotification = useCallback((msg: string, type: NotificationLog['type'] = 'info', relatedActivityIds?: string[]) => {
    const id = Math.random().toString();
    const newNotif: NotificationLog = {
      id,
      timestamp: Date.now(),
      message: msg,
      type,
      relatedActivityIds
    };
    setState(prev => ({
      ...prev,
      notifications: [newNotif, ...prev.notifications].slice(0, 50)
    }));
    if (type !== 'ai') {
      setTimeout(() => setState(p => ({...p, notifications: p.notifications.filter(n => n.id !== id)})), 8000);
    }
  }, []);

  const runAiAnalysis = async () => {
    if (state.activities.length === 0) return;
    setIsAnalyzing(true);
    addNotification("Iniciando análisis de conflictos con IA...", "info");
    const conflicts = await analyzeCalendarConflicts(state.activities);
    if (conflicts && conflicts.length > 0) {
      conflicts.forEach((c: any) => {
        addNotification(`IA: ${c.message}`, c.severity === 'warning' ? 'ai' : 'info', c.involvedActivityIds);
      });
    } else {
      addNotification("No se detectaron conflictos logísticos.", "success");
    }
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

  const handleSelectDay = (date: string) => {
    const existingStyle = state.dayStyles.find(s => {
        if (!s.endDate) return s.startDate === date;
        const d = new Date(date + 'T00:00:00');
        return isWithinInterval(d, { 
          start: new Date(s.startDate + 'T00:00:00'), 
          end: new Date(s.endDate + 'T00:00:00') 
        });
    });
    
    const existingActivity = state.activities.find(a => a.startDate === date);
    
    if (existingActivity) {
      setModalActivityTitle(existingActivity.title);
      setModalActivityDescription(existingActivity.description || '');
      setModalActivityProgram(existingActivity.program);
      setModalActivityCategoryId(existingActivity.categoryId || '');
      setModalActivityStartDate(existingActivity.startDate);
      setModalActivityEndDate(existingActivity.endDate);
    } else {
      setModalActivityTitle('');
      setModalActivityDescription('');
      setModalActivityProgram('General');
      setModalActivityCategoryId('');
      setModalActivityStartDate(date);
      setModalActivityEndDate(date);
    }
    
    setEditingDayId(existingStyle?.id || null);
    setEditingDate(date);
  };

  const updateDayStyle = useCallback((id: string | null, date: string, update: Partial<DayStyle>) => {
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
  }, []);

  const handleModalConfirm = () => {
    if (!editingDate) return;
    if (modalActivityTitle.trim()) {
      const cat = state.categories.find(c => c.id === modalActivityCategoryId);
      const existingIdx = state.activities.findIndex(a => a.startDate === editingDate);
      const newActivity: ActivityRange = {
        id: existingIdx > -1 ? state.activities[existingIdx].id : Math.random().toString(36).substr(2, 9),
        title: modalActivityTitle,
        description: modalActivityDescription,
        startDate: modalActivityStartDate,
        endDate: modalActivityEndDate || modalActivityStartDate,
        program: modalActivityProgram,
        categoryId: modalActivityCategoryId,
        color: cat?.color || '#3b82f6',
        status: 'active'
      };
      if (existingIdx > -1) handleUpdateActivity(newActivity);
      else handleAddActivity(newActivity);
    }
    setEditingDate(null);
    setEditingDayId(null);
  };

  const ICONS_LIBRARY = [
    { id: 'piano', emoji: '🎹' }, { id: 'violin', emoji: '🎻' }, { id: 'trumpet', emoji: '🎺' }, { id: 'drum', emoji: '🥁' },
    { id: 'masks', emoji: '🎭' }, { id: 'art', emoji: '🎨' }, { id: 'flag', emoji: '🚩' }, { id: 'star', emoji: '⭐' },
    { id: 'fire', emoji: '🎆' }, { id: 'check', emoji: '✅' }, { id: 'pin', emoji: '📍' }, { id: 'bell', emoji: '🔔' },
    { id: 'coffee', emoji: '☕' }, { id: 'food', emoji: '🍴' }, { id: 'alert', emoji: '⚠️' }, { id: 'idea', emoji: '💡' },
  ];

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-[#f3f4f6] text-gray-900'}`}>
      <div className={`fixed inset-0 z-40 md:relative md:inset-auto md:flex transition-all duration-500 ${isSidebarCollapsed ? 'md:w-0 overflow-hidden' : 'md:w-[25%] lg:w-[20%] min-w-[300px]'} ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="absolute inset-0 bg-black/40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
        <Sidebar 
          state={state} 
          onUpdateConfig={handleUpdateConfig} 
          onAddActivity={handleAddActivity} 
          onUpdateActivity={handleUpdateActivity}
          onRemoveActivity={handleRemoveActivity} 
          onAddCategory={(c) => setState(p => ({...p, categories: [...p.categories, c]}))} 
          onUpdateCategory={(c) => setState(p => ({...p, categories: p.categories.map(oc => oc.id === c.id ? c : oc)}))}
          onRemoveCategory={(id) => setState(p => ({...p, categories: p.categories.filter(oc => oc.id !== id)}))} 
          selectedMonth={selectedMonth} 
          setSelectedMonth={setSelectedMonth}
          selectedActivityId={selectedActivityId} 
          onSelectActivity={setSelectedActivityId} 
          onHighlightActivities={(ids) => setHighlightedActivityIds(ids)}
          setState={setState}
          onEditDay={handleSelectDay}
        />
      </div>

      <div className="flex-1 flex flex-col transition-all duration-500 relative bg-gray-100 dark:bg-gray-950">
        <div className={`border-b h-14 md:h-16 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-500 hover:text-indigo-600"><Menu size={20} /></button>
              <h1 className="text-[12px] md:text-[14px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] truncate max-w-[150px] md:max-w-none">{state.config.institutionName}</h1>
           </div>
           <div className="flex items-center gap-2 md:gap-3">
              <ThemeToggle size="sm" />
              <button onClick={runAiAnalysis} disabled={isAnalyzing} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-6 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all">
                {isAnalyzing ? <RotateCcw size={12} className="animate-spin" /> : <Sparkles size={12} />} <span className="hidden xs:inline">Analizar IA</span>
              </button>
           </div>
        </div>
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          <CalendarCanvas 
            state={state} 
            selectedMonth={selectedMonth} 
            onSelectDay={handleSelectDay} 
            selectedActivityId={selectedActivityId} 
            highlightedActivityIds={highlightedActivityIds} 
            onSelectActivity={setSelectedActivityId} 
            onToggleComplete={(id) => setState(p => ({...p, activities: p.activities.map(a => a.id === id ? {...a, completed: !a.completed} : a)}))} 
            isSidebarCollapsed={isSidebarCollapsed} 
          />
        </div>
      </div>

      {editingDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[150] p-2 md:p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`w-full max-w-2xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-10 relative flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-500 ${theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`}>
            <button onClick={() => {setEditingDate(null); setEditingDayId(null);}} className="absolute top-4 right-4 md:top-8 md:right-8 p-2 md:p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
              <X size={20} md:size={24} />
            </button>
            <div className="flex items-center gap-4 mb-4 md:mb-8">
               <div className="p-2 md:p-3 bg-indigo-600 rounded-xl md:rounded-2xl text-white shadow-xl shadow-indigo-100">
                  <CalendarClock size={24} md:size={28} />
               </div>
               <div>
                  <h2 className="text-[20px] md:text-[26px] font-black tracking-tighter leading-none">Gestión Operativa</h2>
                  <p className="text-[9px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">{format(new Date(editingDate + 'T00:00:00'), "eeee, d 'de' MMMM", {locale: es})}</p>
               </div>
            </div>
            <div className="space-y-4 md:space-y-6 overflow-y-auto pr-2 md:pr-4 custom-scrollbar">
               <div className="space-y-4 md:space-y-5 p-4 md:p-6 bg-indigo-50/20 dark:bg-indigo-900/10 border rounded-[1.5rem] md:rounded-[2rem]">
                  <div className="flex items-center gap-2 mb-1">
                    <AlignLeft size={14} className="text-indigo-600" />
                    <span className="text-[9px] font-black uppercase text-indigo-900 dark:text-indigo-300">Detalles de la Actividad</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Título del Evento</label>
                    <input type="text" value={modalActivityTitle} onChange={e => setModalActivityTitle(e.target.value)} placeholder="Ej: Ensayo General..." className="w-full p-3 rounded-xl border text-sm font-bold dark:bg-gray-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Desde</label>
                        <input type="date" value={modalActivityStartDate} onChange={e => setModalActivityStartDate(e.target.value)} className="w-full p-2.5 rounded-lg border text-xs dark:bg-gray-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Hasta</label>
                        <input type="date" value={modalActivityEndDate} onChange={e => setModalActivityEndDate(e.target.value)} className="w-full p-2.5 rounded-lg border text-xs dark:bg-gray-700" />
                     </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Categoría</label>
                    <select value={modalActivityCategoryId} onChange={e => setModalActivityCategoryId(e.target.value)} className="w-full p-2.5 rounded-lg border text-xs dark:bg-gray-700">
                        <option value="">Sin categoría</option>
                        {state.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Notas</label>
                    <textarea value={modalActivityDescription} onChange={e => setModalActivityDescription(e.target.value)} placeholder="Detalles logísticos..." className="w-full p-3 rounded-xl border text-sm dark:bg-gray-700 h-20 md:h-24 resize-none" />
                  </div>
               </div>
               <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-700/50 rounded-[1.5rem] md:rounded-[2rem] border">
                  <div className="flex flex-col md:flex-row gap-4 mb-4 md:mb-6">
                     <button onClick={() => updateDayStyle(editingDayId, editingDate!, {isHoliday: !state.dayStyles.find(s=>s.id===editingDayId)?.isHoliday})} className={`flex-1 flex items-center justify-center gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border transition-all font-black text-[9px] md:text-[10px] uppercase ${state.dayStyles.find(s=>s.id===editingDayId)?.isHoliday ? 'bg-red-500 text-white' : 'bg-white text-red-500'}`}><Flag size={14} /> Feriado</button>
                     <div className="flex-1 flex items-center gap-2">
                        {['square', 'circle'].map((shape) => (
                          <button key={shape} onClick={() => updateDayStyle(editingDayId, editingDate!, {shape: shape as any})} className={`flex-1 py-3 md:py-4 border rounded-xl md:rounded-2xl transition-all flex flex-col items-center gap-1 ${state.dayStyles.find(s=>s.id===editingDayId)?.shape === shape ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400'}`}>{shape === 'circle' ? <Circle size={12} md:size={14} /> : <LayoutList size={12} md:size={14} />}<span className="text-[7px] md:text-[8px] font-black uppercase">{shape === 'circle' ? 'Círculo' : 'Cuadro'}</span></button>
                        ))}
                     </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 md:gap-3">
                    {ICONS_LIBRARY.map(item => (
                      <button key={item.id} onClick={() => updateDayStyle(editingDayId, editingDate!, { icon: item.emoji })} className={`text-lg md:text-xl p-2 md:p-3 rounded-xl md:rounded-2xl transition-all border border-transparent ${state.dayStyles.find(s=>s.id===editingDayId)?.icon === item.emoji ? 'bg-indigo-100 border-indigo-200 scale-110' : 'hover:bg-white active:bg-indigo-50'}`}>{item.emoji}</button>
                    ))}
                  </div>
               </div>
            </div>
            <button onClick={handleModalConfirm} className="mt-4 md:mt-8 bg-indigo-600 text-white py-4 md:py-5 rounded-xl md:rounded-[1.8rem] font-black uppercase text-[11px] md:text-[12px] tracking-[0.1em] md:tracking-[0.2em] shadow-2xl active:scale-95 transition-all"><Check size={18} md:size={20} className="inline mr-2" /> Guardar Cambios</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
