import api from './axios';
import type {
  ClientOption,
  ManagedClient,
  LocationServicePrice,
  PartOption,
  PublicTicketSummary,
  ServicePricing,
  Ticket,
  TicketStatus,
} from '../types/service';

export type ApiPage<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export const getTickets = async (search?: string, statuses?: TicketStatus[], page = 1) => {
  const response = await api.get<ApiPage<Ticket>>('service/tickets/', {
    params: {
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...(statuses?.length ? { status: statuses.join(',') } : {}),
      page,
    },
  });
  return response.data;
};

export const getTicket = async (id: number) =>
  (await api.get<Ticket>(`service/tickets/${id}/`)).data;

export const requestPublicTrackingCode = async (email: string) =>
  (await api.post<{ detail: string }>('service/public-track/request-code/', { email })).data;

export const verifyPublicTrackingCode = async (email: string, code: string) =>
  (await api.post<{ tracking_token: string }>('service/public-track/verify-code/', { email, code })).data;

export const getPublicTickets = async (trackingToken: string) =>
  (await api.post<ApiPage<PublicTicketSummary>>('service/public-track/tickets/', {
    tracking_token: trackingToken,
  })).data.results;

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

export const takeOverTicket = async (id: number) =>
  (await api.post<Ticket>(`service/tickets/${id}/take-over/`)).data;

export const changeTicketStatus = async (id: number, status: TicketStatus, comment?: string) =>
  (await api.post<Ticket>(`service/tickets/${id}/change-status/`, { status, comment })).data;

export const resendReadyEmail = async (id: number) =>
  (await api.post<{ detail: string }>(`service/tickets/${id}/send-ready-email/`)).data;

export const revealDevicePasscode = async (id: number) =>
  (await api.get<{ device_passcode: string }>(`service/tickets/${id}/device-passcode/`)).data;

export const waitForTicketParts = async (id: number, comment?: string) =>
  (await api.post<Ticket>(`service/tickets/${id}/wait-for-parts/`, { comment })).data;

export const resumeTicketWork = async (id: number, comment?: string) =>
  (await api.post<Ticket>(`service/tickets/${id}/resume-work/`, { comment })).data;

export const resumeTicketRepair = async (id: number, comment?: string) =>
  (await api.post<Ticket>(`service/tickets/${id}/resume-repair/`, { comment })).data;

export const returnTicketToDiagnosis = async (id: number, comment?: string) =>
  (await api.post<Ticket>(`service/tickets/${id}/return-to-diagnosis/`, { comment })).data;

export const updateTicket = async (id: number, data: { diagnosis_note?: string; estimated_cost?: string }) =>
  (await api.patch<Ticket>(`service/tickets/${id}/`, data)).data;

export const updateTicketCosts = async (id: number, data: { estimated_cost?: string; final_cost?: string }) =>
  (await api.patch<Ticket>(`service/tickets/${id}/`, data)).data;

export const addTicketPart = async (ticket: number, part: number, quantity: number) =>
  (await api.post('service/ticket-parts/', { ticket, part, quantity })).data;

export const deleteTicketPart = async (id: number) =>
  api.delete(`service/ticket-parts/${id}/`);

export const addTicketService = async (ticket: number, name: string, price: string) =>
  (await api.post('service/ticket-services/', { ticket, name, price })).data;

export const deleteTicketService = async (id: number) =>
  api.delete(`service/ticket-services/${id}/`);

export const getServicePricing = async () =>
  (await api.get<ApiPage<ServicePricing>>('service/services/')).data.results;

export const createServicePricing = async (data: {
  name: string;
  description?: string;
  default_price: string;
  is_active?: boolean;
}) => (await api.post<ServicePricing>('service/services/', data)).data;

export const updateServicePricing = async (id: number, data: Partial<{
  name: string;
  description: string;
  default_price: string;
  is_active: boolean;
}>) => (await api.patch<ServicePricing>(`service/services/${id}/`, data)).data;

export const getLocationServicePrices = async () =>
  (await api.get<ApiPage<LocationServicePrice>>('service/location-service-prices/')).data.results;

export const createLocationServicePrice = async (data: {
  location: number;
  service: number;
  custom_price?: string | null;
  is_available?: boolean;
}) => (await api.post<LocationServicePrice>('service/location-service-prices/', data)).data;

export const updateLocationServicePrice = async (id: number, data: Partial<{
  custom_price: string | null;
  is_available: boolean;
}>) => (await api.patch<LocationServicePrice>(`service/location-service-prices/${id}/`, data)).data;

export const getClients = async (search?: string, page = 1) =>
  (await api.get<ApiPage<ClientOption>>('clients/clients/', {
    params: {
      minimal: 'true',
      ...(search?.trim() ? { search: search.trim() } : {}),
      page,
    },
  })).data;

export const createClient = async (data: {
  first_name: string;
  last_name: string;
  email?: string;
  phone_number: string;
}) => (await api.post<ClientOption>('clients/clients/', data)).data;

export const getManagedClients = async (search?: string, page = 1) =>
  (await api.get<ApiPage<ManagedClient>>('clients/clients/', {
    params: { ...(search?.trim() ? { search: search.trim() } : {}), page },
  })).data;

export const updateClient = async (id: number, data: {
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
}) => (await api.patch<ManagedClient>(`clients/clients/${id}/`, data)).data;

export const anonymizeClient = async (id: number) =>
  api.delete(`clients/clients/${id}/`);

export const getParts = async (page = 1) => (await api.get<ApiPage<PartOption>>('inventory/parts/', { params: { page } })).data;