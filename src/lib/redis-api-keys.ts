import { Redis } from '@upstash/redis';
import { randomBytes, createHash } from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key?: string; // Only included when creating
  hashedKey: string;
  active: boolean;
  lastUsed: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function generateApiKey(): { key: string; hashedKey: string } {
  const key = `gmd_${randomBytes(32).toString('hex')}`;
  const hashedKey = createHash('sha256').update(key).digest('hex');
  return { key, hashedKey };
}

export async function createApiKey(userId: string, name: string): Promise<ApiKey & { key: string }> {
  const id = crypto.randomUUID();
  const { key, hashedKey } = generateApiKey();
  
  const apiKey: ApiKey = {
    id,
    userId,
    name,
    hashedKey,
    active: true,
    lastUsed: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  // Store the API key
  await redis.set(`api-key:${id}`, JSON.stringify(apiKey));
  
  // Store hash lookup
  await redis.set(`api-key:hash:${hashedKey}`, id);
  
  // Add to user's API keys set
  await redis.sadd(`user:api-keys:${userId}`, id);
  
  return { ...apiKey, key };
}

export async function validateApiKey(key: string): Promise<(ApiKey & { user: unknown }) | null> {
  const hashedKey = createHash('sha256').update(key).digest('hex');
  
  // Look up API key ID by hash
  const apiKeyId = await redis.get(`api-key:hash:${hashedKey}`);
  if (!apiKeyId) return null;
  
  // Get API key data
  const apiKeyData = await redis.get(`api-key:${apiKeyId}`);
  if (!apiKeyData) return null;
  
  const apiKey = JSON.parse(apiKeyData as string) as ApiKey;
  
  // Check if active
  if (!apiKey.active) return null;
  
  // Get user data
  const userData = await redis.get(`user:${apiKey.userId}`);
  if (!userData) return null;
  
  const user = JSON.parse(userData as string);
  
  // Update last used timestamp
  apiKey.lastUsed = new Date();
  apiKey.updatedAt = new Date();
  await redis.set(`api-key:${apiKeyId}`, JSON.stringify(apiKey));
  
  return { ...apiKey, user };
}

export async function getUserApiKeys(userId: string): Promise<Omit<ApiKey, 'key' | 'hashedKey'>[]> {
  // Get user's API key IDs
  const apiKeyIds = await redis.smembers(`user:api-keys:${userId}`);
  
  if (apiKeyIds.length === 0) return [];
  
  // Get all API keys
  const apiKeys: (Omit<ApiKey, 'key' | 'hashedKey'>)[] = [];
  
  for (const id of apiKeyIds) {
    const data = await redis.get(`api-key:${id}`);
    if (data) {
      const apiKey = JSON.parse(data as string) as ApiKey;
      const { hashedKey: _hashedKey, ...sanitizedKey } = apiKey;
      
      // Convert date strings back to Date objects
      sanitizedKey.createdAt = new Date(sanitizedKey.createdAt);
      sanitizedKey.updatedAt = new Date(sanitizedKey.updatedAt);
      if (sanitizedKey.lastUsed) {
        sanitizedKey.lastUsed = new Date(sanitizedKey.lastUsed);
      }
      
      apiKeys.push(sanitizedKey);
    }
  }
  
  return apiKeys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function deleteApiKey(id: string, userId: string): Promise<void> {
  // Get API key to verify ownership and get hash
  const data = await redis.get(`api-key:${id}`);
  if (!data) return;
  
  const apiKey = JSON.parse(data as string) as ApiKey;
  
  // Verify ownership
  if (apiKey.userId !== userId) return;
  
  // Delete API key
  await redis.del(`api-key:${id}`);
  
  // Delete hash lookup
  await redis.del(`api-key:hash:${apiKey.hashedKey}`);
  
  // Remove from user's set
  await redis.srem(`user:api-keys:${userId}`, id);
}