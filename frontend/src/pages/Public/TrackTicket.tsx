import React from 'react';

export const TrackTicket: React.FC = () => {
  return (
    <div className="bg-white shadow rounded-lg p-8 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Sprawdź status naprawy</h2>
      <input 
        type="text" 
        placeholder="Wpisz numer zgłoszenia" 
        className="w-full border p-2 rounded mb-4"
      />
      <button className="w-full bg-blue-600 text-white py-2 rounded">Szukaj</button>
    </div>
  );
};