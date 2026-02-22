import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGoogleTokensByEmail } from "@/lib/google-oauth"

/**
 * Test endpoint to verify OAuth configuration
 * GET /api/test-oauth
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Get the Google account tokens
    const account = await getGoogleTokensByEmail(session.user.email)

    if (!account) {
      return NextResponse.json(
        { error: "No Google account found for this user" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        email: session.user.email,
        name: session.user.name,
      },
      oauth: {
        provider: account.provider,
        hasAccessToken: !!account.access_token,
        hasRefreshToken: !!account.refresh_token,
        accessTokenExpiry: account.expires_at
          ? new Date(account.expires_at * 1000).toISOString()
          : null,
        isExpired:
          account.expires_at && account.expires_at < Math.floor(Date.now() / 1000),
        scopes: account.scope?.split(" ") || [],
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch OAuth data", details: String(error) },
      { status: 500 }
    )
  }
}
