import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectDB from '@/lib/mongodb';
import { authService } from '@/services/authService';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        await connectDB();
        return await authService.verifyCredentials(credentials.email, credentials.password);
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = user.role; token.id = user.id; }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.id = token.id;
      return session;
    }
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
});

export { handler as GET, handler as POST };