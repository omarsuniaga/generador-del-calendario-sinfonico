
import React, { useState, useRef } from 'react';
import { CalendarState, ActivityRange, ProgramType, Category, ActivityStatus } from '../types.ts';
// Removed startOfMonth as it was unused and reported as missing in the environment
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Plus, Sparkles, Tag, Trash2, ChevronDown, ChevronRight, 
  Calendar as CalendarIcon, Music, Edit2, Share2, 
  Upload, FileBox, FileUp, ClipboardList, 
  Building, RotateCcw, FileImage, FileText, Eraser,
  Hash, Star, Music2, CalendarPlus, Search, ListFilter
} from 'lucide-react';
import { parseNaturalLanguageActivity } from '../services/geminiService.ts';
import { 
  ExportService, 
  ImportService,
  ImportResult 
} from '../services/dataService.ts';
import { exportToImage, exportToPDF } from '../services/exportService.ts';
import { useTheme } from '../contexts/ThemeContext.tsx';

interface SidebarProps {
  state: CalendarState;
  onUpdateConfig: (update: Partial<CalendarState['config']>) => void;
  onAddActivity: (activity: ActivityRange) => void;
  onUpdateActivity: (activity: ActivityRange) => void;
  onRemoveActivity: (id: string) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (category: Category) => void;
  onRemoveCategory: (id: string) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedActivityId: string | null;
  onSelectActivity: (id: string | null) => void;
  setState: React.Dispatch<React.SetStateAction<CalendarState>>;
  onEditDay: (date: string) => void;
}

const ORNAMENTS = [
  { icon: 'None', label: 'Sin adorno' },
  { icon: '🎻', label: 'Violín' },
  { icon: '🎼', label: 'Partitura' },
  { icon: '🌸', label: 'Primavera' },
  { icon: '☀️', label: 'Verano' },
  { icon: '🍂', label: 'Otoño' },
  { icon: '❄️', label: 'Invierno' },
  { icon: '🎵', label: 'Nota Musical' },
  { icon: '🏛️', label: 'Clásico' },
];

const PROGRAMS: ProgramType[] = ['General', 'Orquesta', 'Coro', 'Coro Infantil', 'Coro Juvenil'];

