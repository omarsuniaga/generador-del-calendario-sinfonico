
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { CalendarState, ActivityRange, DayStyle, Category } from '../types.ts';
import { format, endOfMonth, eachDayOfInterval, isSameDay, endOfWeek, eachWeekOfInterval, isWithinInterval, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Music, ZoomIn, ZoomOut, Maximize, 
  Clock, Music2, Calendar as CalendarIcon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.tsx';

interface CalendarCanvasProps {
  state: CalendarState;
  selectedMonth: number;
  onSelectDay: (date: string) => void;
  selectedActivityId: string | null;
  highlightedActivityIds?: string[];
  isSidebarCollapsed: boolean;
  onSelectActivity?: (id: string | null) => void;
  onToggleComplete: (id: string) => void;
}

// DIMENSIONES CARTA HORIZONTAL (11" x 8.5" @ 300DPI)
const CANVAS_WIDTH = 3300;
const CANVAS_HEIGHT = 2550;
const PADDING_FACTOR = 0.95;
const MIN_SCALE = 0.05; // Aumentado para evitar desaparición
const MAX_SCALE = 3;
const DRAG_THRESHOLD = 5;

const parseSafeDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const DayCellDecoration: React.FC<{ 
  dayStyle?: DayStyle; 
  category?: Category; 
  isHoliday?: boolean; 
  isHighlighted?: boolean;
}> = ({ dayStyle, category, isHoliday, isHighlighted }) => {
  const shape = dayStyle?.shape || 'square';
  const color = category?.color || '#cbd5e1';
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none p-2" viewBox="0 0 100 100">
      {isHighlighted && (
        <rect x="0" y="0" width="100" height="100" fill="#facc15" fillOpacity="0.2" className="animate-pulse" />
      )}
      {isHoliday ? (
        <path d="M 50,5 L 95,50 L 50,95 L 5,50 Z" fill="rgba(239, 68, 68, 0.08)" stroke="#ef4444" strokeWidth="3" strokeDasharray="5 3" />
      ) : category ? (
        shape === 'circle' ? (
          <circle cx="50" cy="50" r="42" fill={`${color}12`} stroke={color} strokeWidth="2" />
        ) : (
          <rect x="8" y="8" width="84" height="84" rx="15" fill={`${color}08`} stroke={color} strokeWidth="2.5" />
        )
      ) : null}
      {dayStyle?.icon && (
        <g transform="translate(62, 62)">
          <circle cx="15" cy="15" r="22" fill="white" stroke="#e2e8f0" strokeWidth="0.8" />
          <text x="15" y="24" fontSize="24" textAnchor="middle" className="select-none">{dayStyle.icon}</text>
        </g>
      )}
    </svg>
  );
};

