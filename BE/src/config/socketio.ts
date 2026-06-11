import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { env } from './env';

/**
 * Socket.IO server factory for BlazeWatch.
 *
 * @param httpServer - The Node.js HTTP server to attach Socket.IO to
 * @returns A configured Socket.IO server instance
 *
 * CORS origin is controlled by the SOCKETIO_CORS_ORIGIN environment variable.
 * The server is used by RealtimeService to broadcast events such as:
 * - `sensor.update`   — new sensor reading received
 * - `incident.created` — new incident detected
 * - `sensor.offline`  — sensor stopped sending data
 * - `sensor.online`   — sensor reconnected
 */
function createSocketIOServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.SOCKETIO_CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  return io;
}

export { createSocketIOServer };
