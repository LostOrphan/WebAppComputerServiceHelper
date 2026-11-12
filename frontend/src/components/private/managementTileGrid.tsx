import React from 'react';
import { Link } from 'react-router-dom';

export interface ManagementTile {
  id: string;
  title: string;
  description: string;
  icon?: string;
  path: string;
  color: string;
}

export const ManagementTileGrid: React.FC<{ tiles: ManagementTile[] }> = ({ tiles }) => (
  <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 p-4 md:grid-cols-3 md:gap-6">
    {tiles.map(tile => (
      <Link
        key={tile.id}
        to={tile.path}
        className="group flex aspect-square flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-500 hover:shadow-md"
      >
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl transition-transform group-hover:scale-110 ${tile.color}`}>
          {tile.icon}
        </div>
        <h3 className="mb-1 text-base font-bold text-slate-800 group-hover:text-blue-600 md:text-lg">{tile.title}</h3>
        <p className="line-clamp-2 px-2 text-xs text-slate-500">{tile.description}</p>
      </Link>
    ))}
  </div>
);
