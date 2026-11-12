import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import type { Branch, City, OpeningHours } from '../../types/auth';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchToEdit: Branch | null;
}

interface BranchFormData {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone_number: string;
  email: string;
  is_active: boolean;
}

const weekdays = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];
const emptyOpeningHours = (): Array<Partial<OpeningHours> & { weekday: number }> =>
  weekdays.map((_, weekday) => ({ weekday, opens_at: '', closes_at: '', is_closed: true }));

const emptyForm: BranchFormData = {
  name: '',
  address: '',
  postal_code: '',
  city: '',
  phone_number: '',
  email: '',
  is_active: true,
};

export const BranchModal: React.FC<BranchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  branchToEdit,
}) => {
  const [formData, setFormData] = useState<BranchFormData>(emptyForm);
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openingHours, setOpeningHours] = useState(emptyOpeningHours);
  const cityFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (branchToEdit) {
      setFormData({
        name: branchToEdit.name,
        address: branchToEdit.address,
        postal_code: branchToEdit.postal_code,
        city: String(branchToEdit.city.id),
        phone_number: branchToEdit.phone_number || '',
        email: branchToEdit.email || '',
        is_active: branchToEdit.is_active,
      });
      setSelectedCity(branchToEdit.city);
      setCityQuery(branchToEdit.city.name);
      setOpeningHours(branchToEdit.opening_hours.map(hours => ({
        id: hours.id,
        weekday: hours.weekday,
        opens_at: hours.opens_at?.slice(0, 5) || '',
        closes_at: hours.closes_at?.slice(0, 5) || '',
        is_closed: hours.is_closed,
      })));
    } else {
      setFormData(emptyForm);
      setSelectedCity(null);
      setCityQuery('');
      setOpeningHours(emptyOpeningHours());
    }
    setCitySuggestions([]);
    setError(null);
  }, [branchToEdit, isOpen]);

  useEffect(() => {
    if (!isOpen || cityQuery.trim().length < 2 || selectedCity?.name === cityQuery.trim()) {
      setCitySuggestions([]);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingCities(true);
      try {
        const response = await api.get<{ results: City[] }>('/accounts/cities/', {
          params: { search: cityQuery.trim() },
        });
        if (!isCancelled) {
          setCitySuggestions(response.data.results);
        }
      } catch (err) {
        console.error('Błąd wyszukiwania miast:', err);
        if (!isCancelled) {
          setCitySuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearchingCities(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [cityQuery, isOpen, selectedCity]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!cityFieldRef.current?.contains(event.target as Node)) {
        setCitySuggestions([]);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!isOpen) return null;

  const updateField = (field: keyof BranchFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const getErrorMessage = (err: any, fallback: string) => {
    const responseData = err.response?.data;
    if (responseData && typeof responseData === 'object') {
      return Object.values(responseData).flat().join(' ');
    }
    return fallback;
  };

  const updateOpeningHours = (weekday: number, field: 'opens_at' | 'closes_at' | 'is_closed', value: string | boolean) => {
    setOpeningHours(current => current.map(hours => (
      hours.weekday === weekday ? { ...hours, [field]: value } : hours
    )));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!selectedCity) {
      setError('Wybierz miasto z listy podpowiedzi.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      ...formData,
      city: selectedCity.id,
    };

    try {
      let locationId = branchToEdit?.id;
      if (branchToEdit) {
        await api.patch(`/accounts/locations/${branchToEdit.id}/`, payload);
      } else {
        const response = await api.post<Branch>('/accounts/locations/', payload);
        locationId = response.data.id;
      }

      let rows = openingHours;
      if (!branchToEdit && locationId) {
        const hoursResponse = await api.get<{ results: OpeningHours[] }>('/accounts/opening-hours/', {
          params: { location: locationId },
        });
        rows = hoursResponse.data.results.map(hours => ({
          id: hours.id,
          weekday: hours.weekday,
          opens_at: openingHours.find(item => item.weekday === hours.weekday)?.opens_at || '',
          closes_at: openingHours.find(item => item.weekday === hours.weekday)?.closes_at || '',
          is_closed: openingHours.find(item => item.weekday === hours.weekday)?.is_closed ?? true,
        }));
      }
      await Promise.all(rows.filter(hours => hours.id).map(hours => api.patch(
        `/accounts/opening-hours/${hours.id}/`,
        {
          opens_at: hours.is_closed ? null : hours.opens_at || null,
          closes_at: hours.is_closed ? null : hours.closes_at || null,
          is_closed: hours.is_closed,
        },
      )));
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Błąd zapisywania oddziału.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">
          {branchToEdit ? 'Edytuj oddział' : 'Dodaj nowy oddział'}
        </h2>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nazwa</label>
            <input required value={formData.name} onChange={(event) => updateField('name', event.target.value)} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Adres</label>
            <input required value={formData.address} onChange={(event) => updateField('address', event.target.value)} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kod pocztowy</label>
              <input required value={formData.postal_code} onChange={(event) => updateField('postal_code', event.target.value)} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div ref={cityFieldRef} className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Miasto</label>
              <input
                required
                value={cityQuery}
                onChange={(event) => {
                  setCityQuery(event.target.value);
                  setSelectedCity(null);
                  updateField('city', '');
                }}
                placeholder="Wpisz nazwę miasta"
                className="w-full border rounded-lg p-2 text-sm"
              />
              {(isSearchingCities || citySuggestions.length > 0) && !selectedCity && (
                <div className="absolute z-10 w-full bg-white border rounded-lg shadow-md mt-1 max-h-48 overflow-auto">
                  {isSearchingCities ? (
                    <div className="px-3 py-2 text-sm text-slate-500">Szukanie...</div>
                  ) : (
                    citySuggestions.map((city) => (
                      <button
                        type="button"
                        key={city.id}
                        onClick={() => {
                          setSelectedCity(city);
                          setCityQuery(city.name);
                          updateField('city', String(city.id));
                          setCitySuggestions([]);
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
                      >
                        {city.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Telefon</label>
            <input value={formData.phone_number} onChange={(event) => updateField('phone_number', event.target.value)} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">E-mail</label>
            <input type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          {branchToEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) => setFormData((current) => ({ ...current, is_active: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Lokalizacja aktywna
            </label>
          )}
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold text-slate-700">Godziny otwarcia</h3>
            {openingHours.map(hours => (
              <div key={hours.weekday} className="grid grid-cols-[7rem_1fr_1fr_auto] items-center gap-2 text-sm">
                <span className="text-slate-700">{weekdays[hours.weekday]}</span>
                <input type="time" value={hours.opens_at || ''} disabled={Boolean(hours.is_closed)} onChange={event => updateOpeningHours(hours.weekday, 'opens_at', event.target.value)} className="rounded border border-slate-300 p-1.5 disabled:bg-slate-100" />
                <input type="time" value={hours.closes_at || ''} disabled={Boolean(hours.is_closed)} onChange={event => updateOpeningHours(hours.weekday, 'closes_at', event.target.value)} className="rounded border border-slate-300 p-1.5 disabled:bg-slate-100" />
                <label className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-600">
                  <input type="checkbox" checked={Boolean(hours.is_closed)} onChange={event => updateOpeningHours(hours.weekday, 'is_closed', event.target.checked)} />
                  Zamknięte
                </label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
