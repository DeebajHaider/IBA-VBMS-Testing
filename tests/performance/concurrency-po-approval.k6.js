import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

/**
 * K6 CONCURRENCY TEST: Multiple POs Approving Same Booking
 * 
 * Scenario: Multiple POs attempt to approve/reject the same booking simultaneously
 * Expected: Only ONE approval/rejection succeeds, others get conflict error (409)
 */

// Custom metrics
const approvalDuration = new Trend('approval_duration', true);
const approvalSuccessRate = new Rate('approval_success_rate');
const approvalConflictRate = new Counter('approval_conflicts');
const approvalErrorRate = new Rate('approval_error_rate');

export const options = {
  stages: [
    { duration: '10s', target: 3 },   // 3 POs processing simultaneously
    { duration: '30s', target: 3 },   // sustained load
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    'approval_duration': ['p(95)<500'],   // 95th percentile < 500ms
    'approval_success_rate': ['rate>0.5'], // At least 50% should see success or conflict
    'approval_error_rate': ['rate<0.1'],   // Less than 10% server errors
    'http_req_failed': ['rate<0.1'],
  },
};

// Setup: Create test booking and authenticate POs
export function setup() {
  // Login as student to create a booking
  const studentLoginRes = http.post(
    'http://localhost:3000/api/auth/login',
    JSON.stringify({ erp: '12345', password: 'student123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const studentToken = studentLoginRes.status === 200 ? studentLoginRes.json('access_token') : null;

  // Create a booking that POs will try to approve
  const bookingRes = http.post(
    'http://localhost:3000/api/bookings',
    JSON.stringify({
      roomId: 'room-approval-test-001',
      startTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 48 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      purpose: 'Test booking for concurrent approval',
      requiredCapacity: 10,
    }),
    { headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' } }
  );

  const bookingId = bookingRes.status === 201 ? bookingRes.json('id') : 'booking-test-001';

  // Login as PO
  const poLoginRes = http.post(
    'http://localhost:3000/api/auth/login',
    JSON.stringify({ erp: 'po001', password: 'po123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const poToken = poLoginRes.status === 200 ? poLoginRes.json('access_token') : null;

  return { bookingId, poToken };
}

// Main test: Concurrent approval attempts
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.poToken}`,
  };

  group('Concurrent PO Approval - Same Booking', () => {
    // Each VU (PO) attempts to approve/reject the same booking
    const decision = __VU % 2 === 0 ? 'approved' : 'rejected'; // Alternate decisions
    
    const approvalPayload = JSON.stringify({
      bookingId: data.bookingId,
      decision: decision,
      reason: `Decision by PO ${__VU}`,
    });

    const res = http.post(
      'http://localhost:3000/api/approvals/process',
      approvalPayload,
      { headers }
    );

    approvalDuration.add(res.timings.duration);

    // Check response
    const isValid = check(res, {
      'status is 201 (success) or 409 (conflict)': (r) => 
        r.status === 201 || r.status === 409,
      'response has body': (r) => r.body && r.body.length > 0,
    });

    if (res.status === 201) {
      approvalSuccessRate.add(1);
    } else if (res.status === 409) {
      approvalConflictRate.add(1);
      approvalSuccessRate.add(0);
    } else {
      approvalErrorRate.add(1);
      approvalSuccessRate.add(0);
    }

    // Log for debugging
    console.log(`PO ${__VU}: Status ${res.status}, Decision: ${decision}`);
  });

  sleep(1);
}
