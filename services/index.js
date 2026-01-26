/**
 * Creates a Fastify server instance with logging enabled.
 * 
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
// RESILIENCE: Manual Circuit Breaker + Retry with Exponential Backoff for /addEvent
// If the external service fails 3+ times in 30s, the circuit "opens" and new requests are rejected
// Periodically probes if the external service has recovered to resume accepting requests
// Retry mechanism: Retries failed requests up to 3 times with exponential backoff (1s, 2s, 4s)
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

// --- Retry Configuration ---
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Utility function: Retry with exponential backoff
 * Retries a failed async function up to maxRetries times with increasing delays
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} baseDelay - Initial delay in ms (default: 1000)
 * @returns {Promise} - Result of the function or throws error after all retries
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, baseDelay = INITIAL_RETRY_DELAY) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute the function
      const result = await fn();
      
      // If successful, log and return immediately
      if (attempt > 0) {
        fastify.log.info({ attempt }, 'Request succeeded after retry');
      }
      return result;
      
    } catch (error) {
      lastError = error;
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        fastify.log.error({ attempt, error: error.message }, 'All retry attempts exhausted');
        throw error;
      }
      
      // Calculate exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      
      fastify.log.warn(
        { attempt: attempt + 1, nextDelay: delay, error: error.message },
        'Request failed, retrying with exponential backoff'
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// probeExternalService: tries a dummy request to see if the external service has recovered
async function probeExternalService() {
  try {
    const resp = await fetch('http://event.com/addEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '__probe__', userId: 'probe' })
    });
    if (resp.ok) {
      circuitOpen = false;
      failureTimestamps.length = 0;
      nextProbe = null;
      fastify.log.info('[Circuit Breaker] Service recovered - CLOSED');
      return true;
    }
  } catch (err) {
    fastify.log.warn('[Circuit Breaker] Probe failed, service still unavailable');
  }
  return false;
}

fastify.post('/addEvent', async (request, reply) => {
  // STEP 1: If the circuit is open, immediately reject the request (no retries)
  if (circuitOpen) {
    fastify.log.warn('[Circuit Breaker] Request rejected - circuit is OPEN');
    reply.code(503).send({ 
      error: 'Circuit breaker open',
      message: 'External service temporarily unavailable. Please try again later.' 
    });
    return;
  }

  try {
    // STEP 2: Execute request with retry mechanism
    const data = await retryWithBackoff(async () => {
      const resp = await fetch('http://event.com/addEvent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: new Date().getTime(),
          ...request.body
        })
      });
      
      // If response is not OK, throw error to trigger retry
      if (!resp.ok) {
        throw new Error(`External service error: ${resp.status}`);
      }
      
      return resp.json();
    });

    // STEP 3: Success - clean up old failures outside the window
    const now = Date.now();
    while (failureTimestamps.length && now - failureTimestamps[0] > FAILURE_WINDOW) {
      failureTimestamps.shift();
    }

    fastify.log.info({ eventId: data.id }, 'Event added successfully');
    reply.send(data);

  } catch (err) {
    // STEP 4: All retries failed - register failure for circuit breaker
    const now = Date.now();
    failureTimestamps.push(now);

    // Clean up old failures outside the window
    while (failureTimestamps.length && now - failureTimestamps[0] > FAILURE_WINDOW) {
      failureTimestamps.shift();
    }

    // STEP 5: If threshold is exceeded, open circuit and schedule probe
    if (failureTimestamps.length >= FAILURE_THRESHOLD && !circuitOpen) {
      circuitOpen = true;
      fastify.log.error(
        { failures: failureTimestamps.length },
        '[Circuit Breaker] OPENED - threshold exceeded'
      );

      // Schedule recovery attempt after BACKOFF_TIME
      if (!nextProbe) {
        nextProbe = setTimeout(async () => {
          const recovered = await probeExternalService();
          
          if (!recovered) {
            // If still failing, retry probe after another BACKOFF_TIME
            nextProbe = setTimeout(async function retry() {
              const ok = await probeExternalService();
              if (!ok) {
                nextProbe = setTimeout(retry, BACKOFF_TIME);
              }
            }, BACKOFF_TIME);
          }
        }, BACKOFF_TIME);
      }
    }

    fastify.log.error({ error: err.message }, 'Failed to add event after all retries');
    reply.code(503).send({ 
      error: 'Could not add event',
      message: 'External service unavailable after retries'
    });
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
