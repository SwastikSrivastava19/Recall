import { query } from './db';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the authenticated user from the Request headers.
 * Supports:
 * - Authorization: Bearer <Supabase JWT>
 * - Authorization: Bearer <User UUID>
 * - x-user-id: <User UUID>
 */
export async function getAuthenticatedUser(request: Request): Promise<AuthResult> {
  let userId: string | null = null;

  const authHeader = request.headers.get('authorization');
  const xUserId = request.headers.get('x-user-id');

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const jwtPayload = parseJwtPayload(token);

    if (jwtPayload && typeof jwtPayload === 'object') {
      userId = jwtPayload.sub || jwtPayload.id || null;
    } else if (UUID_REGEX.test(token)) {
      userId = token;
    }
  }

  if (!userId && xUserId && UUID_REGEX.test(xUserId.trim())) {
    userId = xUserId.trim();
  }

  if (!userId) {
    return {
      authenticated: false,
      error: 'Unauthorized: Missing or invalid Authorization credentials',
    };
  }

  // Validate that user exists in auth.users table
  try {
    const res = await query<{ id: string; email: string }>(
      'SELECT id, email FROM auth.users WHERE id = $1 LIMIT 1;',
      [userId]
    );

    if (res.rows.length === 0) {
      return {
        authenticated: false,
        error: 'Unauthorized: Authenticated user does not exist',
      };
    }

    return {
      authenticated: true,
      user: res.rows[0],
    };
  } catch (err: any) {
    console.error('Auth verification error:', err);
    return {
      authenticated: false,
      error: 'Internal authentication verification error',
    };
  }
}
