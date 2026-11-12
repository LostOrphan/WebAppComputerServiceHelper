import {
  ManagementTileGrid,
  type ManagementTile,
} from "../../../components/private/managementTileGrid";
import { useAuth } from "../../../context/AuthContext";

const tiles: ManagementTile[] = [
  {
    id: "employees",
    title: "Pracownicy oddziału",
    description: "Zarządzaj zespołem swojego oddziału",
    path: "/work/admin/branch/employees",
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: "warehouse",
    title: "Magazyn oddziału",
    description: "Przeglądaj stan magazynu oddziału",
    path: "/work/admin/branch/warehouse",
    color: "bg-amber-50 text-amber-600",
  },
  {
    id: "hours",
    title: "Godziny otwarcia",
    description: "Ustaw godziny pracy oddziału",
    path: "/work/admin/branch/hours",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "services",
    title: "Cennik oddziału",
    description: "Ustaw lokalne ceny usług",
    path: "/work/admin/branch/services",
    color: "bg-cyan-50 text-cyan-600",
  },
  {
    id: "clients",
    title: "Klienci oddziału",
    description: "Zarządzaj klientami swojego oddziału",
    path: "/work/admin/branch/clients",
    color: "bg-indigo-50 text-indigo-600",
  },
];

export const BranchPanel = () => {
  const { user } = useAuth();
  const locationName = user?.location_name || "BRAK LOKALIZACJI";

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-800">
          Oddział {locationName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Panel zarządzania aktywnym oddziałem
        </p>
      </header>
      <ManagementTileGrid tiles={tiles} />
    </div>
  );
};
