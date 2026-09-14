import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export const PublicLayout: React.FC=()=>{
    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link to="/" className="text-xl font-bold text-blue-600">Serwis IT</Link>
            <nav className="space-x-6">
                <Link to="/" className="text-gray-600 hover:text-blue-600 transition">Strona Główna</Link>
                <Link to="/sprawdz-zgloszenie" className="text-gray-600 hover:text-blue-600 transition">Sprawdź status</Link>
            </nav>
            </div>
        </header>

        <main className="flex-grow max-w-7xl w-full mx-auto p-6">
            <Outlet />
        </main>

        <footer className="bg-gray-800 text-white text-center py-4 text-sm">
            &copy; 2026 System Serwisowy IT
        </footer>
        </div>
    );
};