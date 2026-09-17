import api from './axios';
import type { ClientOption, PartOption, Ticket, TicketStatus } from '../types/service';

export const getTickets = async (search?: string) => {
  const response = await api.get<Ticket[]>('service/tickets/', {
    params: search?.trim() ? { search: search.trim() } : undefined,
  });
  return response.data;
};

export const createTicket = async (data: {
  client: number;
  location: number;
  device_name: string;
  serial_number?: string;
  device_passcode?: string;
  problem_description: string;
}) => (await api.post<Ticket>('service/tickets/', data)).data;

export const claimTicket = async (id: number) =>
  (await api.post<Ticket>(`service/tickets/${id}/claim/`)).data;

export const changeTicketStatus = async (id: number, status: TicketStatus, comment?: string) =>
  (await api.post<Ticket>(`service/tickets/${id}/change-status/`, { status, comment })).data;

export const updateTicket = async (id: number, data: { diagnosis_note?: string; estimated_cost?: string }) =>
  (await api.patch<Ticket>(`service/tickets/${id}/`, data)).data;

export const addTicketPart = async (ticket: number, part: number, quantity: number) =>
  (await api.post('service/ticket-parts/', { ticket, part, quantity })).data;

export const getClients = async () =>
  (await api.get<ClientOption[]>('clients/clients/', { params: { minimal: 'true' } })).data;

export const getParts = async () => (await api.get<PartOption[]>('inventory/parts/')).data;