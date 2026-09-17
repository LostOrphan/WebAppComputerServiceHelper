import React, { useEffect, useState } from 'react';
import { addTicketPart, changeTicketStatus, claimTicket, createTicket, getClients, getParts, getTickets, updateTicket } from '../../api/service';
import { useAuth } from '../../context/AuthContext';
import type { ClientOption, PartOption, Ticket, TicketStatus } from '../../types/service';

const nextStatuses: Partial<Record<TicketStatus, TicketStatus[]>> = {
  DIAGNOSIS: ['IN_PROGRESS', 'PARTS', 'REJECTED'],
  PARTS: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['READY', 'PARTS', 'REJECTED'],
  READY: ['CLOSED'],
};

export const Service: React.FC = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [parts, setParts] = useState<PartOption[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ client: '', device_name: '', serial_number: '', device_passcode: '', problem_description: '' });

  const loadTickets = async () => {
    try { setTickets(await getTickets(search)); setError(''); } catch { setError('Nie udało się pobrać zgłoszeń.'); }
  };
  useEffect(() => { void loadTickets(); }, [search]);
  useEffect(() => { void Promise.all([getClients(), getParts()]).then(([clientData, partData]) => { setClients(clientData); setParts(partData); }); }, []);

  const applyTicket = (ticket: Ticket) => { setSelected(ticket); setTickets(current => current.map(item => item.id === ticket.id ? ticket : item)); };
  const run = async (action: () => Promise<Ticket>) => { try { applyTicket(await action()); } catch { setError('Operacja nie powiodła się.'); } };

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.location) return;
    try {
      const ticket = await createTicket({ ...form, client: Number(form.client), location: user.location });
      setShowCreate(false); setForm({ client: '', device_name: '', serial_number: '', device_passcode: '', problem_description: '' });
      setTickets(current => [ticket, ...current]); setSelected(ticket);
    } catch { setError('Nie udało się utworzyć zgłoszenia.'); }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-bold text-slate-800">Zgłoszenia serwisowe</h1><p className="text-sm text-slate-500">Oddział: {user?.location_name ?? 'wszystkie lokalizacje'}</p></div>
      <div className="flex gap-2"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Szukaj zgłoszenia..." className="rounded border border-slate-300 px-3 py-2" /><button onClick={() => setShowCreate(true)} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Nowe zgłoszenie</button></div>
    </header>
    {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b p-4 font-semibold">Kolejka ({tickets.length})</div>
        {tickets.length === 0 ? <p className="p-8 text-center text-slate-500">Brak zgłoszeń w tej lokalizacji.</p> : <div className="divide-y">{tickets.map(ticket => <button key={ticket.id} onClick={() => setSelected(ticket)} className={`w-full p-4 text-left hover:bg-slate-50 ${selected?.id === ticket.id ? 'bg-blue-50' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{ticket.ticket_code} · {ticket.device_name}</p><p className="text-sm text-slate-500">{ticket.client.first_name} {ticket.client.last_name}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{ticket.status_display}</span></div><p className="mt-2 line-clamp-2 text-sm text-slate-600">{ticket.problem_description}</p><p className="mt-2 text-xs text-slate-400">{ticket.assigned_worker ? `Pracuje: ${ticket.assigned_worker.full_name}` : 'Nieprzypisane'}</p></button>)}</div>}
      </section>
      <TicketDetails ticket={selected} parts={parts} onClaim={ticket => void run(() => claimTicket(ticket.id))} onStatus={(ticket, status) => void run(() => changeTicketStatus(ticket.id, status))} onSave={(ticket, note) => void run(() => updateTicket(ticket.id, { diagnosis_note: note }))} onAddPart={(ticket, part, quantity) => void run(async () => { await addTicketPart(ticket.id, part, quantity); return (await getTickets(search)).find(item => item.id === ticket.id) as Ticket; })} />
    </div>
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={submitTicket} className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-xl"><div className="flex justify-between"><h2 className="text-xl font-bold">Nowe zgłoszenie</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="Zamknij">×</button></div><select required value={form.client} onChange={event => setForm({ ...form, client: event.target.value })} className="w-full rounded border p-2"><option value="">Wybierz klienta</option>{clients.map(client => <option key={client.id} value={client.id}>{client.first_name} {client.last_name} {client.phone_number ?? ''}</option>)}</select><input required placeholder="Urządzenie" value={form.device_name} onChange={event => setForm({ ...form, device_name: event.target.value })} className="w-full rounded border p-2" /><div className="grid grid-cols-2 gap-3"><input placeholder="Numer seryjny" value={form.serial_number} onChange={event => setForm({ ...form, serial_number: event.target.value })} className="rounded border p-2" /><input placeholder="Hasło do urządzenia" value={form.device_passcode} onChange={event => setForm({ ...form, device_passcode: event.target.value })} className="rounded border p-2" /></div><textarea required placeholder="Opis problemu" value={form.problem_description} onChange={event => setForm({ ...form, problem_description: event.target.value })} className="min-h-28 w-full rounded border p-2" /><button className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white">Utwórz zgłoszenie</button></form></div>}
  </div>;
};

const TicketDetails: React.FC<{ ticket: Ticket | null; parts: PartOption[]; onClaim: (ticket: Ticket) => void; onStatus: (ticket: Ticket, status: TicketStatus) => void; onSave: (ticket: Ticket, note: string) => void; onAddPart: (ticket: Ticket, part: number, quantity: number) => void }> = ({ ticket, parts, onClaim, onStatus, onSave, onAddPart }) => {
  const [note, setNote] = useState(''); const [part, setPart] = useState(''); const [quantity, setQuantity] = useState(1);
  useEffect(() => { setNote(ticket?.diagnosis_note ?? ''); }, [ticket]);
  if (!ticket) return <section className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Wybierz zgłoszenie, aby rozpocząć pracę.</section>;
  return <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm text-slate-500">{ticket.ticket_code}</p><h2 className="text-xl font-bold">{ticket.device_name}</h2><p className="text-sm text-slate-600">{ticket.client.first_name} {ticket.client.last_name} · {ticket.client.phone_number ?? 'brak telefonu'}</p></div><div className="rounded bg-slate-50 p-3 text-sm text-slate-700">{ticket.problem_description}</div><div className="flex flex-wrap gap-2">{!ticket.assigned_worker && ticket.status === 'NEW' && <button onClick={() => onClaim(ticket)} className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Przyjmij zgłoszenie</button>}{ticket.assigned_worker && nextStatuses[ticket.status]?.map(status => <button key={status} onClick={() => onStatus(ticket, status)} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white">Przejdź: {status}</button>)}</div><label className="block text-sm font-medium text-slate-700">Notatka diagnostyczna<textarea value={note} onChange={event => setNote(event.target.value)} className="mt-1 min-h-28 w-full rounded border p-2" /><button onClick={() => onSave(ticket, note)} className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm">Zapisz notatkę</button></label><div className="border-t pt-4"><h3 className="font-semibold">Części do rozliczenia</h3><div className="mt-2 flex gap-2"><select value={part} onChange={event => setPart(event.target.value)} className="min-w-0 grow rounded border p-2"><option value="">Wybierz część</option>{parts.map(item => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select><input type="number" min="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="w-16 rounded border p-2" /><button disabled={!part} onClick={() => onAddPart(ticket, Number(part), quantity)} className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50">Dodaj</button></div>{ticket.used_parts.map(item => <p key={item.id} className="mt-2 text-sm text-slate-600">{item.part.name} × {item.quantity} · {item.total_price.toFixed(2)} PLN</p>)}</div></section>;
};