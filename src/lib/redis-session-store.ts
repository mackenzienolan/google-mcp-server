import { Redis } from '@upstash/redis';

export class RedisSessionStore {
  private redis: Redis;
  private SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private getKey(connectionId: string): string {
    return `mcp:session:${connectionId}`;
  }

  async setSession(connectionId: string, sessionId: string): Promise<void> {
    await this.redis.setex(this.getKey(connectionId), this.SESSION_TTL, sessionId);
  }

  async getSession(connectionId: string): Promise<string | null> {
    return await this.redis.get(this.getKey(connectionId));
  }

  async deleteSession(connectionId: string): Promise<void> {
    await this.redis.del(this.getKey(connectionId));
  }
}

export function createRedisSessionStore(): RedisSessionStore | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return new RedisSessionStore(redis);
}