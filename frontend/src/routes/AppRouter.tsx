import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './PrivateRoute';
import { PublicLayout } from '../components/layout/PublicLayout';
import { PrivateLayout } from '../components/layout/PrivateLayout';

import { HomePage } from '../pages/Public/HomePage';
import { TrackTicket } from '../pages/Public/TrackTicket';
import { Login } from '../pages/Private/Login';
import { Dashboard } from '../pages/Private/Dashboard';
import { Inventory } from '../pages/Private/inventory';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/sprawdz-zgloszenie" element={<TrackTicket />} />
      </Route>

      <Route path="/work" element={<Navigate to="/work/login" replace />} />
      <Route path="/work/login" element={<Login />} />

      <Route element={<PrivateRoute />}>
        <Route element={<PrivateLayout />}>
          <Route path="/work/dashboard" element={<Dashboard />} />
          <Route path="/work/inventory" element={<Inventory />} />
        </Route>
      </Route>

      {/* Fallback dla nieistniejących ścieżek */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};