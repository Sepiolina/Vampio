const fs = require('fs');
const path = require('path');

const exactReplaceMap = {
  'bg-slate-950': 'bg-primary',
  'bg-slate-900/40': 'bg-secondary',
  'bg-slate-900/50': 'bg-secondary',
  'bg-slate-900/60': 'bg-secondary',
  'bg-slate-900/80': 'bg-secondary',
  'bg-slate-900/90': 'bg-secondary',
  'bg-slate-900/95': 'bg-secondary',
  'bg-slate-900': 'bg-secondary',
  'bg-slate-800/80': 'bg-tertiary',
  'bg-slate-800/60': 'bg-tertiary',
  'bg-slate-800/40': 'bg-tertiary',
  'bg-slate-800': 'bg-tertiary',
  'hover:bg-slate-900/80': 'hover:bg-secondary',
  'hover:bg-slate-900': 'hover:bg-secondary',
  'hover:bg-slate-800/80': 'hover:bg-tertiary',
  'hover:bg-slate-800/60': 'hover:bg-tertiary',
  'hover:bg-slate-800': 'hover:bg-tertiary',
  'hover:bg-slate-700': 'hover:bg-tertiary hover:opacity-80',
  'bg-indigo-950/80': 'bg-accent/10',
  'bg-indigo-950/60': 'bg-accent/10',
  'bg-indigo-950/30': 'bg-accent/10',
  'bg-indigo-900/30': 'bg-accent/20',
  'border-slate-800/80': 'border-border-subtle',
  'border-slate-800/60': 'border-border-subtle',
  'border-slate-800': 'border-border-subtle',
  'border-slate-700/80': 'border-border-subtle',
  'border-slate-700/60': 'border-border-subtle',
  'border-slate-700': 'border-border-subtle',
  'hover:border-slate-700/80': 'hover:border-border-subtle hover:brightness-125',
  'border-indigo-800/60': 'border-accent/20',
  'border-indigo-800/50': 'border-accent/20',
  'border-indigo-800/40': 'border-accent/20',
  'border-indigo-900/30': 'border-accent/20',
  'text-slate-100': 'text-content',
  'text-slate-200': 'text-content',
  'text-slate-300': 'text-content',
  'text-slate-400': 'text-content-muted',
  'text-slate-500': 'text-content-muted',
  'text-slate-600': 'text-content-muted',
  'hover:text-slate-200': 'hover:text-content',
  'hover:text-white': 'hover:text-content',
  'text-white': 'text-content',
  'text-indigo-400': 'text-accent',
  'text-indigo-300': 'text-accent',
  'text-indigo-200': 'text-accent',
  'hover:text-indigo-300': 'hover:text-accent',
  'bg-indigo-600/90': 'bg-accent',
  'bg-indigo-600': 'bg-accent',
  'bg-indigo-500': 'bg-accent-hover',
  'hover:bg-indigo-600': 'hover:bg-accent-hover',
  'hover:bg-indigo-500/50': 'hover:bg-accent-hover',
  'hover:bg-indigo-500': 'hover:bg-accent-hover',
  'hover:border-indigo-500/50': 'hover:border-accent',
  'hover:border-indigo-500/40': 'hover:border-accent',
  'hover:border-indigo-500': 'hover:border-accent',
  'focus:border-indigo-500': 'focus:border-accent',
  'focus:ring-indigo-500': 'focus:ring-accent',
  'shadow-indigo-500/20': 'shadow-accent/20',
  'shadow-indigo-600/30': 'shadow-accent/30',
  'from-indigo-500': 'from-accent',
  'to-purple-500': 'to-accent-hover',
  'to-purple-600': 'to-accent-hover',
  'hover:bg-indigo-950/25': 'hover:bg-tertiary',
  'hover:bg-indigo-950/20': 'hover:bg-tertiary',
  'bg-emerald-950/40': 'bg-accent/10',
  'hover:bg-emerald-900/60': 'hover:bg-accent/20',
  'text-emerald-300': 'text-accent',
  'text-emerald-400': 'text-accent',
  'text-emerald-500/70': 'text-accent',
  'text-emerald-500': 'text-accent',
  'border-emerald-800/40': 'border-accent/20',
  'bg-emerald-950/60': 'bg-accent/10',
  'border-emerald-800/60': 'border-accent/20',
  'bg-amber-950/60': 'bg-accent/10',
  'text-amber-400': 'text-accent',
  'border-amber-800/60': 'border-accent/20',
  'text-amber-500/70': 'text-accent',
  'text-amber-500': 'text-accent',
  'border-amber-500/80': 'border-accent/50',
  'bg-cyan-950/60': 'bg-accent/10',
  'text-cyan-400': 'text-accent',
  'border-cyan-800/60': 'border-accent/20',
  'text-cyan-300': 'text-accent',
  'bg-purple-950/60': 'bg-accent/10',
  'text-purple-400': 'text-accent',
  'border-purple-800/60': 'border-accent/20',
  'bg-violet-950/60': 'bg-accent/10',
  'text-violet-400': 'text-accent',
  'border-violet-800/60': 'border-accent/20',
  'bg-blue-950/60': 'bg-accent/10',
  'text-blue-400': 'text-accent',
  'border-blue-800/60': 'border-accent/20',
  'bg-pink-950/60': 'bg-accent/10',
  'text-pink-400': 'text-accent',
  'border-pink-800/60': 'border-accent/20',
  'bg-orange-950/60': 'bg-accent/10',
  'text-orange-400': 'text-accent',
  'border-orange-800/60': 'border-accent/20',
  'bg-teal-950/60': 'bg-accent/10',
  'text-teal-400': 'text-accent',
  'border-teal-800/60': 'border-accent/20',
  'bg-sky-950/60': 'bg-accent/10',
  'text-sky-400': 'text-accent',
  'border-sky-800/60': 'border-accent/20',
  'text-zinc-400': 'text-content-muted',
  'bg-zinc-900': 'bg-tertiary',
  'border-zinc-800': 'border-border-subtle'
};

function replaceGlobal(content) {
  let modified = content;
  const keys = Object.keys(exactReplaceMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const safeKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?<=\\s|["'\`]|^)${safeKey}(?=\\s|["'\`]|\\!|$)`, 'g');
    modified = modified.replace(regex, exactReplaceMap[key]);
  }
  return modified;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = replaceGlobal(content);
      if (content !== modified) {
        fs.writeFileSync(fullPath, modified, 'utf8');
        console.log('Updated ' + fullPath);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src'));
