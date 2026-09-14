import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const Dashboard: React.FC=()=>{
    const {user, logout} = useAuth();

    return(
        <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Panel Główny</h1>
        <p className="text-gray-600 mb-2">Zalogowany jako: <strong className="text-gray-900">{user?.username}</strong></p>
        <p className="text-gray-600 mb-6">Rola w systemie: <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-semibold">{user?.role}</span></p>
        
        <button onClick={logout} className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition">
          Wyloguj się
        </button>
      </div>
    </div>
    );
};