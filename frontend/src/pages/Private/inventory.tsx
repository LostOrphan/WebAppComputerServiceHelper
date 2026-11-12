import React, { useState, useEffect, useRef } from 'react';
import { getCategories, getStocks } from '../../api/inventory';
import type { PartCategory, Stock } from '../../types/inventory';
import { AddPartModal } from '../../components/private/addPartModal'; // Zauważ małą literę 'addPartModal' jak w Twoim kodzie
import { ReceiveGoodsModal } from '../../components/private/receiveGoodsModal';

export const Inventory: React.FC = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Stany dla okien modalnych
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState<boolean>(false);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  
  // Stan przechowujący EAN w przypadku gdy skaner nie znajdzie części
  const [scannedEan, setScannedEan] = useState<string>('');

  const fetchInventory = async (searchQuery?: string, category?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStocks(searchQuery, category, undefined, 1);
      setStocks(data.results);
      setNextPage(2);
      setHasMore(Boolean(data.next));
    } catch (err) {
      setError('Nie udało się pobrać danych magazynowych. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setError('Nie udało się pobrać kategorii.'));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchInventory(searchInput, selectedCategory);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput, selectedCategory]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver(async () => {
      if (loadingMore) return;
      setLoadingMore(true);
      try {
        const page = await getStocks(searchInput, selectedCategory, undefined, nextPage);
        setStocks(current => [...current, ...page.results.filter(item => !current.some(existing => existing.id === item.id))]);
        setNextPage(current => current + 1);
        setHasMore(Boolean(page.next));
      } finally {
        setLoadingMore(false);
      }
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, nextPage, searchInput, selectedCategory, loadingMore]);

  // Kiedy zeskanowano kod, którego nie ma w bazie
  const handlePartNotFound = (scannedCode: string) => {
    setScannedEan(scannedCode);
    setIsAddModalOpen(true);
  };

  const handleAddPartManually = (identifier: string) => {
    setScannedEan(identifier);
    setIsReceiveModalOpen(false);
    setIsAddModalOpen(true);
  };

  const selectedStock = stocks.find(stock => stock.part.id === selectedPartId);
  const selectedSpecifications = selectedStock?.part.specifications ?? {};

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 mb-4 md:mb-0">Magazyn (Części)</h1>
        
        <div className="flex w-full md:w-auto space-x-4 flex-wrap gap-y-2 md:gap-y-0">
          <form onSubmit={(e) => e.preventDefault()} className="flex grow">
            <input
              type="text"
              placeholder="Szukaj (nazwa, SKU, EAN)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full md:w-64 border border-slate-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="ml-2 border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filtruj po kategorii"
            >
              <option value="">Wszystkie kategorie</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </form>
          
          <button 
            onClick={() => setIsReceiveModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition whitespace-nowrap font-medium shadow-sm flex items-center"
          >
             Dodaj produkt
          </button>
          
          {/* <button 
            onClick={() => {
              setScannedEan(''); // Ręczne dodanie czyści zapamiętany EAN ze skanera
              setIsAddModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition whitespace-nowrap font-medium shadow-sm"
          >
            + Dodaj część
          </button> */}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : stocks.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            Brak części spełniających kryteria.
          </div>
        ) : (
          <div className="max-h-[calc(100vh-11rem)] overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">SKU / EAN</th>
                  <th className="px-6 py-4 font-semibold">Produkt</th>
                  <th className="px-6 py-4 font-semibold">Kategoria</th>
                  <th className="px-6 py-4 font-semibold">Ilość</th>
                  <th className="px-6 py-4 font-semibold">Cena netto</th>
                  <th className="px-6 py-4 font-semibold">Cena brutto</th>
                  <th className="px-6 py-4 font-semibold">Specyfikacja</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stocks.map((stock) => {
                  const hasMinimum = stock.min_quantity > 0;
                  const isLow = hasMinimum && stock.is_low_stock;

                  return (
                    <tr 
                      key={stock.id} 
                      className={`hover:bg-slate-50 transition ${isLow ? 'bg-red-50/50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{stock.part.sku}</div>
                        {stock.part.ean && <div className="text-xs text-slate-500 font-mono mt-1">{stock.part.ean}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <div>{stock.part.name}</div>
                        {stock.part.brand && <div className="text-xs text-slate-500">{stock.part.brand}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {stock.part.category_name || '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                        {stock.quantity} <span className="text-sm font-normal text-slate-500">{stock.part.unit}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {stock.part.default_buy_price_net} PLN
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                        {stock.part.sell_price_gross} PLN
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPartId(stock.part.id)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-900 disabled:text-slate-400"
                          disabled={!stock.part.specifications || Object.keys(stock.part.specifications).length === 0}
                        >
                          Zobacz specyfikację
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {!hasMinimum ? (
                          <span className={stock.quantity > 0 ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200' : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200'}>
                            {stock.quantity > 0 ? 'W magazynie' : 'Brak w magazynie'}
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            Niski stan
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            W normie
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasMore && <div ref={loadMoreRef} className="p-3 text-center text-sm text-slate-500">{loadingMore ? 'Ładowanie...' : 'Przewiń, aby załadować więcej...'}</div>}
          </div>
        )}
      </div>

      {/* Okna modalne */}
      <ReceiveGoodsModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        onSuccess={() => fetchInventory()} // Automatyczne odświeżenie po dodaniu sztuk!
        onNotFound={handlePartNotFound}
        onAddManually={handleAddPartManually}
      />

      <AddPartModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialEan={scannedEan}
        onSuccess={() => {
          fetchInventory(); // Odśwież tabelę
          setScannedEan(''); // Wyczyść stan skanera
        }}
      />

      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Specyfikacja produktu</h2>
                <p className="text-sm text-slate-500">
                  {selectedStock.part.brand ? `${selectedStock.part.brand} ` : ''}{selectedStock.part.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartId(null)}
                className="text-xl font-bold text-slate-400 hover:text-slate-600"
                aria-label="Zamknij specyfikację"
              >
                ×
              </button>
            </div>

            {Object.keys(selectedSpecifications).length > 0 ? (
              <dl className="divide-y divide-slate-200">
                {Object.entries(selectedSpecifications).map(([name, value]) => (
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