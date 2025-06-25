import { Adapter } from "next-auth/adapters";
import { Redis } from "@upstash/redis";

export interface RedisAdapterConfig {
  redis: Redis;
  baseKeyPrefix?: string;
  accountKeyPrefix?: string;
  accountByUserIdPrefix?: string;
  emailKeyPrefix?: string;
  sessionKeyPrefix?: string;
  sessionByUserIdKeyPrefix?: string;
  userKeyPrefix?: string;
  verificationTokenKeyPrefix?: string;
}

export const defaultConfig = {
  baseKeyPrefix: "",
  accountKeyPrefix: "user:account:",
  accountByUserIdPrefix: "user:account:by-user-id:",
  emailKeyPrefix: "user:email:",
  sessionKeyPrefix: "user:session:",
  sessionByUserIdKeyPrefix: "user:session:by-user-id:",
  userKeyPrefix: "user:",
  verificationTokenKeyPrefix: "user:token:",
};

const isoDateRE =
  /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-6]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-6]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;

function isDate(value: unknown): value is ConstructorParameters<typeof Date>[0] {
  return isoDateRE.test(value) || !isNaN(Date.parse(value));
}

export function hydrateDates(json: object) {
  return Object.entries(json).reduce((result, [key, val]) => {
    result[key] = val;
    if (val !== null && isDate(val)) result[key] = new Date(val as string);
    return result;
  }, {} as Record<string, unknown>);
}

export function RedisAdapter(config: RedisAdapterConfig): Adapter {
  const c = {
    ...defaultConfig,
    ...config,
  };

  const { redis } = c;

  const setObjectAsJson = async (key: string, obj: unknown) =>
    await redis.set(key, JSON.stringify(obj));

  const getObjectFromJson = async (key: string) => {
    const value = await redis.get(key);
    if (value === null) return null;
    return hydrateDates(value as object);
  };

  const getUserByEmail = async (email: string) => {
    const userId = await redis.get(c.emailKeyPrefix + email);
    if (!userId) return null;
    return await getObjectFromJson(c.userKeyPrefix + userId);
  };

  return {
    async createUser(user) {
      const id = crypto.randomUUID();
      const newUser = { ...user, id };
      await setObjectAsJson(c.userKeyPrefix + id, newUser);
      await redis.set(c.emailKeyPrefix + user.email, id);
      return newUser;
    },

    async getUser(id) {
      return await getObjectFromJson(c.userKeyPrefix + id);
    },

    async getUserByEmail(email) {
      return await getUserByEmail(email);
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const accountId = await redis.get(
        c.accountKeyPrefix + provider + ":" + providerAccountId
      );
      if (!accountId) return null;
      const account = await getObjectFromJson(c.accountKeyPrefix + accountId);
      if (!account) return null;
      return await getObjectFromJson(c.userKeyPrefix + account.userId);
    },

    async updateUser(user) {
      const id = user.id as string;
      const existingUser = await getObjectFromJson(c.userKeyPrefix + id);
      const newUser = { ...existingUser, ...user };
      await setObjectAsJson(c.userKeyPrefix + id, newUser);
      return newUser;
    },

    async deleteUser(userId) {
      const user = await getObjectFromJson(c.userKeyPrefix + userId);
      if (!user) return;
      
      await redis.del(c.userKeyPrefix + userId);
      await redis.del(c.emailKeyPrefix + user.email);
      
      // Delete user's accounts
      const accountIds = await redis.smembers(c.accountByUserIdPrefix + userId);
      if (accountIds.length > 0) {
        await redis.del(...accountIds.map(id => c.accountKeyPrefix + id));
        await redis.del(c.accountByUserIdPrefix + userId);
      }
      
      // Delete user's sessions
      const sessionIds = await redis.smembers(c.sessionByUserIdKeyPrefix + userId);
      if (sessionIds.length > 0) {
        await redis.del(...sessionIds.map(id => c.sessionKeyPrefix + id));
        await redis.del(c.sessionByUserIdKeyPrefix + userId);
      }
      
      return user;
    },

    async linkAccount(account) {
      const id = crypto.randomUUID();
      const accountWithId = { ...account, id };
      await setObjectAsJson(c.accountKeyPrefix + id, accountWithId);
      await redis.set(
        c.accountKeyPrefix + account.provider + ":" + account.providerAccountId,
        id
      );
      await redis.sadd(c.accountByUserIdPrefix + account.userId, id);
      return accountWithId;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      const accountId = await redis.get(
        c.accountKeyPrefix + provider + ":" + providerAccountId
      );
      if (!accountId) return;
      
      const account = await getObjectFromJson(c.accountKeyPrefix + accountId);
      if (!account) return;
      
      await redis.del(c.accountKeyPrefix + accountId);
      await redis.del(c.accountKeyPrefix + provider + ":" + providerAccountId);
      await redis.srem(c.accountByUserIdPrefix + account.userId, accountId);
      
      return account;
    },

    async createSession({ sessionToken, userId, expires }) {
      const session = { sessionToken, userId, expires };
      await setObjectAsJson(c.sessionKeyPrefix + sessionToken, session);
      await redis.sadd(c.sessionByUserIdKeyPrefix + userId, sessionToken);
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const session = await getObjectFromJson(c.sessionKeyPrefix + sessionToken);
      if (!session) return null;
      
      const user = await getObjectFromJson(c.userKeyPrefix + session.userId);
      if (!user) return null;
      
      return { session, user };
    },

    async updateSession({ sessionToken, expires, userId }) {
      const session = await getObjectFromJson(c.sessionKeyPrefix + sessionToken);
      if (!session) return null;
      
      const newSession = { ...session };
      if (expires) newSession.expires = expires;
      if (userId) newSession.userId = userId;
      
      await setObjectAsJson(c.sessionKeyPrefix + sessionToken, newSession);
      return newSession;
    },

    async deleteSession(sessionToken) {
      const session = await getObjectFromJson(c.sessionKeyPrefix + sessionToken);
      if (!session) return;
      
      await redis.del(c.sessionKeyPrefix + sessionToken);
      await redis.srem(c.sessionByUserIdKeyPrefix + session.userId, sessionToken);
      
      return session;
    },

    async createVerificationToken({ identifier, expires, token }) {
      const verificationToken = { identifier, expires, token };
      await setObjectAsJson(c.verificationTokenKeyPrefix + identifier + ":" + token, verificationToken);
      return verificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const verificationToken = await getObjectFromJson(
        c.verificationTokenKeyPrefix + identifier + ":" + token
      );
      if (!verificationToken) return null;
      
      await redis.del(c.verificationTokenKeyPrefix + identifier + ":" + token);
      return verificationToken;
    },
  };
}