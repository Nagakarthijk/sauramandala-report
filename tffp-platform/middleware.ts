import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // A throw here (network hiccup reaching Supabase Auth, a malformed
  // session cookie) would otherwise take down every /workspace request
  // with an opaque crash before any page code even runs. Fail safe by
  // treating it as "not signed in" instead.
  let response: NextResponse;
  let user: unknown;
  try {
    const result = await updateSession(request);
    response = result.response;
    user = result.user;
  } catch (err) {
    console.error('updateSession threw in middleware', err);
    response = NextResponse.next({ request: { headers: request.headers } });
    user = null;
  }

  if (request.nextUrl.pathname.startsWith('/workspace') && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/workspace/:path*'],
};
