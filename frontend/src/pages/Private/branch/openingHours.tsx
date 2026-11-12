import React, { useEffect, useState } from 'react';
import api from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import type { OpeningHours } from '../../../types/auth';

export const BranchOpeningHours: React.FC = () => {
  const { user } = useAuth();
  const [hours, setHours] = useState<OpeningHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadHours = async () => {
    if (!user?.location) return;
    setIsLoading(true);
    try {
      const response = await api.get<{ results: OpeningHours[] }>('/accounts/opening-hours/', { params: { location: user.location } });
      setHours(response.data.results);
    } catch {
      setError('Nie udało się pobrać godzin otwarcia.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadHours(); }, [user?.location]);

  const updateHour = (id: number, field: keyof Pick<OpeningHours, 'opens_at' | 'closes_at' | 'is_closed'>, value: string | boolean) => {
    setHours(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const saveHours = async () => {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      await Promise.all(hours.map(item => api.patch(`/accounts/opening-hours/${item.id}/`, {
        opens_at: item.is_closed ? null : item.opens_at?.slice(0, 5),
        closes_at: item.is_closed ? null : item.closes_at?.slice(0, 5),
        is_closed: item.is_closed,
      })));
      setMessage('Godziny otwarcia zostały zapisane.');
      await loadHours();
    } catch (err: any) {
      setError(err.response?.data?.non_field_errors?.[0] || 'Nie udało się zapisać godzin otwarcia.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Godziny otwarcia oddziału</h1>
        <p className="mt-1 text-sm text-slate-500">{user?.location_name || 'Twój oddział'}</p>
      </header>
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      {message && <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">{message}</div>}
      <section className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        {isLoading ? <p className="p-8 text-center text-slate-500">Ładowanie godzin...</p> : (
          <table className="w-full min-w-140 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Dzień</th><th className="p-4">Otwarcie</th><th className="p-4">Zamknięcie</th><th className="p-4">Status</th></tr></thead>
            <tbody className="divide-y">
              {hours.map(item => (
                <tr key={item.id}>
                  <td className="p-4 font-medium text-slate-800">{item.weekday_name}</td>
                  <td className="p-4"><input type="time" value={item.opens_at?.slice(0, 5) || ''} disabled={item.is_closed} onChange={event => updateHour(item.id, 'opens_at', event.target.value)} className="rounded border border-slate-300 p-2 disabled:bg-slate-100" /></td>
                  <td className="p-4"><input type="time" value={item.closes_at?.slice(0, 5) || ''} disabled={item.is_closed} onChange={event => updateHour(item.id, 'closes_at', event.target.value)} className="rounded border border-slate-300 p-2 disabled:bg-slate-100" /></td>
                  <td className="p-4"><label className="flex items-center gap-2"><input type="checkbox" checked={item.is_closed} onChange={event => updateHour(item.id, 'is_closed', event.target.checked)} /> Zamknięte</label></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div className="flex justify-end"><button type="button" disabled={isSaving || isLoading} onClick={() => void saveHours()} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">{isSaving ? 'Zapisywanie...' : 'Zapisz godziny'}</button></div>
    </div>
  );
};
