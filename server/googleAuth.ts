import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { creditService } from "./services/credit-service";
import { sendNewUserRegistrationToAdmin } from "./services/email-service";

const getGoogleOidcConfig = memoize(
  async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
      );
    }

    return await client.discovery(
      new URL("https://accounts.google.com"),
      clientId,
      clientSecret
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const sessionSecret = process.env.SESSION_SECRET || 'local-dev-secret-change-in-production';
  if (!process.env.SESSION_SECRET) {
    console.warn('⚠️  SESSION_SECRET not set, using default (not secure for production)');
  }

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !!process.env.REPL_ID, // Only secure on Replit/Cloud
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function shouldBootstrapAdminRole(email: unknown): boolean {
  const normalizedUserEmail = normalizeEmail(email);
  const normalizedAdminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  return !!normalizedUserEmail && !!normalizedAdminEmail && normalizedUserEmail === normalizedAdminEmail;
}

async function upsertUser(claims: any) {
  const googleId = claims["sub"];
  const email = claims["email"];
  const shouldBeAdmin = shouldBootstrapAdminRole(email);
  const buildUserUpsertData = () => ({
    id: googleId,
    email,
    firstName: claims["given_name"],
    lastName: claims["family_name"],
    profileImageUrl: claims["picture"],
    ...(shouldBeAdmin ? { role: "admin" as const } : {}),
  });

  const existingUser = await storage.getUser(googleId);

  if (!existingUser && email) {
    const existingByEmail = await storage.getUserByEmail(email);
    if (existingByEmail && existingByEmail.id !== googleId) {
      try {
        await storage.migrateUserId(existingByEmail.id, googleId);
        console.log(`[Auth] Migrated user ${existingByEmail.id} -> ${googleId} (email: ${email})`);
        await storage.upsertUser(buildUserUpsertData());
        return;
      } catch (migrationErr) {
        console.error(`[Auth] Migration failed for ${existingByEmail.id} -> ${googleId}, updating existing record:`, migrationErr);
        try {
          await storage.updateUserIdByEmail(email, googleId, {
            firstName: claims["given_name"],
            lastName: claims["family_name"],
            profileImageUrl: claims["picture"],
          });
          console.log(`[Auth] Updated user ID by email ${email}: ${existingByEmail.id} -> ${googleId}`);
          await storage.upsertUser(buildUserUpsertData());
          return;
        } catch (updateErr) {
          console.error(`[Auth] Failed to update user ID by email:`, updateErr);
        }
      }
    }
  }

  const isNewUser = !existingUser;

  await storage.upsertUser(buildUserUpsertData());

  if (isNewUser) {
    await creditService.initializeUserCredits(googleId);
    const userName = [claims["given_name"], claims["family_name"]].filter(Boolean).join(" ") || "Unknown User";
    const userEmail = email || "No email provided";
    sendNewUserRegistrationToAdmin(claims["sub"], userName, userEmail).catch(err => {
      console.error("[Auth] Failed to send new user notification to admin:", err);
    });
  }
}

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("⚠️  Google OAuth not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing). Google login will be disabled.");
    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));
    return;
  }

  const config = await getGoogleOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    console.log('[Auth] Google verify callback', {
      email: tokens.claims().email,
      sub: tokens.claims().sub
    });
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  const registeredDomains = new Set<string>();

  const ensureStrategy = (req: any) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${process.env.PORT || 5000}`;
    const baseUrl = `${protocol}://${host}`;
    const strategyName = `google:${host}`;

    if (!registeredDomains.has(host)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile",
          callbackURL: `${baseUrl}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredDomains.add(host);
    }

    return strategyName;
  };

  app.get("/api/login", (req, res, next) => {
    const strategyName = ensureStrategy(req);
    passport.authenticate(strategyName, {
      prompt: "consent",
      scope: ["openid", "email", "profile"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const strategyName = ensureStrategy(req);
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getGoogleOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const userId = user.claims.sub;
    const userData = await storage.getUser(userId);

    if (!userData) {
      return res.status(401).json({ message: "User not found" });
    }

    if (userData.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    if (!userData.isActive) {
      return res.status(403).json({ message: "Account suspended" });
    }

    (req as any).adminUser = userData;
    next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
