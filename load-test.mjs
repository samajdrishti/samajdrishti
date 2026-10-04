import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.API_URL || 'http://localhost:5000';

export default function () {
  const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({
    email: 'admin@samajdrishti.gov.in',
    password: 'Admin@123',
  }), { headers: { 'Content-Type': 'application/json' } });
  check(login, { 'login 200': (r) => r.status === 200 });
  const token = login.json('token') || 'demo';

  const dash = http.get(`${BASE}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(dash, { 'dashboard 200': (r) => r.status === 200 });

  const overview = http.get(`${BASE}/api/monitoring/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(overview, { 'overview 200': (r) => r.status === 200 });

  const cameras = http.get(`${BASE}/api/monitoring/cameras?limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(cameras, { 'cameras 200': (r) => r.status === 200 });

  http.get(`${BASE}/api/monitoring/cameras/1/snapshot`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  sleep(1);
}