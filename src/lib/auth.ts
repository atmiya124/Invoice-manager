import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await db.query.users.findFirst({
            where: eq(users.email, credentials.email),
          });

          console.log("[authorize] user found:", !!user, "has hash:", !!user?.passwordHash);

          if (!user?.passwordHash) return null;

          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
          console.log("[authorize] password valid:", valid);

          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch (err) {
          console.error("[authorize] error:", err);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

