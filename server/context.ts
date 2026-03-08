import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "../shared/const";
import cookie from "cookie";

export type UserContext = {
  id: number;
  email: string;
  name: string | null;
  role: "user" | "admin";
} | null;

export async function createContext({ req, res }: CreateExpressContextOptions) {
  let user: UserContext = null;

  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const token = cookies[COOKIE_NAME];
    if (token && process.env.JWT_SECRET) {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      user = {
        id: payload.userId as number,
        email: payload.email as string,
        name: (payload.name as string) || null,
        role: (payload.role as "user" | "admin") || "user",
      };
    }
  } catch {
    // Invalid or expired token — user stays null
  }

  return { req, res, user };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
