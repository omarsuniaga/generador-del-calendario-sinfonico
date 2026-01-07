
import { CalendarState, ActivityRange, Category, DayStyle, ProgramType, ActivityStatus } from '../types.ts';
import { format, isValid, isAfter } from 'date-fns';

/**
 * Interface for consistent import results across different formats
 */
export interface ImportResult {
  success: boolean;
  message: string;
  data?: Partial<CalendarState>;
  warnings?: string[];
  errors?: string[];
}

/**
 * CORE LOGIC: Data Validation and Sanitization
 */
const sanitizeActivity = (a: any, existingCategories: Category[]): ActivityRange => {
  const startDate = a.startDate || format(new Date(), 'yyyy-MM-dd');
  return {
    id: a.id || Math.random().toString(36).substr(2, 9),
    title: a.title || 'Sin título',
    startDate: startDate,
    endDate: a.endDate || startDate,
    color: a.color || '#3b82f6',
    program: validateProgram(a.program),
    categoryId: a.categoryId,
    status: validateStatus(a.status),
    completed: Boolean(a.completed),
    description: a.description || '',
  };
};

const validateProgram = (val: string): ProgramType => {
  const v = (val || '').toLowerCase();
  if (v.includes('orq')) return 'Orquesta';
  if (v.includes('coro inf')) return 'Coro Infantil';
  if (v.includes('coro juv')) return 'Coro Juvenil';
  if (v.includes('coro')) return 'Coro';
  return 'General';
};

const validateStatus = (val: string): ActivityStatus => {
  const v = (val || '').toLowerCase();
  if (v.includes('post')) return 'postponed';
  if (v.includes('susp')) return 'suspended';
  return 'active';
};

/**
 * EXPORT SERVICES
 */
export const ExportService = {
  toJSON(state: CalendarState): string {
    try {
      const backup = {
        version: '1.5.1',
        application: 'Sinfonía Calendar Core',
        exportDate: new Date().toISOString(),
        data: {
          config: state.config,
          categories: state.categories,
          activities: state.activities,
          dayStyles: state.dayStyles,
        }
      };
      return JSON.stringify(backup, null, 2);
    } catch (e) {
      console.error("Export Error:", e);
      throw new Error("Failed to generate JSON backup");
    }
  },

  toCSV(state: CalendarState): string {
    const headers = ['id', 'title', 'startDate', 'endDate', 'program', 'categoryId', 'categoryName', 'status', 'completed', 'description'];
    
    try {
      const rows = state.activities.map(activity => {
        const category = state.categories.find(c => c.id === activity.categoryId);
        return [
          activity.id,
          `"${(activity.title || '').replace(/"/g, '""')}"`,
          activity.startDate,
          activity.endDate,
          activity.program,
          activity.categoryId || '',
          `"${(category?.name || '').replace(/"/g, '""')}"`,
          activity.status || 'active',
          activity.completed ? 'true' : 'false',
          `"${(activity.description || '').replace(/"/g, '""')}"`
        ].join(',');
      });
      return [headers.join(','), ...rows].join('\n');
    } catch (e) {
      console.error("CSV Export Error:", e);
      throw new Error("Failed to generate CSV data");
    }
  },

  download(content: string, filename: string, mimeType: string): void {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download Error:", e);
    }
  },

  generateFilename(prefix: string, extension: string): string {
    const date = format(new Date(), 'yyyy-MM-dd_HHmm');
    return `${prefix}_${date}.${extension}`;
  }
};

/**
 * IMPORT SERVICES
 */
