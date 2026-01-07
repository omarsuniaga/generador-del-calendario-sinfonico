
import React, { useState, useRef } from 'react';
import { CalendarState, ActivityRange, ProgramType, Category } from '../types.ts';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Plus, 
  Sparkles, 
  Tag, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Music, 
  Edit2,
  X,
  Check,
  Share2,
  Upload,
  FileSpreadsheet,
  FileBox,
  FileUp,
  ClipboardList,
  Building,
  MessageSquare,
  RotateCcw
} from 'lucide-react';
import { parseNaturalLanguageActivity } from '../services/geminiService.ts';
import { 
  exportToJSON, 
  exportToCSV, 
  downloadFile, 
  generateFilename, 
  detectFileFormat, 
  importFromJSON, 
  importFromCSV, 
  ImportResult 
} from '../services/dataService.ts';
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

export const Sidebar: React.FC<SidebarProps> = ({ 
  state, 
  onUpdateConfig, 
  onAddActivity, 
  onRemoveActivity,
  onAddCategory,
  onRemoveCategory,
  selectedMonth, 
  setSelectedMonth,
  selectedActivityId, 
  onSelectActivity,
  setState,
  onEditDay
}) => {
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiProposedActivity, setAiProposedActivity] = useState<Partial<ActivityRange> | null>(null);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);

  // Todos los elementos contraídos por defecto según solicitud del usuario
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    manual: false,
    categories: false,
    activities: false,
    month: false,
    ai: false,
    import: false,
    export: false,
    institution: false
  });
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  const [manualTitle, setManualTitle] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualCat, setManualCat] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
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
      if (!content) return;
      const formatType = detectFileFormat(content);
      let result: ImportResult;
      if (formatType === 'json') result = importFromJSON(content, state.categories);
      else if (formatType === 'csv') result = importFromCSV(content, state.categories);
      else result = { success: false, message: 'Formato no soportado', errors: ['Use JSON o CSV'] };
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
      categories: [...prev.categories, ...(data.categories || [])]
    }));
    setShowImportModal(false);
  };

  const monthActivities = state.activities.filter(a => {
    const d = new Date(a.startDate + 'T00:00:00');
    return isValid(d) && d.getMonth() === selectedMonth;
  });

  const SectionHeader = ({ id, icon: Icon, title, count }: { id: string, icon: any, title: string, count?: number }) => (
    <button 
      onClick={() => toggleSection(id)}
      className={`w-full flex items-center justify-between py-3 px-3 rounded-xl transition-all group ${
        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-indigo-50/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg transition-colors ${openSections[id] ? (theme === 'dark' ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-100 text-indigo-600') : (theme === 'dark' ? 'bg-gray-700 text-gray-400 group-hover:bg-gray-600' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100')}`}>
          <Icon size={16} />
        </div>
        <span className={`text-[11px] font-black uppercase tracking-widest ${openSections[id] ? (theme === 'dark' ? 'text-gray-100' : 'text-gray-900') : (theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}`}>
          {title} {count !== undefined && <span className="ml-1 opacity-40">[{count}]</span>}
        </span>
      </div>
      {openSections[id] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
    </button>
  );

  const handleExportCSV = () => {
    const csvContent = exportToCSV(state);
    const filename = generateFilename('Sinfonia_Actividades', 'csv');
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  };

  const handleExportJSON = () => {
    const jsonContent = exportToJSON(state);
    const filename = generateFilename('Sinfonia_Respaldo', 'json');
    downloadFile(jsonContent, filename, 'application/json');
  };

  return (
    <div className={`h-full border-r flex flex-col overflow-y-auto select-none custom-scrollbar transition-colors duration-300 ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
    }`}>
      <div className="p-6 sticky top-0 backdrop-blur-sm z-20 border-b flex items-center gap-3 bg-white/95 dark:bg-gray-800/95 border-gray-100 dark:border-gray-700">
        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
          <Music size={20} />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter leading-none dark:text-white">Sinfonía</h2>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Calendar Core</span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        
        {/* 1. CREAR EVENTOS */}
        <div className="border-b border-gray-50 dark:border-gray-700 pb-2">
          <SectionHeader id="manual" icon={Plus} title="Crear Eventos" />
          {openSections.manual && (
            <div className="p-3 space-y-3">
              <input type="text" placeholder="Título de la actividad" className="w-full p-2.5 text-[11px] border rounded-xl dark:bg-gray-700 dark:border-gray-600" value={manualTitle} onChange={e => setManualTitle(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="p-2 text-[10px] border rounded-xl dark:bg-gray-700 dark:border-gray-600" value={manualStart} onChange={e => setManualStart(e.target.value)} />
                <input type="date" className="p-2 text-[10px] border rounded-xl dark:bg-gray-700 dark:border-gray-600" value={manualEnd} onChange={e => setManualEnd(e.target.value)} />
              </div>
              <select value={manualCat} onChange={e => setManualCat(e.target.value)} className="w-full p-2 text-[11px] border rounded-xl dark:bg-gray-700 dark:border-gray-600">
                <option value="">Seleccionar Categoría...</option>
                {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea placeholder="Descripción detallada..." className="w-full p-2 text-[11px] border rounded-xl dark:bg-gray-700 dark:border-gray-600 h-16 resize-none" value={manualDesc} onChange={e => setManualDesc(e.target.value)} />
              <button onClick={() => {
                if(!manualTitle || !manualStart) return;
                onAddActivity({
                  id: Math.random().toString(36).substr(2, 9), title: manualTitle, startDate: manualStart, endDate: manualEnd || manualStart,
                  color: state.categories.find(c => c.id === manualCat)?.color || '#3b82f6', program: 'General', categoryId: manualCat, description: manualDesc, status: 'active'
                });
                setManualTitle(''); setManualStart(''); setManualEnd(''); setManualDesc('');
              }} className="w-full p-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                Guardar Actividad
              </button>
            </div>
          )}
        </div>

        {/* 2. CATEGORIAS */}
        <div className="border-b border-gray-50 dark:border-gray-700 pb-2">
          <SectionHeader id="categories" icon={Tag} title="Categorías" count={state.categories.length} />
          {openSections.categories && (
            <div className="p-3 space-y-3">
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {state.categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}} />
                      <span className="text-[10px] font-bold dark:text-gray-200">{cat.name}</span>
                    </div>
                    <button onClick={() => onRemoveCategory(cat.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Nombre..." className="flex-1 p-2 text-[10px] border rounded-xl dark:bg-gray-700" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
                <input type="color" className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} />
                <button onClick={() => {
                  if(!newCatName) return;
                  onAddCategory({id: Math.random().toString(36).substr(2,9), name: newCatName, color: newCatColor});
                  setNewCatName('');
                }} className="p-2 bg-indigo-600 text-white rounded-xl"><Plus size={14}/></button>
              </div>
            </div>
          )}
        </div>

        {/* 3. ACTIVIDADES */}
        <div className="border-b border-gray-50 dark:border-gray-700 pb-2">
          <SectionHeader id="activities" icon={ClipboardList} title="Actividades" count={monthActivities.length} />
          {openSections.activities && (
            <div className="p-2 space-y-2">
               {monthActivities.length > 0 ? monthActivities.map(a => (
                 <div key={a.id} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${selectedActivityId === a.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-700 border-gray-100 dark:border-gray-600'}`}>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectActivity(a.id)}>
                      <h4 className="text-[10px] font-black uppercase truncate">{a.title}</h4>
                      <p className={`text-[8px] font-bold uppercase ${selectedActivityId === a.id ? 'text-indigo-100' : 'text-gray-400'}`}>
                        {format(new Date(a.startDate + 'T00:00:00'), "d MMM", {locale: es})}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => onEditDay(a.startDate)} className={`p-1.5 rounded-lg ${selectedActivityId === a.id ? 'hover:bg-white/20' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}><Edit2 size={12}/></button>
                      <button onClick={() => onRemoveActivity(a.id)} className={`p-1.5 rounded-lg ${selectedActivityId === a.id ? 'hover:bg-red-400' : 'hover:bg-red-50 text-red-400'}`}><Trash2 size={12}/></button>
                    </div>
                 </div>
               )) : (
                 <div className="p-8 text-center opacity-30 text-[9px] font-black uppercase italic">No hay actividades para mostrar</div>
               )}
            </div>
          )}
        </div>

        {/* 4. MES DE TRABAJO */}
        <div className="border-b border-gray-50 dark:border-gray-700 pb-2">
          <SectionHeader id="month" icon={CalendarIcon} title="Mes de Trabajo" />
          {openSections.month && (
            <div className="grid grid-cols-3 gap-2 p-2">
              {months.map((m, i) => (
                <button 
                  key={m} 
                  onClick={() => setSelectedMonth(i)}
                  className={`p-2 rounded-xl text-[9px] font-black uppercase border transition-all ${selectedMonth === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-400 border-transparent hover:border-gray-200'}`}
                >
                  {m.substring(0,3)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. INTELIGENCIA ARTIFICIAL */}
        <div className="border-b border-gray-50 dark:border-gray-700 pb-2">
          <SectionHeader id="ai" icon={Sparkles} title="Inteligencia Artificial" />
          {openSections.ai && (
            <div className="p-3 space-y-3">
              <div className="relative">
                <textarea 
                  placeholder="Describe tus planes: 'Tengo un ensayo de coro el 12 de junio y concierto el 14...'" 
                  className="w-full p-3 text-[11px] border rounded-2xl dark:bg-gray-700 dark:border-gray-600 h-24 resize-none focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={aiPrompt} 
                  onChange={e => setAiPrompt(e.target.value)} 
                />
                {isAiLoading && <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center rounded-2xl"><RotateCcw size={20} className="animate-spin text-indigo-600" /></div>}
              </div>
              <button 
                onClick={handleProcessAiPrompt}
                disabled={isAiLoading || !aiPrompt.trim()}
                className="w-full p-2.5 bg-gray-900 text-white dark:bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                Generar con IA
              </button>

              {aiProposedActivity && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-2xl space-y-3 animate-in zoom-in-95 duration-300">
                   <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                     <MessageSquare size={14} />
                     <span className="text-[9px] font-black uppercase">Confirmar interpretación</span>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[11px] font-black dark:text-white leading-tight">{aiProposedActivity.title}</p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase">
                        {format(new Date((aiProposedActivity.startDate || '') + 'T00:00:00'), "d 'de' MMMM", {locale:es})}
                      </p>
                   </div>
                   <div className="flex gap-2 pt-1">
                      <button onClick={handleConfirmAiActivity} className="flex-1 p-2 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-indigo-700">Crear</button>
                      <button onClick={() => setAiProposedActivity(null)} className="flex-1 p-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-[9px] font-black uppercase">Descartar</button>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 6. IMPORTAR */}
        <div className="border-b border-gray-50 dark:border-gray-700 pb-2">
          <SectionHeader id="import" icon={FileUp} title="Importar" />
          {openSections.import && (
            <div className="p-3 space-y-3">
              <div onClick={() => backupInputRef.current?.click()} className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                <FileBox size={24} className="text-gray-400" />
                <span className="text-[10px] font-black uppercase text-gray-500 text-center">Seleccionar Backup JSON o CSV</span>
                <input type="file" ref={backupInputRef} className="hidden" accept=".json,.csv" onChange={handleFileSelect} />
              </div>
            </div>
          )}
        </div>

        {/* 7. EXPORTAR */}
        <div className="border-b border-gray-50 dark:border-gray-700 pb-2">
          <SectionHeader id="export" icon={Share2} title="Exportar" />
          {openSections.export && (
            <div className="p-3 space-y-2">
              <button onClick={handleExportJSON} className="w-full p-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                <FileBox size={14}/> Backup JSON
              </button>
              <button onClick={handleExportCSV} className="w-full p-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                <FileSpreadsheet size={14}/> CSV Actividades
              </button>
            </div>
          )}
        </div>

        {/* 8. AJUSTE INSTITUCIONAL */}
        <div className="pb-2">
          <SectionHeader id="institution" icon={Building} title="Ajuste Institucional" />
          {openSections.institution && (
            <div className="p-3 space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-gray-400">Nombre Oficial</label>
                <input type="text" value={state.config.institutionName} onChange={e => onUpdateConfig({institutionName: e.target.value})} className="w-full p-2 text-[11px] border rounded-xl dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-gray-400">Logotipo Institucional</label>
                <div onClick={() => fileInputRef.current?.click()} className="p-4 border border-dashed rounded-xl flex flex-col items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-700">
                   {state.config.institutionalLogo ? <img src={state.config.institutionalLogo} className="h-10 w-auto" /> : <Upload size={20} className="text-gray-400" />}
                   <span className="text-[8px] font-black uppercase">Cambiar Logo</span>
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

      {/* IMPORT MODAL PREVIEW */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl p-8 border border-white/20">
            <h3 className="text-lg font-black dark:text-white mb-2 uppercase tracking-tighter">Importar Datos</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{importPreview?.message}</p>
            <div className="flex gap-3">
              <button onClick={handleConfirmImport} className="flex-1 p-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-indigo-200">Procesar Importación</button>
              <button onClick={() => setShowImportModal(false)} className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-xl font-black uppercase text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
