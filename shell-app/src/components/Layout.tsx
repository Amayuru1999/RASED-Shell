import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { ErrorBoundary } from './ErrorBoundary';
import { useAuth } from '../auth/AuthContext';

function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-slate-500 text-sm">
          Revenue Administration System &mdash; Excise Department of Sri Lanka
        </p>
      </div>
      {/*<div className="mb-8">*/}
      {/*  <img*/}
      {/*    src="/images/excise_department_banner.gif"*/}
      {/*    alt="Excise Department Banner"*/}
      {/*    className="w-full h-[200px] object-cover rounded-2xl shadow-sm border border-slate-100"*/}
      {/*  />*/}
      {/*</div>*/}

      {/* Quick Access */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-4">Quick Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New License', path: '/licenses/new', icon: '➕' },
            { label: 'User Reports', path: '/reporting', icon: '📊' },
            { label: 'Production Log', path: '/production', icon: '🏭' },
            { label: 'Manage Users', path: '/users', icon: '👤' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.path}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-navy-700 hover:text-white group transition-all"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-medium text-slate-600 group-hover:text-white text-center">
                {item.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}



export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main
        className="transition-all duration-200"
        style={{
          paddingTop: 'var(--header-height)',
          minHeight: '100vh',
        }}
      >
        <ErrorBoundary mfeName="Main Content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
          <div id="mfe-container" className="flex flex-col w-full" />
        </ErrorBoundary>
      </main>
    </div>
  );
}