export const ImportService = {
  detectFormat(content: string): 'json' | 'csv' | 'unknown' {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.includes(',') || trimmed.includes(';')) return 'csv';
    return 'unknown';
  },

  fromJSON(content: string, existingCategories: Category[]): ImportResult {
    try {
      const parsed = JSON.parse(content);
      const data = parsed.data || parsed;
      
      if (!data.activities && !data.categories) {
        return { success: false, message: 'JSON sin datos de actividades o categorías válidos.' };
      }

      const activities = (data.activities || []).map((a: any) => sanitizeActivity(a, existingCategories));
      
      return {
        success: true,
        message: `JSON procesado: ${activities.length} actividades encontradas.`,
        data: {
          config: data.config,
          categories: data.categories || [],
          activities,
          dayStyles: data.dayStyles || [],
        }
      };
    } catch (e) {
      return { success: false, message: 'Error al parsear el archivo JSON.', errors: [(e as Error).message] };
    }
  },

  fromCSV(content: string, existingCategories: Category[]): ImportResult {
    const activities: ActivityRange[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const lines = content.trim().split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return { success: false, message: 'El CSV no contiene suficientes datos.' };

      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = this.parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim());
      
      const idx = {
        title: headers.findIndex(h => h.includes('tit') || h === 'evento' || h.includes('actividad')),
        start: headers.findIndex(h => h.includes('start') || h.includes('ini') || h === 'desde' || h.includes('fecha')),
        end: headers.findIndex(h => h.includes('end') || h.includes('fin') || h === 'hasta'),
        prog: headers.findIndex(h => h.includes('prog')),
        cat: headers.findIndex(h => h.includes('cat')),
        desc: headers.findIndex(h => h.includes('desc') || h === 'notas' || h.includes('detall'))
      };

      if (idx.title === -1 || idx.start === -1) {
        return { success: false, message: 'No se encontraron las columnas críticas (Título y Fecha Inicio).' };
      }

      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCSVLine(lines[i], delimiter);
        if (row.length < 2) continue;

        const title = row[idx.title] || '';
        if (!title) {
          warnings.push(`Fila ${i + 1} ignorada: Falta título.`);
          continue;
        }

        const startDt = this.parseFlexibleDate(row[idx.start]);
        if (!startDt) {
          errors.push(`Fila ${i + 1} ("${title}") ignorada: Formato de fecha de inicio inválido (${row[idx.start]}).`);
          continue;
        }

        let endDt = idx.end !== -1 ? this.parseFlexibleDate(row[idx.end]) : startDt;
        if (!endDt) endDt = startDt;

        // Validar que fin sea después de inicio
        if (isAfter(startDt, endDt)) {
          warnings.push(`Fila ${i + 1}: La fecha de fin era anterior al inicio. Se ajustó a la misma fecha.`);
          endDt = startDt;
        }

        activities.push({
          id: Math.random().toString(36).substr(2, 9),
          title: title.trim(),
          startDate: format(startDt, 'yyyy-MM-dd'),
          endDate: format(endDt, 'yyyy-MM-dd'),
          program: validateProgram(idx.prog !== -1 ? row[idx.prog] : ''),
          categoryId: undefined,
          color: '#3b82f6',
          status: 'active',
          completed: false,
          description: idx.desc !== -1 ? row[idx.desc] : ''
        });
      }

      return {
        success: activities.length > 0,
        message: activities.length > 0 
          ? `CSV procesado: ${activities.length} actividades encontradas.` 
          : 'No se pudieron procesar actividades válidas del CSV.',
        data: { activities },
        errors,
        warnings
      };
    } catch (e) {
      return { success: false, message: 'Error crítico procesando CSV.', errors: [(e as Error).message] };
    }
  },

  parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  parseFlexibleDate(input: string): Date | null {
    if (!input || typeof input !== 'string') return null;
    const clean = input.trim();
    if (!clean) return null;

    // 1. Intento de parseo directo (ISO YYYY-MM-DD)
    let d = new Date(clean);
    if (isValid(d) && !isNaN(d.getTime())) {
      // Protección contra años erróneos (ej: 0024 en lugar de 2024)
      if (d.getFullYear() > 1000) return d;
    }

    // 2. Parseo manual para formatos comunes (DD/MM/YYYY, MM/DD/YYYY)
    // Soportamos separadores / - .
    const parts = clean.split(/[\/\-\.]/).map(p => parseInt(p, 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    let year: number, month: number, day: number;

    // Caso A: YYYY MM DD
    if (parts[0] > 1000) {
      [year, month, day] = parts;
    } 
    // Caso B: DD MM YYYY o MM DD YYYY
    else if (parts[2] > 1000) {
      year = parts[2];
      // Heurística para decidir entre DD/MM y MM/DD
      if (parts[0] > 12) {
        // DD/MM/YYYY
        [day, month] = [parts[0], parts[1]];
      } else if (parts[1] > 12) {
        // MM/DD/YYYY
        [month, day] = [parts[0], parts[1]];
      } else {
        // Ambiguo (ej 05/06/2024). Por defecto asumimos DD/MM (Europeo/Latam)
        [day, month] = [parts[0], parts[1]];
      }
    } else {
      // No hay año de 4 dígitos evidente
      return null;
    }

    // Validación final de componentes (evitar 31 de febrero, etc)
    d = new Date(year, month - 1, day);
    if (isValid(d) && d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return d;
    }

    return null;
  }
};

// Legacy compatibility exports (keeping same names for UI components)
export const exportToJSON = ExportService.toJSON;
export const exportToCSV = ExportService.toCSV;
export const downloadFile = ExportService.download;
export const generateFilename = ExportService.generateFilename;
export const detectFileFormat = ImportService.detectFormat;
export const importFromJSON = ImportService.fromJSON;
export const importFromCSV = ImportService.fromCSV;
