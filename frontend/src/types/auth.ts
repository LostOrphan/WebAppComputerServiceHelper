export interface LoginCredentials{
    username: string;
    password: string;
}
export interface AuthTokens{
    access: string;
    refresh: string;
}
export interface UserLocation{
    id: number;
    name: string;
}
export interface City{
    id: number;
    name: string;
}
export interface Branch{
    id: number;
    name: string;
    address: string;
    postal_code: string;
    city: City;
    phone_number: string;
    email: string;
    is_active: boolean;
}
export interface User{
    id: number;
    username: string;
    role: 'OWNER'|'MANAGER'|'TECHNICIAN';
    role_display?: string;
    first_name?: string;
    last_name?: string;
    location: number | null;
    location_name: string | null;
}
export interface Employee extends Omit<User, 'location' | 'location_name'>{
    location: UserLocation | null;
    is_active: boolean;
}