export const Sidebar: React.FC<SidebarProps> = ({ 
  state, onUpdateConfig, onAddActivity, onRemoveActivity,
  onAddCategory, onUpdateCategory, onRemoveCategory,
  selectedMonth, setSelectedMonth, selectedActivityId, 
  onSelectActivity, setState, onEditDay
}) => {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiProposedActivity, setAiProposedActivity] = useState<Partial<ActivityRange> | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);

  // Form State for Manual Event Creation
  const [newActivity, setNewActivity] = useState<{
    title: string;
    startDate: string;
    endDate: string;
    categoryId: string;
    program: ProgramType;
  }>({
    title: '',
    startDate: format(new Date(state.config.year, selectedMonth, 1), 'yyyy-MM-dd'),
    endDate: format(new Date(state.config.year, selectedMonth, 1), 'yyyy-MM-dd'),
    categoryId: '',
    program: 'General'
  });

  const [searchTerm, setSearchTerm] = useState('');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    eventManager: true, categories: false, activities: true, month: false, 
    ai: false, import: false, export: false, institution: false, ornaments: false
  });
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const clearMonthActivities = () => {
    if (confirm(`¿Estás seguro de que deseas eliminar todas las actividades de ${months[selectedMonth]}?`)) {
      setState(prev => ({
        ...prev,
        activities: prev.activities.filter(a => {
          const d = new Date(a.startDate + 'T00:00:00');
          return d.getMonth() !== selectedMonth;
        })
      }));
    }
  };

  const handleCreateManualActivity = () => {
    if (!newActivity.title.trim()) return;
    const cat = state.categories.find(c => c.id === newActivity.categoryId);
    onAddActivity({
      id: Math.random().toString(36).substr(2, 9),
      title: newActivity.title,
      startDate: newActivity.startDate,
      endDate: newActivity.endDate || newActivity.startDate,
      program: newActivity.program,
      categoryId: newActivity.categoryId,
      color: cat?.color || '#3b82f6',
      status: 'active'
    });
    setNewActivity({
      ...newActivity,
      title: ''
    });
  };

  const handleProcessAiPrompt = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    const result = await parseNaturalLanguageActivity(aiPrompt);
    if (result) {
      setAiProposedActivity({
        title: result.title,
        startDate: result.startDate,
        endDate: result.endDate,
        program: result.program as ProgramType,
        color: result.color || '#3b82f6'
      });
    }
    setIsAiLoading(false);
  };

  const handleConfirmAiActivity = () => {
    if (aiProposedActivity) {
      onAddActivity({
        id: Math.random().toString(36).substr(2, 9),
        title: aiProposedActivity.title || 'Nueva Actividad',
        startDate: aiProposedActivity.startDate || format(new Date(), 'yyyy-MM-dd'),
        endDate: aiProposedActivity.endDate || aiProposedActivity.startDate || format(new Date(), 'yyyy-MM-dd'),
        program: aiProposedActivity.program || 'General',
        color: aiProposedActivity.color || '#3b82f6',
        status: 'active'
      });
      setAiProposedActivity(null);
      setAiPrompt('');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const formatType = ImportService.detectFormat(content);
      let result: ImportResult;
      if (formatType === 'json') result = ImportService.fromJSON(content, state.categories);
      else if (formatType === 'csv') result = ImportService.fromCSV(content, state.categories);
      else result = { success: false, message: 'Formato no soportado', errors: ['El contenido debe ser JSON o CSV'] };
      
      setImportPreview(result);
      setShowImportModal(true);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!importPreview?.data) return;
    const data = importPreview.data;
    setState(prev => ({
      ...prev,
      activities: [...prev.activities, ...(data.activities || [])],
      categories: data.categories && data.categories.length > 0 ? [...prev.categories, ...data.categories] : prev.categories,
      dayStyles: data.dayStyles ? [...prev.dayStyles, ...data.dayStyles] : prev.dayStyles,
      config: data.config ? { ...prev.config, ...data.config } : prev.config
    }));
    setShowImportModal(false);
  };

  const handleUpdateOrnament = (icon: string) => {
    const existing = state.config.monthOrnaments.filter(o => o.month !== selectedMonth);
    const newOrnaments = icon === 'None' ? existing : [...existing, { month: selectedMonth, icon }];
    onUpdateConfig({ monthOrnaments: newOrnaments });
  };

  const monthActivities = state.activities.filter(a => {
    const d = new Date(a.startDate + 'T00:00:00');
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase());
    return isValid(d) && d.getMonth() === selectedMonth && matchesSearch;
  });

  const currentOrnament = state.config.monthOrnaments.find(o => o.month === selectedMonth)?.icon || 'None';

  const SectionHeader = ({ id, icon: Icon, title, count }: { id: string, icon: any, title: string, count?: number }) => (
    <button 
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-3 px-3 rounded-xl transition-all group hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg transition-colors ${openSections[id] ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'}`}>
          <Icon size={14} />
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${openSections[id] ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
          {title} {count !== undefined && <span className="ml-1 opacity-40">[{count}]</span>}
        </span>
      </div>
      {openSections[id] ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-y-auto select-none custom-scrollbar transition-colors duration-300 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
      <div className="p-6 sticky top-0 backdrop-blur-sm z-20 border-b flex items-center gap-3 bg-white/95 dark:bg-gray-900/95 border-gray-100 dark:border-gray-800 transition-colors">
        <div className="w-9 h-9 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
          <Music size={18} />
        </div>
        <div>
          <h2 className="text-xs font-black uppercase tracking-tighter leading-none text-gray-900 dark:text-white">Sinfonía</h2>
          <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Calendar Core v2</span>
        </div>
      </div>

      <div className="p-4 space-y-2 flex-1">
        
        {/* Mes y Año */}
        <div className="border-b border-gray-50 dark:border-gray-800 pb-2">
          <SectionHeader id="month" icon={CalendarIcon} title="Periodo" />
          {openSections.month && (
            <div className="p-2 space-y-3 animate-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
                <Hash size={14} className="text-indigo-600" />
                <input 
                  type="number" 
                  value={state.config.year} 
                  onChange={e => onUpdateConfig({ year: parseInt(e.target.value) || 2026 })}
                  className="bg-transparent border-0 text-xs font-black w-full outline-none text-gray-900 dark:text-gray-100"
                  placeholder="Año"
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {months.map((m, i) => (
                  <button key={m} onClick={() => setSelectedMonth(i)} className={`py-2 rounded-lg text-[8px] font-black uppercase transition-all ${selectedMonth === i ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    {m.substring(0,3)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Módulo de Gestión de Eventos */}
        <div className="border-b border-gray-50 dark:border-gray-800 pb-2">
          <SectionHeader id="eventManager" icon={CalendarPlus} title="Gestión de Eventos" />
          {openSections.eventManager && (
            <div className="p-3 space-y-4 animate-in slide-in-from-top-1 duration-200">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Título de Actividad</label>
                  <input 
                    type="text" 
                    value={newActivity.title}
                    onChange={e => setNewActivity({...newActivity, title: e.target.value})}
                    className="w-full p-2.5 text-[10px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors" 
                    placeholder="Ej: Concierto de Gala..." 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Inicio</label>
                    <input 
                      type="date" 
                      value={newActivity.startDate}
                      onChange={e => setNewActivity({...newActivity, startDate: e.target.value})}
                      className="w-full p-2 text-[10px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Fin</label>
                    <input 
                      type="date" 
                      value={newActivity.endDate}
                      onChange={e => setNewActivity({...newActivity, endDate: e.target.value})}
                      className="w-full p-2 text-[10px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Categoría</label>
                    <select 
                      value={newActivity.categoryId}
                      onChange={e => setNewActivity({...newActivity, categoryId: e.target.value})}
                      className="w-full p-2 text-[10px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    >
                      <option value="">Ninguna</option>
                      {state.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Programa</label>
                    <select 
                      value={newActivity.program}
                      onChange={e => setNewActivity({...newActivity, program: e.target.value as ProgramType})}
                      className="w-full p-2 text-[10px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    >
                      {PROGRAMS.map(prog => <option key={prog} value={prog}>{prog}</option>)}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={handleCreateManualActivity}
                  disabled={!newActivity.title.trim()}
                  className="w-full p-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-50"
                >
                  <Plus size={14} className="inline mr-2" /> Crear Actividad
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ornamentos */}
        <div className="border-b border-gray-50 dark:border-gray-800 pb-2">
          <SectionHeader id="ornaments" icon={Star} title="Adornos de Mes" />
          {openSections.ornaments && (
            <div className="p-2 grid grid-cols-3 gap-2 animate-in slide-in-from-top-1 duration-200">
               {ORNAMENTS.map(orn => (
                 <button 
                  key={orn.label} 
                  onClick={() => handleUpdateOrnament(orn.icon)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${currentOrnament === orn.icon ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-indigo-300 dark:hover:border-indigo-900'}`}
                 >
                   <span className="text-xl">{orn.icon === 'None' ? <RotateCcw size={16} className="opacity-50" /> : orn.icon}</span>
                   <span className="text-[7px] font-black uppercase truncate w-full text-center">{orn.label}</span>
                 </button>
               ))}
            </div>
          )}
        </div>

        {/* Asistente IA */}
        <div className="border-b border-gray-50 dark:border-gray-800 pb-2">
          <SectionHeader id="ai" icon={Sparkles} title="Asistente IA" />
          {openSections.ai && (
            <div className="p-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
              <textarea 
                placeholder="Ej: Ensayo de orquesta el 15 de este mes a las 10am..." 
                className="w-full p-3 text-[10px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 h-20 resize-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-gray-400" 
                value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} 
              />
              <button onClick={handleProcessAiPrompt} disabled={isAiLoading || !aiPrompt.trim()} className="w-full p-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50">
                {isAiLoading ? <RotateCcw size={12} className="animate-spin" /> : <Sparkles size={12} />} Procesar con IA
              </button>
              {aiProposedActivity && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl space-y-2 animate-in zoom-in-95">
                  <p className="text-[10px] font-black text-indigo-900 dark:text-indigo-100 leading-tight">{aiProposedActivity.title}</p>
                  <div className="flex gap-2">
                    <button onClick={handleConfirmAiActivity} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow-sm">Crear</button>
                    <button onClick={() => setAiProposedActivity(null)} className="flex-1 py-1.5 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg text-[8px] font-black uppercase">Ignorar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actividades del Mes */}
        <div className="border-b border-gray-50 dark:border-gray-800 pb-2">
          <SectionHeader id="activities" icon={ClipboardList} title="Actividades" count={monthActivities.length} />
          {openSections.activities && (
            <div className="p-2 space-y-2 max-h-80 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-1 duration-200">
               <div className="relative mb-3">
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="w-full p-2 pl-8 text-[9px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-all" 
                   placeholder="Buscar actividad..." 
                 />
                 <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
               </div>
               
               {monthActivities.length > 0 && (
                 <button onClick={clearMonthActivities} className="w-full p-2 mb-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2 text-[8px] font-black uppercase transition-colors">
                   <Eraser size={12} /> Limpiar {months[selectedMonth]}
                 </button>
               )}
               {monthActivities.length > 0 ? monthActivities.map(a => (
                 <div key={a.id} className={`p-3 rounded-xl border transition-all group ${selectedActivityId === a.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectActivity(a.id)}>
                      <h4 className="text-[10px] font-black uppercase truncate">{a.title}</h4>
                      <div className="flex justify-between items-center mt-1">
                        <span className={`text-[8px] font-bold uppercase transition-opacity ${selectedActivityId === a.id ? 'text-indigo-100' : 'text-gray-400 dark:text-gray-500'}`}>
                          {format(new Date(a.startDate + 'T00:00:00'), "d MMM", {locale: es})}
                        </span>
                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md ${selectedActivityId === a.id ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                          {a.program}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 justify-end">
                      <button onClick={() => onEditDay(a.startDate)} className={`p-1.5 rounded-lg transition-colors ${selectedActivityId === a.id ? 'bg-white/20 text-white' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-indigo-600'}`}><Edit2 size={12}/></button>
                      <button onClick={() => onRemoveActivity(a.id)} className={`p-1.5 rounded-lg transition-colors ${selectedActivityId === a.id ? 'bg-white/20 text-white' : 'bg-white dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-red-600'}`}><Trash2 size={12}/></button>
                    </div>
                 </div>
               )) : (
                 <div className="p-8 text-center text-gray-400 dark:text-gray-600 text-[9px] font-black uppercase italic">Sin actividades registradas</div>
               )}
            </div>
          )}
        </div>

        {/* Categorías */}
        <div className="border-b border-gray-50 dark:border-gray-800 pb-2">
          <SectionHeader id="categories" icon={Tag} title="Categorías" count={state.categories.length} />
          {openSections.categories && (
            <div className="p-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {state.categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-transparent dark:border-gray-700 transition-all">
                    <div className="flex items-center gap-2">
                      <input type="color" value={cat.color} onChange={e => onUpdateCategory({...cat, color: e.target.value})} className="w-4 h-4 rounded-full border-0 p-0 overflow-hidden cursor-pointer shadow-sm" />
                      <input type="text" value={cat.name} onChange={e => onUpdateCategory({...cat, name: e.target.value})} className="bg-transparent border-0 p-0 text-[10px] font-bold text-gray-700 dark:text-gray-200 outline-none w-24 focus:text-indigo-600 transition-colors" />
                    </div>
                    <button onClick={() => onRemoveCategory(cat.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Nueva..." className="flex-1 p-2 text-[9px] border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-all" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                <button onClick={() => { if(newCatName) onAddCategory({id: Math.random().toString(36).substr(2,9), name: newCatName, color: newCatColor}); setNewCatName(''); }} className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100 dark:shadow-none transition-transform active:scale-95"><Plus size={14}/></button>
              </div>
            </div>
          )}
        </div>

        {/* Transferencia */}
        <div className="border-b border-gray-50 dark:border-gray-800 pb-2">
          <SectionHeader id="export" icon={Share2} title="Transferencia" />
          {openSections.export && (
            <div className="p-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => exportToPDF('calendar-print-area', `Sinfonia_${months[selectedMonth]}`)} className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-[8px] font-black uppercase flex flex-col items-center gap-1.5 shadow-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                  <FileText size={14}/> PDF
                </button>
                <button onClick={() => exportToImage('calendar-print-area', `Sinfonia_${months[selectedMonth]}`)} className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl text-[8px] font-black uppercase flex flex-col items-center gap-1.5 shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                  <FileImage size={14}/> JPEG
                </button>
              </div>
              <button onClick={() => ExportService.download(ExportService.toJSON(state), ExportService.generateFilename('Backup', 'json'), 'application/json')} className="w-full p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                <FileBox size={14}/> Backup JSON
              </button>
              <div onClick={() => backupInputRef.current?.click()} className="p-2.5 border-2 border-dashed border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all">
                <FileUp size={14}/> <span className="text-[8px] font-black uppercase">Importar Archivo</span>
                <input type="file" ref={backupInputRef} className="hidden" accept=".json,.csv" onChange={handleFileSelect} />
              </div>
            </div>
          )}
        </div>

        {/* Ajustes */}
        <div className="pb-4">
          <SectionHeader id="institution" icon={Building} title="Ajustes Institucionales" />
          {openSections.institution && (
            <div className="p-3 space-y-4 animate-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Institución</label>
                <input type="text" value={state.config.institutionName} onChange={e => onUpdateConfig({institutionName: e.target.value})} className="w-full p-2.5 text-[10px] border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors" placeholder="Nombre oficial..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase ml-1">Logo Institucional</label>
                <div onClick={() => fileInputRef.current?.click()} className="p-4 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl flex flex-col items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                   {state.config.institutionalLogo ? <img src={state.config.institutionalLogo} className="h-10 object-contain drop-shadow-sm" /> : <Upload size={16} className="text-gray-400" />}
                   <span className="text-[8px] font-black uppercase text-gray-400">Seleccionar Imagen</span>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if(file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => onUpdateConfig({institutionalLogo: ev.target?.result as string});
                    reader.readAsDataURL(file);
                  }
                }} />
              </div>
            </div>
          )}
        </div>

      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl p-8 border border-white/20 dark:border-gray-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter">Procesar Importación</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">{importPreview?.message}</p>
            <div className="flex gap-3">
              <button onClick={handleConfirmImport} disabled={!importPreview?.success} className="flex-1 p-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50">Confirmar</button>
              <button onClick={() => setShowImportModal(false)} className="flex-1 p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-xl font-black uppercase text-[10px] transition-colors">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
