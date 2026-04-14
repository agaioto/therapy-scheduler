import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, loadDatabase, saveDatabase } from './db.js';
import { hashPassword, verifyPassword, validateRegistration, isUsernameTaken, registerPatient, } from './auth.js';
import { reservationOverlaps, validateReservationPayload, VALID_DURATIONS } from './models.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 4000);
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
};
function getContentType(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}
async function parseJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString('utf8');
    if (!body)
        return null;
    return JSON.parse(body);
}
function sendJson(res, status, payload) {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
    });
    res.end(body);
}
async function serveStaticFile(res, pathname) {
    const resolved = pathname.startsWith('/static/') ? pathname.slice('/static/'.length) : pathname.slice(1);
    let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, resolved);
    if (pathname === '/register')
        filePath = path.join(PUBLIC_DIR, 'register.html');
    if (pathname === '/login')
        filePath = path.join(PUBLIC_DIR, 'login.html');
    if (pathname === '/rooms')
        filePath = path.join(PUBLIC_DIR, 'rooms.html');
    if (pathname === '/reception')
        filePath = path.join(PUBLIC_DIR, 'reception.html');
    if (filePath.endsWith('/'))
        filePath = path.join(filePath, 'index.html');
    if (!filePath.startsWith(PUBLIC_DIR)) {
        return sendJson(res, 400, { error: 'Bad request' });
    }
    try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, {
            'Content-Type': getContentType(filePath),
            'Content-Length': data.length,
        });
        res.end(data);
    }
    catch (error) {
        sendJson(res, 404, { error: 'Not found' });
    }
}
function parseDateFromYMD(value) {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
        return null;
    }
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}
function isBusinessDay(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
}
function isSameLocalDate(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function getAvailableSlots(reservations, roomId, date, durationMinutes) {
    const startOfDay = new Date(date);
    startOfDay.setHours(8, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(19, 0, 0, 0);
    const latestStart = new Date(endOfDay.getTime() - durationMinutes * 60000);
    const roomReservations = reservations.filter((reservation) => {
        if (reservation.roomId !== roomId)
            return false;
        return isSameLocalDate(new Date(reservation.startAt), date);
    });
    const slots = [];
    for (let current = new Date(startOfDay); current <= latestStart; current = new Date(current.getTime() + 15 * 60000)) {
        const candidateISO = current.toISOString();
        const nextReservation = {
            roomId,
            startAt: candidateISO,
            durationMinutes: durationMinutes,
        };
        const isBlocked = roomReservations.some((reservation) => reservationOverlaps(reservation, nextReservation));
        if (!isBlocked) {
            slots.push(current.toTimeString().slice(0, 5));
        }
    }
    return slots;
}
async function handleRegister(req, res) {
    const body = await parseJsonBody(req);
    const state = await loadDatabase();
    const validationError = validateRegistration(body);
    if (validationError) {
        return sendJson(res, 400, { error: validationError });
    }
    if (isUsernameTaken(state, body.username)) {
        return sendJson(res, 409, { error: 'Nome de usuário já está em uso.' });
    }
    const passwordHash = await hashPassword(body.password);
    const patient = registerPatient(state, body, passwordHash);
    await saveDatabase(state);
    return sendJson(res, 201, {
        id: patient.id,
        name: patient.name,
        username: patient.username,
        createdAt: patient.createdAt,
    });
}
async function handleLogin(req, res) {
    const body = await parseJsonBody(req);
    const state = await loadDatabase();
    const loginPayload = body;
    const patient = state.patients.find((entry) => entry.username === loginPayload.username);
    if (!patient) {
        return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    }
    const isValid = await verifyPassword(loginPayload.password, patient.passwordHash);
    if (!isValid) {
        return sendJson(res, 401, { error: 'Usuário ou senha incorretos.' });
    }
    return sendJson(res, 200, {
        id: patient.id,
        name: patient.name,
        username: patient.username,
        createdAt: patient.createdAt,
    });
}
async function handleRooms(req, res) {
    const state = await loadDatabase();
    return sendJson(res, 200, { rooms: state.rooms });
}
async function handleAvailability(req, res) {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const roomId = requestUrl.searchParams.get('roomId') ?? '';
    const dateValue = requestUrl.searchParams.get('date') ?? '';
    const durationMinutes = Number(requestUrl.searchParams.get('durationMinutes'));
    if (!roomId) {
        return sendJson(res, 400, { error: 'Sala é obrigatória.' });
    }
    if (!dateValue) {
        return sendJson(res, 400, { error: 'Data é obrigatória.' });
    }
    if (!VALID_DURATIONS.includes(durationMinutes)) {
        return sendJson(res, 400, { error: 'A duração deve ser 60 ou 120 minutos.' });
    }
    const date = parseDateFromYMD(dateValue);
    if (!date) {
        return sendJson(res, 400, { error: 'Data deve estar no formato AAAA-MM-DD.' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
        return sendJson(res, 200, { roomId, date: dateValue, durationMinutes, slots: [] });
    }
    const state = await loadDatabase();
    const room = state.rooms.find((entry) => entry.id === roomId);
    if (!room) {
        return sendJson(res, 404, { error: 'Sala não encontrada.' });
    }
    if (!isBusinessDay(date)) {
        return sendJson(res, 200, {
            roomId,
            date: dateValue,
            durationMinutes,
            slots: [],
        });
    }
    const slots = getAvailableSlots(state.reservations, roomId, date, durationMinutes);
    return sendJson(res, 200, {
        roomId,
        date: dateValue,
        durationMinutes,
        slots,
    });
}
async function handleCreateReservation(req, res) {
    const body = await parseJsonBody(req);
    if (!body)
        return sendJson(res, 400, { error: 'Corpo da requisição é obrigatório.' });
    const validationError = validateReservationPayload(body);
    if (validationError)
        return sendJson(res, 400, { error: validationError });
    const state = await loadDatabase();
    const room = state.rooms.find((r) => r.id === body.roomId);
    if (!room)
        return sendJson(res, 404, { error: 'Sala não encontrada.' });
    const patient = state.patients.find((p) => p.id === body.patientId);
    if (!patient)
        return sendJson(res, 404, { error: 'Paciente não encontrado.' });
    const startAt = new Date(body.startAt);
    if (startAt < new Date()) {
        return sendJson(res, 400, { error: 'Não é possível reservar em datas passadas.' });
    }
    const day = startAt.getDay();
    if (day === 0 || day === 6) {
        return sendJson(res, 400, { error: 'Reservas são permitidas apenas de segunda a sexta.' });
    }
    const activeReservations = state.reservations.filter((r) => r.status === 'confirmed');
    // Task 9: Limitar reservas diárias por paciente
    const sameDayReservations = activeReservations.filter((r) => r.patientId === body.patientId &&
        new Date(r.startAt).getFullYear() === startAt.getFullYear() &&
        new Date(r.startAt).getMonth() === startAt.getMonth() &&
        new Date(r.startAt).getDate() === startAt.getDate());
    if (sameDayReservations.length >= 2) {
        return sendJson(res, 400, { error: 'Cada paciente pode realizar no máximo duas reservas por dia.' });
    }
    const hour = startAt.getHours();
    const endHour = hour + body.durationMinutes / 60;
    if (hour < 8 || endHour > 19) {
        return sendJson(res, 400, { error: 'Reservas devem ser entre 08:00 e 19:00.' });
    }
    const conflict = activeReservations.some((r) => reservationOverlaps(r, { roomId: body.roomId, startAt: body.startAt, durationMinutes: body.durationMinutes }));
    if (conflict) {
        return sendJson(res, 409, { error: 'Este horário conflita com uma reserva existente.' });
    }
    const reservation = {
        id: globalThis.crypto.randomUUID(),
        patientId: body.patientId,
        roomId: body.roomId,
        startAt: startAt.toISOString(),
        durationMinutes: body.durationMinutes,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
    };
    state.reservations.push(reservation);
    await saveDatabase(state);
    return sendJson(res, 201, {
        ...reservation,
        roomName: room.name,
        therapy: room.therapy,
        patientName: patient.name,
    });
}
async function handleGetReservations(req, res) {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const patientId = requestUrl.searchParams.get('patientId') ?? '';
    if (!patientId) {
        return sendJson(res, 400, { error: 'Identificação do paciente é obrigatória.' });
    }
    const state = await loadDatabase();
    const reservations = state.reservations
        .filter((r) => r.patientId === patientId && r.status === 'confirmed')
        .map((r) => {
        const room = state.rooms.find((rm) => rm.id === r.roomId);
        return {
            ...r,
            roomName: room?.name ?? '',
            therapy: room?.therapy ?? '',
        };
    })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return sendJson(res, 200, { reservations });
}
async function handleCancelReservation(req, res, reservationId) {
    const body = await parseJsonBody(req);
    const patientId = body?.patientId;
    if (!patientId) {
        return sendJson(res, 400, { error: 'Identificação do paciente é obrigatória.' });
    }
    const state = await loadDatabase();
    const reservation = state.reservations.find((r) => r.id === reservationId);
    if (!reservation) {
        return sendJson(res, 404, { error: 'Reserva não encontrada.' });
    }
    if (reservation.patientId !== patientId) {
        return sendJson(res, 403, { error: 'Você só pode cancelar suas próprias reservas.' });
    }
    if (reservation.status === 'cancelled') {
        return sendJson(res, 400, { error: 'Esta reserva já foi cancelada.' });
    }
    const now = Date.now();
    const startTime = new Date(reservation.startAt).getTime();
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
    if (hoursUntilStart < 24) {
        return sendJson(res, 400, { error: 'Cancelamentos devem ser feitos com pelo menos 24 horas de antecedência.' });
    }
    reservation.status = 'cancelled';
    await saveDatabase(state);
    return sendJson(res, 200, { message: 'Reserva cancelada com sucesso.', reservationId });
}
async function handleReceptionReservations(req, res) {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const dateValue = requestUrl.searchParams.get('date') ?? '';
    if (!dateValue) {
        return sendJson(res, 400, { error: 'Data é obrigatória.' });
    }
    const date = parseDateFromYMD(dateValue);
    if (!date) {
        return sendJson(res, 400, { error: 'Data deve estar no formato AAAA-MM-DD.' });
    }
    const state = await loadDatabase();
    const patientMap = new Map(state.patients.map((p) => [p.id, p]));
    const dayReservations = state.reservations.filter((r) => {
        if (r.status !== 'confirmed')
            return false;
        return isSameLocalDate(new Date(r.startAt), date);
    });
    const rooms = state.rooms.map((room) => {
        const reservations = dayReservations
            .filter((r) => r.roomId === room.id)
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .map((r) => ({
            id: r.id,
            startAt: r.startAt,
            durationMinutes: r.durationMinutes,
            patientName: patientMap.get(r.patientId)?.name ?? 'Desconhecido',
            status: r.status,
        }));
        return {
            roomId: room.id,
            roomName: room.name,
            therapy: room.therapy,
            reservations,
        };
    });
    return sendJson(res, 200, { date: dateValue, rooms });
}
async function handleReceptionReservationsRange(req, res) {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const fromValue = requestUrl.searchParams.get('from') ?? '';
    const toValue = requestUrl.searchParams.get('to') ?? '';
    if (!fromValue)
        return sendJson(res, 400, { error: 'Data inicial (from) é obrigatória.' });
    if (!toValue)
        return sendJson(res, 400, { error: 'Data final (to) é obrigatória.' });
    const fromDate = parseDateFromYMD(fromValue);
    const toDate = parseDateFromYMD(toValue);
    if (!fromDate)
        return sendJson(res, 400, { error: 'Data inicial deve estar no formato AAAA-MM-DD.' });
    if (!toDate)
        return sendJson(res, 400, { error: 'Data final deve estar no formato AAAA-MM-DD.' });
    if (toDate < fromDate) {
        return sendJson(res, 400, { error: 'A data final não pode ser anterior à data inicial.' });
    }
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 31) {
        return sendJson(res, 400, { error: 'O intervalo máximo permitido é de 31 dias.' });
    }
    const state = await loadDatabase();
    const patientMap = new Map(state.patients.map((p) => [p.id, p]));
    const roomMap = new Map(state.rooms.map((r) => [r.id, r]));
    const reservations = state.reservations
        .filter((r) => {
        if (r.status !== 'confirmed')
            return false;
        const d = new Date(r.startAt);
        return d >= fromDate && d < new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
    })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .map((r) => ({
        id: r.id,
        startAt: r.startAt,
        durationMinutes: r.durationMinutes,
        roomName: roomMap.get(r.roomId)?.name ?? 'Desconhecida',
        therapy: roomMap.get(r.roomId)?.therapy ?? '',
        patientName: patientMap.get(r.patientId)?.name ?? 'Desconhecido',
        status: r.status,
    }));
    return sendJson(res, 200, { from: fromValue, to: toValue, reservations });
}
async function requestHandler(req, res) {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = requestUrl.pathname;
    if (req.method === 'GET' && ['/', '/register', '/login', '/rooms', '/reception'].includes(pathname)) {
        return serveStaticFile(res, pathname);
    }
    if (req.method === 'GET' && pathname.startsWith('/static/')) {
        return serveStaticFile(res, pathname);
    }
    if (req.method === 'GET' && pathname === '/api/reception/reservations/range') {
        return handleReceptionReservationsRange(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/reception/reservations') {
        return handleReceptionReservations(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/rooms') {
        return handleRooms(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/availability') {
        return handleAvailability(req, res);
    }
    if (req.method === 'POST' && pathname === '/register') {
        return handleRegister(req, res);
    }
    if (req.method === 'POST' && pathname === '/login') {
        return handleLogin(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/reservations') {
        return handleGetReservations(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/reservations') {
        return handleCreateReservation(req, res);
    }
    const cancelMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/cancel$/);
    if (req.method === 'PATCH' && cancelMatch) {
        return handleCancelReservation(req, res, cancelMatch[1]);
    }
    if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { status: 'ok' });
    }
    sendJson(res, 404, { error: 'Not found' });
}
async function main() {
    await initDatabase();
    const server = http.createServer(requestHandler);
    server.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}
main().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
});
