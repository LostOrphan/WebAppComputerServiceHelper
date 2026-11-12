import type { User } from '../types/auth';

export const roleLabels: Record<User['role'], string> = {
  OWNER: 'Zarząd firmy',
  MANAGER: 'Kierownik oddziału',
  TECHNICIAN: 'Serwisant',
};

export const getRoleLabel = (role: User['role'] | string | undefined) =>
  role && role in roleLabels ? roleLabels[role as User['role']] : role || '';
