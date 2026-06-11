import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import { createSocketIOServer } from './config/socketio';
import { redisClient } from './config/redis';
import { env } from './config/env';
import { db } from './config/database';
import { realtimeService } from './services/realtimeService';
import type { JwtPayload } from './types/api.types';

/**
 * Typing for per-socket data attached after JWT authentication.
 */
interface SocketData {
  user: { id: string; role: string; jti: string };
}

// ─── Create HTTP + Socket.IO Servers ─────────────────────────────────────────

const httpServer = createServer();
const io = createSocketIOServer(httpServer);

// ─── JWT Authentication Middleware ────────────────────────────────────────────

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error('AUTH_TOKEN_INVALID'));
    }

    // Verify JWT signature and expiry
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      return next(new Error('AUTH_TOKEN_INVALID'));
    }

    // Check JWT blacklist in Redis
    const blacklisted = await redisClient.get(
      `blazewatch:jwt_blacklist:${decoded.jti}`,
    );
    if (blacklisted) {
      return next(new Error('AUTH_TOKEN_INVALID'));
    }

    // Attach user data to socket
    (socket.data as SocketData).user = {
      id: decoded.sub,
      role: decoded.role,
      jti: decoded.jti,
    };

    next();
  } catch (err) {
    console.error('[WebSocketServer] Auth middleware error:', err);
    next(new Error('AUTH_TOKEN_INVALID'));
  }
});

// ─── Connection Handler ───────────────────────────────────────────────────────

io.on('connection', async (socket) => {
  const { id: userId, role } = (socket.data as SocketData).user;

  console.log(
    `[WebSocketServer] Client connected: ${socket.id}, user: ${userId}, role: ${role}`,
  );

  // Join building room — MVP: single-building, query first building from DB
  try {
    const building = await db('buildings').first();
    if (building) {
      await socket.join(`building:${building.id}`);
      console.log(
        `[WebSocketServer] Socket ${socket.id} joined room building:${building.id}`,
      );
    } else {
      console.warn(
        `[WebSocketServer] No buildings found in DB — skipping room join for socket ${socket.id}`,
      );
    }
  } catch (err) {
    console.error(
      `[WebSocketServer] Failed to join building room for socket ${socket.id}:`,
      err,
    );
  }

  socket.on('disconnect', () => {
    console.log(`[WebSocketServer] Client disconnected: ${socket.id}`);
  });
});

// ─── Initialize RealtimeService ───────────────────────────────────────────────

realtimeService.initialize(io);

// ─── Start Listening ──────────────────────────────────────────────────────────

const port = env.SOCKETIO_PORT;

httpServer.listen(port, () => {
  console.log(`[WebSocketServer] Socket.IO server listening on port ${port}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[WebSocketServer] SIGTERM received — shutting down gracefully');
  io.close(() => {
    console.log('[WebSocketServer] Socket.IO server closed');
  });
  redisClient.disconnect();
  process.exit(0);
});
