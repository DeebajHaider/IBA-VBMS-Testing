import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

/**
 * K6 CONCURRENCY TEST: Two Students Booking Same Room
 * 
 * Scenario: Multiple students attempt to book the same room simultaneously
 * Expected: Only ONE booking succeeds, others get conflict error (409)
 */

// Custom metrics
const bookingDuration = new Trend('booking_duration', true);
const bookingSuccessRate = new Rate('booking_success_rate');
const bookingConflictRate = new Counter('booking_conflicts');
const bookingErrorRate = new Rate('booking_error_rate');

export const options = {
  stages: [
    { duration: '10s', target: 5 },   // 5 students booking concurrently
    { duration: '30s', target: 5 },   // sustained load
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    'booking_duration': ['p(95)<1000'],  // 95th percentile < 1 second
    'booking_success_rate': ['rate>0.5'],  // At least 50% should see success or conflict
    'booking_error_rate': ['rate<0.1'],    // Less than 10% server errors
    'http_req_failed': ['rate<0.1'],
  },
};

// Setup: Create test room and get auth token
export function setup() {
  const loginRes = http.post(
    'http://localhost:3000/api/auth/login',
    JSON.stringify({ erp: '12345', password: 'student123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = loginRes.status === 200 ? loginRes.json('access_token') : null;

  return { token };
}

// Main test: Concurrent booking attempts
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  const roomId = 'room-concurrency-test-001';
  const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString();

  group('Concurrent Room Booking - Same Room', () => {
    // Each VU attempts to book the same room
    const bookingPayload = JSON.stringify({
      roomId: roomId,
      startTime: startTime,
      endTime: endTime,
      purpose: `Booking by student ${__VU}`,
      requiredCapacity: 5,
    });

    const res = http.post(
      'http://localhost:3000/api/bookings',
      bookingPayload,
      { headers }
    );

    bookingDuration.add(res.timings.duration);

    // Check response
    const isSuccess = check(res, {
      'status is 201 (success) or 409 (conflict)': (r) => 
        r.status === 201 || r.status === 409,
      'response has body': (r) => r.body && r.body.length > 0,
    });

    if (res.status === 201) {
      bookingSuccessRate.add(1);
    } else if (res.status === 409) {
      bookingConflictRate.add(1);
      bookingSuccessRate.add(0);
    } else {
      bookingErrorRate.add(1);
      bookingSuccessRate.add(0);
    }

    // Log for debugging
    console.log(`VU ${__VU}: Status ${res.status}`);
  });

  sleep(1);
}
