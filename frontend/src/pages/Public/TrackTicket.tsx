import React, { useMemo, useState } from 'react';
import {
  getPublicTickets,
  requestPublicTrackingCode,
  verifyPublicTrackingCode,
} from '../../api/service';
import type { PublicTicketSummary, TicketStatus } from '../../types/service';

const statusOrder: TicketStatus[] = [
  'NEW',
  'DIAGNOSIS',
  'PARTS',
  'IN_PROGRESS',
  'READY',
  'CLOSED',
  'REJECTED',
];

const formatDate = (value: string) => new Date(value).toLocaleString('pl-PL');

export const TrackTicket: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [tickets, setTickets] = useState<PublicTicketSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const groupedTickets = useMemo(() => statusOrder
    .map(status => ({
      status,
      tickets: tickets.filter(ticket => ticket.status === status),
      label: tickets.find(ticket => ticket.status === status)?.status_display,
    }))
    .filter(group => group.tickets.length > 0), [tickets]);

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await requestPublicTrackingCode(email);
      setCodeRequested(true);
      setMessage(response.detail);
    } catch {
      setError('Nie udało się wysłać kodu. Sprawdź adres e-mail i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { tracking_token } = await verifyPublicTrackingCode(email, code);
      setTickets(await getPublicTickets(tracking_token));
      setMessage('');
    } catch {
      setError('Kod jest nieprawidłowy lub wygasł.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCodeRequested(false);
    setCode('');
    setTickets([]);
    setError('');
    setMessage('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="mx-auto max-w-lg rounded-lg bg-white p-8 shadow">
        <h2 className="text-xl font-bold text-slate-800">Sprawdź swoje zgłoszenia</h2>
        <p className="mt-2 text-sm text-slate-600">
          Otrzymasz jednorazowy kod na adres e-mail przypisany do zgłoszeń.
        </p>

        {error && <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

        {!codeRequested ? (
          <form onSubmit={handleRequestCode} className="mt-5 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Adres e-mail
              <input
                required
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 p-2"
              />
            </label>
            <button type="submit" disabled={loading} className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Wysyłanie...' : 'Wyślij kod'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-5 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Kod weryfikacyjny
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                className="mt-1 w-full rounded border border-slate-300 p-2 tracking-[0.35em]"
              />
            </label>
            <button type="submit" disabled={loading || code.length !== 6} className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Sprawdzanie...' : 'Pokaż zgłoszenia'}
            </button>
            <button type="button" onClick={reset} className="w-full rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Użyj innego adresu
            </button>
          </form>
        )}
      </section>

      {codeRequested && tickets.length === 0 && !loading && !error && (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
          Brak zgłoszeń przypisanych do tego adresu e-mail.
        </section>
      )}

      {groupedTickets.length > 0 && (
        <div className="space-y-5">
          {groupedTickets.map(group => (
            <section key={group.status} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b bg-slate-50 px-5 py-3 font-semibold text-slate-800">{group.label}</h2>
              <div className="divide-y">
                {group.tickets.map(ticket => (
                  <article key={ticket.id} className="p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-800">{ticket.ticket_code} · {ticket.device_name}</h3>
                        <p className="text-sm text-slate-600">Utworzono w: {ticket.location_name}</p>
                      </div>
                      <span className="w-fit rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{ticket.status_display}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p><b>Utworzono:</b> {formatDate(ticket.created_at)}</p>
                      <p><b>Ostatnia zmiana:</b> {formatDate(ticket.updated_at)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
