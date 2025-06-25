import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { RedisAdapter } from './redis-adapter';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: RedisAdapter({ redis }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive.readonly',
          ].join(' '),
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

export async function getGoogleTokens(userId: string) {
  // Get account IDs for this user
  const accountIds = await redis.smembers(`user:account:by-user-id:${userId}`);
  
  if (accountIds.length === 0) {
    throw new Error('No Google account found');
  }
  
  // Find Google account
  for (const accountId of accountIds) {
    const account = await redis.get(`user:account:${accountId}`);
    if (account && typeof account === 'object' && 'provider' in account && account.provider === 'google') {
      return {
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
      };
    }
  }
  
  throw new Error('No Google account found');
}