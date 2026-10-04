import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const PrivateLayout: React.FC = () => {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="sticky top-0 h-screen w-64 shrink-0 bg-slate-800 text-white flex flex-col justify-between">
        <div>
          <div className="p-4 text-lg font-bold border-b border-slate-700">Panel Pracownika</div>
          <nav className="p-4 space-y-2">
            <Link className="block px-4 py-2 rounded hover:bg-slate-700 transition" to="/work/dashboard" >Dashboard</Link>
            <Link className="block px-4 py-2 rounded hover:bg-slate-700 transition" to="/work/inventory">Magazyn</Link>
            <Link className="block px-4 py-2 rounded hover:bg-slate-700 transition" to="/work/service">Serwis</Link>
            {user.role === 'OWNER' && (<Link to="/work/admin/company" className="block px-4 py-2 rounded hover:bg-slate-700 transition">Zarządzaj firmą</Link>)}
            {(user.role === 'MANAGER') && (<Link to="/work/admin/branch" className="block px-4 py-2 rounded hover:bg-slate-700 transition">Zarządzaj oddziałem</Link>)}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-700">
          <div className="text-sm font-medium mb-2">{user?.username} ({user?.role})</div>
          <button onClick={logout} className="w-full bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm transition">
            Wyloguj się
          </button>
        </div>
      </aside>

      <main className="grow p-8">
        <Outlet />
      </main>
    </div>
  );
};