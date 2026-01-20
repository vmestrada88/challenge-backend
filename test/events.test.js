/**
 * Imports the `fetch` function from the 'node-fetch' package, allowing you to make HTTP requests in Node.js environments.
 * @module fetch
 * @see {@link https://www.npmjs.com/package/node-fetch|node-fetch documentation}
 */
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

describe('API Endpoints', () => {
    // Increase timeout for HTTP requests
    jest.setTimeout(5000);

    // Test for GET /getUsers: should return an array of users
    test('GET /getUsers should return users', async () => {
        const res = await fetch(`${BASE_URL}/getUsers`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
    });

    // Test for GET /getEvents: should return an array of events
    test('GET /getEvents should return events', async () => {
        const res = await fetch(`${BASE_URL}/getEvents`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
    });

    // Test for POST /addEvent: should add an event or return 503 if the circuit breaker is active
    test('POST /addEvent should add event or handle circuit breaker', async () => {
        const res = await fetch(`${BASE_URL}/addEvent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Event', userId: '1' })
        });
        // Can be 200 (success) or 503 (circuit breaker active)
        expect([200, 503]).toContain(res.status);
    });
});
