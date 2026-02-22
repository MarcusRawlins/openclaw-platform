import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getGoogleTokensByEmail, refreshGoogleAccessToken } from "@/lib/google-oauth"
import { prisma } from "@/lib/prisma"

/**
 * Example: Fetch recent Gmail messages
 * GET /api/gmail/messages?maxResults=10
 */
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Get the Google account tokens
    let account = await getGoogleTokensByEmail(session.user.email)

    if (!account) {
      return NextResponse.json(
        { error: "No Google account found. Please sign in with Google." },
        { status: 404 }
      )
    }

    // Check if access token is expired
    const isExpired =
      account.expires_at && account.expires_at < Math.floor(Date.now() / 1000)

    if (isExpired && account.refresh_token) {
      // Refresh the access token
      const newTokens = await refreshGoogleAccessToken(account.refresh_token)

      // Update the database
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: newTokens.access_token,
          expires_at: newTokens.expires_at,
        },
      })

      // Update our local account object
      account.access_token = newTokens.access_token
      account.expires_at = newTokens.expires_at
    }

    if (!account.access_token) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 500 }
      )
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const maxResults = searchParams.get("maxResults") || "10"

    // Fetch Gmail messages
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: "Gmail API error", details: error },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      messages: data.messages || [],
      resultSizeEstimate: data.resultSizeEstimate,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch Gmail messages", details: String(error) },
      { status: 500 }
    )
  }
}
