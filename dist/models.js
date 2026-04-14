export const VALID_DURATIONS = [60, 120];
export const MIN_INTERVAL_MINUTES = 15;
export function isValidDuration(duration) {
    return VALID_DURATIONS.includes(duration);
}
export function normalizeDateTime(value) {
    return new Date(value).toISOString();
}
export function reservationOverlaps(existing, next) {
    if (existing.roomId !== next.roomId)
        return false;
    const existingStart = new Date(existing.startAt).getTime();
    const existingEnd = existingStart + existing.durationMinutes * 60000;
    const nextStart = new Date(next.startAt).getTime();
    const nextEnd = nextStart + next.durationMinutes * 60000;
    const intervalMs = MIN_INTERVAL_MINUTES * 60000;
    return !(nextEnd + intervalMs <= existingStart || nextStart >= existingEnd + intervalMs);
}
export function validateReservationPayload(payload) {
    if (!payload.roomId)
        return 'Sala é obrigatória.';
    if (!payload.patientId)
        return 'Identificação do paciente é obrigatória.';
    if (!payload.startAt || Number.isNaN(Date.parse(payload.startAt))) {
        return 'Data e horário válidos são obrigatórios.';
    }
    if (!isValidDuration(payload.durationMinutes)) {
        return 'A duração deve ser 60 ou 120 minutos.';
    }
    return null;
}
