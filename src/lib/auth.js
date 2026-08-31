import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { logEvent } from '@/lib/logger';

// FIX: Ensure NextAuth always has the correct URL in production.
// Vercel auto-injects VERCEL_URL (without protocol) for every deployment.
// If NEXTAUTH_URL isn't explicitly set in the Vercel dashboard, fall back to it.
// This prevents auth callbacks from redirecting to localhost on production.
if (process.env.VERCEL_URL && !process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        await connectDB();

        const user = await User.findOne({
          email: credentials.email?.toLowerCase()?.trim(),
        }).lean();

        if (!user) {
          logEvent({
            eventType: 'auth_login_failed',
            level: 'warn',
            category: 'auth',
            message: `Failed login attempt: User not found (${credentials.email})`,
            userEmail: credentials.email,
          }).catch(() => {});
          throw new Error('No user found');
        }

        if (user.status === 'blocked') {
          logEvent({
            eventType: 'auth_login_blocked',
            level: 'warn',
            category: 'auth',
            message: `Blocked user attempted login: ${user.email}`,
            userEmail: user.email,
          }).catch(() => {});
          throw new Error('Account blocked. Contact admin.');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          logEvent({
            eventType: 'auth_login_failed',
            level: 'warn',
            category: 'auth',
            message: `Failed login attempt: Incorrect password for ${user.email}`,
            userEmail: user.email,
          }).catch(() => {});
          throw new Error('Invalid password');
        }

        logEvent({
          eventType: 'auth_login_success',
          level: 'success',
          category: 'auth',
          message: `User signed in successfully: ${user.name} (${user.email}) [Role: ${user.role}]`,
          userEmail: user.email,
          metadata: { role: user.role, status: user.status },
        }).catch(() => {});

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // 30-day JWT sessions — avoids round-trips to DB for session validation
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.id = token.id;
      session.user.status = token.status;
      return session;
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
