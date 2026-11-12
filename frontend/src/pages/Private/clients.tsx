import React, { useEffect, useRef, useState } from 'react';
import { anonymizeClient, createClient, getManagedClients, updateClient } from '../../api/service';
import type { ManagedClient } from '../../types/service';

type ClientForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
};

const emptyForm: ClientForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone_number: '',
};

export const Clients: React.FC<{ branchOnly?: boolean }> = ({ branchOnly = false }) => {
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [editingClient, setEditingClient] = useState<ManagedClient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const page = await getManagedClients(search, 1);
      setClients(page.results);
      setNextPage(2);
      setHasMore(Boolean(page.next));
      setError(null);
    } catch {
      setError('Nie udało się pobrać listy klientów.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(loadClients, 250);
    return () => window.clearTimeout(timeout);
  }, [search, branchOnly]);

  const loadMoreClients = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getManagedClients(search, nextPage);
      setClients(current => [...current, ...page.results.filter(item => !current.some(existing => existing.id === item.id))]);
      setNextPage(current => current + 1);
      setHasMore(Boolean(page.next));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver(() => void loadMoreClients(), { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, nextPage, search, loadingMore]);

  const openCreate = () => {
    setEditingClient(null);
    setForm(emptyForm);
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (client: ManagedClient) => {
    setEditingClient(client);
    setForm({
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email || '',
      phone_number: client.phone_number || '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('Imię i nazwisko są wymagane.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
      };
      if (editingClient) {
        await updateClient(editingClient.id, payload);
      } else {
        await createClient(payload);
      }
      setIsModalOpen(false);
      await loadClients();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Nie udało się zapisać danych klienta.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (client: ManagedClient) => {
    if (!window.confirm(`Czy na pewno zanonimizować klienta ${client.full_name}?`)) return;
    try {
      await anonymizeClient(client.id);
      await loadClients();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Nie udało się zanonimizować klienta.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{branchOnly ? 'Klienci oddziału' : 'Klienci firmy'}</h1>
          <p className="mt-1 text-sm text-slate-500">Dane kontaktowe i historia aktywnych zgłoszeń.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Dodaj klienta
        </button>
      </header>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Szukaj po imieniu, nazwisku, telefonie lub e-mailu"
            className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-md"
          />
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Ładowanie klientów...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Brak klientów.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4">Klient</th>
                  <th className="p-4">Kontakt</th>
                  <th className="p-4">Aktywne zgłoszenia</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-900">{client.full_name}</td>
                    <td className="p-4 text-slate-600">
                      <div>{client.email || '—'}</div>
                      <div>{client.phone_number || '—'}</div>
                    </td>
                    <td className="p-4 text-slate-600">{client.active_tickets_count}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${client.is_anonymized ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        {client.is_anonymized ? 'Zanonimizowany' : 'Aktywny'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {!client.is_anonymized && (
                        <>
                          <button onClick={() => openEdit(client)} className="mr-3 text-blue-600 hover:text-blue-800">Edytuj</button>
                          <button onClick={() => remove(client)} className="text-red-600 hover:text-red-800">Usuń</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && <div ref={loadMoreRef} className="p-3 text-center text-sm text-slate-500">{loadingMore ? 'Ładowanie...' : 'Przewiń, aby załadować więcej...'}</div>}
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">{editingClient ? 'Edytuj klienta' : 'Dodaj klienta'}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-500">✕</button>
            </div>
            {(['first_name', 'last_name', 'email', 'phone_number'] as const).map(field => (
              <label key={field} className="block text-sm font-medium text-slate-700">
                {field === 'first_name' ? 'Imię' : field === 'last_name' ? 'Nazwisko' : field === 'email' ? 'E-mail' : 'Telefon'}
                <input
                  type={field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={event => setForm(current => ({ ...current, [field]: event.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
                />
              </label>
            ))}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Anuluj</button>
              <button disabled={isSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {isSaving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
