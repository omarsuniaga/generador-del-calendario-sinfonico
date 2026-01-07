
import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { CalendarCanvas } from './components/CalendarCanvas.tsx';
import { CalendarState, ActivityRange, DayStyle, NotificationLog, ActivityStatus } from './types.ts';
import { 
  Menu, ChevronLeft, ChevronRight, 
  Sparkles, RotateCcw, X, CalendarClock, Flag, 
  Circle, LayoutList, Check, AlertCircle, Clock, 
  CheckCircle2, Bell, Trash2
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { analyzeCalendarConflicts } from './services/geminiService.ts';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { useTheme } from './contexts/ThemeContext.tsx';

const STORAGE_KEY = 'sinfonia_calendar_v2';

const App: React.FC = () => {
  const { theme } = useTheme();
  const [state, setState] = useState<CalendarState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error("Error loading state", e); }
    
    return {
      config: { 
        year: 2026, 
        institutionalLogo: null, 
        institutionName: "El Sistema Punta Cana", 
        subtitle: "Calendario Sinfónico",
        monthOrnaments: []
      },
      categories: [
        { id: 'cat-1', name: 'Actividades Regulares', color: '#fbbf24' },
        { id: 'cat-2', name: 'No Laborables', color: '#ef4444' },
        { id: 'cat-3', name: 'Administrativas', color: '#3b82f6' }
      ],
      activities: [], dayStyles: [], notifications: []
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
  const [showNotifications, setShowNotifications] = useState(false);

  // Modal Activity State
  const [modalActivityTitle, setModalActivityTitle] = useState('');
  const [modalActivityDescription, setModalActivityDescription] = useState('');
  const [modalActivityCategoryId, setModalActivityCategoryId] = useState('');
  const [modalActivityStartDate, setModalActivityStartDate] = useState('');
  const [modalActivityEndDate, setModalActivityEndDate] = useState('');
  const [modalActivityStatus, setModalActivityStatus] = useState<ActivityStatus>('active');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  const addNotification = useCallback((msg: string, type: NotificationLog['type'] = 'info', relatedActivityIds?: string[]) => {
    const id = Math.random().toString();
    setState(prev => ({
      ...prev,
      notifications: [{ id, timestamp: Date.now(), message: msg, type, relatedActivityIds }, ...prev.notifications].slice(0, 30)
    }));
  }, []);

  const runAiAnalysis = async () => {
    if (state.activities.length === 0) {
      addNotification("No hay actividades para analizar.", "warning");
      return;
    }
    setIsAnalyzing(true);
    try {
      const conflicts = await analyzeCalendarConflicts(state.activities);
      if (conflicts && conflicts.length > 0) {
        conflicts.forEach((c: any) => addNotification(`IA: ${c.message}`, 'ai', c.involvedActivityIds));
        setShowNotifications(true);
      } else {
        addNotification("Análisis completado: No se detectaron conflictos.", "success");
      }
    } catch (e) {
      addNotification("Error en el análisis de IA.", "warning");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateConfig = (update: Partial<CalendarState['config']>) => {
    setState(prev => ({ ...prev, config: { ...prev.config, ...update } }));
    addNotification("Configuración actualizada", "success");
  };

  const handleUpdateActivity = (activity: ActivityRange) => {
    setState(prev => ({
      ...prev,
      activities: prev.activities.find(a => a.id === activity.id) 
        ? prev.activities.map(a => a.id === activity.id ? activity : a)
        : [...prev.activities, activity]
    }));
    addNotification(`Evento "${activity.title}" guardado`, "success");
  };

  const handleSelectDay = (date: string) => {
    const existingStyle = state.dayStyles.find(s => s.startDate === date);
    const existingActivity = state.activities.find(a => a.startDate === date);
    
    if (existingActivity) {
      setModalActivityTitle(existingActivity.title);
      setModalActivityDescription(existingActivity.description || '');
      setModalActivityCategoryId(existingActivity.categoryId || '');
      setModalActivityStartDate(existingActivity.startDate);
      setModalActivityEndDate(existingActivity.endDate);
      setModalActivityStatus(existingActivity.status || 'active');
    } else {
      setModalActivityTitle('');
      setModalActivityDescription('');
      setModalActivityCategoryId('');
      setModalActivityStartDate(date);
      setModalActivityEndDate(date);
      setModalActivityStatus('active');
    }
    
    setEditingDayId(existingStyle?.id || null);
    setEditingDate(date);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
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
      const existing = state.activities.find(a => a.startDate === editingDate);
      const newActivity: ActivityRange = {
        id: existing?.id || Math.random().toString(36).substr(2, 9),
        title: modalActivityTitle,
        description: modalActivityDescription,
        startDate: modalActivityStartDate,
        endDate: modalActivityEndDate || modalActivityStartDate,
        program: 'General',
        categoryId: modalActivityCategoryId,
        color: cat?.color || '#3b82f6',
        status: modalActivityStatus
      };
      handleUpdateActivity(newActivity);
    }
    setEditingDate(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar - Responsivo */}
      <aside className={`
        fixed inset-y-0 left-0 z-[110] bg-white dark:bg-gray-900 shadow-2xl transition-all duration-300 transform
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'md:w-0 md:opacity-0 pointer-events-none' : 'w-[280px] md:w-[22%] min-w-[280px]'}
      `}>
        <Sidebar 
          state={state} onUpdateConfig={handleUpdateConfig} 
          onAddActivity={handleUpdateActivity} onUpdateActivity={handleUpdateActivity}
          onRemoveActivity={(id) => {
            setState(p => ({...p, activities: p.activities.filter(a => a.id !== id)}));
            addNotification("Actividad eliminada", "info");
          }}
          onAddCategory={(c) => setState(p => ({...p, categories: [...p.categories, c]}))} 
          onUpdateCategory={(c) => setState(p => ({...p, categories: p.categories.map(oc => oc.id === c.id ? c : oc)}))}
          onRemoveCategory={(id) => setState(p => ({...p, categories: p.categories.filter(oc => oc.id !== id)}))}
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
          selectedActivityId={selectedActivityId} onSelectActivity={setSelectedActivityId}
          onEditDay={handleSelectDay} setState={setState}
        />
        <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 md:hidden p-2 text-gray-400">
          <X size={20} />
        </button>
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b z-50 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 transition-colors duration-300">
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <Menu size={20} />
              </button>
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
                {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <h1 className="text-[12px] md:text-[14px] font-black uppercase tracking-widest truncate max-w-[150px] md:max-w-none text-gray-900 dark:text-gray-100">
                {state.config.institutionName}
              </h1>
           </div>
           <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className={`p-2 rounded-xl relative transition-all ${showNotifications ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
              >
                <Bell size={18} />
                {state.notifications.filter(n => n.type === 'ai' || n.type === 'warning').length > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
                )}
              </button>
              <ThemeToggle size="sm" />
              <button onClick={runAiAnalysis} disabled={isAnalyzing} className="hidden sm:flex bg-indigo-600 text-white px-4 md:px-6 py-2 rounded-full text-[10px] font-black uppercase items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                {isAnalyzing ? <RotateCcw size={12} className="animate-spin" /> : <Sparkles size={12} />} 
                <span className="hidden lg:inline">Analizar IA</span>
              </button>
           </div>
        </header>

        {/* Notificaciones Popover */}
        {showNotifications && (
          <div className="absolute top-20 right-4 w-72 md:w-80 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[100] max-h-[60vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Notificaciones</span>
              <button onClick={() => setState(p => ({...p, notifications: []}))} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors"><Trash2 size={12}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {state.notifications.length > 0 ? state.notifications.map(n => (
                <div key={n.id} className={`p-3 rounded-2xl text-[11px] leading-relaxed flex gap-3 border transition-colors ${
                  n.type === 'ai' ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' :
                  n.type === 'success' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
                  'bg-white dark:bg-gray-700/50 border-gray-100 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                }`}>
                  {n.type === 'ai' && <Sparkles size={14} className="shrink-0" />}
                  {n.type === 'warning' && <AlertCircle size={14} className="shrink-0 text-amber-500" />}
                  {n.type === 'success' && <CheckCircle2 size={14} className="shrink-0" />}
                  <p>{n.message}</p>
                </div>
              )) : (
                <div className="py-10 text-center text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase">Sin notificaciones</div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
          <CalendarCanvas 
            state={state} selectedMonth={selectedMonth} onSelectDay={handleSelectDay} 
            selectedActivityId={selectedActivityId} highlightedActivityIds={highlightedActivityIds} 
            onSelectActivity={setSelectedActivityId} isSidebarCollapsed={isSidebarCollapsed}
            onToggleComplete={(id) => {}}
          />
        </div>
      </div>

      {/* Modal Operativo - Responsivo */}
      {editingDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[2rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-10 relative flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors border border-white/20 dark:border-gray-700/50">
            <button onClick={() => setEditingDate(null)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"><X size={20} /></button>
            <div className="flex items-center gap-4 mb-6 md:mb-8">
               <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100/50"><CalendarClock size={24} /></div>
               <div>
                  <h2 className="text-[20px] md:text-[26px] font-black tracking-tighter leading-none">Gestión Operativa</h2>
                  <p className="text-[9px] md:text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{format(new Date(editingDate + 'T00:00:00'), "eeee, d 'de' MMMM", {locale: es})}</p>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
               <div className="p-4 md:p-6 bg-indigo-50/20 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[1.5rem] md:rounded-[2rem] space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Estado</label>
                    <div className="flex gap-2">
                       {[
                         {id: 'active', label: 'Activo', icon: CheckCircle2, color: 'text-green-500'},
                         {id: 'postponed', label: 'Pospuesto', icon: Clock, color: 'text-amber-500'},
                         {id: 'suspended', label: 'Suspendido', icon: AlertCircle, color: 'text-red-500'}
                       ].map(s => (
                         <button key={s.id} onClick={() => setModalActivityStatus(s.id as ActivityStatus)} className={`flex-1 py-3 px-1 rounded-xl border transition-all flex flex-col items-center gap-1 ${modalActivityStatus === s.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                            <s.icon size={14} className={modalActivityStatus === s.id ? 'text-white' : s.color} />
                            <span className="text-[8px] font-black uppercase">{s.label}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Título</label>
                    <input type="text" value={modalActivityTitle} onChange={e => setModalActivityTitle(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Nombre de la actividad..." />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Inicio</label>
                        <input type="date" value={modalActivityStartDate} onChange={e => setModalActivityStartDate(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Fin</label>
                        <input type="date" value={modalActivityEndDate} onChange={e => setModalActivityEndDate(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Categoría</label>
                    <select value={modalActivityCategoryId} onChange={e => setModalActivityCategoryId(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
                        <option value="">Seleccionar...</option>
                        {state.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
               </div>

               <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900/50 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 dark:border-gray-700 transition-colors">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                     <button onClick={() => updateDayStyle(editingDayId, editingDate!, {isHoliday: !state.dayStyles.find(s=>s.id===editingDayId)?.isHoliday})} className={`w-full sm:flex-1 py-4 px-6 rounded-2xl border transition-all font-black text-[10px] uppercase flex items-center justify-center gap-2 ${state.dayStyles.find(s=>s.id===editingDayId)?.isHoliday ? 'bg-red-500 text-white border-red-500 shadow-lg' : 'bg-white dark:bg-gray-700 text-red-500 border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-900'}`}><Flag size={14} /> Feriado</button>
                     <div className="w-full sm:flex-1 flex gap-2">
                        {['circle', 'square'].map(shape => (
                          <button key={shape} onClick={() => updateDayStyle(editingDayId, editingDate!, {shape: shape as any})} className={`flex-1 py-4 border rounded-2xl flex flex-col items-center gap-1 transition-all ${state.dayStyles.find(s=>s.id===editingDayId)?.shape === shape ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-indigo-300'}`}>
                            {shape === 'circle' ? <Circle size={14}/> : <LayoutList size={14}/>}
                            <span className="text-[8px] font-black uppercase">{shape}</span>
                          </button>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

            <button onClick={handleModalConfirm} className="mt-6 md:mt-8 bg-indigo-600 text-white py-4 md:py-5 rounded-[1.5rem] md:rounded-[1.8rem] font-black uppercase text-[12px] tracking-widest shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"><Check size={20} /> Guardar Cambios</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
