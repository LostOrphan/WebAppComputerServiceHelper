import React, { useEffect, useState } from 'react';
import { createLocationServicePrice, getLocationServicePrices, getServicePricing, updateLocationServicePrice } from '../../../api/service';
import { useAuth } from '../../../context/AuthContext';
import type { LocationServicePrice, ServicePricing } from '../../../types/service';

type ServiceRow = { service: ServicePricing; override: LocationServicePrice | null; price: string; isAvailable: boolean };

export const BranchServices: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadServices = async () => {
    setIsLoading(true);
    try {
      const [services, overrides] = await Promise.all([getServicePricing(), getLocationServicePrices()]);
      const overrideByService = new Map(overrides.map(override => [override.service, override]));
      setRows(services.map(service => {
        const override = overrideByService.get(service.id) ?? null;
        return {
          service,
          override,
          price: override?.effective_price ?? service.price,
          isAvailable: override?.is_available ?? service.is_available,
        };
      }));
    } catch {
      setError('Nie udało się pobrać cennika oddziału.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadServices(); }, []);

  const updateRow = (serviceId: number, field: 'price' | 'isAvailable', value: string | boolean) => {
    setRows(current => current.map(row => row.service.id === serviceId ? { ...row, [field]: value } : row));
  };

  const saveServices = async () => {
    if (!user?.location) return;
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      await Promise.all(rows.map(row => row.override
        ? updateLocationServicePrice(row.override.id, { custom_price: row.price, is_available: row.isAvailable })
        : createLocationServicePrice({ location: user.location as number, service: row.service.id, custom_price: row.price, is_available: row.isAvailable })
      ));
      setMessage('Cennik oddziału został zapisany.');
      await loadServices();
    } catch {
      setError('Nie udało się zapisać cennika oddziału.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="rounded-xl border bg-white p-5 shadow-sm"><h1 className="text-2xl font-bold text-slate-800">Cennik usług oddziału</h1><p className="mt-1 text-sm text-slate-500">Ceny i dostępność usług dla {user?.location_name || 'Twojego oddziału'}.</p></header>
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      {message && <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">{message}</div>}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        {isLoading ? <p className="p-8 text-center text-slate-500">Ładowanie cennika...</p> : (
          <table className="w-full min-w-180 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Usługa</th><th className="p-4">Cena firmowa</th><th className="p-4">Cena oddziału</th><th className="p-4">Dostępna</th></tr></thead><tbody className="divide-y">
            {rows.map(row => <tr key={row.service.id}><td className="p-4"><div className="font-medium text-slate-900">{row.service.name}</div><div className="text-xs text-slate-500">{row.service.description || 'Brak opisu'}</div></td><td className="p-4">{row.service.default_price} PLN</td><td className="p-4"><input type="number" min="0" step="0.01" value={row.price} onChange={event => updateRow(row.service.id, 'price', event.target.value)} className="w-32 rounded border border-slate-300 p-2" /></td><td className="p-4"><label className="flex items-center gap-2"><input type="checkbox" checked={row.isAvailable} onChange={event => updateRow(row.service.id, 'isAvailable', event.target.checked)} /> Tak</label></td></tr>)}
          </tbody></table>
        )}
      </div>
      <div className="flex justify-end"><button type="button" disabled={isSaving || isLoading} onClick={() => void saveServices()} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">{isSaving ? 'Zapisywanie...' : 'Zapisz cennik'}</button></div>
    </div>
  );
};
