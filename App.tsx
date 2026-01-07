
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { CalendarCanvas } from './components/CalendarCanvas';
import { CalendarState, ActivityRange, ProgramType, DayStyle, Category, NotificationLog } from './types';
import { 
  Bell, Info, X, Flag, CheckCircle2, Menu, ChevronLeft, ChevronRight, 
  Sparkles, History, Calendar as CalendarIcon, Tag, HelpCircle, 
  Music, Mic, Disc, Piano, Guitar, Drum, Volume2, Users, Star, 
  Award, Heart, Coffee, Utensils, MapPin, AlertTriangle, Lightbulb,
  PlusCircle, LayoutList, CalendarClock, Check
} from 'lucide-react';
import { format, isWithinInterval, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { analyzeCalendarConflicts } from './services/geminiService';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';

const STORAGE_KEY = 'sinfonia_calendar_data';

const App: React.FC = () => {
  const { theme } = useTheme();
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
  const [highlightedActivityIds, setHighlightedActivityIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showNotificationLog, setShowNotificationLog] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);

  // Modal Activity State (for adding activities through the day modal)
  const [modalActivityTitle, setModalActivityTitle] = useState('');
  const [modalActivityProgram, setModalActivityProgram] = useState<ProgramType>('General');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const removeNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id)
    }));
  }, []);

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
      setTimeout(() => removeNotification(id), 5000);
    }
  }, [removeNotification]);

  const runAiAnalysis = async () => {
    if (state.activities.length === 0) return;
    setIsAnalyzing(true);
    const conflicts = await analyzeCalendarConflicts(state.activities);
    conflicts.forEach((c: any) => {
      addNotification(`IA: ${c.message}`, c.severity === 'warning' ? 'ai' : 'info', c.involvedActivityIds);
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

  const handleToggleActivityComplete = (id: string) => {
    setState(prev => ({
      ...prev,
      activities: prev.activities.map(a => 
        a.id === id ? { ...a, completed: !a.completed } : a
      )
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
      
      activities[idx] = { ...original, status: 'postponed', rescheduledToId: newActivityId };
      
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
    const existingStyle = state.dayStyles.find(s => {
        if (!s.endDate) return s.startDate === date;
        const d = new Date(date);
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        return isWithinInterval(d, { start, end });
    });

    // Check if there's an existing activity starting on this date to pre-fill
    const existingActivity = state.activities.find(a => a.startDate === date);
    if (existingActivity) {
      setModalActivityTitle(existingActivity.title);
      setModalActivityProgram(existingActivity.program);
    } else {
      setModalActivityTitle('');
      setModalActivityProgram('General');
    }

    setEditingDayId(existingStyle?.id || null);
    setEditingDate(date);
  };

  const updateDayStyle = useCallback((id: string | null, date: string, update: Partial<DayStyle>) => {
    setState(prev => {
      const newStyles = [...prev.dayStyles];
      const cleanUpdate = { ...update };
      if (cleanUpdate.endDate === '') {
        cleanUpdate.endDate = undefined;
      }
      
      if (id) {
        const idx = newStyles.findIndex(s => s.id === id);
        if (idx > -1) newStyles[idx] = { ...newStyles[idx], ...cleanUpdate };
      } else {
        const newId = Math.random().toString(36).substr(2, 9);
        newStyles.push({ id: newId, startDate: date, ...cleanUpdate });
        setEditingDayId(newId);
      }
      return { ...prev, dayStyles: newStyles };
    });
  }, []);

  const currentDayStyle = editingDayId ? state.dayStyles.find(s => s.id === editingDayId) : null;

  const handleEndDateFocus = useCallback(() => {
    const startDateStr = currentDayStyle?.startDate || editingDate;
    const currentEndDate = currentDayStyle?.endDate;
    
    if (startDateStr && !currentEndDate) {
      try {
        const startDate = new Date(startDateStr);
        const suggestedEndDate = addDays(startDate, 7);
        const formattedEndDate = format(suggestedEndDate, 'yyyy-MM-dd');
        updateDayStyle(editingDayId, editingDate!, { endDate: formattedEndDate });
      } catch (error) {
        console.warn('Could not auto-fill end date:', error);
      }
    }
  }, [currentDayStyle, editingDate, editingDayId, updateDayStyle]);

  // Unified save logic for modal
  const handleModalConfirm = () => {
    if (!editingDate) return;

    // 1. Save Activity if title is provided
    if (modalActivityTitle.trim()) {
      const startDate = currentDayStyle?.startDate || editingDate;
      const endDate = currentDayStyle?.endDate || startDate;
      const cat = state.categories.find(c => c.id === currentDayStyle?.categoryId);

      const existingActivity = state.activities.find(a => a.startDate === editingDate);
      
      if (existingActivity) {
        handleUpdateActivity({
          ...existingActivity,
          title: modalActivityTitle,
          program: modalActivityProgram,
          startDate,
          endDate,
          categoryId: currentDayStyle?.categoryId,
          color: cat?.color || existingActivity.color
        });
      } else {
        handleAddActivity({
          id: Math.random().toString(36).substr(2, 9),
          title: modalActivityTitle,
          startDate,
          endDate,
          program: modalActivityProgram,
          categoryId: currentDayStyle?.categoryId,
          color: cat?.color || '#3b82f6',
          status: 'active'
        });
      }
    }

    setEditingDate(null);
    setEditingDayId(null);
    setModalActivityTitle('');
    addNotification('Día y actividades actualizados correctamente', 'success');
  };

  const handleHighlightActivities = useCallback((ids: string[]) => {
    setHighlightedActivityIds(ids);
    // Auto-clear highlight after 8 seconds
    setTimeout(() => setHighlightedActivityIds([]), 8000);
  }, []);

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
    <div className={`flex h-screen w-screen overflow-hidden font-sans transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gray-900 text-gray-100' 
        : 'bg-[#f3f4f6] text-gray-900'
    }`}>
      
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
            onHighlightActivities={handleHighlightActivities}
          />
        </div>
      </div>

      {/* Main App */}
      <div className={`flex-1 flex flex-col transition-all duration-500 relative`}>
        <div className={`border-b h-16 flex items-center justify-between px-8 shrink-0 relative z-10 transition-colors duration-300 ${
          theme === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-50'
        }`}>
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                className={`hidden md:flex p-2 rounded-full transition-all ${
                  theme === 'dark' ? 'hover:bg-gray-700 text-indigo-400 bg-gray-700/50' : 'hover:bg-gray-100 text-indigo-600 bg-indigo-50'
                }`}
                title={isSidebarCollapsed ? "Mostrar menú" : "Ocultar menú"}
              >
                {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2"><Menu /></button>
              <h1 className={`text-[13px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{state.config.institutionName}</h1>
           </div>
           
           <div className="flex items-center gap-3">
              {/* Theme Toggle Button */}
              <ThemeToggle size="md" />

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
                  <div className={`absolute top-full mt-2 right-0 w-64 p-4 rounded-2xl shadow-2xl text-[10px] font-bold leading-relaxed z-[100] animate-in fade-in slide-in-from-top-2 duration-200 ${
                    theme === 'dark' ? 'bg-gray-700 text-gray-100' : 'bg-gray-900 text-white'
                  }`}>
                    <p>La IA analiza conflictos de horarios, sobrecarga de ensayos y sugiere mejoras logísticas para tus programas musicales.</p>
                  </div>
                )}
              </div>
              <button onClick={() => setShowNotificationLog(true)} className={`p-2.5 rounded-full transition-all relative ${
                theme === 'dark' ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}>
                 <History size={22} />
                 {state.notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
              </button>
           </div>
        </div>

        <div className={`flex-1 p-4 relative overflow-hidden transition-colors duration-300 ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100/50'
        }`}>
          <CalendarCanvas 
            state={state} 
            selectedMonth={selectedMonth} 
            onSelectDay={handleSelectDay}
            selectedActivityId={selectedActivityId}
            highlightedActivityIds={highlightedActivityIds}
            onSelectActivity={setSelectedActivityId}
            onToggleComplete={handleToggleActivityComplete}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        </div>
      </div>

      {/* MODAL REDISEÑADO: Personalizar Día y Eventos */}
      {editingDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[150] p-4 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className={`w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 relative flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 ${
            theme === 'dark' ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
          }`}>
            <button 
              onClick={() => {setEditingDate(null); setEditingDayId(null);}} 
              className={`absolute top-8 right-8 p-2 rounded-full transition-all ${
                theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-4 mb-8">
               <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-100">
                  <CalendarClock size={28} />
               </div>
               <div>
                  <h2 className="text-[26px] font-black tracking-tighter leading-none">Gestión del Día</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Configurar celda y cronograma</p>
               </div>
            </div>
            
            <div className="space-y-8 overflow-y-auto pr-4 custom-scrollbar max-h-[65vh]">
               
               {/* SECCIÓN 1: EVENTO / ACTIVIDAD */}
               <div className={`p-6 rounded-[2rem] border space-y-5 ${
                 theme === 'dark' ? 'bg-indigo-900/10 border-indigo-800/30' : 'bg-indigo-50/30 border-indigo-100/50'
               }`}>
                  <div className="flex items-center gap-2 px-1">
                    <PlusCircle size={14} className="text-indigo-600" />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-900'}`}>Actividad del Cronograma</span>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">Título del Evento</label>
                    <input 
                      type="text" value={modalActivityTitle}
                      onChange={(e) => setModalActivityTitle(e.target.value)}
                      placeholder="Ej: Ensayo General / Concierto Gala"
                      className={`w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold shadow-inner ${
                        theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-indigo-100 text-gray-900'
                      }`}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">Programa Musical</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['Orquesta', 'Coro', 'Coro Infantil', 'Coro Juvenil', 'General'].map(p => (
                         <button
                           key={p}
                           onClick={() => setModalActivityProgram(p as ProgramType)}
                           className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                             modalActivityProgram === p 
                             ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' 
                             : theme === 'dark' 
                               ? 'bg-gray-700 text-gray-400 border-gray-600 hover:border-indigo-800'
                               : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'
                           }`}
                         >
                           {p}
                         </button>
                       ))}
                    </div>
                  </div>
               </div>

               {/* SECCIÓN 2: RANGO DE FECHAS */}
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                      <CalendarIcon size={14} className="text-indigo-400" />
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-xs">Desde</label>
                   </div>
                   <input 
                    type="date" value={currentDayStyle?.startDate || editingDate}
                    onChange={(e) => updateDayStyle(editingDayId, editingDate!, { startDate: e.target.value })}
                    className={`w-full px-5 py-4 border rounded-2xl text-[11px] font-bold ${
                      theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50/50 border-gray-100 text-gray-900'
                    }`}
                   />
                 </div>
                 <div className="space-y-3">
                   <div className="flex items-center gap-2">
                      <CalendarIcon size={14} className="text-indigo-400" />
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-xs">Hasta (Opcional)</label>
                   </div>
                   <div className="relative">
                     <input 
                      type="date" value={currentDayStyle?.endDate || ''}
                      onChange={(e) => updateDayStyle(editingDayId, editingDate!, { endDate: e.target.value })}
                      onFocus={handleEndDateFocus}
                      className={`w-full px-5 py-4 pr-12 border rounded-2xl text-[11px] font-bold ${
                        theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50/50 border-gray-100 text-gray-900'
                      }`}
                     />
                     {currentDayStyle?.endDate && (
                       <button
                         type="button"
                         onClick={() => updateDayStyle(editingDayId, editingDate!, { endDate: '' })}
                         className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                         title="Borrar fecha final"
                       >
                         <X size={14} />
                       </button>
                     )}
                   </div>
                 </div>
               </div>

               {/* SECCIÓN 3: ESTILO DE CELDA (Anteriormente Personalizar Día) */}
               <div className="space-y-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 px-1">
                    <LayoutList size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Apariencia en el Canvas</span>
                  </div>

                  <div className={`p-5 rounded-[1.5rem] flex items-center justify-between border transition-all cursor-pointer ${
                    theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50/50 border-red-100/50 hover:bg-red-50'
                  }`} onClick={() => updateDayStyle(editingDayId, editingDate, { isHoliday: !currentDayStyle?.isHoliday })}>
                    <div className="flex items-center gap-4">
                      <div className="bg-red-500 p-2.5 rounded-xl shadow-lg shadow-red-100">
                        <Flag className="text-white" size={18} />
                      </div>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-red-300' : 'text-red-900'}`}>Día Feriado / No Laborable</span>
                    </div>
                    <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${currentDayStyle?.isHoliday ? 'bg-red-500 border-red-500' : theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-red-200 bg-white'}`}>
                      {currentDayStyle?.isHoliday && <CheckCircle2 className="text-white" size={14} />}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">Categoría Visual</label>
                    <select 
                        value={currentDayStyle?.categoryId || ''}
                        onChange={(e) => updateDayStyle(editingDayId, editingDate, { categoryId: e.target.value })}
                        className={`w-full px-5 py-4 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold ${
                          theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50/50 border-gray-100 text-gray-900'
                        }`}
                    >
                      <option value="">Ninguna categoría</option>
                      {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block px-1">Biblioteca de Iconos</label>
                      <div className={`grid grid-cols-8 gap-3 p-6 rounded-[2rem] border ${
                        theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50/50 border-gray-100'
                      }`}>
                        {ICONS_LIBRARY.map(item => (
                          <button 
                            key={item.id}
                            onClick={() => updateDayStyle(editingDayId, editingDate, { icon: item.emoji })}
                            className={`aspect-square flex flex-col items-center justify-center rounded-2xl transition-all ${
                              currentDayStyle?.icon === item.emoji 
                              ? 'bg-white shadow-xl shadow-indigo-100/50 border border-indigo-100 scale-110 ring-2 ring-indigo-50' 
                              : theme === 'dark' ? 'hover:bg-gray-600 opacity-60 hover:opacity-100' : 'hover:bg-white hover:shadow-md hover:scale-105 opacity-60 hover:opacity-100'
                            }`}
                            title={item.id}
                          >
                            <span className="text-xl">{item.emoji}</span>
                          </button>
                        ))}
                      </div>
                  </div>
               </div>
            </div>
            
            <button 
              onClick={handleModalConfirm}
              className="mt-10 bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[12px] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Check size={18} /> Confirmar Todo el Día
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
