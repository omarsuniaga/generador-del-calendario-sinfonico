
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { CalendarState, ActivityRange, DayStyle } from '../types';
import { format, endOfMonth, eachDayOfInterval, isSameDay, endOfWeek, eachWeekOfInterval, isWithinInterval, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Music, ZoomIn, ZoomOut, Maximize, Landmark, Sparkles, AlertCircle, CalendarClock, CheckCircle2, Hand, Grab, Zap, Star, LayoutGrid } from 'lucide-react';

interface CalendarCanvasProps {
  state: CalendarState;
  selectedMonth: number;
  onSelectDay: (date: string) => void;
  selectedActivityId: string | null;
  isSidebarCollapsed: boolean;
}

const UI_STATE_KEY = 'sinfonia_canvas_viewport_v2';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const PADDING_FACTOR = 0.9;

const parseSafeDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const CalendarCanvas: React.FC<CalendarCanvasProps> = ({ state, selectedMonth, onSelectDay, selectedActivityId, isSidebarCollapsed }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Viewport State: scale and position offsets
  // ALWAYS start with default values to avoid stale localStorage shifts on mount
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

  // Function to center and fit canvas within viewport
  const fitCanvasToViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Ensure container has actual dimensions before calculating
    if (containerWidth === 0 || containerHeight === 0) {
      requestAnimationFrame(fitCanvasToViewport);
      return;
    }
    
    // Calculate optimal scale to fit canvas with padding
    const scaleX = containerWidth / CANVAS_WIDTH;
    const scaleY = containerHeight / CANVAS_HEIGHT;
    const optimalScale = Math.min(scaleX, scaleY) * PADDING_FACTOR;
    
    // Clamp scale to bounds
    const clampedScale = Math.max(0.2, Math.min(3, optimalScale));
    
    // Calculate centered position for transform-origin: 0 0
    const scaledWidth = CANVAS_WIDTH * clampedScale;
    const scaledHeight = CANVAS_HEIGHT * clampedScale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;
    
    setViewport({
      scale: clampedScale,
      offsetX,
      offsetY
    });
  }, []);

  // Wrapper for button to reset interaction flag
  const handleFitToScreen = useCallback(() => {
    setHasUserInteracted(false);
    fitCanvasToViewport();
  }, [fitCanvasToViewport]);

  // Center on mount and when sidebar toggles
  useEffect(() => {
    // Immediate attempt
    fitCanvasToViewport();
    
    // Backup attempt after DOM is fully ready
    const rafId = requestAnimationFrame(() => {
      fitCanvasToViewport();
    });
    
    // Final backup for CSS transitions
    const timerId = setTimeout(() => {
      fitCanvasToViewport();
    }, 150); // Increased from 100ms to 150ms for safety against layout shifts

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [fitCanvasToViewport, isSidebarCollapsed]);

  // Handle window resize
  useEffect(() => {
    window.addEventListener('resize', fitCanvasToViewport);
    return () => window.removeEventListener('resize', fitCanvasToViewport);
  }, [fitCanvasToViewport]);

  // Only persist viewport after user has manually interacted
  useEffect(() => {
    if (hasUserInteracted) {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(viewport));
    }
  }, [viewport, hasUserInteracted]);

  const monthActivities = useMemo(() => {
    return state.activities.filter(a => {
      const start = parseSafeDate(a.startDate);
      const end = parseSafeDate(a.endDate);
      return (start <= monthEnd && end >= monthStart);
    });
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
    
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    setViewport(prev => ({ 
      ...prev, 
      offsetX: prev.offsetX + dx, 
      offsetY: prev.offsetY + dy 
    }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const updateZoom = (delta: number) => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

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
      <div className="fixed bottom-10 right-10 z-[100] flex items-center bg-white/95 backdrop-blur-xl p-2 rounded-[2rem] shadow-[0_25px_80px_-15px_rgba(0,0,0,0.25)] border border-white/50 gap-1 animate-in slide-in-from-bottom-5 duration-700">
        <button 
          onClick={() => updateZoom(-0.15)} 
          className="p-3.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
          title="Alejar"
        >
          <ZoomOut size={22} />
        </button>

        <button 
          onClick={() => setIsDraggingMode(!isDraggingMode)} 
          className={`p-3.5 rounded-2xl transition-all ${isDraggingMode ? 'bg-indigo-600 text-white shadow-[0_10px_30px_-5px_rgba(79,70,229,0.5)]' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
          title="Modo Navegación (Arrastrar)"
        >
          {isDraggingMode ? <Grab size={22} /> : <Hand size={22} />}
        </button>

        <button 
          onClick={handleFitToScreen} 
          className="p-3.5 text-indigo-600 bg-indigo-50 rounded-2xl transition-all hover:bg-indigo-100"
          title="Ajustar a Pantalla"
        >
          <Maximize size={22} />
        </button>

        <button 
          onClick={() => updateZoom(0.15)} 
          className="p-3.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
          title="Acercar"
        >
          <ZoomIn size={22} />
        </button>
      </div>

      <div 
        ref={calendarRef}
        id="calendar-print-area" 
        onMouseDown={handleMouseDown}
        className="bg-white flex flex-col relative overflow-hidden transition-transform duration-300 ease-out shadow-[0_60px_120px_-30px_rgba(0,0,0,0.4)] rounded-sm"
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
        <header className="h-[180px] w-full bg-[#fcfdfe] border-b border-gray-100 flex items-center justify-between px-20 relative overflow-hidden">
          <Music className="absolute top-[-40px] right-20 text-indigo-50/50 w-80 h-80 -rotate-12 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-10">
            <div className="w-[140px] h-[140px] bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center p-8 border border-gray-50/50">
              {state.config.institutionalLogo ? (
                <img src={state.config.institutionalLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Music className="text-indigo-600 w-20 h-20" />
              )}
            </div>
            <div className="flex flex-col">
               <h1 className="font-serif text-[64px] leading-tight text-gray-900 italic font-black tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>
                  {state.config.institutionName}
               </h1>
               <div className="flex items-center gap-6 mt-3">
                  <span className="bg-indigo-600 text-white px-6 py-2 rounded-full text-[14px] font-black uppercase tracking-[0.25em] shadow-lg shadow-indigo-200/50">Calendario Oficial</span>
                  <span className="text-gray-400 text-[14px] font-bold uppercase tracking-[0.4em]">Gestión Académica</span>
               </div>
            </div>
          </div>
          <div className="relative z-10 text-right">
             <div className="text-[110px] font-black text-gray-900 leading-none tracking-tighter opacity-95">{state.config.year}</div>
             <div className="text-[14px] uppercase tracking-[0.6em] font-black text-indigo-500 mt-[-8px]">SINFONÍA CORE</div>
          </div>
        </header>

        {/* CALENDAR BODY */}
        <div className="h-[360px] w-full flex border-b border-gray-100">
          
          {/* GRID SECTION */}
          <div className="w-1/2 p-12 border-r border-gray-50 flex flex-col bg-white">
            <div className="flex items-center justify-between mb-10">
               <h2 className="text-[52px] font-black text-gray-900 uppercase tracking-tighter leading-none border-l-[12px] border-indigo-600 pl-8">
                 {monthName}
               </h2>
               <div className="flex gap-3">
                 {[1,2,3].map(i => <div key={i} className="w-4 h-4 rounded-full bg-indigo-100/60"></div>)}
               </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="grid grid-cols-7 mb-6 text-center">
                {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => (
                  <div key={d} className="text-[13px] font-black text-gray-300 uppercase tracking-[0.3em]">{d}</div>
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
                              className={`relative flex flex-col items-center justify-center h-full transition-all ${!isCurrentMonth ? 'opacity-0' : (isDraggingMode ? '' : 'hover:scale-110 cursor-pointer')}`}
                            >
                               {customStyle?.isHoliday && (
                                 <div className="absolute w-14 h-14 rounded-full bg-red-500/10 border-2 border-red-500/20 pointer-events-none animate-pulse"></div>
                               )}
                               {cat && !customStyle?.isHoliday && (
                                 <div className="absolute w-12 h-12 rounded-2xl opacity-10 pointer-events-none" style={{ backgroundColor: cat.color }}></div>
                               )}
                               
                               <span className={`relative z-10 text-[22px] font-black ${customStyle?.isHoliday ? 'text-red-500' : 'text-gray-900'}`}>
                                 {format(day, 'd')}
                               </span>

                               {customStyle?.icon && (
                                 <span className="absolute top-1 right-2 text-[16px] filter drop-shadow-lg">{customStyle.icon}</span>
                               )}
                               {customStyle?.label && isSameDay(day, parseSafeDate(customStyle.startDate)) && (
                                 <span className="absolute -bottom-3 text-[7px] font-black uppercase text-indigo-400 tracking-tighter whitespace-nowrap overflow-hidden max-w-full px-1">
                                    {customStyle.label}
                                 </span>
                               )}
                            </div>
                          );
                        })}
                      </div>

                      {/* ACTIVITY RANGE LINES */}
                      <div className="absolute inset-x-0 h-full pointer-events-none flex flex-col justify-center gap-2 px-3 z-10">
                        {monthActivities.map(a => {
                          const aStart = parseSafeDate(a.startDate);
                          const aEnd = parseSafeDate(a.endDate);
                          if (aEnd < weekStart || aStart > weekEnd) return null;
                          const startInWeek = aStart < weekStart ? 0 : weekDays.findIndex(d => isSameDay(d, aStart));
                          const endInWeek = aEnd > weekEnd ? 6 : weekDays.findIndex(d => isSameDay(d, aEnd));
                          const left = (startInWeek / 7) * 100 + (100/7)/2;
                          const right = 100 - ((endInWeek / 7) * 100 + (100/7)/2);
                          const catColor = state.categories.find(c => c.id === a.categoryId)?.color || a.color;
                          const isSelected = selectedActivityId === a.id;
                          
                          const isSuspended = a.status === 'suspended';
                          const isPostponed = a.status === 'postponed';

                          return (
                            <div 
                              key={a.id} 
                              className={`relative transition-all duration-300 rounded-full shadow-lg ${isSelected ? 'h-5 z-40' : 'h-2.5 z-10'} ${isSuspended ? 'opacity-30 grayscale-[0.6]' : (isPostponed ? 'opacity-40' : '')}`}
                              style={{ 
                                marginLeft: `${left}%`, 
                                marginRight: `${right}%`,
                                backgroundColor: isSelected ? catColor : `${catColor}dd`,
                                border: isSelected ? '3px solid white' : 'none',
                                boxShadow: isSelected ? `0 0 0 6px ${catColor}55, 0 12px 30px -10px ${catColor}77` : 'none',
                              }}
                            >
                               {isSelected && <div className="absolute inset-0 rounded-full animate-pulse bg-white/30" />}
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

          {/* LEGEND / DESCRIPTION PANEL */}
          <div className="w-1/2 p-12 flex flex-col bg-[#fafbfd] relative overflow-hidden">
             <div className="flex items-center gap-5 mb-10 relative z-10">
                <Music className="text-indigo-600 w-10 h-10" />
                <h3 className="text-[24px] font-black text-gray-900 uppercase tracking-[0.4em]">Cronograma de Eventos</h3>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-8 relative z-10">
                <div className="flex flex-col gap-6">
                  {monthActivities.length > 0 ? (
                    monthActivities.map(a => {
                      const catColor = state.categories.find(c => c.id === a.categoryId)?.color || a.color;
                      const isSelected = selectedActivityId === a.id;
                      const aDate = parseSafeDate(a.startDate);
                      const isSuspended = a.status === 'suspended';
                      const isPostponed = a.status === 'postponed';

                      return (
                        <div 
                          key={a.id} 
                          className={`flex items-start gap-8 p-8 rounded-[3rem] transition-all duration-700 border-2 ${isSelected ? 'bg-white shadow-[0_40px_90px_-20px_rgba(0,0,0,0.18)] scale-[1.05] border-indigo-200 z-30' : 'bg-white/50 border-transparent'} group ${a.status !== 'active' && !isSelected ? 'opacity-50' : ''}`}
                        >
                           <div className={`w-6 h-6 rounded-full mt-4 shrink-0 shadow-2xl transition-all ${isSelected ? 'scale-125 ring-[10px]' : 'ring-0'}`} style={{ backgroundColor: catColor, ringColor: `${catColor}22` }}></div>
                           <div className="flex flex-col flex-1">
                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                  {isSelected && (
                                    <div className="p-2 bg-amber-50 rounded-2xl animate-in zoom-in spin-in-12 duration-500">
                                      <Zap size={32} className="text-amber-500 fill-amber-500" />
                                    </div>
                                  )}
                                  <span className={`font-black transition-all tracking-tighter leading-none ${isSelected ? 'text-[42px] text-gray-950' : 'text-[20px] text-gray-600'} ${isPostponed ? 'line-through opacity-50' : ''}`}>
                                    {format(aDate, 'dd')} · {a.title}
                                  </span>
                                </div>
                                {isSelected && (
                                  <div className="shrink-0 p-3 bg-indigo-600 rounded-full shadow-xl animate-in fade-in slide-in-from-right-4 duration-500">
                                    <CheckCircle2 size={32} className="text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-5 mt-5">
                                <span className={`uppercase tracking-[0.3em] font-black transition-all ${isSelected ? 'text-[16px] text-indigo-600 bg-indigo-50 px-6 py-2.5 rounded-2xl' : 'text-[10px] text-gray-400'}`}>
                                  {a.program}
                                </span>
                                {isSelected && (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <Star size={16} className="fill-gray-400" />
                                    <span className="uppercase tracking-[0.2em] font-black text-[12px] italic">
                                      {a.status?.toUpperCase() || 'ACTIVO'}
                                    </span>
                                  </div>
                                )}
                                {!isSelected && (
                                  <span className="uppercase tracking-[0.2em] font-black text-[9px] text-gray-300">
                                    • {a.status?.toUpperCase()}
                                  </span>
                                )}
                              </div>
                           </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 opacity-20 scale-150">
                      <Music size={64} />
                      <p className="text-[14px] font-black mt-6 uppercase tracking-[0.5em]">Sin eventos registrados</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>

        {/* CANVAS FOOTER */}
        <footer className="flex-1 w-full bg-[#f8fafc] p-16 flex items-center justify-between relative overflow-hidden">
          <Landmark className="absolute left-[-50px] bottom-[-50px] w-96 h-96 text-gray-200/50 rotate-12 opacity-40" />
          <div className="relative z-10 flex flex-col gap-8 w-2/3">
             <div className="flex items-center gap-10">
                <div className="w-24 h-[4px] bg-indigo-600 rounded-full shadow-lg shadow-indigo-100"></div>
                <p className="text-[16px] font-black text-gray-500 uppercase tracking-[0.6em]">Propiedad de {state.config.institutionName}</p>
             </div>
             <p className="text-[22px] text-gray-400 font-bold leading-relaxed italic max-w-3xl font-serif">
               "La música es el arte más directo, entra por el oído y va al corazón." 
               Este documento estratégico coordina la excelencia musical de nuestra comunidad.
             </p>
          </div>

          <div className="relative z-10 text-right flex flex-col items-end gap-8">
             <div className="bg-gray-900 text-white px-10 py-6 rounded-[2.5rem] shadow-[0_35px_80px_-15px_rgba(0,0,0,0.4)] flex flex-col items-end border border-white/10">
                <span className="text-[26px] font-black tracking-tighter uppercase italic text-indigo-300">Control de Calidad</span>
                <span className="text-[12px] opacity-40 font-mono tracking-[0.5em] mt-3">ID: {state.config.year}-CORE-{Math.random().toString(16).slice(2, 6).toUpperCase()}</span>
             </div>
             <div className="flex items-center gap-4">
                <LayoutGrid size={22} className="text-indigo-400" />
                <span className="text-[14px] font-black text-gray-400 uppercase tracking-[0.4em]">Certificado Musical 2026</span>
             </div>
          </div>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 12px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};
