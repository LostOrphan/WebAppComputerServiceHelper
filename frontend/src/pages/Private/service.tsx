import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient, createTicket, getClients, getTickets } from '../../api/service';
import { useAuth } from '../../context/AuthContext';
import type { ClientOption, Ticket, TicketStatus } from '../../types/service';

const activeStatuses: TicketStatus[] = ['NEW', 'DIAGNOSIS', 'PARTS', 'IN_PROGRESS', 'READY'];
const statusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: 'NEW', label: 'Nowe (Przyjęte)' },
  { value: 'DIAGNOSIS', label: 'W trakcie diagnozy' },
  { value: 'PARTS', label: 'Oczekiwanie na części' },
  { value: 'IN_PROGRESS', label: 'W trakcie naprawy' },
  { value: 'READY', label: 'Gotowe do odbioru' },
  { value: 'CLOSED', label: 'Zakończone / Odebrane' },
  { value: 'REJECTED', label: 'Odrzucone / Rezygnacja' },
];

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone_number: '',
  device_name: '',
  serial_number: '',
  device_passcode: '',
  problem_description: '',
};

const normalizePolishPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0048')) return digits.slice(2);
  if (digits.length === 9) return `48${digits}`;
  return digits;
};

export const Service: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [suggestedClients, setSuggestedClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [clientLookup, setClientLookup] = useState<{ type: 'phone' | 'email'; value: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL' | TicketStatus>('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const statuses = statusFilter === 'ACTIVE'
        ? activeStatuses
        : statusFilter === 'ALL'
          ? undefined
          : [statusFilter];
      const page = await getTickets(search, statuses, 1);
      setTickets(page.results);
      setNextPage(2);
      setHasMore(Boolean(page.next));
      setError('');
    } catch {
      setError('Nie udało się pobrać zgłoszeń.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [search, statusFilter]);

  const loadMoreTickets = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const statuses = statusFilter === 'ACTIVE' ? activeStatuses : statusFilter === 'ALL' ? undefined : [statusFilter];
      const page = await getTickets(search, statuses, nextPage);
      setTickets(current => [...current, ...page.results.filter(item => !current.some(existing => existing.id === item.id))]);
      setNextPage(current => current + 1);
      setHasMore(Boolean(page.next));
    } catch {
      setError('Nie udało się pobrać kolejnych zgłoszeń.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver(() => void loadMoreTickets(), { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, nextPage, search, statusFilter, loadingMore]);

  const openCreateModal = () => {
    setShowCreate(true);
    setError('');
  };

  const clearCreateForm = () => {
    setForm(emptyForm);
    setSuggestedClients([]);
    setSelectedClient(null);
    setClientLookup(null);
    setError('');
  };

  useEffect(() => {
    if (!clientLookup) {
      setSuggestedClients([]);
      setIsSearchingClient(false);
      return;
    }

    const query = clientLookup.type === 'phone'
      ? normalizePolishPhone(clientLookup.value.trim())
      : clientLookup.value.trim().toLowerCase();
    const isValidQuery = clientLookup.type === 'phone'
      ? query.length >= 3
      : query.includes('@');
    if (!isValidQuery) {
      setSuggestedClients([]);
      setIsSearchingClient(false);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingClient(true);
      try {
        const matches = (await getClients(query)).results;
        if (!isCancelled) {
          setSuggestedClients(matches);
        }
      } catch {
        if (!isCancelled) setSuggestedClients([]);
      } finally {
        if (!isCancelled) setIsSearchingClient(false);
      }
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [clientLookup]);

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.location) return;

    try {
      const client = selectedClient ?? await createClient({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || undefined,
        phone_number: `+${normalizePolishPhone(form.phone_number)}`,
      });
      const ticket = await createTicket({
        ...form,
        client: client.id,
        location: user.location,
      });
      setTickets(current => [ticket, ...current]);
      setForm(emptyForm);
      setSuggestedClients([]);
      setSelectedClient(null);
      setClientLookup(null);
      setShowCreate(false);
      setError('');
    } catch {
      setError('Nie udało się utworzyć zgłoszenia.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Zgłoszenia serwisowe</h1>
          <p className="text-sm text-slate-500">
            Oddział: {user?.location_name ?? 'wszystkie lokalizacje'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Szukaj zgłoszenia, klienta lub e-maila..."
            className="w-full rounded border border-slate-300 px-3 py-2 sm:w-80"
          />
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as 'ACTIVE' | 'ALL' | TicketStatus)}
            className="rounded border border-slate-300 bg-white px-3 py-2"
            aria-label="Filtruj po statusie"
          >
            <option value="ACTIVE">Aktywne</option>
            <option value="ALL">Wszystkie statusy</option>
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void openCreateModal()}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Nowe zgłoszenie
          </button>
        </div>
      </header>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b p-4 font-semibold">Istniejące zgłoszenia ({tickets.length})</div>
        {loading ? (
          <p className="p-8 text-center text-slate-500">Ładowanie zgłoszeń...</p>
        ) : tickets.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Brak zgłoszeń w tej lokalizacji.</p>
        ) : (
          <div className="divide-y">
            {tickets.map(ticket => (
              <article key={ticket.id} className="p-4 hover:bg-slate-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {ticket.ticket_code} · {ticket.device_name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {ticket.client.first_name} {ticket.client.last_name}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {ticket.status_display}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{ticket.problem_description}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {ticket.assigned_worker
                    ? `Przypisany pracownik: ${ticket.assigned_worker.full_name}`
                    : 'Nieprzypisane'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/work/service/${ticket.id}`)}
                  className="mt-3 rounded border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  Szczegóły
                </button>
              </article>
            ))}
          </div>
        )}
        {hasMore && <div ref={loadMoreRef} className="p-3 text-center text-sm text-slate-500">{loadingMore ? 'Ładowanie...' : 'Przewiń, aby załadować więcej...'}</div>}
      </section>

      {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-6xl">
          <form onSubmit={submitTicket} className="mx-auto w-full max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Nowe zgłoszenie</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Zamknij"
                className="text-2xl leading-none text-slate-500 hover:text-slate-800"
              >
                ×
              </button>
            </div>

            <input
              required
              type="tel"
              placeholder="Numer telefonu"
              value={form.phone_number}
              onChange={event => {
                setForm(current => ({ ...current, phone_number: event.target.value }));
                setClientLookup({ type: 'phone', value: event.target.value });
              setSuggestedClients([]);
                setSelectedClient(null);
              }}
              className="w-full rounded border border-slate-300 p-2"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                required
                placeholder="Imię klienta"
                value={form.first_name}
                onChange={event => setForm(current => ({ ...current, first_name: event.target.value }))}
                readOnly={Boolean(selectedClient)}
                className="rounded border border-slate-300 p-2"
              />
              <input
                required
                placeholder="Nazwisko klienta"
                value={form.last_name}
                onChange={event => setForm(current => ({ ...current, last_name: event.target.value }))}
                readOnly={Boolean(selectedClient)}
                className="rounded border border-slate-300 p-2"
              />
            </div>
            <input
              type="email"
              placeholder="Adres e-mail"
              value={form.email}
              onChange={event => {
                setForm(current => ({ ...current, email: event.target.value }));
                setClientLookup({ type: 'email', value: event.target.value });
                setSuggestedClients([]);
                setSelectedClient(null);
              }}
              readOnly={Boolean(selectedClient)}
              className="w-full rounded border border-slate-300 p-2"
            />

            <input
              required
              placeholder="Urządzenie"
              value={form.device_name}
              onChange={event => setForm({ ...form, device_name: event.target.value })}
              className="w-full rounded border border-slate-300 p-2"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                placeholder="Numer seryjny"
                value={form.serial_number}
                onChange={event => setForm({ ...form, serial_number: event.target.value })}
                className="rounded border border-slate-300 p-2"
              />
              <input
                placeholder="Hasło do urządzenia"
                value={form.device_passcode}
                onChange={event => setForm({ ...form, device_passcode: event.target.value })}
                className="rounded border border-slate-300 p-2"
              />
            </div>
            <textarea
              required
              placeholder="Opis problemu"
              value={form.problem_description}
              onChange={event => setForm({ ...form, problem_description: event.target.value })}
              className="min-h-28 w-full rounded border border-slate-300 p-2"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={clearCreateForm}
                className="flex-1 rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Wyczyść
              </button>
              <button className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                Utwórz zgłoszenie
              </button>
            </div>
          </form>
          {(isSearchingClient || suggestedClients.length > 0) && (
            <aside className="mt-4 max-h-28rem w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl md:absolute md:left-[calc(50%+17rem)] md:top-6 md:mt-0 md:w-72">
              {isSearchingClient ? (
                <p className="text-sm text-slate-500">Sprawdzanie klienta...</p>
              ) : (
                <>
                  <p className="mb-3 text-sm font-semibold text-slate-800">
                    Znaleziono klientów ({suggestedClients.length})
                  </p>
                  <div className="space-y-3">
                    {suggestedClients.map(client => (
                      <div key={client.id} className="rounded border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-800">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {client.email || client.phone_number}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setForm(current => ({
                                ...current,
                                first_name: client.first_name,
                                last_name: client.last_name,
                                email: client.email ?? '',
                                phone_number: client.phone_number ?? '',
                              }));
                              setSelectedClient(client);
                              setSuggestedClients([]);
                              setClientLookup(null);
                            }}
                            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            Użyj danych
                          </button>
                          <button
                            type="button"
                            onClick={() => setSuggestedClients(current => current.filter(item => item.id !== client.id))}
                            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Odrzuć
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </aside>
          )}
          </div>
        </div>
      )}
    </div>
  );
};
