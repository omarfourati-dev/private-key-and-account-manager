import { Router, Request, Response } from 'express';
import express from 'express';
import https from 'https';
import crypto from 'crypto';
import { prisma } from '../index';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from '../utils/jwt';
import { logger } from '../utils/logger';

export const oauthRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // Must be 'lax' for cross-origin OAuth redirects
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 600_000, // 10 minutes
};

// Helper: HTTPS POST
function httpsPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: { 'Content-Length': Buffer.byteLength(body), ...headers },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Helper: HTTPS GET
function httpsGet(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Issue JWT + refresh token and set cookie
async function issueSession(userId: string, email: string, res: Response): Promise<string> {
  const accessToken = generateAccessToken({ userId, email });
  const { token: refreshToken } = generateRefreshToken({ userId, email });
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt: getRefreshTokenExpiry() },
  });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
  return accessToken;
}

// ─── GOOGLE OAuth2 ───────────────────────────────────────────────────────────

// GET /api/auth/google — redirect to Google consent screen
oauthRouter.get('/google', (_req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.redirect(`${FRONTEND_URL}/auth/callback?error=provider_not_configured`);
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, STATE_COOKIE_OPTIONS);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${BACKEND_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback — receive authorization code
oauthRouter.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(error)}`);
  }

  const storedState = req.cookies['oauth_state'] as string | undefined;
  res.clearCookie('oauth_state');

  if (!state || state !== storedState) {
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${BACKEND_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }).toString();

    const tokenData = JSON.parse(
      await httpsPost('https://oauth2.googleapis.com/token', tokenBody, {
        'Content-Type': 'application/x-www-form-urlencoded',
      })
    ) as { access_token?: string; error?: string };

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(`Google token error: ${tokenData.error}`);
    }

    // Fetch user info
    const userInfo = JSON.parse(
      await httpsGet('https://www.googleapis.com/oauth2/v3/userinfo', {
        Authorization: `Bearer ${tokenData.access_token}`,
      })
    ) as { sub?: string; email?: string };

    const { sub: googleId, email } = userInfo;
    if (!googleId || !email) throw new Error('Missing user info from Google');

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });
    const isNewUser = !user;

    if (!user) {
      // Single-user app: reject if another account already exists
      const existing = await prisma.user.findFirst();
      if (existing) {
        return res.redirect(`${FRONTEND_URL}/auth/callback?error=account_exists`);
      }

      user = await prisma.user.create({
        data: {
          email,
          googleId,
          settings: { create: { autoLockMins: 15, theme: 'dark' } },
        },
      });
      logger.info('New user created via Google OAuth', { userId: user.id });
    } else if (!user.googleId) {
      // Link Google to existing email account
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
      logger.info('Google ID linked to existing account', { userId: user.id });
    }

    const accessToken = await issueSession(user.id, user.email, res);
    return res.redirect(
      `${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(accessToken)}&isNewUser=${isNewUser}`
    );
  } catch (err) {
    logger.error('Google OAuth error:', err);
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=oauth_failed`);
  }
});

// ─── APPLE Sign In ───────────────────────────────────────────────────────────

// GET /api/auth/apple — redirect to Apple sign-in
oauthRouter.get('/apple', (_req: Request, res: Response) => {
  if (!process.env.APPLE_CLIENT_ID) {
    res.redirect(`${FRONTEND_URL}/auth/callback?error=provider_not_configured`);
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, STATE_COOKIE_OPTIONS);

  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: `${BACKEND_URL}/api/auth/apple/callback`,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });

  res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

// POST /api/auth/apple/callback — Apple uses form_post response_mode
oauthRouter.post(
  '/apple/callback',
  express.urlencoded({ extended: true }),
  async (req: Request, res: Response) => {
    const { code, id_token, state, error } = req.body as Record<string, string>;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(error)}`);
    }

    const storedState = req.cookies['oauth_state'] as string | undefined;
    res.clearCookie('oauth_state');

    if (!state || state !== storedState) {
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=invalid_state`);
    }

    if (!id_token || !code) {
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=missing_tokens`);
    }

    try {
      // Decode Apple id_token JWT payload (header.payload.signature)
      // Note: In production, verify signature against Apple's JWKS endpoint
      // https://appleid.apple.com/auth/keys
      const payloadBase64 = id_token.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64url').toString('utf8')
      ) as { sub?: string; email?: string; email_verified?: boolean };

      const appleId = payload.sub;
      const email = payload.email;

      if (!appleId) throw new Error('Missing sub from Apple id_token');

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { appleId },
            ...(email ? [{ email }] : []),
          ],
        },
      });
      const isNewUser = !user;

      if (!user) {
        const existing = await prisma.user.findFirst();
        if (existing) {
          return res.redirect(`${FRONTEND_URL}/auth/callback?error=account_exists`);
        }
        if (!email) {
          return res.redirect(`${FRONTEND_URL}/auth/callback?error=no_email`);
        }

        user = await prisma.user.create({
          data: {
            email,
            appleId,
            settings: { create: { autoLockMins: 15, theme: 'dark' } },
          },
        });
        logger.info('New user created via Apple Sign In', { userId: user.id });
      } else if (!user.appleId) {
        user = await prisma.user.update({ where: { id: user.id }, data: { appleId } });
        logger.info('Apple ID linked to existing account', { userId: user.id });
      }

      const accessToken = await issueSession(user.id, user.email, res);
      return res.redirect(
        `${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(accessToken)}&isNewUser=${isNewUser}`
      );
    } catch (err) {
      logger.error('Apple Sign In error:', err);
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=oauth_failed`);
    }
  }
);
