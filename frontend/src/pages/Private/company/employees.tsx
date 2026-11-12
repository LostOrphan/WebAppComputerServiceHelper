import React, { useEffect, useState } from 'react';
import api from '../../../api/axios';
import { EmployeeModal } from '../../../components/private/employeeModal';
import type { Employee, UserLocation } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import { getRoleLabel } from '../../../utils/roles';

type Location = UserLocation;

export const Employees: React.FC<{ branchOnly?: boolean }> = ({ branchOnly = false }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Stany filtrowania i modali
  const [selectedLocation, setSelectedLocation] = useState<string>(branchOnly ? String(user?.location || '') : 'ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Employee | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, locsRes] = await Promise.all([
        api.get<{ results: Employee[] }>('/accounts/users/'),
        api.get<{ results: Location[] }>('/accounts/locations/'),
      ]);
      setEmployees(usersRes.data.results);
      setLocations(branchOnly ? locsRes.data.results.filter(location => location.id === user?.location) : locsRes.data.results);
    } catch (err) {
      console.error('Błąd pobierania danych:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branchOnly, user?.location]);

  // Filtrowanie listy użytkowników
  const filteredEmployees = employees.filter((emp) => {
    if (selectedLocation === 'ALL') return true;
    if (selectedLocation === 'NONE') return emp.location === null;
    return emp.location?.id === Number(selectedLocation);
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: Employee) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Nagłówek i Akcje */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <h1 className="text-2xl font-bold text-slate-800">Zarządzanie Pracownikami</h1>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!branchOnly && <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Wszystkie oddziały</option>
            <option value="NONE">Bez oddziału</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>}

          {/* Przycisk Dodaj */}
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-sm whitespace-nowrap"
          >
            + Dodaj pracownika
          </button>
        </div>
      </div>

      {/* Tabela Pracowników */}
      <div className="bg-white rounded-xl shadow-sm border max-h-[calc(100vh-13rem)] overflow-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Ładowanie pracowników...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Brak pracowników dla wybranych kryteriów.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                <th className="p-4 font-semibold">Pracownik</th>
                <th className="p-4 font-semibold">Rola</th>
                <th className="p-4 font-semibold">Oddział</th>
                <th className="p-4 font-semibold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm text-slate-700">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div className="text-xs text-slate-400">@{emp.username}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {emp.role_display || getRoleLabel(emp.role)}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">
                    {emp.location?.name || '—'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1 rounded hover:bg-blue-50"
                    >
                      Edytuj
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Okno modalne */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        userToEdit={editingUser}
        locations={locations}
      />
    </div>
  );
};