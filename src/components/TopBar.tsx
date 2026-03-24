import React from 'react';
import { Search, Bell, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export const TopBar = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <header className="h-14 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between px-6 bg-white/80 dark:bg-bg-dark/80 backdrop-blur-xl sticky top-0 z-20 transition-colors duration-300">
      <nav className="flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-[0.1em] uppercase text-slate-900/25 dark:text-white/25 select-none">Dashboard</span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-slate-900/10 dark:text-white/10 shrink-0" fill="none">
          <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-900/70 dark:text-white/70">Generador</span>
      </nav>
      <div className="flex items-center gap-0.5">
        <button className="flex items-center gap-2 h-8 px-3 rounded-md text-slate-900/30 dark:text-white/30 hover:text-slate-900/70 dark:hover:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-150">
          <Search className="w-3.5 h-3.5" />
          <span className="text-[11px] tracking-wide hidden lg:block">Buscar</span>
          <kbd className="hidden lg:block text-[9px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded px-1 py-0.5 font-mono leading-none text-slate-900/40 dark:text-white/20">⌘K</kbd>
        </button>
        <div className="w-px h-4 bg-black/[0.08] dark:bg-white/[0.08] mx-1.5" />
        <button onClick={toggleTheme} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-900/30 dark:text-white/30 hover:text-slate-900/70 dark:hover:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-150">
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
        <button className="relative w-8 h-8 rounded-md flex items-center justify-center text-slate-900/30 dark:text-white/30 hover:text-slate-900/70 dark:hover:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-150">
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-[7px] right-[7px] w-[5px] h-[5px] bg-blue-500 rounded-full ring-[1.5px] ring-white dark:ring-bg-dark" />
        </button>
        <button className="w-8 h-8 rounded-md flex items-center justify-center text-slate-900/30 dark:text-white/30 hover:text-slate-900/70 dark:hover:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-150">
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
