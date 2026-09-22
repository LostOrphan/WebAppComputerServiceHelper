import React, { useEffect, useState } from 'react';
import api from '../../../api/axios';
import { getParts, getStocks, updateStockMinimum } from '../../../api/inventory';
import { AddPartModal } from '../../../components/private/addPartModal';
import type { Branch } from '../../../types/auth';
import type { Part, Stock } from '../../../types/inventory';

export const Warehouses: React.FC = () => {
  const [locations, setLocations] = useState<Branch[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStockLoading, setIsStockLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [savingStockId, setSavingStockId] = useState<number | null>(null);

  const fetchParts = async () => {
    const data = await getParts();
    setParts(data);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [locationsResponse, partsData] = await Promise.all([
          api.get<Branch[]>('/accounts/locations/'),
          getParts(),
        ]);
        setLocations(locationsResponse.data);
        setParts(partsData);
      } catch (err) {
        console.error('Błąd pobierania danych magazynów:', err);
        setError('Nie udało się pobrać danych magazynów.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedLocation) {
      setStocks([]);
      return;
    }

    const fetchStocks = async () => {
      setIsStockLoading(true);
      setError(null);
      try {
        setStocks(await getStocks(undefined, undefined, selectedLocation));
      } catch (err) {
        console.error('Błąd pobierania stanu magazynu:', err);
        setError('Nie udało się pobrać stanu wybranego magazynu.');
      } finally {
        setIsStockLoading(false);
      }
    };

    fetchStocks();
  }, [selectedLocation]);

  const openCreatePart = () => {
    setEditingPart(null);
    setIsPartModalOpen(true);
  };

  const openEditPart = (part: Part) => {
    setEditingPart(part);
    setIsPartModalOpen(true);
  };

  const refreshParts = async () => {
    try {
      await fetchParts();
    } catch (err) {
      setError('Nie udało się odświeżyć listy produktów.');
    }
  };

  const updateMinimum = async (stockId: number, value: string) => {
    const minQuantity = Math.max(0, Number(value) || 0);
    setSavingStockId(stockId);
    setError(null);

    try {
      await updateStockMinimum(stockId, minQuantity);
      setStocks(await getStocks(undefined, undefined, selectedLocation));
    } catch (err) {
      setError('Nie udało się zapisać minimalnego stanu magazynowego.');
    } finally {
      setSavingStockId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Magazyny i produkty</h1>
        <p className="mt-1 text-sm text-slate-500">Wybierz lokalizację, aby zobaczyć jej stan magazynowy.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-slate-800">Stan magazynu</h2>
          <select
            value={selectedLocation}
            onChange={(event) => setSelectedLocation(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            aria-label="Wybierz lokalizację magazynu"
          >
            <option value="">Wybierz lokalizację</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}{location.is_active ? '' : ' (nieaktywna)'}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {!selectedLocation ? (
            <div className="py-12 text-center text-slate-500">Wybierz lokalizację, aby wyświetlić stan magazynu.</div>
          ) : isStockLoading ? (
            <div className="py-12 text-center text-slate-500">Ładowanie stanu magazynu...</div>
          ) : stocks.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Wybrany magazyn nie zawiera produktów.</div>
          ) : (
            <div className="max-h-112 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Produkt</th>
                    <th className="p-4">Kategoria</th>
                    <th className="p-4">Ilość</th>
                    <th className="p-4">Minimum</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stocks.map((stock) => (
                    <tr key={stock.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono text-slate-600">{stock.part.sku}</td>
                      <td className="p-4 font-medium text-slate-900">{stock.part.name}</td>
                      <td className="p-4 text-slate-600">{stock.part.category_name || '-'}</td>
                      <td className="p-4 font-semibold">{stock.quantity} {stock.part.unit}</td>
                      <td className="p-4 text-slate-600">
                        <input
                          type="number"
                          min="0"
                          defaultValue={stock.min_quantity}
                          onBlur={(event) => updateMinimum(stock.id, event.target.value)}
                          disabled={savingStockId === stock.id}
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100"
                          aria-label={`Minimalny stan dla ${stock.part.name}`}
                        />
                        <span className="ml-2 text-xs text-slate-400">
                          {stock.min_quantity > 0 ? '' : 'N/D'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={stock.min_quantity === 0
                          ? stock.quantity > 0 ? 'text-green-600' : 'text-red-600'
                          : stock.is_low_stock ? 'text-red-600' : 'text-green-600'}>
                          {stock.min_quantity === 0
                            ? stock.quantity > 0 ? 'W magazynie' : 'Brak w magazynie'
                            : stock.is_low_stock ? 'Niski stan' : 'W normie'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-slate-800">Zarejestrowane produkty</h2>
          <button onClick={openCreatePart} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Dodaj produkt
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">Ładowanie produktów...</div>
          ) : parts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">Brak zarejestrowanych produktów.</div>
          ) : (
            <div className="max-h-128 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">SKU / EAN</th>
                    <th className="p-4">Produkt</th>
                    <th className="p-4">Kategoria</th>
                    <th className="p-4">Specyfikacja</th>
                    <th className="p-4 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parts.map((part) => (
                    <tr key={part.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono text-slate-600">
                        <div>{part.sku}</div>
                        {part.ean && <div className="text-xs text-slate-400">{part.ean}</div>}
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        {part.name}
                        {part.brand && <div className="text-xs font-normal text-slate-500">{part.brand}</div>}
                      </td>
                      <td className="p-4 text-slate-600">{part.category_name || '-'}</td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedPart(part)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-900"
                        >
                          Zobacz specyfikację
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => openEditPart(part)} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800">
                          Edytuj
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <AddPartModal
        isOpen={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        onSuccess={refreshParts}
        partToEdit={editingPart}
      />

      {selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Specyfikacja produktu</h2>
                <p className="text-sm text-slate-500">
                  {selectedPart.brand ? `${selectedPart.brand} ` : ''}{selectedPart.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPart(null)}
                className="text-xl font-bold text-slate-400 hover:text-slate-600"
                aria-label="Zamknij specyfikację"
              >
                ×
              </button>
            </div>

            {selectedPart.specifications && Object.keys(selectedPart.specifications).length > 0 ? (
              <dl className="divide-y divide-slate-200">
                {Object.entries(selectedPart.specifications).map(([name, value]) => (
                  <div key={name} className="grid grid-cols-2 gap-4 py-3 text-sm">
                    <dt className="font-medium text-slate-600">{name}</dt>
                    <dd className="wrap-break-words text-slate-800">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="py-4 text-sm text-slate-500">Brak zapisanych specyfikacji.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};