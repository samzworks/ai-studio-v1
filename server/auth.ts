import type { Express, RequestHandler } from "express";
import { setupGoogleAuth, isAuthenticated as googleIsAuthenticated, isAdmin as googleIsAdmin } from "./googleAuth";

export async function setupAuth(app: Express) {
  console.log("🔐 Setting up Google OAuth authentication");
  return setupGoogleAuth(app);
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  return googleIsAuthenticated(req, res, next);
};

export const isAdmin: RequestHandler = (req, res, next) => {
  return googleIsAdmin(req, res, next);
};
