import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
