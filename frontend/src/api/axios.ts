import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
    withCredentials: true,
    headers:{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
    accessToken = token;
};

export const refreshAccessToken = async () => {
    const response = await axios.post<{ access: string }>(
        `${api.defaults.baseURL}/auth/token/refresh/`,
        {},
        { withCredentials: true },
    );
    setAccessToken(response.data.access);
    return response.data.access;
};

api.interceptors.request.use(
    (config)=>{
        if(accessToken && config.headers){
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response)=>response,
    async (error) => {
        const originalRequest = error.config;

        if(error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('auth/token/')){
            originalRequest._retry = true;
            try {
                const access = await refreshAccessToken();
                originalRequest.headers.Authorization = `Bearer ${access}`;
                return api(originalRequest);
            } catch (refreshError) {
                setAccessToken(null);
                window.location.href='/work/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    },
);
export default api;