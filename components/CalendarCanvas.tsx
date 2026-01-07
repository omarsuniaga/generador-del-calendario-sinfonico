
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { CalendarState, ActivityRange, DayStyle, Category } from '../types.ts';
import { format, endOfMonth, eachDayOfInterval, isSameDay, endOfWeek, eachWeekOfInterval, isWithinInterval, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Music, ZoomIn, ZoomOut, Maximize, Landmark, Sparkles, AlertCircle, 
  CalendarClock, CheckCircle2, Hand, Grab, Zap, Star, LayoutGrid, 
  Calendar as CalendarIcon, Clock, ChevronRight, Circle 
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

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const PADDING_FACTOR = 0.98;

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
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible p-1" 
      viewBox="0 0 100 100" 
      preserveAspectRatio="xMidYMid meet"
    >
      {isHighlighted && (
        <rect 
          x="0" y="0" width="100" height="100" 
          fill="#facc15" 
          fillOpacity="0.4"
          className="animate-pulse"
        />
      )}

      {isHoliday ? (
        <path
          d="M 50,5 L 95,50 L 50,95 L 5,50 Z"
          fill="rgba(239, 68, 68, 0.1)"
          stroke="#ef4444"
          strokeWidth="2"
          strokeDasharray="4 2"
          opacity="0.3"
        />
      ) : category ? (
        shape === 'circle' ? (
          <circle cx="50" cy="50" r="38" fill={`${color}15`} stroke={color} strokeWidth="1.5" />
        ) : (
          <rect x="12" y="12" width="76" height="76" rx="12" fill={`${color}10`} stroke={color} strokeWidth="2" />
        )
      ) : null}

      {dayStyle?.icon && (
        <g transform="translate(70, 70)">
          <circle cx="10" cy="10" r="12" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
          <text x="10" y="14" fontSize="14" textAnchor="middle">{dayStyle.icon}</text>
        </g>
      )}
    </svg>
  );
};