export const CalendarCanvas: React.FC<CalendarCanvasProps> = ({ 
  state, selectedMonth, onSelectDay, selectedActivityId,
  highlightedActivityIds = [], isSidebarCollapsed, onSelectActivity
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Estado inicial del viewport con valores seguros
  const [viewport, setViewport] = useState({ scale: 0.1, offsetX: 50, offsetY: 50 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragMoved = useRef(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });

  const currentMonthDate = new Date(state.config.year, selectedMonth, 1);
  const monthStart = currentMonthDate;
  const monthEnd = endOfMonth(currentMonthDate);
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { locale: es });

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const fitCanvasToViewport = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const scaleX = clientWidth / CANVAS_WIDTH;
    const scaleY = clientHeight / CANVAS_HEIGHT;
    const optimalScale = Math.min(scaleX, scaleY) * PADDING_FACTOR;
    const clampedScale = clamp(optimalScale, MIN_SCALE, MAX_SCALE);
    
    // Centrado absoluto
    const offsetX = (clientWidth - CANVAS_WIDTH * clampedScale) / 2;
    const offsetY = (clientHeight - CANVAS_HEIGHT * clampedScale) / 2;
    
    setViewport({ scale: clampedScale, offsetX, offsetY });
  }, []);

  // Monitor de tamaño para recalcular posición
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => fitCanvasToViewport());
    observer.observe(containerRef.current);
    
    // Ejecutar inicial
    fitCanvasToViewport();
    
    return () => observer.disconnect();
  }, [fitCanvasToViewport, isSidebarCollapsed]);

  // Recalcular cuando cambia el mes o el año
  useEffect(() => {
    fitCanvasToViewport();
  }, [selectedMonth, state.config.year, fitCanvasToViewport]);

  const monthActivities = useMemo(() => {
    return state.activities
      .filter(a => {
        const start = parseSafeDate(a.startDate);
        const end = parseSafeDate(a.endDate);
        return (start <= monthEnd && end >= monthStart);
      })
      .sort((a, b) => parseSafeDate(a.startDate).getTime() - parseSafeDate(b.startDate).getTime());
  }, [state.activities, monthStart, monthEnd]);

  const getDayStyle = (date: Date): DayStyle | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return state.dayStyles.find(s => {
        if (!s.endDate) return s.startDate === dateStr;
        const start = parseSafeDate(s.startDate);
        const end = parseSafeDate(s.endDate);
        return isValid(start) && isValid(end) && isWithinInterval(date, { start, end });
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragMoved.current = false;
    if (pointers.current.size === 1) lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const currPos = { x: e.clientX, y: e.clientY };
    const prevPos = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, currPos);

    if (Math.hypot(currPos.x - prevPos.x, currPos.y - prevPos.y) > DRAG_THRESHOLD) dragMoved.current = true;

    if (pointers.current.size === 1) {
      const dx = currPos.x - lastPointerPos.current.x;
      const dy = currPos.y - lastPointerPos.current.y;
      setViewport(v => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
      lastPointerPos.current = currPos;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = 1 + (-e.deltaY * 0.001);
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    setViewport(v => {
      const newScale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const canvasX = (mouseX - v.offsetX) / v.scale;
      const canvasY = (mouseY - v.offsetY) / v.scale;
      return { scale: newScale, offsetX: mouseX - canvasX * newScale, offsetY: mouseY - canvasY * newScale };
    });
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
      onWheel={handleWheel} onDoubleClick={fitCanvasToViewport}
      style={{ touchAction: 'none' }}
      className="h-full w-full overflow-hidden flex items-center justify-center relative select-none bg-[#e2e8f0] dark:bg-black/90 shadow-inner cursor-grab active:cursor-grabbing"
    >
      {/* Controles de Navegación del Canvas */}
      <div className="absolute bottom-8 right-8 z-[100] flex p-2 rounded-[2rem] border border-gray-200 dark:border-gray-700 gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-2xl">
        <button onPointerDown={e => e.stopPropagation()} onClick={() => setViewport(v => ({...v, scale: clamp(v.scale - 0.1, MIN_SCALE, MAX_SCALE)}))} className="p-4 rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"><ZoomOut size={24} /></button>
        <button onPointerDown={e => e.stopPropagation()} onClick={fitCanvasToViewport} className="p-4 rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"><Maximize size={24} /></button>
        <button onPointerDown={e => e.stopPropagation()} onClick={() => setViewport(v => ({...v, scale: clamp(v.scale + 0.1, MIN_SCALE, MAX_SCALE)}))} className="p-4 rounded-full hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"><ZoomIn size={24} /></button>
      </div>

      {/* EL LIENZO (CANVAS) */}
      <div 
        id="calendar-print-area" 
        ref={canvasRef}
        className="bg-white flex flex-col relative overflow-hidden shadow-[0_80px_160px_rgba(0,0,0,0.3)] border border-white"
        style={{ 
          width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`,
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
          transformOrigin: '0 0'
        }}
      >
        {/* CABECERA INSTITUCIONAL */}
        <header className="h-[380px] w-full bg-[#f8fafc] border-b-[12px] border-indigo-600 flex items-center justify-between px-28">
          <div className="flex items-center gap-20">
            <div className="w-[260px] h-[260px] bg-white rounded-[3.5rem] shadow-2xl flex items-center justify-center p-10 border border-gray-100">
              {state.config.institutionalLogo ? <img src={state.config.institutionalLogo} className="w-full h-full object-contain" /> : <Music className="text-indigo-600 w-32 h-32" />}
            </div>
            <div className="space-y-4">
               <h1 className="text-[100px] leading-none text-gray-900 font-black tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>{state.config.institutionName}</h1>
               <div className="flex gap-5 items-center">
                 <span className="bg-indigo-600 text-white px-10 py-3 rounded-full text-[26px] font-black uppercase tracking-[0.2em]">Planeación Operativa</span>
                 <span className="text-[30px] font-bold text-gray-400 uppercase tracking-widest">{state.config.subtitle}</span>
               </div>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[200px] font-black text-gray-900 leading-none tracking-tighter">{state.config.year}</div>
             <div className="text-[30px] uppercase tracking-[0.6em] font-black text-indigo-500 mt-2">ALTA PRECISIÓN ACADÉMICA</div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL: DIVISIÓN CARTA HORIZONTAL */}
        <main className="flex-1 flex flex-row border-b-[6px] border-gray-100">
          
          {/* LADO IZQUIERDO: EL CALENDARIO (50% ANCHO) */}
          <section className="w-1/2 p-24 flex flex-col bg-white border-r-[6px] border-gray-100">
            <div className="flex items-center justify-between mb-16">
               <h2 className="text-[120px] font-black text-gray-900 uppercase border-l-[25px] border-indigo-600 pl-12 leading-none">{format(currentMonthDate, 'MMMM', { locale: es }).toUpperCase()}</h2>
            </div>
            
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-7 mb-12 text-center text-[34px] font-black text-gray-300 tracking-[0.4em]">
                {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => <div key={d}>{d}</div>)}
              </div>
              
              <div className="flex-1 grid grid-rows-6 gap-6">
                {weeks.map((weekStart, wIdx) => {
                  const weekEnd = endOfWeek(weekStart, { locale: es });
                  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
                  return (
                    <div key={wIdx} className="relative flex border-b border-gray-100 last:border-0">
                      <div className="grid grid-cols-7 w-full h-full z-20">
                        {weekDays.map((day, dIdx) => {
                          const isCurrentMonth = day >= monthStart && day <= monthEnd;
                          const customStyle = getDayStyle(day);
                          return (
                            <div 
                              key={dIdx} 
                              onPointerDown={e => e.stopPropagation()}
                              onClick={() => { if (!isCurrentMonth || dragMoved.current) return; onSelectDay(format(day, 'yyyy-MM-dd')); }} 
                              className={`relative flex flex-col items-end p-8 h-full transition-all ${!isCurrentMonth ? 'opacity-0' : 'hover:bg-indigo-50/50 cursor-pointer'}`}
                            >
                               {isCurrentMonth && <DayCellDecoration dayStyle={customStyle} category={state.categories.find(c => c.id === customStyle?.categoryId)} isHoliday={customStyle?.isHoliday} />}
                               <span className={`relative z-10 text-[64px] font-black ${customStyle?.isHoliday ? 'text-red-500' : 'text-gray-900'}`}>{format(day, 'd')}</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* LÍNEAS DE TIEMPO DEL CALENDARIO */}
                      <div className="absolute inset-x-0 bottom-6 h-[55%] pointer-events-none flex flex-col justify-end gap-3 pb-4 z-10 px-3">
                        {monthActivities.map(a => {
                          const aStart = parseSafeDate(a.startDate), aEnd = parseSafeDate(a.endDate);
                          if (aEnd < weekStart || aStart > weekEnd) return null;
                          const sIdx = aStart < weekStart ? 0 : weekDays.findIndex(d => isSameDay(d, aStart));
                          const eIdx = aEnd > weekEnd ? 6 : weekDays.findIndex(d => isSameDay(d, aEnd));
                          const cW = 100/7, lP = sIdx*cW + cW/8, rP = 100-(eIdx*cW + 7*cW/8);
                          const color = state.categories.find(c => c.id === a.categoryId)?.color || a.color;
                          return (
                            <div key={a.id} className="relative h-14 flex items-center" style={{ marginLeft: `${lP}%`, marginRight: `${rP}%` }}>
                              <div className="w-full h-full rounded-full opacity-95 shadow-xl border-[5px] border-white" style={{ backgroundColor: color }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* LADO DERECHO: EL CRONOGRAMA (50% ANCHO) */}
          <section className="w-1/2 bg-[#fcfdfe] p-24 flex flex-col">
             <div className="flex items-center gap-12 mb-20">
                <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><Clock size={80} /></div>
                <div>
                   <h3 className="text-[84px] font-black text-gray-900 uppercase tracking-tighter leading-none">Cronograma Detallado</h3>
                   <p className="text-[36px] font-bold text-gray-400 mt-4 uppercase tracking-[0.2em]">{format(currentMonthDate, 'MMMM yyyy', { locale: es })}</p>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto pr-8 custom-scrollbar space-y-12">
                {monthActivities.length > 0 ? monthActivities.map((a, idx) => {
                  const cat = state.categories.find(c => c.id === a.categoryId);
                  const isSuspended = a.status === 'suspended';
                  return (
                    <div key={a.id} className={`flex items-stretch gap-12 p-14 rounded-[4rem] border-2 transition-all ${isSuspended ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-100 shadow-[0_30px_60px_rgba(0,0,0,0.05)]'}`}>
                       <div className="flex flex-col items-center justify-center w-[220px] rounded-[3rem] bg-indigo-50 border border-indigo-100 shrink-0">
                          <span className="text-[34px] font-black text-indigo-400 uppercase">{format(parseSafeDate(a.startDate), 'MMM', { locale: es })}</span>
                          <span className="text-[110px] font-black text-indigo-600 leading-none">{format(parseSafeDate(a.startDate), 'dd')}</span>
                       </div>
                       <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-5 mb-5">
                             <div className="w-10 h-10 rounded-full shadow-md" style={{ backgroundColor: cat?.color || a.color }} />
                             <span className="text-[30px] font-black uppercase text-indigo-500 tracking-widest">{a.program}</span>
                          </div>
                          <h4 className={`text-[64px] font-black truncate leading-tight ${isSuspended ? 'line-through text-gray-400' : 'text-gray-900'}`}>{a.title}</h4>
                          <div className="flex items-center gap-8 mt-5">
                            <span className="text-[34px] font-bold text-gray-500 flex items-center gap-4 uppercase">
                               <CalendarIcon size={36} className="text-indigo-400" /> 
                               {format(parseSafeDate(a.startDate), "eeee d", {locale: es})}
                               {a.endDate !== a.startDate && ` al ${format(parseSafeDate(a.endDate), "d", {locale: es})}`}
                            </span>
                          </div>
                       </div>
                    </div>
                  );
                }) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-40 opacity-20">
                    <Music2 size={240} className="text-gray-300" />
                    <p className="text-[72px] font-black text-gray-400 uppercase mt-12 italic">No hay registros</p>
                  </div>
                )}
             </div>
          </section>
        </main>

        {/* PIE DE PÁGINA INSTITUCIONAL */}
        <footer className="h-[220px] w-full bg-[#f8fafc] px-28 py-14 flex items-center justify-between">
          <div className="space-y-4">
             <div className="flex items-center gap-12">
                <div className="w-40 h-[10px] bg-indigo-600 rounded-full" /> 
                <p className="text-[32px] font-black text-gray-400 uppercase tracking-[0.3em]">Plan Maestro de Gestión • {state.config.institutionName}</p>
             </div>
             <p className="text-[36px] text-gray-400 font-bold italic font-serif opacity-60">"La música es el lenguaje universal de la humanidad."</p>
          </div>
          <div className="flex items-center gap-12">
            <div className="text-right">
               <p className="text-[30px] font-black text-gray-300 uppercase tracking-widest">Sinfonía Calendar v2.5</p>
               <p className="text-[24px] font-bold text-gray-200">Hoja Carta Horizontal - 300 DPI</p>
            </div>
            <div className="h-32 w-32 bg-white rounded-[2.5rem] shadow-2xl border border-gray-50 flex items-center justify-center text-indigo-500">
               <Music2 size={70} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
