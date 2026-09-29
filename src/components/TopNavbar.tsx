import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { AuthUser } from '../types';
import { NavRoute } from './Sidebar';

interface TopNavbarProps {
  currentPath: string;
  onNavigate: (path: NavRoute) => void;
  currentUser: AuthUser | null;
  onToggleMobileSidebar: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onLogoutClick: () => void;
  onTriggerScan?: () => void;
  isScanning?: boolean;
}

export function TopNavbar({
  currentPath,
  onNavigate,
  currentUser,
  onToggleMobileSidebar,
  onOpenNotifications,
  unreadNotificationsCount,
  onLogoutClick,
  onTriggerScan,
  isScanning,
}: TopNavbarProps) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format page title from current path
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/dashboard':
        return 'Executive Command Dashboard';
      case '/environments':
        return 'Fleet Environments Overview';
      case '/configurations':
        return 'Configuration Versioning & Registry';
      case '/deployments':
        return 'Deployment Gatekeeper & Release Checks';
      case '/drifts':
        return 'Configuration Drift Detection Engine';
      case '/drift-history':
        return 'Historical Drift Timeline & Attribution';
      case '/comparison':
        return 'Side-by-Side Configuration Comparison';
      case '/simulation':
        return 'Failure Injection & Chaos Simulation';
      case '/what-if':
        return 'What-If Simulation & Out-of-Order Events';
      case '/risk-analysis':
        return 'Deployment Risk Velocity & Score Analysis';
      case '/dependencies':
        return 'Microservice & Service Dependencies';
      case '/secrets':
        return 'KMS Secrets Metadata & Expiration Tracking';
      case '/experiments':
        return 'Canary Experiments & Feature Flags';
      case '/change-requests':
        return 'Configuration Change Requests (CR)';
      case '/incidents':
        return 'Incident Management & Drift Response';
      case '/system-health':
        return 'System Health Monitoring';
      case '/performance':
        return 'Performance Analytics & Report Export Center';
      case '/guided-demo':
        return 'Guided Deployment Safety Demonstration';
      case '/test-results':
        return 'Quantitative Benchmark & Automated Test Evidence';
      case '/audit-logs':
        return 'Immutable Audit Logs & Event Trace';
      case '/notifications':
        return 'Notification Center & Alert Dispatcher';
      case '/settings':
        return 'Platform Settings & Governance Policies';
      case '/users':
        return 'Enterprise User Management (Admin)';
      case '/profile':
        return 'User Profile & Credentials';
      default:
        return 'Deployment Safety Intelligence';
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-indigo-400 font-semibold uppercase tracking-wider hidden sm:inline-block">
              Platform &bull;
            </span>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {getPageTitle(currentPath)}
            </h1>
          </div>
        </div>
      </div>

      {/* Right: Actions, Notifications & Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => onNavigate('/guided-demo')}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap ${
            currentPath === '/guided-demo'
              ? 'bg-indigo-600 text-white border-indigo-500'
              : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Guided Demo</span>
        </button>

        {/* Quick Validate button */}
        {onTriggerScan && (
          <button
            onClick={onTriggerScan}
            disabled={isScanning}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-700/60 hover:bg-indigo-900/60 text-indigo-200 text-xs font-semibold shadow-sm transition-all"
            title="Scan fleet for configuration drifts"
          >
            <Zap className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : 'text-indigo-400'}`} />
            <span>{isScanning ? 'Validating...' : 'Scan Fleet'}</span>
          </button>
        )}

        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white transition-colors"
          aria-label="Notifications"
          title="Notification Center"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse ring-2 ring-slate-900" />
          )}
        </button>

        {/* User Profile Dropdown */}
        {currentUser && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/50 text-slate-200 transition-all text-xs font-medium"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                {currentUser.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-white leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-indigo-300 font-mono leading-none">
                  {currentUser.role.replace('_', ' ')}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150">
                {/* User Header */}
                <div className="px-4 py-2 border-b border-slate-800">
                  <div className="font-semibold text-white truncate">{currentUser.name}</div>
                  <div className="text-slate-400 font-mono text-[11px] truncate">
                    {currentUser.email}
                  </div>
                  <div className="mt-1 inline-block px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-bold">
                    Role: {currentUser.role.replace('_', ' ')}
                  </div>
                </div>

                {/* Links */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      onNavigate('/profile');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('/settings');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 flex items-center gap-2.5 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings</span>
                  </button>
                </div>

                {/* Logout Action */}
                <div className="pt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogoutClick();
                    }}
                    className="w-full text-left px-4 py-2 flex items-center gap-2.5 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
