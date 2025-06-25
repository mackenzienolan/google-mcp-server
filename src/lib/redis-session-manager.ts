import { Redis } from '@upstash/redis';
import { randomBytes } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface McpSession {
  id: string;
  sessionId: string;
  userId?: string;
  status: 'pending' | 'authorized' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class SessionManager {
  private static SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private static SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

  static generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  static async createSession(): Promise<McpSession> {
    const id = crypto.randomUUID();
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION);

    const session: McpSession = {
      id,
      sessionId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    // Store session with TTL
    await redis.setex(`mcp:session:${sessionId}`, this.SESSION_TTL, JSON.stringify(session));

    return session;
  }

  static async getSession(sessionId: string): Promise<McpSession | null> {
    const data = await redis.get(`mcp:session:${sessionId}`);
    if (!data) return null;

    const session = JSON.parse(data as string) as McpSession;
    
    // Convert date strings back to Date objects
    session.createdAt = new Date(session.createdAt);
    session.updatedAt = new Date(session.updatedAt);
    session.expiresAt = new Date(session.expiresAt);

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.expireSession(sessionId);
      return null;
    }

    return session;
  }

  static async authorizeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.userId = userId;
    session.status = 'authorized';
    session.updatedAt = new Date();

    // Update session with remaining TTL
    const ttl = await redis.ttl(`mcp:session:${sessionId}`);
    const remainingTtl = ttl > 0 ? ttl : this.SESSION_TTL;
    
    await redis.setex(`mcp:session:${sessionId}`, remainingTtl, JSON.stringify(session));
  }

  static async expireSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.status = 'expired';
    session.updatedAt = new Date();

    // Update session with short TTL for cleanup
    await redis.setex(`mcp:session:${sessionId}`, 60, JSON.stringify(session));
  }

  static async isSessionAuthorized(sessionId: string): Promise<{ authorized: boolean; userId?: string }> {
    const session = await this.getSession(sessionId);
    
    if (!session || session.status !== 'authorized') {
      return { authorized: false };
    }

    return { authorized: true, userId: session.userId };
  }

  static generateAuthUrl(sessionId: string, baseUrl: string): string {
    return `${baseUrl}/auth/mcp?session=${sessionId}`;
  }
}