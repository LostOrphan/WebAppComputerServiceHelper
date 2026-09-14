import React, { createContext, useContext, useState, useEffect,type ReactNode } from 'react';
import api from '../api/axios';
import type { AuthTokens, LoginCredentials, User } from '../types/auth';

interface AuthContextType{
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}>=({children})=>{
    const [user,setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const fetchCurrentUser = async()=>{
        try{
            const response = await api.get<User>('accounts/users/me/');
            setUser(response.data);
        }catch{
            logout();
        }finally{
            setIsLoading(false);
        }
    };
    useEffect(()=>{
        const token = localStorage.getItem('access_token');
        if(token){
            fetchCurrentUser();
        }else{
            setIsLoading(false);
        }
    },[]);
    const login = async(credentials: LoginCredentials)=>{
        const response = await api.post<AuthTokens>('auth/token/', credentials);
        const{access,refresh} = response.data;

        localStorage.setItem('access_token',access);
        localStorage.setItem('refresh_token',refresh);

        await fetchCurrentUser();
    };
    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };
    return(
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
        }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth=()=>{
    const context = useContext(AuthContext);
    if(!context){
        throw new Error('useAuth must use within AuthProvider');
    }
    return context;
};