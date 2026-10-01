import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Supabase exchangeCodeForSession error:', error);
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
      }
    } catch (err: any) {
      console.error('Auth callback exception:', err);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message)}`, request.url));
    }
  }

  // Redirect back to dashboard upon successful authentication
  return NextResponse.redirect(new URL(next, request.url));
}