export const CalendarCanvas: React.FC<CalendarCanvasProps> = ({ 
  state, 
  selectedMonth, 
  onSelectDay, 
  selectedActivityId,
  highlightedActivityIds = [],
  isSidebarCollapsed, 
  onSelectActivity,
  onToggleComplete
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isDraggingMode, setIsDraggingMode] = useState(false);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });

  const currentMonthDate = new Date(state.config.year, selectedMonth, 1);
  const monthStart = currentMonthDate;
  const monthEnd = endOfMonth(currentMonthDate);
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { locale: es });

  const fitCanvasToViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth === 0 || containerHeight === 0) return;

    const scaleX = containerWidth / CANVAS_WIDTH;
    const scaleY = containerHeight / CANVAS_HEIGHT;
    const optimalScale = Math.min(scaleX, scaleY) * PADDING_FACTOR;
    const clampedScale = Math.max(0.15, Math.min(3, optimalScale));
    
    setViewport({ 
      scale: clampedScale, 
      offsetX: (containerWidth - CANVAS_WIDTH * clampedScale) / 2, 
      offsetY: (containerHeight - CANVAS_HEIGHT * clampedScale) / 2 
    });
  }, []);

  useEffect(() => {
    fitCanvasToViewport();
    const handleResize = () => fitCanvasToViewport();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitCanvasToViewport, isSidebarCollapsed, selectedMonth]);

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

  const isDayHighlighted = (day: Date) => {
    if (highlightedActivityIds.length === 0) return false;
    return monthActivities.some(a => 
      highlightedActivityIds.includes(a.id) && 
      isWithinInterval(day, { start: parseSafeDate(a.startDate), end: parseSafeDate(a.endDate) })
    );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDraggingMode) {
      setIsPointerDown(true);
      lastPointerPos.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown) return;
    const deltaX = e.clientX - lastPointerPos.current.x;
    const deltaY = e.clientY - lastPointerPos.current.y;
    setViewport(v => ({ ...v, offsetX: v.offsetX + deltaX, offsetY: v.offsetY + deltaY }));
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPointerDown(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`h-full w-full overflow-hidden flex items-center justify-center relative touch-none select-none ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#e2e8f0]'} ${isDraggingMode ? 'cursor-grab' : ''}`}
    >
      <div className="absolute bottom-6 right-6 z-[100] flex p-1.5 rounded-[1.5rem] border gap-1 bg-white/95 dark:bg-gray-800/95 shadow-xl">
        <button onClick={() => setViewport(v => ({...v, scale: Math.max(0.1, v.scale - 0.1)}))} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"><ZoomOut size={18} /></button>
        <button onClick={() => setIsDraggingMode(!isDraggingMode)} className={`p-2 rounded-xl transition-colors ${isDraggingMode ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}><Hand size={18} /></button>
        <button onClick={fitCanvasToViewport} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"><Maximize size={18} /></button>
        <button onClick={() => setViewport(v => ({...v, scale: Math.min(3, v.scale + 0.1)}))} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"><ZoomIn size={18} /></button>
      </div>

      <div 
        id="calendar-print-area" 
        className="bg-white flex flex-col relative overflow-hidden shadow-2xl rounded-sm"
        style={{ 
          width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`,
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
          transformOrigin: '0 0'
        }}
      >
        <header className="h-[120px] w-full bg-[#fcfdfe] border-b border-gray-100 flex items-center justify-between px-12">
          <div className="flex items-center gap-6">
            <div className="w-[80px] h-[80px] bg-white rounded-2xl shadow-sm flex items-center justify-center p-4">
              {state.config.institutionalLogo ? <img src={state.config.institutionalLogo} className="w-full h-full object-contain" /> : <Music className="text-indigo-600 w-10 h-10" />}
            </div>
            <div>
               <h1 className="text-[36px] leading-tight text-gray-900 italic font-black" style={{ fontFamily: 'Georgia, serif' }}>{state.config.institutionName}</h1>
               <span className="bg-indigo-600 text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">Calendario Oficial</span>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[60px] font-black text-gray-900 leading-none">{state.config.year}</div>
             <div className="text-[10px] uppercase tracking-[0.4em] font-black text-indigo-500">SINFONÍA CORE</div>
          </div>
        </header>

        <div className="h-[450px] w-full flex border-b border-gray-100">
          <div className="flex-1 p-6 flex flex-col bg-white overflow-hidden">
            <h2 className="text-[32px] font-black text-gray-900 uppercase border-l-[8px] border-indigo-600 pl-4 mb-4">{format(currentMonthDate, 'MMMM', { locale: es }).toUpperCase()}</h2>
            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-7 mb-2 text-center text-[10px] font-black text-gray-400">
                {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="flex-1 flex flex-col justify-between">
                {weeks.map((weekStart, wIdx) => {
                  const weekEnd = endOfWeek(weekStart, { locale: es });
                  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
                  return (
                    <div key={wIdx} className="relative h-full flex items-center border-b border-gray-50 last:border-0">
                      <div className="grid grid-cols-7 w-full h-full z-20">
                        {weekDays.map((day, dIdx) => {
                          const isCurrentMonth = day >= monthStart && day <= monthEnd;
                          const customStyle = getDayStyle(day);
                          return (
                            <div key={dIdx} onClick={() => !isDraggingMode && onSelectDay(format(day, 'yyyy-MM-dd'))} className={`relative flex flex-col items-end p-1 h-full ${!isCurrentMonth ? 'opacity-0' : 'hover:bg-indigo-50/20 cursor-pointer'}`}>
                               {isCurrentMonth && <DayCellDecoration dayStyle={customStyle} category={state.categories.find(c => c.id === customStyle?.categoryId)} isHoliday={customStyle?.isHoliday} isHighlighted={isDayHighlighted(day)} />}
                               <span className={`relative z-10 text-[18px] font-black ${customStyle?.isHoliday ? 'text-red-500' : 'text-gray-900'}`}>{format(day, 'd')}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="absolute inset-x-0 h-full pointer-events-none flex flex-col justify-end pb-1.5 z-10">
                        {monthActivities.map(a => {
                          const aStart = parseSafeDate(a.startDate), aEnd = parseSafeDate(a.endDate);
                          if (aEnd < weekStart || aStart > weekEnd) return null;
                          const sIdx = aStart < weekStart ? 0 : weekDays.findIndex(d => isSameDay(d, aStart));
                          const eIdx = aEnd > weekEnd ? 6 : weekDays.findIndex(d => isSameDay(d, aEnd));
                          const cW = 100/7, lP = sIdx*cW + cW/3, rP = 100-(eIdx*cW + 2*cW/3);
                          const color = state.categories.find(c => c.id === a.categoryId)?.color || a.color;
                          return (
                            <div key={a.id} className={`relative h-6 flex items-center transition-all ${a.status !== 'active' ? 'opacity-40' : ''}`} style={{ marginLeft: `${lP}%`, marginRight: `${rP}%` }}>
                              <div className="flex items-center w-full relative h-full">
                                <div className="shrink-0 w-2.5 h-2.5 rounded-full z-10 border-2 border-white shadow-sm" style={{ backgroundColor: highlightedActivityIds.includes(a.id) ? '#facc15' : color }} />
                                <div className="flex-1 h-[2.5px] flex items-center justify-center relative mx-[-2px] z-0">
                                   <div className="w-full h-full" style={{ backgroundColor: highlightedActivityIds.includes(a.id) ? '#facc15' : color }} />
                                   <div className="absolute inset-x-0 flex justify-center">
                                      <div className={`px-2 py-0.5 bg-white border rounded-lg text-[11px] font-black uppercase whitespace-nowrap shadow-sm ${highlightedActivityIds.includes(a.id) ? 'bg-yellow-400 border-yellow-500' : ''}`}>
                                        {a.title}
                                      </div>
                                   </div>
                                </div>
                                <div className="shrink-0 w-2.5 h-2.5 rounded-full z-10 border-2 border-white shadow-sm" style={{ backgroundColor: highlightedActivityIds.includes(a.id) ? '#facc15' : color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="w-1/3 p-6 flex flex-col bg-[#fafbfd] border-l border-gray-100 overflow-hidden">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-black text-gray-900 uppercase flex items-center gap-2"><Clock size={16} className="text-indigo-600" /> Cronograma</h3>
             </div>
             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {monthActivities.map((a, index) => (
                    <div key={a.id} onClick={() => onSelectActivity?.(selectedActivityId === a.id ? null : a.id)} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedActivityId === a.id ? 'bg-white shadow-lg border-indigo-200' : 'bg-white/60 hover:shadow-sm'}`}>
                       <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black bg-gray-100 text-gray-400 text-xs">{index + 1}</div>
                       <div className="flex-1 min-w-0">
                          <span className="text-[12px] font-black text-gray-900 block truncate leading-tight">{a.title}</span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">{format(parseSafeDate(a.startDate), 'dd MMM', { locale: es })}</span>
                       </div>
                    </div>
                  ))}
                  {monthActivities.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-300 gap-2 opacity-50">
                      <CalendarIcon size={32} />
                      <p className="text-[10px] font-black uppercase">Sin actividades</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>

        <footer className="flex-1 w-full bg-[#f8fafc] px-12 py-6 flex items-center justify-between">
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-6">
                <div className="w-16 h-[3px] bg-indigo-600 rounded-full" /> 
                <p className="text-[12px] font-black text-gray-500 uppercase">Propiedad de {state.config.institutionName}</p>
             </div>
             <p className="text-[15px] text-gray-400 font-bold italic font-serif">"La música es el arte más directo, entra por el oído y va al corazón."</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-100 flex items-center justify-center text-indigo-400">
                <Music size={14} />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
