import { useAuth } from '../../../context/AuthContext';

export const BranchPanel = () => {
  const { user } = useAuth();
  const locationName = user?.location_name || 'BRAK LOKALIZACJI';

  return (
    <div className="p-8 bg-white rounded-lg shadow-sm border border-slate-200">
      <h1 className="text-3xl font-bold text-slate-800">
        ODDZIAŁ {locationName.toUpperCase()}
      </h1>
    </div>
  );
};