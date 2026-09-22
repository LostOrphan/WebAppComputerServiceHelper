import api from './axios';
import type { ClientOption, PartOption, Ticket, TicketStatus } from '../types/service';

export const getTickets = async (search?: string, statuses?: TicketStatus[]) => {
  const response = await api.get<Ticket[]>('service/tickets/', {
    params: {
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...(statuses?.length ? { status: statuses.join(',') } : {}),
    },
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

export const getClients = async (search?: string) =>
  (await api.get<ClientOption[]>('clients/clients/', {
    params: {
      minimal: 'true',
      ...(search?.trim() ? { search: search.trim() } : {}),
    },
  })).data;

export const createClient = async (data: {
  first_name: string;
  last_name: string;
  email?: string;
  phone_number: string;
}) => (await api.post<ClientOption>('clients/clients/', data)).data;

export const getParts = async () => (await api.get<PartOption[]>('inventory/parts/')).data;