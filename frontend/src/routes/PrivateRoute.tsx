import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types/auth';

interface PrivateRouteProps {
    requiredRoles?: User['role'][];
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ requiredRoles }) => {
    const { isAuthenticated, isLoading, user } = useAuth();

    if(isLoading){
        return(
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-600 font-medium">Sprawdzanie sesji...</div>
            </div>
        );
    }
    if (!isAuthenticated) {
        return <Navigate to="/work/login" replace />;
    }

    if (requiredRoles && (!user || !requiredRoles.includes(user.role))) {
        return <Navigate to="/work/dashboard" replace />;
    }
    return <Outlet />;
};