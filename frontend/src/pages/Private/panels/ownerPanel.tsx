import React from 'react';
import { ManagementTileGrid, type ManagementTile } from '../../../components/private/managementTileGrid';

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
  {
    id: 'clients',
    title: 'Klienci',
    description: 'Zarządzaj danymi klientów',
    icon: '',
    path: '/work/admin/company/clients',
    color: 'bg-indigo-50 text-indigo-600',
  },

];

export const OwnerPanel: React.FC = () => {
  return <ManagementTileGrid tiles={tiles} />;
};