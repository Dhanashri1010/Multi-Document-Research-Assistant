import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Sparkles,
  GitCompare,
  FlaskConical,
  BookOpenCheck,
  GraduationCap,
  Award,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { useAuth } from '../../context/AuthContext.js';

export const Sidebar: React.FC = () => {
  const { documents, selectedDocIds } = useWorkspace();
  const { user, isAuthenticated, logout } = useAuth();
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
    {
      to: '/nlp-lab',
      label: 'NLP Lab',
      icon: FlaskConical,
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
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Smart Document Assistant</p>
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

        {/* Project Workflow & Technology Guide Link */}
        <div className="pt-4 space-y-1">
          <div className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Evaluation & Guide
          </div>
          <NavLink
            to="/rubric-coverage"
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`
            }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Award className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="text-xs font-semibold leading-tight line-clamp-2">
                Rubric Compliance (30/30)
              </span>
            </div>
          </NavLink>
          <NavLink
            to="/workflow-guide"
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`
            }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <GraduationCap className="w-4 h-4 shrink-0 text-brand-400" />
              <span className="text-xs font-semibold leading-tight line-clamp-2">
                Project Workflow & Architecture
              </span>
            </div>
          </NavLink>
        </div>
      </nav>

      {/* User Profile & Logout */}
      {isAuthenticated && user ? (
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate" title={user.name}>
                {user.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out of your account"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        </div>
      )}

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
          Document Search Ready
        </p>
      </div>
    </aside>
  );
};
