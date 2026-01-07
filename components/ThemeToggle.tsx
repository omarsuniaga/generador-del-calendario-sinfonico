
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', size = 'md' }) => {
  const { theme, toggleTheme } = useTheme();
  
  const sizes = {
    sm: { button: 'p-2', icon: 16 },
    md: { button: 'p-2.5', icon: 20 },
    lg: { button: 'p-3', icon: 24 },
  };

  return (
    <button
      onClick={toggleTheme}
      className={`
        ${sizes[size].button}
        rounded-xl
        transition-all duration-300
        ${theme === 'dark' 
          ? 'bg-gray-800 text-amber-400 hover:bg-gray-700 hover:text-amber-300 shadow-lg shadow-amber-500/10' 
          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700'
        }
        ${className}
      `}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun size={sizes[size].icon} className="transition-transform hover:rotate-45" />
      ) : (
        <Moon size={sizes[size].icon} className="transition-transform hover:-rotate-12" />
      )}
    </button>
  );
};
