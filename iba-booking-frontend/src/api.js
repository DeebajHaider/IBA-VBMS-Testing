// src/api.js
// ─────────────────────────────────────────────────────────────
// Drop this file into your React project at src/api.js
// It replaces all the mock data in the frontend with real API calls.
// ─────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ── Token helpers ──────────────────────────────────────────────
export const getToken  = ()        => localStorage.getItem('iba_token');
export const setToken  = (t)       => localStorage.setItem('iba_token', t);
export const clearToken = ()       => localStorage.removeItem('iba_token');
export const getStoredUser = ()    => {
  const u = localStorage.getItem('iba_user');
  return u ? JSON.parse(u) : null;
};
export const setStoredUser = (u)   => localStorage.setItem('iba_user', JSON.stringify(u));
export const clearStoredUser = ()  => localStorage.removeItem('iba_user');

// ── Core fetch wrapper ─────────────────────────────────────────
async function req(method, path, body) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

const get    = (path)        => req('GET',    path);
const post   = (path, body)  => req('POST',   path, body);
const patch  = (path, body)  => req('PATCH',  path, body);
const del    = (path)        => req('DELETE', path);

// ── AUTH ───────────────────────────────────────────────────────
export const api = {

  auth: {
    /** Returns { access_token, user } */
    login: (erp, password) => post('/auth/login', { erp, password }),
  },

  // ── USERS ────────────────────────────────────────────────────
  users: {
    list:   ()         => get('/users'),
    get:    (id)       => get(`/users/${id}`),
    create: (data)     => post('/users', data),
    remove: (id)       => del(`/users/${id}`),
  },

  // ── BUILDINGS ────────────────────────────────────────────────
  buildings: {
    list:   ()         => get('/buildings'),
    get:    (id)       => get(`/buildings/${id}`),
    create: (data)     => post('/buildings', data),
    remove: (id)       => del(`/buildings/${id}`),
  },

  // ── ROOMS ────────────────────────────────────────────────────
  rooms: {
    list:         (buildingId)       => get(`/rooms${buildingId ? `?building_id=${buildingId}` : ''}`),
    get:          (id)               => get(`/rooms/${id}`),
    availability: (id, date)         => get(`/rooms/${id}/availability?date=${date}`),
    create:       (data)             => post('/rooms', data),
    remove:       (id)               => del(`/rooms/${id}`),
  },

  // ── BOOKINGS ─────────────────────────────────────────────────
  bookings: {
    /** Admin/PO: list all. Student: list own. Optional ?status=pending */
    list:    (params = {})  => {
      const qs = new URLSearchParams(params).toString();
      return get(`/bookings${qs ? `?${qs}` : ''}`);
    },
    get:     (id)           => get(`/bookings/${id}`),
    create:  (data)         => post('/bookings', data),
    approve: (id)           => patch(`/bookings/${id}/approve`),
    reject:  (id)           => patch(`/bookings/${id}/reject`),
    cancel:  (id)           => patch(`/bookings/${id}/cancel`),
  },

  // ── BLOCKED SLOTS ────────────────────────────────────────────
  blockedSlots: {
    /** Optional ?room_id=xxx&date=2025-06-10 */
    list:   (roomId, date)  => {
      const qs = new URLSearchParams({
        ...(roomId ? { room_id: roomId } : {}),
        ...(date   ? { date }            : {}),
      }).toString();
      return get(`/blocked-slots${qs ? `?${qs}` : ''}`);
    },
    /** data = { room_id, date, slot_ids: [1,2,3], reason } */
    create: (data)          => post('/blocked-slots', data),
    remove: (id)            => del(`/blocked-slots/${id}`),
  },

  // ── TIME SLOTS ───────────────────────────────────────────────
  timeSlots: {
    list: () => get('/time-slots'),
  },
};