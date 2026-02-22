import { prisma } from "./prisma"

/**
 * Get Google OAuth tokens for a user
 * @param userId - The user ID to fetch tokens for
 * @returns The account with access and refresh tokens, or null if not found
 */
export async function getGoogleTokens(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
  })

  return account
}

/**
 * Get Google OAuth tokens for a user by email
 * @param email - The user email to fetch tokens for
 * @returns The account with access and refresh tokens, or null if not found
 */
export async function getGoogleTokensByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: {
        where: {
          provider: "google",
        },
      },
    },
  })

  return user?.accounts[0] ?? null
}

/**
 * Refresh an expired Google access token using the refresh token
 * @param refreshToken - The refresh token
 * @returns New access token and expiry
 */
export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  const tokens = await response.json()

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${tokens.error}`)
  }

  return {
    access_token: tokens.access_token,
    expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
  }
}
