import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ProcessGenerator } from './components/ProcessGenerator';
import { MaturityDiagnostic } from './components/MaturityDiagnostic';
import { ProcessAnalyzer } from './components/ProcessAnalyzer';
import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  const [activeTab, setActiveTab] = useState('diagramador');

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-slate-50 dark:bg-bg-dark text-slate-800 dark:text-slate-200 antialiased transition-colors duration-300">
        <Sidebar activeId={activeTab} onNavigate={setActiveTab} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            {activeTab === 'diagramador' && <ProcessGenerator />}
            {activeTab === 'diagnostico' && <MaturityDiagnostic />}
            {activeTab === 'analyzer'    && <ProcessAnalyzer />}
            {!['diagramador', 'diagnostico', 'analyzer'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-900/10 dark:text-white/10">
                <div className="w-12 h-12 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01M9 15h6"/>
                  </svg>
                </div>
                <p className="text-[11px] font-medium tracking-[0.2em] uppercase">Módulo en desarrollo</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
