import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/context";

const app = express();
app.use(express.json());

app.use(
  "/api/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
