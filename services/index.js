/**
 * Creates a Fastify server instance with logging enabled.
 * 
 * @constant
 * @type {import('fastify').FastifyInstance}
 * @see {@link https://www.fastify.io/docs/latest/Reference/Instance/|Fastify Instance Documentation}
 */
const fastify = require('fastify')({ logger: true });
const listenMock = require('../mock-server');

fastify.get('/getUsers', async (request, reply) => {
  const resp = await fetch('http://event.com/getUsers');
  const data = await resp.json();
  reply.send(data); 
});

// ---
// RESILIENCE: Manual Circuit Breaker for /addEvent
// If the external service fails 3+ times in 30s, the circuit "opens" and new requests are rejected
// Periodically probes if the external service has recovered to resume accepting requests
// ---

// --- Circuit Breaker State ---
// failureTimestamps: stores timestamps of recent failures
const failureTimestamps = [];
// circuitOpen: indicates if the circuit is open (rejecting requests)
let circuitOpen = false;
// nextProbe: reference to the timer for the next recovery attempt
let nextProbe = null;
// FAILURE_WINDOW: time window to count failures (30s)
const FAILURE_WINDOW = 30 * 1000; // 30 seconds
// FAILURE_THRESHOLD: number of failures to open the circuit
const FAILURE_THRESHOLD = 3;
// BACKOFF_TIME: wait time before probing for recovery
const BACKOFF_TIME = 30 * 1000; // 30 seconds

// probeExternalService: tries a dummy request to see if the external service has recovered
async function probeExternalService() {
  try {
  const resp = await fetch('http://event.com/addEvent', {
    method: 'POST',
    body: JSON.stringify({ name: '__probe__', userId: 'probe' })
  });
  if (resp.ok) {
    circuitOpen = false;
    failureTimestamps.length = 0;
    nextProbe = null;
    return true;
  }
  } catch {}
  return false;
}

fastify.post('/addEvent', async (request, reply) => {
  // If the circuit is open, immediately reject the request
  if (circuitOpen) {
  reply.code(503).send({ error: 'External service temporarily unavailable. Please try again later.' });
  return;
  }
  try {
  // Try to add the event normally
  const resp = await fetch('http://event.com/addEvent', {
    method: 'POST',
    body: JSON.stringify({
    id: new Date().getTime(),
    ...request.body
    })
  });
  if (!resp.ok) throw new Error('External service error');
  const data = await resp.json();
  reply.send(data);
  // On success, clean up old failures outside the window
  const now = Date.now();
  while (failureTimestamps.length && now - failureTimestamps[0] > FAILURE_WINDOW) {
    failureTimestamps.shift();
  }
  } catch (err) {
  // Register timestamp of the failure
  const now = Date.now();
  failureTimestamps.push(now);
  // Clean up old failures outside the window
  while (failureTimestamps.length && now - failureTimestamps[0] > FAILURE_WINDOW) {
    failureTimestamps.shift();
  }
  // If threshold is exceeded, open circuit and schedule probe
  if (failureTimestamps.length >= FAILURE_THRESHOLD && !circuitOpen) {
    circuitOpen = true;
    // Schedule recovery attempt after BACKOFF_TIME
    if (!nextProbe) {
    nextProbe = setTimeout(async () => {
      const ok = await probeExternalService();
      if (!ok) {
      // If still failing, retry after another BACKOFF_TIME
      nextProbe = setTimeout(arguments.callee, BACKOFF_TIME);
      }
    }, BACKOFF_TIME);
    }
  }
  reply.code(503).send({ error: 'Could not add event. External service unavailable.' });
  }
});

fastify.get('/getEvents', async (request, reply) => {  
  const resp = await fetch('http://event.com/getEvents');
  const data = await resp.json();
  reply.send(data);
});

/*******************************************************************
*  PERFORMANCE OPTIMIZATION IN /getEventsByUserId/:id
*  The original endpoint fetched a user's events sequentially,
*  which was slow with many events. Now, event requests are made
*  in parallel using Promise.all, speeding up the response. The original
*  code is commented for reference and comparison.
*******************************************************************/
fastify.get('/getEventsByUserId/:id', async (request, reply) => {
  const { id } = request.params;
  const user = await fetch('http://event.com/getUserById/' + id);
  const userData = await user.json();
  const userEvents = userData.events;

  // --- Original sequential code (slow) ---
  // fastify.get('/getEventsByUserId/:id', async (request, reply) => {
  //     const { id } = request.params;
  //     const user = await fetch('http://event.com/getUserById/' + id);
  //     const userData = await user.json();
  //     const userEvents = userData.events;
  //     const eventArray = [];
  //     
  //     for(let i = 0; i < userEvents.length; i++) {
  //         const event = await fetch('http://event.com/getEventById/' + userEvents[i]);
  //         const eventData = await event.json();
  //         eventArray.push(eventData);
  //     }
  //     reply.send(eventArray);
  // });

  // --- Optimized version: fetch in parallel ---
  const eventArray = await Promise.all(
    userEvents.map(async (eventId) => {
    const event = await fetch('http://event.com/getEventById/' + eventId);
    return event.json();
    })
  );
  reply.send(eventArray);
});

fastify.listen({ port: 3000 }, (err) => {
  listenMock();
  if (err) {
    fastify.log.error(err);
    process.exit();
  }
});
