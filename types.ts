
export type ProgramType = 'Orquesta' | 'Coro' | 'Coro Infantil' | 'Coro Juvenil' | 'General';
export type ActivityStatus = 'active' | 'postponed' | 'suspended';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface ActivityRange {
  id: string;
  title: string;
  startDate: string; // ISO format
  endDate: string; // ISO format
  color: string;
  program: ProgramType;
  categoryId?: string;
  description?: string;
  status?: ActivityStatus;
  rescheduledToId?: string; 
}

export interface DayStyle {
  id: string;
  startDate: string; // ISO format
  endDate?: string; // ISO format
  shape?: 'circle' | 'square';
  bgColor?: string;
  icon?: string; 
  label?: string;
  isHoliday?: boolean;
  categoryId?: string;
}

export interface NotificationLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'warning' | 'success' | 'ai';
}

export interface CalendarConfig {
  year: number;
  institutionalLogo: string | null;
  institutionName: string;
  subtitle: string;
}

export interface CalendarState {
  config: CalendarConfig;
  activities: ActivityRange[];
  dayStyles: DayStyle[];
  categories: Category[];
  notifications: NotificationLog[];
}
