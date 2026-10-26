import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  GitCompare,
  BookOpenCheck,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';

export const Sidebar: React.FC = () => {
  const { documents, selectedDocIds } = useWorkspace();
  const readyCount = documents.filter((d) => d.status === 'ready').length;

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/documents',
      label: 'Documents',
      icon: FileText,
      badge: documents.length > 0 ? documents.length : null,
    },
    {
      to: '/research',
      label: 'Research Workspace',
      icon: Sparkles,
      badge: selectedDocIds.length > 0 ? `${selectedDocIds.length} sel` : null,
    },
    {
      to: '/compare',
      label: 'Compare Documents',
      icon: GitCompare,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
          <BookOpenCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight leading-none">
            Research Assistant
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Multi-Document RAG</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Workspace
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </div>
            {item.badge !== null && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Knowledge Base
          </span>
          <span className="font-semibold text-slate-300">{readyCount} Ready</span>
        </div>
        <p className="text-[11px] text-slate-500 truncate">
          Local Semantic Vector Engine
        </p>
      </div>
    </aside>
  );
};
