const fastify = require('fastify')({ logger: true });
const listenMock = require('../mock-server');

fastify.get('/getUsers', async (request, reply) => {
    const resp = await fetch('http://event.com/getUsers');
    const data = await resp.json();
    reply.send(data); 
});


// ---
// RESILIENCIA: Circuit Breaker manual para /addEvent
// Si el servicio externo falla 3+ veces en 30s, se "abre" el circuito y se rechazan nuevas peticiones
// Se prueba periódicamente si el servicio externo se recupera para volver a aceptar peticiones
// ---


// --- Circuit Breaker State ---
// failureTimestamps: almacena timestamps de los fallos recientes
const failureTimestamps = [];
// circuitOpen: indica si el circuito está abierto (rechazando peticiones)
let circuitOpen = false;
// nextProbe: referencia al timer para el próximo intento de recuperación
let nextProbe = null;
// FAILURE_WINDOW: ventana de tiempo para contar fallos (30s)
const FAILURE_WINDOW = 30 * 1000; // 30 segundos
// FAILURE_THRESHOLD: cantidad de fallos para abrir el circuito
const FAILURE_THRESHOLD = 3;
// BACKOFF_TIME: tiempo de espera antes de probar recuperación
const BACKOFF_TIME = 30 * 1000; // 30 segundos


// probeExternalService: intenta una petición dummy para ver si el servicio externo se recuperó
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
  // Si el circuito está abierto, rechazar petición inmediatamente
  if (circuitOpen) {
    reply.code(503).send({ error: 'Servicio externo temporalmente no disponible. Intente más tarde.' });
    return;
  }
  try {
    // Intentar agregar el evento normalmente
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
    // Si fue exitosa, limpiar fallos viejos fuera de la ventana
    const now = Date.now();
    while (failureTimestamps.length && now - failureTimestamps[0] > FAILURE_WINDOW) {
      failureTimestamps.shift();
    }
  } catch (err) {
    // Registrar timestamp del fallo
    const now = Date.now();
    failureTimestamps.push(now);
    // Limpiar fallos viejos fuera de la ventana
    while (failureTimestamps.length && now - failureTimestamps[0] > FAILURE_WINDOW) {
      failureTimestamps.shift();
    }
    // Si supera el umbral de fallos, abrir circuito y programar probe
    if (failureTimestamps.length >= FAILURE_THRESHOLD && !circuitOpen) {
      circuitOpen = true;
      // Programar intento de recuperación tras BACKOFF_TIME
      if (!nextProbe) {
        nextProbe = setTimeout(async () => {
          const ok = await probeExternalService();
          if (!ok) {
            // Si sigue fallando, reintentar después de otro BACKOFF_TIME
            nextProbe = setTimeout(arguments.callee, BACKOFF_TIME);
          }
        }, BACKOFF_TIME);
      }
    }
    reply.code(503).send({ error: 'No se pudo agregar el evento. Servicio externo no disponible.' });
  }
});

fastify.get('/getEvents', async (request, reply) => {  
    const resp = await fetch('http://event.com/getEvents');
    const data = await resp.json();
    reply.send(data);
});

/*******************************************************************
*  OPTIMIZACIÓN DE RENDIMIENTO EN /getEventsByUserId/:id
*  El endpoint original obtenía los eventos de un usuario haciendo peticiones secuenciales,
*  lo que generaba lentitud con muchos eventos. Ahora, las peticiones a los eventos se hacen
*  en paralelo usando Promise.all, acelerando la respuesta. El código original se deja * mentado
*  para referencia y comparación.
*   *******************************************************************/
fastify.get('/getEventsByUserId/:id', async (request, reply) => {
    const { id } = request.params;
    const user = await fetch('http://event.com/getUserById/' + id);
    const userData = await user.json();
    const userEvents = userData.events;


    // --- Código original secuencial (lento) ---
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

    // --- Versión optimizada: fetch en paralelo ---
    // Fetch all events in parallel
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
