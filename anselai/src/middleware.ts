import { auth } from "@/lib/auth"

export default auth((req) => {
  const isAuth = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth")

  if (isAuthPage) {
    if (isAuth) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
    return null
  }

  if (!isAuth) {
    return Response.redirect(new URL("/auth/signin", req.url))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
