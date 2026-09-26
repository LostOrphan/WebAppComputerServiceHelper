import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addTicketPart, addTicketService, changeTicketStatus, claimTicket, deleteTicketPart, deleteTicketService, getServicePricing, getTicket, updateTicket, updateTicketCosts } from '../../api/service';
import { getStocks } from '../../api/inventory';
import type { Stock } from '../../types/inventory';
import type { ServicePricing, Ticket, TicketStatus } from '../../types/service';

const formatDate = (value: string) => new Date(value).toLocaleString('pl-PL');
const workStatuses: TicketStatus[] = ['PARTS', 'IN_PROGRESS'];

type EstimateService = { key: string; id?: number; name: string; price: string; persisted: boolean };
type EstimatePart = { key: string; id?: number; partId: number; name: string; sku: string; price: string; quantity: number; persisted: boolean };

export const TicketDetails: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [services, setServices] = useState<ServicePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [customEstimate, setCustomEstimate] = useState('');
  const [estimateServices, setEstimateServices] = useState<EstimateService[]>([]);
  const [estimateParts, setEstimateParts] = useState<EstimatePart[]>([]);
  const [removedServices, setRemovedServices] = useState<number[]>([]);
  const [removedParts, setRemovedParts] = useState<number[]>([]);
  const [estimateModal, setEstimateModal] = useState<'service' | 'part' | null>(null);
  const [estimateSearch, setEstimateSearch] = useState('');
  const [estimateQuantity, setEstimateQuantity] = useState('1');
  const [finalCost, setFinalCost] = useState('');

  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const loadedTicket = await getTicket(Number(ticketId));
      setTicket(loadedTicket);
      setDiagnosis(loadedTicket.diagnosis_note);
      setFinalCost(loadedTicket.final_cost ?? '');
      setEstimateServices(loadedTicket.used_services.map(service => ({
        key: `service-${service.id}`,
        id: service.id,
        name: service.name,
        price: service.price,
        persisted: true,
      })));
      setEstimateParts(loadedTicket.used_parts.map(ticketPart => ({
        key: `part-${ticketPart.id}`,
        id: ticketPart.id,
        partId: ticketPart.part.id,
        name: ticketPart.part.name,
        sku: ticketPart.part.sku,
        price: ticketPart.price_at_use,
        quantity: ticketPart.quantity,
        persisted: true,
      })));
      setRemovedServices([]);
      setRemovedParts([]);
      const savedItemsTotal = loadedTicket.total_parts_cost + loadedTicket.total_services_cost;
      const savedEstimate = Number(loadedTicket.estimated_cost ?? 0);
      setCustomEstimate(savedEstimate > savedItemsTotal ? (savedEstimate - savedItemsTotal).toFixed(2) : '');
      setError('');
    } catch {
      setError('Nie udało się pobrać zgłoszenia.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTicket();
  }, [ticketId]);

  useEffect(() => {
    if (ticket && (ticket.status === 'NEW' || ticket.status === 'DIAGNOSIS' || workStatuses.includes(ticket.status))) {
      Promise.all([getStocks(), getServicePricing()])
        .then(([stockData, serviceData]) => {
          setStocks(stockData);
          setServices(serviceData.filter(service => service.is_available));
        })
        .catch(() => {
          setStocks([]);
          setServices([]);
        });
    }
  }, [ticket?.status]);

  const runAction = async (action: () => Promise<Ticket | unknown>) => {
    setSaving(true);
    setError('');
    try {
      await action();
      await loadTicket();
    } catch {
      setError('Nie udało się zapisać zmian. Sprawdź dane i uprawnienia.');
    } finally {
      setSaving(false);
    }
  };

  const saveEstimate = async () => {
    if (!ticket) return;
    for (const service of removedServices) {
      await deleteTicketService(service);
    }
    for (const part of removedParts) {
      await deleteTicketPart(part);
    }
    for (const part of estimateParts.filter(item => !item.persisted)) {
      await addTicketPart(ticket.id, part.partId, part.quantity);
    }
    for (const service of estimateServices.filter(item => !item.persisted)) {
      await addTicketService(ticket.id, service.name, service.price);
    }
    const itemsTotal = estimateParts.reduce((sum, part) => sum + Number(part.price) * part.quantity, 0)
      + estimateServices.reduce((sum, service) => sum + Number(service.price), 0);
    const customTotal = Number(customEstimate) || 0;
    const calculatedEstimate = (itemsTotal + customTotal).toFixed(2);
    await updateTicketCosts(ticket.id, { estimated_cost: calculatedEstimate });
  };

  const saveDiagnosisAndStart = () => {
    if (!ticket) return;
    void runAction(async () => {
      await saveEstimate();
      await updateTicket(ticket.id, { diagnosis_note: diagnosis });
      return changeTicketStatus(ticket.id, 'IN_PROGRESS');
    });
  };

  const saveWorkDetails = () => {
    if (!ticket) return;
    void runAction(async () => {
      await saveEstimate();
      await updateTicket(ticket.id, { diagnosis_note: diagnosis });
    });
  };

  const moveStatus = (status: TicketStatus) => {
    if (!ticket) return;
    void runAction(() => changeTicketStatus(ticket.id, status));
  };

  const startDiagnosis = () => {
    if (!ticket) return;
    void runAction(() => claimTicket(ticket.id));
  };

  const addSelectedService = (service: ServicePricing) => {
    setEstimateServices(current => [...current, {
      key: `service-new-${service.id}-${Date.now()}`,
      name: service.name,
      price: service.price,
      persisted: false,
    }]);
    setEstimateModal(null);
    setEstimateSearch('');
  };

  const addSelectedPart = (stock: Stock) => {
    const quantity = Number(estimateQuantity);
    if (quantity < 1 || quantity > stock.quantity) return;
    setEstimateParts(current => [...current, {
      key: `part-new-${stock.part.id}-${Date.now()}`,
      partId: stock.part.id,
      name: stock.part.name,
      sku: stock.part.sku,
      price: stock.part.sell_price_gross,
      quantity,
      persisted: false,
    }]);
    setEstimateModal(null);
    setEstimateSearch('');
    setEstimateQuantity('1');
  };

  const removeEstimateService = (service: EstimateService) => {
    if (service.persisted && service.id) setRemovedServices(current => [...current, service.id as number]);
    setEstimateServices(current => current.filter(item => item.key !== service.key));
  };
  const removeEstimatePart = (part: EstimatePart) => {
    if (part.persisted && part.id) setRemovedParts(current => [...current, part.id as number]);
    setEstimateParts(current => current.filter(item => item.key !== part.key));
  };

  const estimatedItemsTotal = estimateParts.reduce((sum, part) => sum + Number(part.price) * part.quantity, 0)
    + estimateServices.reduce((sum, service) => sum + Number(service.price), 0);
  const estimatedTotal = estimatedItemsTotal + (Number(customEstimate) || 0);
  const estimateTable = (
    <div className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="p-3 font-semibold">Pozycja</th>
            <th className="p-3 font-semibold">Typ</th>
            <th className="p-3 font-semibold">Ilość</th>
            <th className="p-3 font-semibold">Cena jednostkowa</th>
            <th className="p-3 font-semibold">Razem</th>
            <th className="p-3 text-right font-semibold"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {estimateServices.map(service => (
            <tr key={service.key}>
              <td className="p-3">{service.name}</td>
              <td className="p-3 text-slate-500">Usługa</td>
              <td className="p-3">1</td>
              <td className="p-3">{service.price} PLN</td>
              <td className="p-3 font-medium">{service.price} PLN</td>
              <td className="p-3 text-right"><button type="button" onClick={() => removeEstimateService(service)} className="text-red-600 hover:text-red-800">Usuń</button></td>
            </tr>
          ))}
          {estimateParts.map(part => (
            <tr key={part.key}>
              <td className="p-3">{part.name} <span className="text-slate-500">({part.sku})</span></td>
              <td className="p-3 text-slate-500">Część</td>
              <td className="p-3">{part.quantity}</td>
              <td className="p-3">{part.price} PLN</td>
              <td className="p-3 font-medium">{(Number(part.price) * part.quantity).toFixed(2)} PLN</td>
              <td className="p-3 text-right"><button type="button" onClick={() => removeEstimatePart(part)} className="text-red-600 hover:text-red-800">Usuń</button></td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="p-3" colSpan={4}>Szacowany lączny koszt</td>
            <td className="p-3">{estimatedTotal.toFixed(2)} PLN</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );

  const closeTicket = () => {
    if (!ticket) return;
    void runAction(async () => {
      await updateTicketCosts(ticket.id, { final_cost: finalCost });
      return changeTicketStatus(ticket.id, 'CLOSED');
    });
  };

  if (loading) return <p className="p-8 text-center text-slate-500">Ładowanie zgłoszenia...</p>;
  if (error && !ticket) return <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>;
  if (!ticket) return <p className="rounded border border-red-200 bg-red-50 p-4 text-red-700">Nie znaleziono zgłoszenia.</p>;

  const isHistorical = ticket.status === 'CLOSED' || ticket.status === 'REJECTED';
  const isNew = ticket.status === 'NEW';
  const isReady = ticket.status === 'READY';
  const isDiagnosis = ticket.status === 'DIAGNOSIS';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{ticket.ticket_code}</h1>
          <p className="text-sm text-slate-500">{ticket.device_name} · {ticket.status_display}</p>
        </div>
        <button type="button" onClick={() => navigate('/work/service')} className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Wróć do zgłoszeń
        </button>
      </header>

      {isHistorical && (
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Historia zgłoszenia</h2>
          <p className="mt-1 text-sm text-slate-600">To zgłoszenie jest zamknięte i nie można już zmienić jego danych.</p>
        </section>
      )}
      {isNew && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Diagnoza</h2>
          <p className="mt-1 text-sm text-slate-600">Rozpoczęcie diagnozy zgłoszenia zmieni jego stan z nowego na "w trakcie diagnozy".</p>
          <button type="button" disabled={saving} onClick={startDiagnosis} className="mt-2 rounded border border-blue-500 bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
            Rozpocznij diagnozę
          </button>
        </section>
      )}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Informacje o zgłoszeniu</h2>
            <div className="grid gap-2 md:grid-cols-2 text-sm text-slate-700  rounded-lg border border-slate-400 shadow-sm p-4">
                <h2 className="col-span-2 pb-2 text-base font-semibold text-slate-800">Dane klienta</h2>
                <p className="col-span-2"><b>Klient:</b> {ticket.client.first_name} {ticket.client.last_name}</p>
                <p className=""><b>Telefon:</b> {ticket.client.phone_number || 'Brak'}</p>
                <p className=""><b>Email:</b> {ticket.client.email || 'Brak'}</p>
            </div>
             <div className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-slate-700  rounded-lg border border-slate-400 shadow-sm p-4">
                <h2 className="col-span-2 pb-2 text-base font-semibold text-slate-800">Informacje o urządzeniu</h2>
                <p className="col-span-2"><b>Urządzenie:</b> {ticket.device_name}</p>
                <p className=""><b>Numer seryjny:</b> {ticket.serial_number || 'Brak'}</p>
            </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p><b>Zgłoszenie utworzył:</b> {ticket.created_by?.full_name || 'Nieznany użytkownik'}</p>
          <p><b>Ostatnio przypisany:</b> {ticket.assigned_worker?.full_name || 'Nieprzypisane'}</p>
          <p><b>Utworzono:</b> {formatDate(ticket.created_at)}</p>
          <p><b>Ostatnia aktualizacja:</b> {formatDate(ticket.updated_at)}</p>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-semibold">Opis problemu</p>
          <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3">{ticket.problem_description}</p>
        </div>
        </section>
      {isDiagnosis && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Nowe zgłoszenie</h2>
          <p className="mt-1 text-sm text-slate-600">Wykonaj diagnozę, zapisz jej wynik i rozpocznij obsługę zgłoszenia.</p>
          <textarea value={diagnosis} onChange={event => setDiagnosis(event.target.value)} placeholder="Wynik diagnozy" className="mt-4 min-h-32 w-full rounded border border-slate-300 bg-white p-3" />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            {/* <p className="rounded bg-white p-2 text-sm text-slate-700">Szacowany łączny koszt: <b>{estimatedTotal.toFixed(2)} PLN</b></p> */}
            <input
              type="number"
              min="0"
              step="0.01"
              value={customEstimate}
              onChange={event => setCustomEstimate(event.target.value)}
              placeholder="Własny koszt dodatkowy"
              className="w-55 rounded border border-slate-300 p-2"
            />
            <button type="button" disabled={saving} onClick={() => setEstimateModal('service')} className="rounded border border-blue-300 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">Dodaj usługę</button>
            <button type="button" disabled={saving} onClick={() => setEstimateModal('part')} className="rounded border border-blue-300 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">Dodaj część</button>
            <button type="button" disabled={saving || !diagnosis.trim()} onClick={saveDiagnosisAndStart} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Zapisz diagnozę i zmień status
            </button>
          </div>
          {estimateTable}
        </section>
      )}

      {workStatuses.includes(ticket.status) && (
        <section className="space-y-5 rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Obsługa zgłoszenia</h2>
            <p className="mt-1 text-sm text-slate-600">Dodawaj części i usługi, aktualizuj diagnozę oraz przeprowadzaj zgłoszenie przez kolejne etapy.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={saving} onClick={() => setEstimateModal('service')} className="rounded bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-900 disabled:opacity-50">Dodaj usługę z cennika</button>
            <button type="button" disabled={saving} onClick={() => setEstimateModal('part')} className="rounded bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-900 disabled:opacity-50">Dodaj część z magazynu</button>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4 text-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Szacowany koszt</h3>
            {estimateTable}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">Własny koszt dodatkowy (PLN)
                <input type="number" min="0" step="0.01" value={customEstimate} onChange={event => setCustomEstimate(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" />
              </label>
              <div className="rounded bg-slate-50 p-3 text-right text-base font-semibold text-slate-800">Razem: {estimatedTotal.toFixed(2)} PLN</div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Diagnoza</label>
              <textarea value={diagnosis} onChange={event => setDiagnosis(event.target.value)} className="min-h-28 w-full rounded border border-slate-300 bg-white p-3" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Szacowany koszt zostanie wyliczony z dodanych pozycji.</p>
              <button type="button" disabled={saving} onClick={saveWorkDetails} className="rounded border border-blue-300 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">Zapisz informacje i koszt</button>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4 text-sm">
            <p><b>Części:</b> {ticket.total_parts_cost} PLN</p>
            <p><b>Usługi:</b> {ticket.total_services_cost} PLN</p>
            <p><b>Łącznie:</b> {ticket.total_cost} PLN</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {ticket.status === 'DIAGNOSIS' && <button type="button" disabled={saving} onClick={() => moveStatus('PARTS')} className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50">Czekaj na części</button>}
            {(ticket.status === 'DIAGNOSIS' || ticket.status === 'PARTS') && <button type="button" disabled={saving} onClick={() => moveStatus('IN_PROGRESS')} className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">Rozpocznij naprawę</button>}
            {ticket.status === 'IN_PROGRESS' && <button type="button" disabled={saving} onClick={() => moveStatus('READY')} className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Gotowe do odbioru</button>}
            <button type="button" disabled={saving} onClick={() => moveStatus('REJECTED')} className="rounded border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Odrzuć</button>
          </div>
        </section>
      )}

      {isReady && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Gotowe do odbioru</h2>
          <p className="mt-1 text-sm text-slate-600">Sprawdź podsumowanie i zapisz końcową cenę przed zamknięciem zgłoszenia.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <p><b>Części:</b> {ticket.total_parts_cost}</p>
            <p><b>Usługi:</b> {ticket.total_services_cost}</p>
            <p><b>Razem:</b> {ticket.total_cost}</p>
          </div>
          <textarea readOnly value={ticket.diagnosis_note || 'Brak diagnozy'} className="mt-4 min-h-24 w-full rounded border border-slate-300 bg-white p-3" />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input type="number" min={ticket.total_cost} step="0.01" value={finalCost} onChange={event => setFinalCost(event.target.value)} placeholder="Końcowa cena" className="rounded border border-slate-300 p-2" />
            <button type="button" disabled={saving || !finalCost} onClick={closeTicket} className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Zamknij zgłoszenie</button>
          </div>
        </section>
      )}

      {estimateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold text-slate-800">
                {estimateModal === 'service' ? 'Wybierz usługę z cennika' : 'Wybierz część z magazynu'}
              </h2>
              <button type="button" onClick={() => setEstimateModal(null)} aria-label="Zamknij" className="text-2xl text-slate-400 hover:text-slate-700">×</button>
            </div>
            <input
              autoFocus
              value={estimateSearch}
              onChange={event => setEstimateSearch(event.target.value)}
              placeholder={estimateModal === 'service' ? 'Szukaj usługi...' : 'Szukaj części po nazwie, SKU lub EAN...'}
              className="mt-4 w-full rounded border border-slate-300 p-2"
            />
            {estimateModal === 'part' && (
              <label className="mt-3 block text-sm text-slate-700">Ilość
                <input type="number" min="1" value={estimateQuantity} onChange={event => setEstimateQuantity(event.target.value)} className="ml-2 w-24 rounded border border-slate-300 p-2" />
              </label>
            )}
            <div className="mt-4 divide-y rounded border border-slate-200">
              {estimateModal === 'service' ? (
                services
                  .filter(service => `${service.name} ${service.description ?? ''}`.toLowerCase().includes(estimateSearch.toLowerCase()))
                  .map(service => (
                    <button key={service.id} type="button" onClick={() => addSelectedService(service)} className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50">
                      <span><b>{service.name}</b><span className="block text-sm text-slate-500">{service.description || 'Brak opisu'}</span></span>
                      <span className="font-medium">{service.price} PLN</span>
                    </button>
                  ))
              ) : (
                stocks
                  .filter(stock => `${stock.part.name} ${stock.part.sku} ${stock.part.ean ?? ''}`.toLowerCase().includes(estimateSearch.toLowerCase()) && stock.quantity > 0)
                  .map(stock => (
                    <button key={stock.part.id} type="button" onClick={() => addSelectedPart(stock)} className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50">
                      <span><b>{stock.part.name}</b><span className="block text-sm text-slate-500">{stock.part.sku} · dostępne: {stock.quantity}</span></span>
                      <span className="font-medium">{stock.part.sell_price_gross} PLN</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}


        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mt-5">
          <h2 className="mb-2 font-semibold text-slate-800">Historia statusów</h2>
          <div className="space-y-2">{ticket.status_history.map(history => (
            <div key={history.id} className="rounded border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><b>{history.status_display}</b><span className="text-slate-500">{formatDate(history.changed_at)}</span></div>
              <p className="text-slate-600">Zmienił: {history.changed_by_name}</p>
              {history.comment && <p className="mt-1 whitespace-pre-wrap">{history.comment}</p>}
            </div>
          ))}</div>
        </div>
      </section>
    </div>
  );
};
