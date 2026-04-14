import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Patient, Room, Reservation } from './models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../therapy-scheduler-db.json');

export interface DatabaseState {
  patients: Patient[];
  rooms: Room[];
  reservations: Reservation[];
}

const DEFAULT_STATE: DatabaseState = {
  patients: [],
  rooms: [],
  reservations: [],
};

export async function loadDatabase(): Promise<DatabaseState> {
  try {
    const content = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(content) as DatabaseState;
  } catch (error) {
    return DEFAULT_STATE;
  }
}

export async function saveDatabase(state: DatabaseState): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(state, null, 2), 'utf8');
}

export async function initDatabase(): Promise<DatabaseState> {
  const state = await loadDatabase();

  if (state.rooms.length === 0) {
    state.rooms = [
      { id: 'room-1', name: 'Sala 1', therapy: 'Terapia A', createdAt: new Date().toISOString() },
      { id: 'room-2', name: 'Sala 2', therapy: 'Terapia B', createdAt: new Date().toISOString() },
      { id: 'room-3', name: 'Sala 3', therapy: 'Terapia C', createdAt: new Date().toISOString() },
      { id: 'room-4', name: 'Sala 4', therapy: 'Terapia D', createdAt: new Date().toISOString() },
      { id: 'room-5', name: 'Sala 5', therapy: 'Terapia E', createdAt: new Date().toISOString() },
    ];
  }

  await saveDatabase(state);
  return state;
}
