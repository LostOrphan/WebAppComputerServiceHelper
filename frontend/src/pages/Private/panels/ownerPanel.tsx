import React from 'react';
import { Link } from 'react-router-dom';

interface ManagementTile {
  id: string;
  title: string;
  description: string;
  icon: string; // Możesz podmienić na ikony z lucide-react lub heroicons
  path: string;
  color: string; // Kolor tła akcentu ikony
}

const tiles: ManagementTile[] = [
  {
    id: 'employees',
    title: 'Pracownicy',
    description: 'Zarządzaj pracownikami',
    icon: '',
    path: '/work/admin/company/employees',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    id: 'locations',
    title: 'Oddziały',
    description: 'Zarządzaj oddziałami firmy',
    icon: '',
    path: '/work/admin/company/branches',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    id: 'warehouse',
    title: 'Magazyn',
    description: 'Zarządzaj magazynami oddziałów',
    icon: '',
    path: '/work/admin/company/warehouses',
    color: 'bg-amber-50 text-amber-600',
  },
  // {
  //   id: 'orders',
  //   title: 'Zlecenia Serwisowe',
  //   description: 'Przeglądaj zlecenia serwisowe',
  //   icon: '',
  //   path: '/work/admin/company/orders',
  //   color: 'bg-purple-50 text-purple-600',
  // },
  {
    id: 'services',
    title: 'Cennik usług',
    description: 'Zarządzaj usługami i cenami firmy',
    icon: '',
    path: '/work/admin/company/services',
    color: 'bg-cyan-50 text-cyan-600',
  },

];

export const OwnerPanel: React.FC = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto p-4">
      {tiles.map((tile) => (
        <Link
          key={tile.id}
          to={tile.path}
          className="aspect-square bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-500 hover:-translate-y-1 transition-all duration-200 flex flex-col items-center justify-center text-center group"
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110 ${tile.color}`}>
            {tile.icon}
          </div>

          <h3 className="font-bold text-slate-800 text-base md:text-lg mb-1 group-hover:text-blue-600 transition-colors">
            {tile.title}
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 px-2">
            {tile.description}
          </p>
        </Link>
      ))}
    </div>
  );
};