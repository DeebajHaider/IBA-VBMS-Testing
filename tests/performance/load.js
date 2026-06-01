import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics — separate tracking for login vs read endpoints
// This lets us set DIFFERENT thresholds for login (slow, bcrypt) vs reads (fast)
// ---------------------------------------------------------------------------
const loginDuration = new Trend('login_duration', true);   // true = display in ms
const readDuration  = new Trend('read_duration',  true);
const errorRate     = new Rate('error_rate');

// ---------------------------------------------------------------------------
// options — the test plan: stages + thresholds
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp from 0 → 10 VUs over 30 seconds
    { duration: '1m',  target: 10 },  // hold at 10 VUs for 1 minute
    { duration: '20s', target: 0  },  // ramp back down to 0 over 20 seconds
  ],
  thresholds: {
    // 95th percentile of login requests must be under 1000ms
    // Login is bcrypt-heavy — intentionally slower, so we allow 1 second
    'login_duration': ['p(95)<1000'],

    // 95th percentile of all read requests (buildings + rooms) must be under 500ms
    'read_duration': ['p(95)<500'],

    // Zero HTTP failures allowed — no 5xx, no network errors
    'error_rate': ['rate<0.01'],  // <1% errors (we want 0, but 1% allows for flakes)

    // Also check the built-in metric as a backstop
    'http_req_failed': ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// setup() — runs ONCE before any VU starts
// Logs in and returns the token + a building_id for use in all VU iterations
// ---------------------------------------------------------------------------
export function setup() {
  const loginRes = http.post(
    'http://localhost:3000/api/auth/login',
    JSON.stringify({ erp: '12345', password: 'student123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  // If login fails here, the test can't run — bail out clearly
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.error(`Setup login failed: ${loginRes.status} ${loginRes.body}`);
    return { token: null, buildingId: null };
  }

  const token = loginRes.json('access_token');

  // Fetch buildings once to grab a real building_id for the rooms query
  const buildingsRes = http.get(
    'http://localhost:3000/api/buildings',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let buildingId = null;
  if (buildingsRes.status === 200) {
    const buildings = buildingsRes.json();
    if (Array.isArray(buildings) && buildings.length > 0) {
      buildingId = buildings[0].id;
    }
  }

  console.log(`Setup complete. Token acquired. Building ID: ${buildingId}`);
  return { token, buildingId };
}

// ---------------------------------------------------------------------------
// default function — the body of one VU's one iteration
// This runs in a loop for every VU for the entire test duration
// ---------------------------------------------------------------------------
export default function (data) {
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // --- Request 1: Login (once per iteration, to measure login under load) ---
  // We re-login on every iteration so we get real concurrent login measurements.
  // In a real user session you'd only log in once, but for load testing purposes
  // we want to stress the bcrypt path deliberately.
  const loginRes = http.post(
    'http://localhost:3000/api/auth/login',
    JSON.stringify({ erp: '12345', password: 'student123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  // Record login duration in our custom metric
  loginDuration.add(loginRes.timings.duration);

  // Check: login should succeed
  const loginOk = check(loginRes, {
    'login: status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login: has access_token':  (r) => {
      try { return !!r.json('access_token'); } catch { return false; }
    },
  });
  errorRate.add(!loginOk);  // add 1 to error rate if login failed

  // --- Request 2: GET /api/buildings ---
  const buildingsRes = http.get(
    'http://localhost:3000/api/buildings',
    { headers }
  );

  readDuration.add(buildingsRes.timings.duration);

  const buildingsOk = check(buildingsRes, {
    'buildings: status 200':   (r) => r.status === 200,
    'buildings: is array':     (r) => {
      try { return Array.isArray(r.json()); } catch { return false; }
    },
  });
  errorRate.add(!buildingsOk);

  // --- Request 3: GET /api/rooms?building_id=<X> ---
  // Use the building_id fetched in setup(); fall back to no filter if null
  const roomsUrl = data.buildingId
    ? `http://localhost:3000/api/rooms?building_id=${data.buildingId}`
    : 'http://localhost:3000/api/rooms';

  const roomsRes = http.get(roomsUrl, { headers });

  readDuration.add(roomsRes.timings.duration);

  const roomsOk = check(roomsRes, {
    'rooms: status 200': (r) => r.status === 200,
    'rooms: is array':   (r) => {
      try { return Array.isArray(r.json()); } catch { return false; }
    },
  });
  errorRate.add(!roomsOk);

  // Pause 1 second between iterations — simulates a real user pausing to read
  // Without this, VUs hammer the server as fast as possible, which is unrealistic
  sleep(1);
}

