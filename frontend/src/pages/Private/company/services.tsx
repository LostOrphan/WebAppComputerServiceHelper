import React, { useEffect, useState } from 'react';
import {
  createServicePricing,
  getServicePricing,
  updateServicePricing,
} from '../../../api/service';
import type { ServicePricing } from '../../../types/service';

type ServiceForm = {
  name: string;
  description: string;
  default_price: string;
  is_active: boolean;
};

const emptyForm: ServiceForm = {
  name: '',
  description: '',
  default_price: '',
  is_active: true,
};

export const Services: React.FC = () => {
  const [services, setServices] = useState<ServicePricing[]>([]);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [editingService, setEditingService] = useState<ServicePricing | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      setServices(await getServicePricing());
      setError('');
    } catch {
      setError('Nie udało się pobrać usług.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchServices();
  }, []);

  const openCreate = () => {
    setEditingService(null);
    setForm(emptyForm);
    setError('');
    setIsFormOpen(true);
  };

  const openEdit = (service: ServicePricing) => {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description ?? '',
      default_price: service.default_price,
      is_active: service.is_active,
    });
    setError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (!isSaving) setIsFormOpen(false);
  };

  const updateForm = <K extends keyof ServiceForm>(field: K, value: ServiceForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      if (editingService) {
        const updated = await updateServicePricing(editingService.id, form);
        setServices(current => current.map(service => (
          service.id === updated.id ? updated : service
        )));
      } else {
        const created = await createServicePricing(form);
        setServices(current => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      }
      setIsFormOpen(false);
    } catch {
      setError('Nie udało się zapisać usługi. Sprawdź nazwę i cenę.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cennik usług</h1>
          <p className="text-sm text-slate-500">Domyślne ceny usług dla całej firmy</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + Dodaj usługę
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="overflow-auto rounded-xl border bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Ładowanie usług...</div>
        ) : services.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Brak zdefiniowanych usług.</div>
        ) : (
          <table className="w-full min-w-160 border-collapse text-left">
            <thead>
              <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <th className="p-4 font-semibold">Usługa</th>
                <th className="p-4 font-semibold">Opis</th>
                <th className="p-4 font-semibold">Cena domyślna</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 text-right font-semibold">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm text-slate-700">
              {services.map(service => (
                <tr key={service.id} className="hover:bg-slate-50">
                  <td className="p-4 font-semibold text-slate-900">{service.name}</td>
                  <td className="max-w-sm p-4 text-slate-600">{service.description || '—'}</td>
                  <td className="whitespace-nowrap p-4 font-medium">{service.default_price} PLN</td>
                  <td className="p-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${service.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {service.is_active ? 'Aktywna' : 'Nieaktywna'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
                      className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800"
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

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={submitForm} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold text-slate-800">
                {editingService ? 'Edytuj usługę' : 'Dodaj usługę'}
              </h2>
              <button type="button" onClick={closeForm} disabled={isSaving} aria-label="Zamknij" className="text-2xl leading-none text-slate-400 hover:text-slate-700 disabled:opacity-50">
                ×
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nazwa usługi</label>
              <input required value={form.name} onChange={event => updateForm('name', event.target.value)} className="w-full rounded border border-slate-300 p-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Opis</label>
              <textarea value={form.description} onChange={event => updateForm('description', event.target.value)} className="min-h-24 w-full rounded border border-slate-300 p-2" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cena domyślna (PLN)</label>
              <input required min="0" step="0.01" type="number" value={form.default_price} onChange={event => updateForm('default_price', event.target.value)} className="w-full rounded border border-slate-300 p-2" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_active} onChange={event => updateForm('is_active', event.target.checked)} />
              Usługa aktywna
            </label>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button type="button" onClick={closeForm} disabled={isSaving} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Anuluj</button>
              <button type="submit" disabled={isSaving} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {isSaving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
