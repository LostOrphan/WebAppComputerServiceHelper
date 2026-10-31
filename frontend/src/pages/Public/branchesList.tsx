import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import type { Branch } from '../../types/auth';

export const BranchesList: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await api.get<Branch[]>('/accounts/locations/public/');
        setBranches(response.data);
      } catch (error) {
        console.error('Błąd pobierania oddziałów:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Nasze lokalizacje</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Znajdź nas tutaj</h1>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Ładowanie oddziałów...</p>
      ) : hasError ? (
        <p className="text-red-600">Nie udało się pobrać listy oddziałów.</p>
      ) : branches.length === 0 ? (
        <p className="text-slate-500">Obecnie nie ma aktywnych oddziałów.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {branches.map((branch) => (
            <article key={branch.id} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">{branch.name}</h2>
              <address className="mt-4 not-italic leading-7 text-slate-600">
                <div>{branch.address}</div>
                <div>{branch.postal_code} {branch.city.name}</div>
              </address>
              
              <h2 className="mt-5 text-lg font-semibold text-slate-900">Godziny otwarcia</h2>
              <div className="mt-2 space-y-1 text-sm">
                {branch.opening_hours?.map(hours => (
                  <div key={hours.id} className="grid grid-cols-[7rem_1fr] gap-3">
                    <span className="font-medium text-slate-800">{hours.weekday_name}</span>
                    <span className="text-slate-600">
                      {hours.is_closed || !hours.opens_at || !hours.closes_at
                        ? 'Nieczynne'
                        : `${hours.opens_at.slice(0, 5)} - ${hours.closes_at.slice(0, 5)}`}
                    </span>
                  </div>
                ))}
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Kontakt</h2>

              <div className="mt-2 flex items-center gap-16 justify-left">
              {branch.phone_number && (
                <a className="ml-4 inline-block font-medium text-blue-600 hover:text-blue-800" href={`tel:${branch.phone_number}`}>
                  {branch.phone_number}
                </a>
              )}
              {branch.email && (
                <a className="ml-auto mr-4 block font-medium text-blue-600 hover:text-blue-800" href={`mailto:${branch.email}`}>
                  {branch.email}
                </a>
              )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};