import axios from "axios";

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
    headers:{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

api.interceptors.request.use(
    (config)=>{
        const accessToken = localStorage.getItem('access_token');
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
            const refreshToken = localStorage.getItem('refresh_token');
           
            if(refreshToken){
                try{ 
                    const response = await axios.post('http://127.0.0.1:8000/api/auth/token/refresh/', {
                        refresh: refreshToken,
                });
                const {access} = response.data;
                localStorage.setItem('access_token',access);

                originalRequest.headers.Authorization = `Bearer ${access}`;
                return api(originalRequest);
            }catch(refreshError){
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href='/login';
                return Promise.reject(refreshError);
            }
        }
    }
    return Promise.reject(error);
}
);
export default api;