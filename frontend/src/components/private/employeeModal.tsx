import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import type { Employee, User, UserLocation } from '../../types/auth';

type Location = UserLocation;

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit: Employee | null;
  locations: Location[];
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen, onClose, onSuccess, userToEdit, locations
}) => {
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    role: 'TECHNICIAN' as User['role'],
    location: '' as string | number,
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userToEdit) {
      setFormData({
        username: userToEdit.username,
        first_name: userToEdit.first_name || '',
        last_name: userToEdit.last_name || '',
        role: userToEdit.role,
        location: userToEdit.location?.id || '',
        password: '', // Puste = bez zmiany hasła
      });
    } else {
      setFormData({ username: '', first_name: '', last_name: '', role: 'TECHNICIAN', location: '', password: '' });
    }
    setError(null);
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload: Record<string, string | number | null> = {
      ...formData,
      location: formData.location ? Number(formData.location) : null,
    };

    // Usuwamy puste hasło przy edycji
    if (userToEdit && !payload.password) {
      delete payload.password;
    }

    try {
      if (userToEdit) {
        await api.patch(`/accounts/users/${userToEdit.id}/`, payload);
      } else {
        await api.post('/accounts/users/', payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const responseData = err.response?.data;
      const validationMessage = responseData && typeof responseData === 'object'
        ? Object.values(responseData).flat().join(' ')
        : null;
      setError(validationMessage || 'Błąd zapisywania danych.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToEdit) return;

    const confirmed = window.confirm(
      `Czy na pewno chcesz zarchiwizować użytkownika "${userToEdit.username}"?`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.patch(`/accounts/users/${userToEdit.id}/`, {
        username: `ARCHIVED_${userToEdit.username}`,
        is_active: false,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      const responseData = err.response?.data;
      const validationMessage = responseData && typeof responseData === 'object'
        ? Object.values(responseData).flat().join(' ')
        : null;
      setError(validationMessage || 'Błąd archiwizowania użytkownika.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">
          {userToEdit ? 'Edytuj pracownika' : 'Dodaj nowego pracownika'}
        </h2>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Login (Username)</label>
            <input
              type="text"
              required
            //   disabled={!!userToEdit} // Login zablokowany przy edycji
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm disabled:bg-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Imię</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nazwisko</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {userToEdit ? 'Nowe hasło (pozostaw puste, by nie zmieniać)' : 'Hasło'}
            </label>
            <input
              type="password"
              required={!userToEdit}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Rola</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                className="w-full border rounded-lg p-2 text-sm"
              >
                <option value="TECHNICIAN">Serwisant</option>
                <option value="MANAGER">Kierownictwo wydziału</option>
                <option value="OWNER">Szefostwo firmy</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Oddział</label>
              <select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm"
              >
                <option value="">Brak (Ogólne)</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
                
          <div className="flex justify-end space-x-2 pt-4 border-t">
            {userToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 mr-auto text-sm text-white bg-red-500 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                Usuń
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Anuluj
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};