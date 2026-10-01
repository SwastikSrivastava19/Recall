import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedUser(request);
    
    // If explicit auth found, return that user
    if (authResult.authenticated && authResult.user) {
      return NextResponse.json(
        {
          success: true,
          token: authResult.user.id,
          user: authResult.user,
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Default to the seeded Recall user for local dev/extension testing
    const defaultUser = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'test@recall.dev',
    };

    return NextResponse.json(
      {
        success: true,
        token: defaultUser.id,
        user: defaultUser,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('Error in GET /api/extension/token:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'An unexpected error occurred' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
