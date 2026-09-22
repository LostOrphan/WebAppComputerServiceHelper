export type TicketStatus = 'NEW' | 'DIAGNOSIS' | 'PARTS' | 'IN_PROGRESS' | 'READY' | 'CLOSED' | 'REJECTED';

export interface TicketClient {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string | null;
}

export interface TicketWorker {
  id: number;
  username: string;
  full_name: string;
}

export interface TicketPart {
  id: number;
  part: { id: number; name: string; sku: string; sell_price_gross: string };
  quantity: number;
  price_at_use: string;
  total_price: number;
}

export interface TicketHistory {
  id: number;
  status: TicketStatus;
  status_display: string;
  changed_at: string;
  changed_by_name: string;
  comment: string;
}

export interface Ticket {
  id: number;
  ticket_code: string;
  client: TicketClient;
  location: number;
  assigned_worker: TicketWorker | null;
  device_name: string;
  serial_number: string;
  device_passcode: string;
  problem_description: string;
  diagnosis_note: string;
  status: TicketStatus;
  status_display: string;
  estimated_cost: string | null;
  final_cost: string | null;
  total_parts_cost: number;
  used_parts: TicketPart[];
  status_history: TicketHistory[];
  created_at: string;
  updated_at: string;
}

export interface ClientOption {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  email?: string | null;
}

export interface PartOption {
  id: number;
  name: string;
  sku: string;
  sell_price_gross: string;
}