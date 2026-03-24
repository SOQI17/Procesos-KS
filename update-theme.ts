import fs from 'fs';
import path from 'path';

const files = [
  'src/App.tsx',
  'src/components/Sidebar.tsx',
  'src/components/TopBar.tsx',
  'src/components/ProcessGenerator.tsx',
  'src/components/MaturityDiagnostic.tsx',
  'src/components/ProcessAnalyzer.tsx'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');

  content = content.replace(/bg-bg-dark/g, 'bg-slate-50 dark:bg-bg-dark');
  content = content.replace(/bg-bg-sidebar/g, 'bg-white dark:bg-bg-sidebar');
  
  content = content.replace(/text-white(?!\/)/g, 'text-slate-900 dark:text-white');
  
  content = content.replace(/text-white\/(\[?[0-9.]+\]?)/g, 'text-slate-900/$1 dark:text-white/$1');
  content = content.replace(/bg-white\/(\[?[0-9.]+\]?)/g, 'bg-black/$1 dark:bg-white/$1');
  content = content.replace(/border-white\/(\[?[0-9.]+\]?)/g, 'border-black/$1 dark:border-white/$1');

  content = content.replace(/text-slate-200/g, 'text-slate-800 dark:text-slate-200');
  content = content.replace(/text-slate-300/g, 'text-slate-700 dark:text-slate-300');
  content = content.replace(/text-slate-400/g, 'text-slate-600 dark:text-slate-400');
  
  content = content.replace(/shadow-\[0_0_10px_white\]/g, 'shadow-[0_0_10px_black] dark:shadow-[0_0_10px_white]');

  fs.writeFileSync(filePath, content, 'utf-8');
});
console.log('Theme classes updated!');
