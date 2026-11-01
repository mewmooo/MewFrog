import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Lewati endpoint perangkat (/api/device/v1/* menggunakan Bearer Device Token terpisah)
  if (pathname.startsWith('/api/device/')) {
    return response;
  }

  // 2. Proteksi API Dashboard Privat
  if (pathname.startsWith('/api/dashboard/')) {
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Sesi login pengguna diperlukan' },
        { status: 401 }
      );
    }
    return response;
  }

  // 3. Jika pengguna sudah login dan membuka halaman /login -> arahkan ke home /
  if (pathname === '/login') {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  // 4. Proteksi Seluruh Halaman Dashboard Web
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (e.g. .svg, .png, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

