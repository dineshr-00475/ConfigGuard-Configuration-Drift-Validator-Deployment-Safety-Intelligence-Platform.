import React from 'react';
import {
  LayoutDashboard,
  Server,
  FileCode2,
  Rocket,
  ShieldAlert,
  History,
  GitCompare,
  Bug,
  HelpCircle,
  Activity,
  Network,
  KeyRound,
  FlaskConical,
  GitPullRequest,
  ScrollText,
  Bell,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  HeartPulse,
  Siren,
  Gauge,
  PlayCircle,
} from 'lucide-react';
import { AuthUser } from '../types';

export type NavRoute =
  | '/dashboard'
  | '/guided-demo'
  | '/environments'
  | '/configurations'
  | '/deployments'
  | '/drifts'
  | '/drift-history'
  | '/comparison'
  | '/simulation'
  | '/what-if'
  | '/risk-analysis'
  | '/dependencies'
  | '/secrets'
  | '/experiments'
  | '/test-results'
  | '/incidents'
  | '/change-requests'
  | '/audit-logs'
  | '/notifications'
  | '/system-health'
  | '/performance'
  | '/settings'
  | '/users'
  | '/profile';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: NavRoute) => void;
  currentUser: AuthUser | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogoutClick: () => void;
  unreadAlertCount: number;
}

interface NavSection {
  title: string;
  items: {
    label: string;
    path: NavRoute;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    adminOnly?: boolean;
  }[];
}

export function Sidebar({
  currentPath,
  onNavigate,
  currentUser,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onLogoutClick,
  unreadAlertCount,
}: SidebarProps) {
  const isAdmin = currentUser?.role === 'ADMIN';

  const navSections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        { label: 'Guided Demo Mode', path: '/guided-demo', icon: PlayCircle },
        { label: 'Environments', path: '/environments', icon: Server },
        { label: 'Configurations', path: '/configurations', icon: FileCode2 },
        { label: 'Deployment Pipeline', path: '/deployments', icon: Rocket },
      ],
    },
    {
      title: 'Validation',
      items: [
        { label: 'Drift Detection', path: '/drifts', icon: ShieldAlert },
        { label: 'Drift History', path: '/drift-history', icon: History },
        { label: 'Configuration Comparison', path: '/comparison', icon: GitCompare },
        { label: 'Failure Simulation', path: '/simulation', icon: Bug },
        { label: 'What-if Simulation', path: '/what-if', icon: HelpCircle },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { label: 'Risk Analysis', path: '/risk-analysis', icon: Activity },
        { label: 'Dependencies', path: '/dependencies', icon: Network },
        { label: 'Secrets', path: '/secrets', icon: KeyRound },
        { label: 'Experiments', path: '/experiments', icon: FlaskConical },
        { label: 'Benchmark & Tests', path: '/test-results', icon: ShieldCheck, badge: '61 Pass' },
      ],
    },
    {
      title: 'Management',
      items: [
        { label: 'Incident Management', path: '/incidents', icon: Siren },
        { label: 'Change Requests', path: '/change-requests', icon: GitPullRequest },
        { label: 'Audit Logs', path: '/audit-logs', icon: ScrollText },
        {
          label: 'Notifications',
          path: '/notifications',
          icon: Bell,
          badge: unreadAlertCount > 0 ? unreadAlertCount : undefined,
        },
      ],
    },
    {
      title: 'System & Telemetry',
      items: [
        { label: 'System Health', path: '/system-health', icon: HeartPulse },
        { label: 'Performance & Reports', path: '/performance', icon: Gauge },
        { label: 'Settings', path: '/settings', icon: Settings },
        ...(isAdmin
          ? [{ label: 'User Management', path: '/users' as NavRoute, icon: Users, adminOnly: true }]
          : []),
      ],
    },
  ];

  const handleNav = (path: NavRoute) => {
    onNavigate(path);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        <button
          onClick={() => handleNav('/dashboard')}
          className="flex items-center gap-3 text-left overflow-hidden group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 p-0.5 shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-900 rounded-[6px] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <div className="text-xs font-bold text-white tracking-tight truncate">
                Drift Validator
              </div>
              <div className="text-[10px] text-slate-400 truncate">Safety Intelligence</div>
            </div>
          )}
        </button>

        {/* Desktop Collapse Toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden md:flex w-7 h-7 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white items-center justify-center transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links Scrollable Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-5 custom-scrollbar">
        {/* Main Dashboard item */}
        <div>
          <button
            onClick={() => handleNav('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              currentPath === '/dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Dashboard"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Dashboard</span>}
          </button>
        </div>

        {/* Grouped Sections */}
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive = currentPath === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-slate-800 text-indigo-400 font-semibold border border-indigo-500/30'
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white leading-none">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/40">
        {!isCollapsed && currentUser && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-2 rounded-lg bg-slate-800/40 border border-slate-800">
            <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser.name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
              <div className="text-[10px] text-indigo-400 font-mono font-medium truncate">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onLogoutClick}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Logout"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-50 shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
