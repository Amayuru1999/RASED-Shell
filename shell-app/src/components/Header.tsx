import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface NavItem {
  id: string;
  label: string;
  path: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', roles: ['SUPER_ADMIN', 'EXCISE_OFFICER', 'DATA_ENTRY_OPERATOR', 'AUDITOR'] },
  { id: 'users', label: 'Users', path: '/users', roles: ['SUPER_ADMIN'] },
  { id: 'licenses', label: 'Licenses', path: '/licenses', roles: ['SUPER_ADMIN', 'EXCISE_OFFICER'] },
  { id: 'production', label: 'Production', path: '/production', roles: ['SUPER_ADMIN', 'EXCISE_OFFICER', 'DATA_ENTRY_OPERATOR'] },
  { id: 'reporting', label: 'Reports', path: '/reporting', roles: ['SUPER_ADMIN', 'EXCISE_OFFICER', 'AUDITOR'] },
];

export function Header() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
      style={{
        height: 'var(--header-height)',
        background: 'var(--navy-primary)',
        borderBottom: '1px solid rgba(201,168,76,0.3)',
      }}
    >
      {/* Branding */}
      <div className="flex items-center gap-4">
        {/* Sri Lanka Emblem SVG Placeholder */}
        <div className="w-10 h-10 rounded-full bg-gold-500/20 border border-gold-500/40 flex items-center justify-center">
          <span className="text-gold-400 font-bold text-lg">⚜</span>
        </div>
        <div>
          <h1 className="text-white font-semibold text-sm leading-tight">
            Revenue Administration System
          </h1>
          <p className="text-slate-400 text-xs">Excise Department of Sri Lanka</p>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6">

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 mr-4">
          {visibleItems.map((item) => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`text-sm font-medium transition-colors hover:text-gold-400 ${isActive ? 'text-gold-400 border-b-2 border-gold-400 pb-1' : 'text-slate-300'}`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        {/* User dropdown */}
        <div className="relative">
          <button
            id="user-menu-button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center">
              <span className="text-navy-700 font-bold text-xs">{initials}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-white text-sm font-medium leading-tight">{user?.name}</p>
              <p className="text-slate-400 text-xs capitalize">{user?.primaryRole?.replace(/_/g, ' ')}</p>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                <div className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {user?.roles?.map((role) => (
                      <span key={role} className="px-1.5 py-0.5 bg-navy-700/10 text-navy-700 rounded text-xs font-medium">
                        {role.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  id="logout-button"
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
