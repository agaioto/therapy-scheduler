export interface Patient {
  id: string;
  name: string;
  phone: string;
  address: string;
  referredBy?: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  therapy: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  patientId: string;
  roomId: string;
  startAt: string; // ISO timestamp
  durationMinutes: 60 | 120;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export const VALID_DURATIONS = [60, 120] as const;
export const MIN_INTERVAL_MINUTES = 15;

export function isValidDuration(duration: number): duration is 60 | 120 {
  return VALID_DURATIONS.includes(duration as 60 | 120);
}

export function normalizeDateTime(value: string): string {
  return new Date(value).toISOString();
}

export function reservationOverlaps(
  existing: Reservation,
  next: Pick<Reservation, 'roomId' | 'startAt' | 'durationMinutes'>
): boolean {
  if (existing.roomId !== next.roomId) return false;

  const existingStart = new Date(existing.startAt).getTime();
  const existingEnd = existingStart + existing.durationMinutes * 60_000;
  const nextStart = new Date(next.startAt).getTime();
  const nextEnd = nextStart + next.durationMinutes * 60_000;

  const intervalMs = MIN_INTERVAL_MINUTES * 60_000;

  return !(nextEnd + intervalMs <= existingStart || nextStart >= existingEnd + intervalMs);
}

export function validateReservationPayload(payload: {
  roomId: string;
  patientId: string;
  startAt: string;
  durationMinutes: number;
}): string | null {
  if (!payload.roomId) return 'Sala é obrigatória.';
  if (!payload.patientId) return 'Identificação do paciente é obrigatória.';
  if (!payload.startAt || Number.isNaN(Date.parse(payload.startAt))) {
    return 'Data e horário válidos são obrigatórios.';
  }
  if (!isValidDuration(payload.durationMinutes)) {
    return 'A duração deve ser 60 ou 120 minutos.';
  }
  return null;
}

