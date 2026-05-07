import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            supabaseResponse.cookies.set(name, value)
          );
        },
      },
    }
  );

  // Refresh the session if needed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/profile", "/content", "/shop", "/community"];
  
  // Routes that require active subscription
  const subscriptionRequiredRoutes = ["/dashboard", "/content", "/shop", "/community"];

  // Check if user is trying to access protected routes
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isSubscriptionRequired = subscriptionRequiredRoutes.some(route => pathname.startsWith(route));

  // If trying to access protected route without auth, redirect to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // If user is authenticated, check subscription status for subscription-required routes
  if (user && isSubscriptionRequired) {
    // Check subscription status
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!subscription) {
      // No active subscription, redirect to pricing/renewal page
      const url = request.nextUrl.clone();
      url.pathname = "/pricing";
      url.searchParams.set("renew", "true");
      return NextResponse.redirect(url);
    }

    // Check if subscription is about to expire (within 7 days)
    if (subscription.current_period_end) {
      const expiryDate = new Date(subscription.current_period_end);
      const now = new Date();
      const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        // Add renewal warning header
        supabaseResponse.headers.set("x-subscription-expiring", "true");
      }
    }
  }

  // If user is already logged in and tries to access auth pages, redirect to dashboard
  if (user && (pathname === "/register" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Important: Do not modify the response beyond this point
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};