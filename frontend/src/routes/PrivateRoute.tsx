import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const PrivateRoute: React.FC=()=>{
    const {isAuthenticated, isLoading} = useAuth();

    if(isLoading){
        return(
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-600 font-medium">Sprawdzanie sesji...</div>
            </div>
        );
    }
    return isAuthenticated?<Outlet /> : <Navigate to="/work/login" replace />;
};