import api from './axios';
import type {Stock, Part, PartCategory} from '../types/inventory';
import type { CreatePartPayload } from '../types/inventory';
import type { ApiPage } from './service';
export const getStocks = async(search?: string, category?: string, location?: string, page = 1)=>{
  const params = {
    ...(search?.trim() ? {search: search.trim()} : {}),
    ...(category ? {category} : {}),
    ...(location ? {location} : {}),
    page,
  };
    const response = await api.get<ApiPage<Stock>>('inventory/stock/',{params});
    return response.data;
}
export const getLowStock = async()=>{
    const response = await api.get<ApiPage<Stock>>('inventory/stock/low-stock/');
    return response.data;
}
export const getParts = async(search?: string, page = 1)=>{
  const params = search?.trim() ? {search: search.trim()} : {};
  const response = await api.get<ApiPage<Part>>('inventory/parts/', {params: { ...params, page }});
    return response.data
}
export const getCategories=async()=>{
    const response = await api.get<ApiPage<PartCategory>>('inventory/categories/');
    return response.data.results;
}
export const createCategory = async (name: string) =>
  (await api.post<PartCategory>('inventory/categories/', { name })).data;

export const updateCategory = async (id: number, name: string) =>
  (await api.patch<PartCategory>(`inventory/categories/${id}/`, { name })).data;

export const deleteCategory = async (id: number) =>
  api.delete(`inventory/categories/${id}/`);

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