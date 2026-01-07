
import React, { useState, useRef } from 'react';
import { CalendarState, ActivityRange, ProgramType, Category } from '../types';
import { format, endOfMonth, addDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Settings, 
  Plus, 
  Image as ImageIcon, 
  Sparkles, 
  Tag, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Music, 
  Clock,
  Edit2,
  X,
  Check,
  Download,
  FileText,
  Share2,
  Wand2,
  Lightbulb,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  FileBox,
  CalendarClock,
  RotateCcw,
  FileUp,
  ClipboardList,
  Type,
  Info,
  Layers,
  Bell
} from 'lucide-react';
import { parseNaturalLanguageActivity, getMusicalSuggestions, generateInstitutionalPlan } from '../services/geminiService';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';

interface SidebarProps {
  state: CalendarState;
  onUpdateConfig: (update: Partial<CalendarState['config']>) => void;
  onAddActivity: (activity: ActivityRange) => void;
  onUpdateActivity: (activity: ActivityRange) => void;
  onRemoveActivity: (id: string) => void;
  onPostponeActivity: (id: string, newStart: string, newEnd: string) => void;
  onSuspendActivity: (id: string) => void;
  onReactivateActivity: (id: string) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (category: Category) => void;
  onRemoveCategory: (id: string) => void;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedActivityId: string | null;
  onSelectActivity: (id: string | null) => void;
}

const parseSafeDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Fixed: Replaced missing date-fns 'parse' with simplified native logic for common formats
const parseFlexibleDate = (input: string, defaultYear: number): Date | null => {
  const cleanInput = input.trim().toLowerCase();
  if (!cleanInput) return null;
  
  // Try native date parsing first
  let d = new Date(cleanInput);
  if (isValid(d) && d.getFullYear() > 1900) return d;

  // Manual fallback for common Spanish/numeric formats since date-fns 'parse' is reported missing
  // Supports DD/MM/YYYY
  const dmy = cleanInput.match(/^(\d{1,2})[\/\- ](\d{1,2})[\/\- ](\d{4})$/);
  if (dmy) {
    const d = new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    if (isValid(d)) return d;
  }

  // Supports DD/MM (assume defaultYear)
  const dm = cleanInput.match(/^(\d{1,2})[\/\- ](\d{1,2})$/);
  if (dm) {
    const d = new Date(defaultYear, parseInt(dm[2]) - 1, parseInt(dm[1]));
    if (isValid(d)) return d;
  }

  return null;
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  state, 
  onUpdateConfig, 
  onAddActivity, 
  onUpdateActivity,
  onRemoveActivity,
  onPostponeActivity,
  onSuspendActivity,
  onReactivateActivity,
  onAddCategory,
  onUpdateCategory,
  onRemoveCategory,
  selectedMonth,
  setSelectedMonth,
  selectedActivityId,
  onSelectActivity
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiInput, setAiInput] = useState('');
  const [csvTextInput, setCsvTextInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'text'>('text');
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    manual: true,
    categories: false,
    activities: true,
    month: false,
    ai: false,
    ai_notifs: false,
    import: false,
    export: false,
    institution: false
  });
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [manualId, setManualId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualProgram, setManualProgram] = useState<ProgramType>('General');
  const [manualCat, setManualCat] = useState('');
  const [postponeDate, setPostponeDate] = useState('');

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCreateOrUpdateCategory = () => {
    if (!newCatName.trim()) return;
    if (editingCatId) {
      onUpdateCategory({ id: editingCatId, name: newCatName, color: newCatColor });
      setEditingCatId(null);
    } else {
      onAddCategory({ id: Math.random().toString(36).substr(2, 9), name: newCatName, color: newCatColor });
    }
    setNewCatName('');
    setNewCatColor('#6366f1');
  };

  const startEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setNewCatName(cat.name);
    setNewCatColor(cat.color);
    if (!openSections.categories) toggleSection('categories');
  };

  const handleMagicFill = async () => {
    if (!manualTitle.trim()) return;
    setIsAiLoading(true);
    const result = await parseNaturalLanguageActivity(manualTitle);
    if (result) {
      setManualTitle(result.title || manualTitle);
      if (result.startDate) setManualStart(result.startDate);
      if (result.endDate) setManualEnd(result.endDate);
      if (result.program) setManualProgram(result.program as ProgramType);
      const matchedCat = state.categories.find(c => c.name.toLowerCase().includes((result.title || '').toLowerCase()));
      if (matchedCat) setManualCat(matchedCat.id);
    }
    setIsAiLoading(false);
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    try {
      const result = await parseNaturalLanguageActivity(aiInput);
      if (result) {
        const cat = state.categories.find(c => c.name.toLowerCase().includes((result.title || '').toLowerCase()));
        onAddActivity({
          id: Math.random().toString(36).substr(2, 9),
          title: result.title || 'Nueva Actividad',
          startDate: result.startDate || format(new Date(), 'yyyy-MM-dd'),
          endDate: result.endDate || result.startDate || format(new Date(), 'yyyy-MM-dd'),
          color: result.color || cat?.color || '#3b82f6',
          program: (result.program as ProgramType) || 'General',
          categoryId: cat?.id || state.categories[0]?.id,
          status: 'active'
        });
        setAiInput('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const processCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return;
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const hasNumbers = /[0-9]/.test(firstLine);
    const hasHeaders = !hasNumbers;
    const dataRows = hasHeaders ? lines.slice(1) : lines;
    const headerCols = hasHeaders ? firstLine.toLowerCase().split(delimiter).map(c => c.trim()) : [];
    let addedCount = 0;
    dataRows.forEach(row => {
      const values = row.split(delimiter).map(v => v.trim());
      const entry: any = {};
      if (hasHeaders) {
        headerCols.forEach((h, index) => {
          const v = values[index];
          if (h.includes('tit') || h.includes('event') || h.includes('activ')) entry.title = v;
          if (h.includes('ini') || h.includes('start') || h.includes('desde') || h.includes('fecha')) if (!entry.startDate) entry.startDate = v;
          if (h.includes('fin') || h.includes('end') || h.includes('hasta')) entry.endDate = v;
          if (h.includes('prog')) entry.program = v;
          if (h.includes('cat')) entry.categoryName = v;
        });
      } else {
        entry.startDate = values[0];
        entry.endDate = values[1];
        entry.title = values[2];
        entry.program = values[3];
        entry.categoryName = values[4];
      }
      const parsedStart = parseFlexibleDate(entry.startDate, state.config.year);
      const parsedEnd = entry.endDate ? parseFlexibleDate(entry.endDate, state.config.year) : parsedStart;
      if (entry.title && parsedStart) {
        let program: ProgramType = 'General';
        const pLower = entry.program?.toLowerCase() || '';
        if (pLower.includes('orq')) program = 'Orquesta';
        else if (pLower.includes('coro inf')) program = 'Coro Infantil';
        else if (pLower.includes('coro juv')) program = 'Coro Juvenil';
        else if (pLower.includes('coro')) program = 'Coro';
        const cat = state.categories.find(c => c.name.toLowerCase() === entry.categoryName?.toLowerCase() || entry.title.toLowerCase().includes(c.name.toLowerCase()));
        onAddActivity({
          id: Math.random().toString(36).substr(2, 9),
          title: entry.title,
          startDate: format(parsedStart, 'yyyy-MM-dd'),
          endDate: format(parsedEnd || parsedStart, 'yyyy-MM-dd'),
          program: program,
          categoryId: cat?.id || state.categories[0]?.id,
          color: cat?.color || '#3b82f6',
          status: 'active'
        });
        addedCount++;
      }
    });
    if (addedCount > 0) {
      alert(`Se han importado ${addedCount} actividades.`);
      setCsvTextInput('');
    } else {
      alert('Formato inválido. Use: Fecha Inicio, Fecha Fin, Actividad, Programa, Categoría');
    }
  };

  const handleExportPNG = async () => {
    const node = document.getElementById('calendar-print-area');
    if (!node) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(node, { quality: 1, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `Calendario_${months[selectedMonth]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {}
    setIsExporting(false);
  };

  const handleExportPDF = async () => {
    const node = document.getElementById('calendar-print-area');
    if (!node) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(node, { quality: 1, pixelRatio: 2 });
      const pdf = new jsPDF('landscape', 'px', [1280, 720]);
      pdf.addImage(dataUrl, 'PNG', 0, 0, 1280, 720);
      pdf.save(`Calendario_${months[selectedMonth]}.pdf`);
    } catch (err) {}
    setIsExporting(false);
  };

  const handleExportDocx = async () => {
    const monthActivities = state.activities.filter(a => parseSafeDate(a.startDate).getMonth() === selectedMonth);
    if (monthActivities.length === 0) return;
    setIsExporting(true);
    const planData = await generateInstitutionalPlan(monthActivities, state.config.institutionName, months[selectedMonth]);
    if (planData) {
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: state.config.institutionName.toUpperCase(), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: planData.introduccion, spacing: { before: 200 } }),
            new Paragraph({ text: "OBJETIVOS", heading: HeadingLevel.HEADING_2 }),
            ...planData.objetivos.map((obj: string) => new Paragraph({ text: `• ${obj}`, bullet: { level: 0 } })),
          ]
        }]
      });
      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Plan_${months[selectedMonth]}.docx`;
      a.click();
    }
    setIsExporting(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => onUpdateConfig({ institutionalLogo: event.target?.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) processCsv(text);
      };
      reader.readAsText(file);
    }
  };

  const handleManualAction = () => {
    if (!manualTitle || !manualStart) return;
    const cat = state.categories.find(c => c.id === manualCat);
    onAddActivity({
      id: manualId || Math.random().toString(36).substr(2, 9),
      title: manualTitle,
      startDate: manualStart,
      endDate: manualEnd || manualStart,
      color: cat?.color || '#3b82f6',
      program: manualProgram,
      categoryId: manualCat,
      status: 'active'
    });
    setManualTitle(''); setManualStart(''); setManualEnd(''); setManualCat('');
  };

  const handlePostponeSubmit = (id: string) => {
    if (!postponeDate) return;
    onPostponeActivity(id, postponeDate, postponeDate);
    setPostponeDate('');
  };

  const SectionHeader = ({ id, icon: Icon, title, count }: { id: string, icon: any, title: string, count?: number }) => (
    <button 
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-3 px-3 hover:bg-indigo-50/50 rounded-xl transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg transition-colors ${openSections[id] ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
          <Icon size={16} />
        </div>
        <span className={`text-[11px] font-black uppercase tracking-widest ${openSections[id] ? 'text-gray-900' : 'text-gray-500'}`}>
          {title} {count !== undefined && <span className="ml-1 opacity-40">[{count}]</span>}
        </span>
      </div>
      {openSections[id] ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
    </button>
  );

  const aiNotifications = state.notifications.filter(n => n.type === 'ai');

  return (
    <div className="h-full bg-white border-r border-gray-100 flex flex-col overflow-y-auto select-none custom-scrollbar">
      <div className="p-6 sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <Music size={20} />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-tighter uppercase text-gray-900 leading-none">Sinfonía</h2>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Calendar Core</span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {/* 1. CREAR EVENTOS */}
        <div className="border-b border-gray-50 pb-2">
          <SectionHeader id="manual" icon={Plus} title="Crear Eventos" />
          {openSections.manual && (
            <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="relative">
                <input 
                  type="text" placeholder="Título de la actividad"
                  className="w-full px-3 py-2.5 pr-10 border border-gray-100 rounded-xl text-[11px] outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium bg-gray-50/30"
                  value={manualTitle} onChange={e => setManualTitle(e.target.value)}
                />
                <button 
                  onClick={handleMagicFill} disabled={isAiLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600 p-1.5"
                >
                  {isAiLoading ? <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent animate-spin rounded-full"></div> : <Wand2 size={16} />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="w-full text-[10px] border border-gray-100 rounded-xl p-2 bg-gray-50/30" value={manualStart} onChange={e => setManualStart(e.target.value)} />
                <input type="date" className="w-full text-[10px] border border-gray-100 rounded-xl p-2 bg-gray-50/30" value={manualEnd} onChange={e => setManualEnd(e.target.value)} />
              </div>
              <select 
                className="w-full text-[10px] border border-gray-100 rounded-xl p-2.5 bg-gray-50/30 font-medium"
                value={manualCat} onChange={e => setManualCat(e.target.value)}
              >
                <option value="">Seleccionar Categoría</option>
                {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleManualAction} className="w-full bg-gray-900 text-white text-[10px] font-black py-3 rounded-xl uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-100">
                Añadir al Calendario
              </button>
            </div>
          )}
        </div>

        {/* 2. CATEGORIAS */}
        <div className="border-b border-gray-50 pb-2">
          <SectionHeader id="categories" icon={Tag} title="Categorías" count={state.categories.length} />
          {openSections.categories && (
            <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                {state.categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50/50 rounded-lg border border-transparent hover:border-indigo-100 transition-all group">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></div>
                      <span className="text-[10px] font-bold text-gray-700 truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => startEditCategory(cat)} className="text-indigo-400 hover:text-indigo-600 p-1"><Edit2 size={12} /></button>
                      <button onClick={() => onRemoveCategory(cat.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" placeholder="Nueva..." value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2 text-[10px] border border-gray-100 rounded-xl bg-gray-50/30"
                />
                <input type="color" className="w-8 h-8 p-0 rounded-lg cursor-pointer border-none bg-transparent" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} />
                <button onClick={handleCreateOrUpdateCategory} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"><Plus size={16} /></button>
              </div>
            </div>
          )}
        </div>

        {/* 3. ACTIVIDADES */}
        <div className="border-b border-gray-50 pb-2">
          <SectionHeader id="activities" icon={Layers} title="Actividades" count={state.activities.filter(a => parseSafeDate(a.startDate).getMonth() === selectedMonth).length} />
          {openSections.activities && (
            <div className="p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200 pb-20">
              {state.activities.filter(a => parseSafeDate(a.startDate).getMonth() === selectedMonth).length > 0 ? (
                state.activities
                  .filter(a => parseSafeDate(a.startDate).getMonth() === selectedMonth)
                  .map(a => {
                    const cat = state.categories.find(c => c.id === a.categoryId);
                    const isSelected = selectedActivityId === a.id;
                    return (
                      <div key={a.id} onClick={() => onSelectActivity(isSelected ? null : a.id)} className={`p-3 bg-white rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-600 shadow-md ring-2 ring-indigo-50/10' : 'border-gray-100 hover:border-indigo-200 shadow-sm'} ${a.status !== 'active' ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || a.color }}></div>
                          <span className={`text-[10px] font-black truncate flex-1 ${isSelected ? 'text-indigo-900' : 'text-gray-800'} ${a.status === 'postponed' ? 'line-through' : ''}`}>{a.title}</span>
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                          {format(parseSafeDate(a.startDate), 'dd MMM')} - {format(parseSafeDate(a.endDate), 'dd MMM')} 
                        </p>

                        {isSelected && (
                          <div className="mt-3 flex flex-col gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                            {a.status === 'active' && (
                              <>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">Nueva Fecha</label>
                                  <div className="flex gap-1">
                                    <input 
                                      type="date" 
                                      className="flex-1 text-[9px] p-2 border border-gray-200 rounded-lg bg-white" 
                                      value={postponeDate}
                                      onChange={(e) => setPostponeDate(e.target.value)}
                                    />
                                    <button 
                                      onClick={() => handlePostponeSubmit(a.id)}
                                      className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-sm flex items-center justify-center"
                                      title="Posponer"
                                    >
                                      <CalendarClock size={14} />
                                    </button>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => onSuspendActivity(a.id)}
                                  className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                                >
                                  <AlertCircle size={12} /> Suspender
                                </button>
                              </>
                            )}
                            {a.status !== 'active' && (
                              <button 
                                onClick={() => onReactivateActivity(a.id)}
                                className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                              >
                                <RotateCcw size={12} /> Reactivar
                              </button>
                            )}
                            <button 
                              onClick={() => onRemoveActivity(a.id)}
                              className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                            >
                              <Trash2 size={12} /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : <p className="text-center text-[10px] text-gray-300 italic py-4">No hay eventos este mes</p>}
            </div>
          )}
        </div>

        {/* 4. MES DE TRABAJO */}
        <div className="border-b border-gray-50 pb-2">
          <SectionHeader id="month" icon={CalendarIcon} title="Mes de trabajo" />
          {openSections.month && (
            <div className="p-3 grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {months.map((m, idx) => (
                <button
                  key={m} onClick={() => setSelectedMonth(idx)}
                  className={`text-[9px] py-2 rounded-lg font-black transition-all ${selectedMonth === idx ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                  {m.substring(0, 3)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. INTELIGENCIA ARTIFICIAL */}
        <div className="border-b border-gray-50 pb-2">
          <SectionHeader id="ai" icon={Sparkles} title="Inteligencia Artificial" />
          {openSections.ai && (
            <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <textarea 
                placeholder="Escribe: Ensayo general del 15 al 18 de Mayo..."
                className="w-full h-24 p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium"
                value={aiInput} onChange={(e) => setAiInput(e.target.value)}
              />
              <button 
                disabled={isAiLoading || !aiInput} onClick={handleAiParse}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isAiLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Sparkles size={14} />}
                Autoprogramar
              </button>
            </div>
          )}
        </div>

        {/* NEW SECTION: AI NOTIFICATIONS */}
        <div className="border-b border-gray-50 pb-2">
          <SectionHeader id="ai_notifs" icon={Bell} title="Notificaciones IA" count={aiNotifications.length} />
          {openSections.ai_notifs && (
            <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 max-h-60 overflow-y-auto custom-scrollbar">
              {aiNotifications.length > 0 ? (
                aiNotifications.map((notif) => (
                  <div key={notif.id} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3 group">
                    <div className="shrink-0 p-2 bg-white rounded-lg text-indigo-600 shadow-sm self-start">
                      <Sparkles size={12} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-indigo-900 leading-relaxed">{notif.message.replace('IA: ', '')}</p>
                      <p className="text-[8px] font-black uppercase text-indigo-400 tracking-widest">
                        {format(new Date(notif.timestamp), 'p', { locale: es })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-[10px] text-gray-300 italic py-4">Sin nuevas advertencias de la IA</p>
              )}
            </div>
          )}
        </div>

        {/* 6. IMPORTAR EVENTOS */}
        <div className="border-b border-gray-50 pb-2">
          <SectionHeader id="import" icon={FileUp} title="Importar Eventos" />
          {openSections.import && (
            <div className="p-3 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setImportMode('text')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${importMode === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>Texto</button>
                <button onClick={() => setImportMode('file')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${importMode === 'file' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>Archivo</button>
              </div>
              {importMode === 'text' ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Formato CSV</span>
                    <button onClick={() => setCsvTextInput("12 Feb 2026, 14 Feb 2026, Concierto Gala, Orquesta, Temporada")} className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:underline"><Lightbulb size={10} /> Ver Ejemplo</button>
                  </div>
                  <textarea 
                    value={csvTextInput} onChange={e => setCsvTextInput(e.target.value)}
                    placeholder="Fecha Ini, Fecha Fin, Actividad, Programa, Categoría..."
                    className="w-full h-32 p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-mono outline-none"
                  />
                  <button onClick={() => processCsv(csvTextInput)} className="w-full py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Importar Registros</button>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="p-6 border-2 border-dashed border-indigo-100 bg-indigo-50/20 rounded-2xl flex flex-col items-center gap-2 cursor-pointer group hover:bg-indigo-50 transition-all">
                  <FileSpreadsheet className="text-indigo-400 group-hover:scale-110 transition-all" size={32} />
                  <span className="text-[10px] font-black text-indigo-600 uppercase">Subir archivo .CSV</span>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt" onChange={handleCsvUpload} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 7. EXPORTAR */}
        <div className="pb-2">
          <SectionHeader id="export" icon={Share2} title="Exportar" />
          {openSections.export && (
            <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <button disabled={isExporting} onClick={handleExportDocx} className="w-full flex items-center justify-between px-4 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50">
                <span className="text-[10px] font-black uppercase tracking-widest">Generar Plan Operativo</span>
                <Sparkles size={14} />
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={isExporting} onClick={handleExportPNG} className="flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-100 transition-all">
                  <Download size={14} /> PNG
                </button>
                <button disabled={isExporting} onClick={handleExportPDF} className="flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase hover:bg-black transition-all">
                  <FileText size={14} /> PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* INSTITUTIONAL SETTINGS (Extra at bottom) */}
        <div className="mt-8 pt-4 border-t border-gray-50 opacity-40 hover:opacity-100 transition-opacity">
           <SectionHeader id="institution" icon={Settings} title="Ajustes Institucionales" />
           {openSections.institution && (
             <div className="p-3 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
               <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase">Nombre de la Institución</label>
                 <input 
                  type="text" value={state.config.institutionName}
                  onChange={e => onUpdateConfig({ institutionName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-100 rounded-lg text-[10px] font-bold"
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase">Logo Principal</label>
                 <label className="flex items-center justify-center w-full py-3 border border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-indigo-400">
                   <span className="text-[10px] font-black uppercase text-indigo-600">Cambiar Imagen</span>
                   <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                 </label>
               </div>
             </div>
           )}
        </div>
      </div>
      
      <div className="mt-auto p-6 bg-gray-50/50">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px]">SC</div>
            <div>
              <p className="text-[9px] font-black text-gray-900 uppercase leading-none">Sinfonía Cloud</p>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">V 2.5 Active</p>
            </div>
         </div>
      </div>
    </div>
  );
};
