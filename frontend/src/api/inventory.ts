import api from './axios';
import type {Stock, Part, PartCategory} from '../types/inventory';
import type { CreatePartPayload } from '../types/inventory';
export const getStocks = async(search?: string, category?: string, location?: string)=>{
  const params = {
    ...(search?.trim() ? {search: search.trim()} : {}),
    ...(category ? {category} : {}),
    ...(location ? {location} : {}),
  };
    const response = await api.get<Stock[]>('inventory/stock/',{params});
    return response.data;
}
export const getLowStock = async()=>{
    const response = await api.get<Stock[]>('inventory/stock/low-stock/');
    return response.data;
}
export const getParts = async(search?: string)=>{
  const params = search?.trim() ? {search: search.trim()} : {};
  const response = await api.get<Part[]>('inventory/parts/', {params});
    return response.data
}
export const getCategories=async()=>{
    const response = await api.get<PartCategory[]>('inventory/categories/');
    return response.data;
}

export const createPart = async (data: CreatePartPayload) => {
  const response = await api.post<Part>('inventory/parts/', data);
  return response.data;
};
export const receiveGoods = async (identifier: string, quantity: number) => {
  const response = await api.post('inventory/stock/receive-goods/', { identifier, quantity });
  return response.data;
};
export const updatePart = async (id: number, data: CreatePartPayload) => {
  const response = await api.patch<Part>(`inventory/parts/${id}/`, data);
  return response.data;
};
export const updateStockMinimum = async (id: number, minQuantity: number) => {
  const response = await api.patch<Stock>(`inventory/stock/${id}/`, {
    min_quantity: minQuantity,
  });
  return response.data;
};