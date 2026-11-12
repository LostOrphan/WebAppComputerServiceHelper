import React, { useState, useEffect, useRef } from 'react';
import { getParts, receiveGoods } from '../../api/inventory';
import type { Part } from '../../types/inventory';

interface ReceiveGoodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onNotFound: (scannedCode: string) => void; // Wywoływane gdy backend zwróci 404
  onAddManually: (identifier: string) => void;
}

export const ReceiveGoodsModal: React.FC<ReceiveGoodsModalProps> = ({ 
  isOpen, onClose, onSuccess, onNotFound, onAddManually
}) => {
  const [identifier, setIdentifier] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipNextSearch = useRef(false);

  // Focus na pole EAN po otwarciu (gotowość na skaner)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setIdentifier('');
      setQuantity(1);
      setError(null);
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const searchTerm = identifier.trim();

    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    if (!isOpen || !searchTerm) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setHasSearched(false);
      try {
        setSearchResults((await getParts(searchTerm)).results);
        setHasSearched(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [identifier, isOpen]);

  const handlePartSelect = (part: Part) => {
    skipNextSearch.current = true;
    setIdentifier(part.sku || part.ean || '');
    setSearchResults([]);
    setHasSearched(false);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await receiveGoods(identifier, quantity);
      onSuccess(); // Odśwież tabelę w tle
      onClose();   // Zamknij modal (sukces)
    } catch (err: any) {
      // Jeśli backend zgłosił 404 (NOT_FOUND)
      if (err.response?.status === 404) {
        onClose(); // Zamknij to okno...
        onNotFound(identifier); // ...i otwórz okno nowego produktu z tym kodem
      } else {
        setError('Wystąpił błąd podczas dodawania do magazynu.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Szybkie przyjęcie (Skaner)</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Kod EAN / SKU / Nazwa produktu</label>
            <input
              ref={inputRef}
              type="text"
              required
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Zeskanuj lub wpisz..."
            />

            {identifier.trim() && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {isSearching ? (
                  <div className="p-3 text-sm text-slate-500">Searching...</div>
                ) : searchResults.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">EAN</th>
                        <th className="px-3 py-2">Nazwa produktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map(part => (
                        <tr
                          key={part.id}
                          onClick={() => handlePartSelect(part)}
                          className="cursor-pointer border-t border-slate-100 hover:bg-blue-50"
                        >
                          <td className="px-3 py-2 font-mono">{part.sku}</td>
                          <td className="px-3 py-2 font-mono">{part.ean || '-'}</td>
                          <td className="px-3 py-2">{part.brand ? `${part.brand} ` : ''}{part.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : hasSearched ? (
                  <div className="p-3 text-sm text-slate-500">Nie znaleziono wyników. Spróbuj dodać produkt ręcznie</div>
                ) : null
              }
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ilość do dodania</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => onAddManually(identifier.trim())}
              className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              Dodaj ręcznie
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-red-300 hover:bg-red-800 text-white rounded-lg font-medium">
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !identifier.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Przetwarzanie...' : 'Przyjmij'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};