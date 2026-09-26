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
import { OwnerPanel } from '../pages/Private/panels/ownerPanel';
import { BranchPanel } from '../pages/Private/panels/branchPanel';
import { Employees } from '../pages/Private/company/employees';
import { Branches } from '../pages/Private/company/branches';
import { Warehouses } from '../pages/Private/company/warehouses';
import { Orders } from '../pages/Private/company/orders';
import { Services } from '../pages/Private/company/services';
import { About } from '../pages/Public/about';
import { BranchesList } from '../pages/Public/branchesList';
import { Service } from '../pages/Private/service';
import { TicketDetails } from '../pages/Private/ticketDetails';
export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/ticket" element={<TrackTicket />} />
        <Route path="/about" element={<About />} />
        <Route path="/find-us" element={<BranchesList />} />
      </Route>

      <Route path="/work" element={<Navigate to="/work/login" replace />} />
      <Route path="/work/login" element={<Login />} />

      <Route element={<PrivateRoute />}>
        <Route element={<PrivateLayout />}>
          <Route path="/work/dashboard" element={<Dashboard />} />
          <Route path="/work/inventory" element={<Inventory />} />
          <Route path="/work/service" element={<Service />} />
          <Route path="/work/service/:ticketId" element={<TicketDetails />} />
          <Route element={<PrivateRoute requiredRoles={["OWNER"]} />}>
            <Route path="/work/admin/company" element={<OwnerPanel />} />
              <Route path="/work/admin/company/employees" element={<Employees />} />
              <Route path="/work/admin/company/branches" element={<Branches />} />
              <Route path="/work/admin/company/warehouses" element={<Warehouses />} />
              <Route path="/work/admin/company/orders" element={<Orders />} />
              <Route path="/work/admin/company/services" element={<Services />} />
          </Route>
          <Route element={<PrivateRoute requiredRoles={[ 'MANAGER']} />}>
            <Route path="/work/admin/branch" element={<BranchPanel />} />
          </Route>
        </Route>
      </Route>


      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};