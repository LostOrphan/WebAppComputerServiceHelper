import React, { useState, useEffect } from 'react';
import { getCategories, createPart } from '../../api/inventory';
import type { PartCategory } from '../../types/inventory';
import type { CreatePartPayload } from '../../types/inventory';

interface SpecificationRow {
  name: string;
  value: string;
}

interface AddPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialEan?: string; // Kod ze skanera przekazany po nieudanym szukaniu
}

export const AddPartModal: React.FC<AddPartModalProps> = ({ 
  isOpen, onClose, onSuccess, initialEan 
}) => {
  const [categories, setCategories] = useState<PartCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specificationRows, setSpecificationRows] = useState<SpecificationRow[]>([]);

  const [formData, setFormData] = useState<CreatePartPayload>({
    name: '',
    brand: '',
    sku: '', // Pozostawione puste -> backend wygeneruje np. PRT-000001
    ean: '',
    category: 0,
    default_buy_price_net: '', // Zaktualizowana nazwa pola
    sell_price_gross: '',
    unit: 'PCS'
  });

  // Pobieranie kategorii oraz ustawianie EAN po otwarciu
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ 
        ...prev, 
        ean: initialEan || '',
        sku: '' // Czyścimy SKU, żeby system sam wygenerował nowe
      }));
      setSpecificationRows([]);
      setError(null);
      
      // Pobierz kategorie, jeśli jeszcze ich nie mamy
      if (categories.length === 0) {
        getCategories()
          .then(data => setCategories(data))
          .catch(() => setError('Nie udało się pobrać kategorii.'));
      }
    }
  }, [isOpen, initialEan, categories.length]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const specifications = specificationRows.reduce<Record<string, string>>((result, row) => {
      const name = row.name.trim();
      const value = row.value.trim();

      if (name && value) {
        result[name] = value;
      }

      return result;
    }, {});

    try {
      await createPart({ ...formData, specifications });
      onSuccess(); // Odświeża tabelę w Inventory.tsx
      onClose();   // Zamyka modal
    } catch (err: any) {
      setError('Nie udało się dodać produktu. Sprawdź, czy formularz jest poprawny.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSpecification = () => {
    setSpecificationRows(rows => [...rows, { name: '', value: '' }]);
  };

  const updateSpecification = (index: number, field: keyof SpecificationRow, value: string) => {
    setSpecificationRows(rows => rows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
  };

  const removeSpecification = (index: number) => {
    setSpecificationRows(rows => rows.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold text-slate-800">Dodaj nowy produkt</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa części</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="np. Dysk SSD 1TB"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Producent</label>
            <input
              type="text"
              value={formData.brand}
              onChange={e => setFormData({ ...formData, brand: e.target.value })}
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="np. Samsung"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kod EAN (Skaner)</label>
              <input
                type="text"
                value={formData.ean}
                onChange={e => setFormData({ ...formData, ean: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="Kod kreskowy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU (opcjonalne)</label>
              <input
                type="text"
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 bg-slate-50 placeholder:text-slate-400"
                placeholder="Auto-generowane"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategoria</label>
              <select
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: Number(e.target.value) })}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={0} disabled>Wybierz...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jednostka</label>
              <select
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value as any })}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="PCS">szt. (PCS)</option>
                <option value="G">g (Grams)</option>
                <option value="ML">ml (ML)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cena zakupu netto</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.default_buy_price_net}
                onChange={e => setFormData({ ...formData, default_buy_price_net: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cena sprzedaży brutto</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.sell_price_gross}
                onChange={e => setFormData({ ...formData, sell_price_gross: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <section className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Specyfikacja</h3>
              <button
                type="button"
                onClick={addSpecification}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                + Dodaj specyfikację
              </button>
            </div>

            {specificationRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.name}
                  onChange={e => updateSpecification(index, 'name', e.target.value)}
                  className="min-w-0 flex-1 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Nazwa, np. Pojemność"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={e => updateSpecification(index, 'value', e.target.value)}
                  className="min-w-0 flex-1 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Wartość, np. 512 GB"
                />
                <button
                  type="button"
                  onClick={() => removeSpecification(index)}
                  className="px-2 text-slate-400 hover:text-red-600"
                  aria-label="Usuń specyfikację"
                >
                  ×
                </button>
              </div>
            ))}
          </section>

          <div className="flex justify-end space-x-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting || formData.category === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Zapisywanie...' : 'Zapisz produkt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};