import React, { createContext, useContext, useState, useEffect,type ReactNode } from 'react';
import api, { refreshAccessToken, setAccessToken } from '../api/axios';
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
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        void refreshAccessToken()
            .then(fetchCurrentUser)
            .catch(() => setIsLoading(false));
    },[]);
    const login = async(credentials: LoginCredentials)=>{
        const response = await api.post<AuthTokens>('auth/token/', credentials);
        setAccessToken(response.data.access);
        await fetchCurrentUser();
    };
    const logout = () => {
        void api.post('auth/logout/');
        setAccessToken(null);
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