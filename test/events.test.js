const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

describe('API Endpoints', () => {
  jest.setTimeout(5000);

  test('GET /getUsers should return users', async () => {
    const res = await fetch(`${BASE_URL}/getUsers`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /getEvents should return events', async () => {
    const res = await fetch(`${BASE_URL}/getEvents`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST /addEvent should add event or handle circuit breaker', async () => {
    const res = await fetch(`${BASE_URL}/addEvent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Event', userId: '1' })
    });
    // Puede ser 200 o 503 si el circuit breaker está activo
    expect([200, 503]).toContain(res.status);
  });
});
