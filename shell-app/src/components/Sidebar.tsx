import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    roles: ['SUPER_ADMIN', 'EXCISE_OFFICER', 'DATA_ENTRY_OPERATOR', 'AUDITOR'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z"
        />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'User Management',
    path: '/users',
    roles: ['SUPER_ADMIN'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
  {
    id: 'licenses',
    label: 'License Management',
    path: '/licenses',
    roles: ['SUPER_ADMIN', 'EXCISE_OFFICER'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    id: 'production',
    label: 'Production & Materials',
    path: '/production',
    roles: ['SUPER_ADMIN', 'EXCISE_OFFICER', 'DATA_ENTRY_OPERATOR'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
        />
      </svg>
    ),
  },
  {
    id: 'reporting',
    label: 'Reports & Analytics',
    path: '/reporting',
    roles: ['SUPER_ADMIN', 'EXCISE_OFFICER', 'AUDITOR'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  return (
    <aside
      className="fixed top-0 left-0 bottom-0 flex flex-col z-40"
      style={{
        width: 'var(--sidebar-width)',
        paddingTop: 'var(--header-height)',
        background: 'linear-gradient(180deg, #1B2A4A 0%, #101a33 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        <ul className="space-y-1" role="list">
          {visibleItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
            return (
              <li key={item.id}>
                <button
                  id={`nav-${item.id}`}
                  onClick={() => navigate(item.path)}
                  className={`sidebar-link w-full ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className={isActive ? 'text-gold-400' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge != null && (
                    <span className="px-1.5 py-0.5 bg-gold-500 text-navy-700 rounded-full text-xs font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-slate-500 text-xs text-center">
          RAS v1.0.0 &nbsp;|&nbsp; Excise Dept
        </p>
      </div>
    </aside>
  );
}
