import crypto from 'crypto';
import type { DatabaseState, Patient } from './models.ts';

const HASH_ALGORITHM = 'sha256';
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const ITERATIONS = 100000;

export interface RegistrationPayload {
  name: string;
  phone: string;
  address: string;
  referredBy?: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return Promise.resolve(false);

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
    });
  });
}

export function validateRegistration(payload: RegistrationPayload): string | null {
  if (!payload.name?.trim()) return 'Nome é obrigatório.';
  if (!payload.phone?.trim()) return 'Telefone é obrigatório.';
  if (!payload.address?.trim()) return 'Endereço é obrigatório.';
  if (!payload.username?.trim()) return 'Usuário é obrigatório.';
  if (!payload.password || payload.password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  return null;
}

export function isUsernameTaken(state: DatabaseState, username: string): boolean {
  return state.patients.some((patient) => patient.username === username);
}

export function registerPatient(
  state: DatabaseState,
  payload: RegistrationPayload,
  passwordHash: string
): Patient {
  const patient: Patient = {
    id: crypto.randomUUID(),
    name: payload.name.trim(),
    phone: payload.phone.trim(),
    address: payload.address.trim(),
    referredBy: payload.referredBy?.trim() || undefined,
    username: payload.username.trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  state.patients.push(patient);
  return patient;
}
