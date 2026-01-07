
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { CalendarState, ActivityRange, DayStyle } from '../types';
import { format, endOfMonth, eachDayOfInterval, isSameDay, endOfWeek, eachWeekOfInterval, isWithinInterval, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Music, ZoomIn, ZoomOut, Maximize, Landmark, Sparkles, AlertCircle, 
  CalendarClock, CheckCircle2, Hand, Grab, Zap, Star, LayoutGrid, 
  Calendar as CalendarIcon, Clock, ChevronRight, Circle 
} from 'lucide-react';

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

const UI_STATE_KEY = 'sinfonia_canvas_viewport_v2';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const PADDING_FACTOR = 0.95;

const parseSafeDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Viewport State: scale and position offsets
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const [isDraggingMode, setIsDraggingMode] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const currentMonthDate = new Date(state.config.year, selectedMonth, 1);
  const monthStart = currentMonthDate;
  const monthEnd = endOfMonth(currentMonthDate);
  
  const weeks = eachWeekOfInterval({
    start: monthStart,
    end: monthEnd
  }, { locale: es });

  // Clear stale viewport data to ensure fresh centering on every page load
  useEffect(() => {
    localStorage.removeItem(UI_STATE_KEY);
  }, []);

  // Function to center and fit canvas within viewport with visual bias
  const fitCanvasToViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    if (containerWidth === 0 || containerHeight === 0) {
      requestAnimationFrame(fitCanvasToViewport);
      return;
    }
    
    const scaleX = containerWidth / CANVAS_WIDTH;
    const scaleY = containerHeight / CANVAS_HEIGHT;
    const optimalScale = Math.min(scaleX, scaleY) * PADDING_FACTOR;
    
    const clampedScale = Math.max(0.2, Math.min(3, optimalScale));
    
    const scaledWidth = CANVAS_WIDTH * clampedScale;
    const scaledHeight = CANVAS_HEIGHT * clampedScale;
    
    const horizontalPadding = containerWidth - scaledWidth;
    const LEFT_BIAS = 0.35; 
    const offsetX = horizontalPadding * LEFT_BIAS;
    
    const verticalPadding = containerHeight - scaledHeight;
    const TOP_BIAS = 0.45;
    const offsetY = verticalPadding * TOP_BIAS;
    
    setViewport({
      scale: clampedScale,
      offsetX,
      offsetY
    });
  }, []);

  const handleFitToScreen = useCallback(() => {
    setHasUserInteracted(false);
    fitCanvasToViewport();
  }, [fitCanvasToViewport]);

  useEffect(() => {
    fitCanvasToViewport();
    const rafId = requestAnimationFrame(() => fitCanvasToViewport());
    const timerId = setTimeout(() => fitCanvasToViewport(), 150);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [fitCanvasToViewport, isSidebarCollapsed]);

  useEffect(() => {
    window.addEventListener('resize', fitCanvasToViewport);
    return () => window.removeEventListener('resize', fitCanvasToViewport);
  }, [fitCanvasToViewport]);

  useEffect(() => {
    if (hasUserInteracted) {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(viewport));
    }
  }, [viewport, hasUserInteracted]);

  const monthActivities = useMemo(() => {
    return state.activities
      .filter(a => {
        const start = parseSafeDate(a.startDate);
        const end = parseSafeDate(a.endDate);
        return (start <= monthEnd && end >= monthStart);
      })
      .sort((a, b) => parseSafeDate(a.startDate).getTime() - parseSafeDate(b.startDate).getTime());
  }, [state.activities, selectedMonth]);

  const monthName = format(currentMonthDate, 'MMMM', { locale: es }).toUpperCase();

  const getDayStyle = (date: Date): DayStyle | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return state.dayStyles.find(s => {
        if (!s.endDate) return s.startDate === dateStr;
        const start = parseSafeDate(s.startDate);
        const end = parseSafeDate(s.endDate);
        if (!isValid(start) || !isValid(end)) return false;
        return isWithinInterval(date, { start, end });
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDraggingMode) return;
    setIsMouseDown(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown) return;
    if (!hasUserInteracted) setHasUserInteracted(true);
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    setViewport(prev => ({ 
      ...prev, 
      offsetX: prev.offsetX + dx, 
      offsetY: prev.offsetY + dy 
    }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsMouseDown(false);

  const updateZoom = (delta: number) => {
    if (!hasUserInteracted) setHasUserInteracted(true);
    setViewport(prev => {
      const newScale = Math.min(Math.max(prev.scale + delta, 0.2), 3);
      const container = containerRef.current;
      if (!container) return { ...prev, scale: newScale };
      const cx = container.clientWidth / 2;
      const cy = container.clientHeight / 2;
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        offsetX: cx - (cx - prev.offsetX) * ratio,
        offsetY: cy - (cy - prev.offsetY) * ratio
      };
    });
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`h-full w-full bg-[#374151] overflow-hidden flex items-start justify-start relative select-none ${isDraggingMode ? (isMouseDown ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
    >
      {/* Floating Toolbar Controls */}
      <div className="absolute bottom-6 right-6 z-[100] flex items-center bg-white/95 backdrop-blur-xl p-1.5 rounded-[1.5rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border border-white/20 gap-1 animate-in slide-in-from-bottom-5 duration-700">
        <button 
          onClick={() => updateZoom(-0.15)} 
          className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
          title="Alejar"
        >
          <ZoomOut size={18} />
        </button>

        <button 
          onClick={() => setIsDraggingMode(!isDraggingMode)} 
          className={`p-2.5 rounded-xl transition-all ${isDraggingMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
          title="Modo Navegación (Arrastrar)"
        >
          {isDraggingMode ? <Grab size={18} /> : <Hand size={18} />}
        </button>

        <button 
          onClick={handleFitToScreen} 
          className="p-2.5 text-indigo-600 bg-indigo-50 rounded-xl transition-all hover:bg-indigo-100"
          title="Ajustar a Pantalla"
        >
          <Maximize size={18} />
        </button>

        <button 
          onClick={() => updateZoom(0.15)} 
          className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
          title="Acercar"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      <div 
        ref={calendarRef}
        id="calendar-print-area" 
        onMouseDown={handleMouseDown}
        className="bg-white flex flex-col relative overflow-hidden transition-transform duration-300 ease-out shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] rounded-sm"
        style={{ 
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          minWidth: `${CANVAS_WIDTH}px`,
          minHeight: `${CANVAS_HEIGHT}px`,
          transformOrigin: '0 0',
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
          pointerEvents: isDraggingMode && isMouseDown ? 'none' : 'auto'
        }}
      >
        {/* CANVAS HEADER */}
        <header className="h-[130px] w-full bg-[#fcfdfe] border-b border-gray-100 flex items-center justify-between px-16 relative overflow-hidden">
          <Music className="absolute top-[-30px] right-10 text-indigo-50/50 w-60 h-60 -rotate-12 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-[100px] h-[100px] bg-white rounded-[1.8rem] shadow-xl flex items-center justify-center p-6 border border-gray-50/50">
              {state.config.institutionalLogo ? (
                <img src={state.config.institutionalLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Music className="text-indigo-600 w-12 h-12" />
              )}
            </div>
            <div className="flex flex-col">
               <h1 className="font-serif text-[44px] leading-tight text-gray-900 italic font-black tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>
                  {state.config.institutionName}
               </h1>
               <div className="flex items-center gap-4 mt-1">
                  <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] shadow-md shadow-indigo-100">Calendario Oficial</span>
                  <span className="text-gray-400 text-[11px] font-bold uppercase tracking-[0.3em]">Gestión Académica</span>
               </div>
            </div>
          </div>
          <div className="relative z-10 text-right">
             <div className="text-[70px] font-black text-gray-900 leading-none tracking-tighter opacity-95">{state.config.year}</div>
             <div className="text-[12px] uppercase tracking-[0.4em] font-black text-indigo-500 mt-[-4px]">SINFONÍA CORE</div>
          </div>
        </header>

        {/* CALENDAR BODY */}
        <div className="h-[410px] w-full flex border-b border-gray-100">
          
          {/* GRID SECTION */}
          <div className="w-1/2 p-8 border-r border-gray-100 flex flex-col bg-white">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-[32px] font-black text-gray-900 uppercase tracking-tighter leading-none border-l-[8px] border-indigo-600 pl-5">
                 {monthName}
               </h2>
               <div className="flex gap-2">
                 {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-100"></div>)}
               </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-7 mb-3 text-center">
                {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => (
                  <div key={d} className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{d}</div>
                ))}
              </div>

              <div className="flex-1 flex flex-col justify-between">
                {weeks.map((weekStart, wIdx) => {
                  const weekEnd = endOfWeek(weekStart, { locale: es });
                  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
                  
                  return (
                    <div key={wIdx} className="relative h-full flex items-center">
                      <div className="grid grid-cols-7 w-full h-full relative z-20">
                        {weekDays.map((day, dIdx) => {
                          const isCurrentMonth = day >= monthStart && day <= monthEnd;
                          const dateIso = format(day, 'yyyy-MM-dd');
                          const customStyle = getDayStyle(day);
                          const cat = state.categories.find(c => c.id === customStyle?.categoryId);
                          
                          return (
                            <div 
                              key={dIdx} 
                              onClick={() => !isDraggingMode && onSelectDay(dateIso)}
                              className={`relative flex flex-col items-center justify-center h-full transition-all ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : (isDraggingMode ? '' : 'hover:scale-110 cursor-pointer')}`}
                            >
                               {customStyle?.isHoliday && (
                                 <div className="absolute w-10 h-10 rounded-full bg-red-500/10 border-2 border-red-500/20 pointer-events-none animate-pulse"></div>
                               )}
                               {cat && !customStyle?.isHoliday && (
                                 <div className="absolute w-9 h-9 rounded-xl opacity-10 pointer-events-none" style={{ backgroundColor: cat.color }}></div>
                               )}
                               
                               <span className={`relative z-10 text-[16px] font-black ${customStyle?.isHoliday ? 'text-red-500' : 'text-gray-900'}`}>
                                 {format(day, 'd')}
                               </span>

                               {customStyle?.icon && (
                                 <span className="absolute top-1 right-1 text-[12px] filter drop-shadow-lg">{customStyle.icon}</span>
                               )}
                               {customStyle?.label && isSameDay(day, parseSafeDate(customStyle.startDate)) && (
                                 <span className="absolute -bottom-2.5 text-[5.5px] font-black uppercase text-indigo-400 tracking-tighter whitespace-nowrap overflow-hidden max-w-[85%] px-1">
                                    {customStyle.label}
                                 </span>
                               )}
                            </div>
                          );
                        })}
                      </div>

                      {/* ACTIVITY TIMELINE CONNECTORS - NEW DESIGN */}
                      <div className="absolute inset-x-0 h-full pointer-events-none flex flex-col justify-end gap-1 px-1 pb-1 z-10">
                        {monthActivities.map(a => {
                          const aStart = parseSafeDate(a.startDate);
                          const aEnd = parseSafeDate(a.endDate);
                          
                          if (aEnd < weekStart || aStart > weekEnd) return null;
                          
                          const startInWeek = aStart < weekStart ? 0 : weekDays.findIndex(d => isSameDay(d, aStart));
                          const endInWeek = aEnd > weekEnd ? 6 : weekDays.findIndex(d => isSameDay(d, aEnd));
                          
                          const cellWidth = 100 / 7;
                          const leftPos = startInWeek * cellWidth + cellWidth / 2;
                          const rightPos = 100 - (endInWeek * cellWidth + cellWidth / 2);
                          
                          const catColor = state.categories.find(c => c.id === a.categoryId)?.color || a.color;
                          const isSelected = selectedActivityId === a.id;
                          const isHighlighted = highlightedActivityIds.includes(a.id);
                          const isSuspended = a.status === 'suspended';
                          const isPostponed = a.status === 'postponed';
                          const isCompleted = a.completed;
                          
                          const isSingleDay = isSameDay(aStart, aEnd);

                          return (
                            <div 
                              key={a.id} 
                              className={`relative h-5 flex items-center transition-all duration-300 ${
                                isSuspended ? 'opacity-30' : (isPostponed ? 'opacity-50' : '')
                              } ${isSelected || isHighlighted ? 'z-40' : 'z-10'}`}
                              style={{ 
                                marginLeft: `${leftPos}%`, 
                                marginRight: `${rightPos}%`,
                              }}
                            >
                              {/* Start Circle */}
                              <div 
                                className={`absolute left-0 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all ${
                                  isSelected ? 'scale-150 shadow-lg' : isHighlighted ? 'scale-125 shadow-[0_0_15px_#facc15] border-yellow-400 bg-yellow-400 animate-pulse' : ''
                                }`}
                                style={{ 
                                  backgroundColor: isHighlighted ? undefined : catColor,
                                  borderColor: isHighlighted ? undefined : catColor,
                                  boxShadow: isSelected ? `0 0 0 4px ${catColor}33` : 'none'
                                }}
                              />
                              
                              {/* Connecting Line */}
                              <div 
                                className={`flex-1 h-0.5 mx-1.5 transition-all ${isCompleted ? 'opacity-60' : ''} ${isHighlighted ? 'h-1 bg-yellow-400 animate-pulse shadow-[0_0_10px_#facc15]' : ''}`}
                                style={{ backgroundColor: isHighlighted ? undefined : catColor }}
                              />
                              
                              {/* Event Title - Centered on Line */}
                              <div 
                                className={`absolute left-1/2 -translate-x-1/2 -top-4 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                                  isSelected 
                                    ? 'bg-white shadow-lg text-gray-900 scale-110' 
                                    : isHighlighted 
                                      ? 'bg-yellow-400 text-black shadow-xl scale-110 border-2 border-white'
                                      : 'bg-white/90 text-gray-700'
                                } ${isPostponed ? 'line-through' : ''}`}
                                style={{ 
                                  borderLeft: isHighlighted ? 'none' : `3px solid ${catColor}`,
                                  maxWidth: '120px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {a.title}
                              </div>
                              
                              {!isSingleDay && (
                                <div 
                                  className={`absolute right-0 translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all ${
                                    isSelected ? 'scale-150 shadow-lg' : isHighlighted ? 'scale-125 shadow-[0_0_15px_#facc15] border-yellow-400 bg-yellow-400 animate-pulse' : ''
                                  }`}
                                  style={{ 
                                    backgroundColor: isHighlighted ? undefined : catColor,
                                    borderColor: isHighlighted ? undefined : catColor,
                                    boxShadow: isSelected ? `0 0 0 4px ${catColor}33` : 'none'
                                  }}
                                />
                              )}
                              
                              {isSelected && (
                                <div 
                                  className="absolute inset-0 -inset-y-2 rounded-full animate-pulse pointer-events-none"
                                  style={{ backgroundColor: `${catColor}15` }}
                                />
                              )}
                              {isHighlighted && !isSelected && (
                                <div 
                                  className="absolute inset-0 -inset-y-4 -inset-x-2 rounded-xl animate-pulse pointer-events-none bg-yellow-400/10 border-2 border-yellow-400/30"
                                />
                              )}
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

          {/* LEGEND / DESCRIPTION PANEL - TODOLIST STYLE */}
          <div className="w-1/2 p-8 flex flex-col bg-[#fafbfd] relative overflow-hidden">
             <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-indigo-100 rounded-xl">
                    <Music className="text-indigo-600 w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-black text-gray-900 uppercase tracking-widest">Cronograma</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">de Eventos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                  <span className="text-[10px] font-black text-gray-500">{monthActivities.filter(a => a.completed).length}</span>
                  <span className="text-[10px] font-bold text-gray-400">/</span>
                  <span className="text-[10px] font-black text-gray-900">{monthActivities.length}</span>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative z-10">
                <div className="flex flex-col gap-2">
                  {monthActivities.length > 0 ? (
                    [...monthActivities]
                      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                      .map((a, index) => {
                        const catColor = state.categories.find(c => c.id === a.categoryId)?.color || a.color;
                        const isSelected = selectedActivityId === a.id;
                        const isHighlighted = highlightedActivityIds.includes(a.id);
                        const aDate = parseSafeDate(a.startDate);
                        const isCompleted = a.completed;
                        const isPast = aDate < new Date() && !isSameDay(aDate, new Date());
                        
                        return (
                          <div 
                            key={a.id} 
                            onClick={() => onSelectActivity?.(isSelected ? null : a.id)}
                            className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 cursor-pointer group ${
                              isSelected 
                                ? 'bg-white shadow-lg border-2 border-indigo-200 scale-[1.02]' 
                                : isHighlighted
                                  ? 'bg-yellow-50 border-2 border-yellow-400 scale-[1.01] shadow-md shadow-yellow-100'
                                  : 'bg-white/60 border border-transparent hover:bg-white hover:shadow-md'
                            } ${a.status !== 'active' ? 'opacity-50' : ''}`}
                          >
                             <button 
                               onClick={(e) => { e.stopPropagation(); onToggleComplete(a.id); }}
                               className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                                 isCompleted 
                                   ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                                   : isPast 
                                     ? 'bg-amber-100 text-amber-500 hover:bg-amber-200' 
                                     : isHighlighted
                                       ? 'bg-yellow-400 text-black animate-bounce'
                                       : 'bg-gray-100 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600'
                               }`}
                             >
                               {isCompleted ? (
                                 <CheckCircle2 size={18} />
                               ) : isPast ? (
                                 <AlertCircle size={18} />
                               ) : isHighlighted ? (
                                 <Zap size={18} />
                               ) : (
                                 <Clock size={18} />
                               )}
                             </button>
                             
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[12px] font-black text-gray-900 truncate ${
                                    isCompleted ? 'line-through opacity-60' : ''
                                  } ${a.status === 'postponed' ? 'line-through text-gray-400' : ''}`}>
                                    {a.title}
                                  </span>
                                  {isHighlighted && (
                                    <span className="px-1.5 py-0.5 bg-yellow-400 text-[7px] font-black uppercase rounded text-black">Conflicto</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                    {format(aDate, 'dd MMM', { locale: es })}
                                  </span>
                                  <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: catColor }}>
                                    {state.categories.find(c => c.id === a.categoryId)?.name || 'General'}
                                  </span>
                                </div>
                             </div>
                             
                             <div 
                               className={`shrink-0 w-2 h-10 rounded-full transition-all ${isSelected || isHighlighted ? 'scale-y-125' : ''}`}
                               style={{ backgroundColor: isHighlighted ? '#facc15' : catColor }}
                             />
                             
                             <div className="shrink-0 w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                               <span className="text-[10px] font-black text-gray-400">{index + 1}</span>
                             </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 opacity-30">
                      <Music size={48} />
                      <p className="text-[12px] font-black mt-4 uppercase tracking-widest">Sin eventos</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1">este mes</p>
                    </div>
                  )}
                </div>
             </div>
             
             {monthActivities.length > 0 && (
               <div className="mt-4 pt-4 border-t border-gray-100">
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Progreso del mes</span>
                   <span className="text-[10px] font-black text-indigo-600">
                     {Math.round((monthActivities.filter(a => a.completed).length / monthActivities.length) * 100)}%
                   </span>
                 </div>
                 <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                     style={{ width: `${(monthActivities.filter(a => a.completed).length / monthActivities.length) * 100}%` }}
                   />
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* CANVAS FOOTER */}
        <footer className="flex-1 w-full bg-[#f8fafc] p-10 flex items-center justify-between relative overflow-hidden">
          <Landmark className="absolute left-[-40px] bottom-[-40px] w-80 h-80 text-gray-200/50 rotate-12 opacity-30" />
          <div className="relative z-10 flex flex-col gap-5 w-2/3">
             <div className="flex items-center gap-8">
                <div className="w-16 h-[3px] bg-indigo-600 rounded-full shadow-sm"></div>
                <p className="text-[13px] font-black text-gray-500 uppercase tracking-[0.4em]">Propiedad de {state.config.institutionName}</p>
             </div>
             <p className="text-[17px] text-gray-400 font-bold leading-relaxed italic max-w-2xl font-serif">
               "La música es el arte más directo, entra por el oído y va al corazón." 
               Este documento estratégico coordina la excelencia musical institucional.
             </p>
          </div>

          <div className="relative z-10 text-right flex flex-col items-end gap-6">
             <div className="bg-gray-900 text-white px-6 py-3.5 rounded-[1.8rem] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.3)] flex flex-col items-end border border-white/5">
                <span className="text-[16px] font-black tracking-tighter uppercase italic text-indigo-300">Control de Calidad</span>
                <span className="text-[10px] opacity-30 font-mono tracking-[0.3em] mt-2">ID: {state.config.year}-CORE-{Math.random().toString(16).slice(2, 6).toUpperCase()}</span>
             </div>
             <div className="flex items-center gap-3">
                <LayoutGrid size={18} className="text-indigo-400" />
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Certificado Musical 2026</span>
             </div>
          </div>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 12px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};
