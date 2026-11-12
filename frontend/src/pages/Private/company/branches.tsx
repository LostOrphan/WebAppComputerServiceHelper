import React, { useEffect, useState } from 'react';
import api from '../../../api/axios';
import { BranchModal } from '../../../components/private/branchModal';
import type { Branch } from '../../../types/auth';

export const Branches: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const branchesResponse = await api.get<{ results: Branch[] }>('/accounts/locations/');
      setBranches(branchesResponse.data.results);
    } catch (error) {
      console.error('Błąd pobierania oddziałów:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditingBranch(null);
    setIsModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <h1 className="text-2xl font-bold text-slate-800">Zarządzanie oddziałami</h1>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition">
          + Dodaj oddział
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border max-h-[calc(100vh-13rem)] overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Ładowanie oddziałów...</div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Brak oddziałów.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                <th className="p-4 font-semibold">Nazwa</th>
                <th className="p-4 font-semibold">Adres</th>
                <th className="p-4 font-semibold">Telefon</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm text-slate-700">
              {branches.map((branch) => (
                <tr key={branch.id} className={branch.is_active ? 'hover:bg-slate-50' : 'bg-  -50 text-slate-400'}>
                  <td className="p-4 font-semibold text-slate-900">{branch.name}</td>
                  <td className="p-4">{branch.address}, {branch.postal_code} {branch.city.name}</td>
                  <td className="p-4">{branch.phone_number || '—'}</td>
                  <td className="p-4">{branch.is_active ? 'Aktywny' : 'Nieaktywny'}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEdit(branch)} className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1 rounded hover:bg-blue-50">
                      Edytuj
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <BranchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        branchToEdit={editingBranch}
      />
    </div>
  );
};