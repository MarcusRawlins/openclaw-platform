# Google OAuth Integration - Complete Guide

This guide covers the complete Google OAuth integration for AnselAI, including setup, authentication flow, and API usage.

## Quick Start

### 1. Environment Setup

The Google OAuth credentials are already configured in `.env.local`:

```env
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
NEXTAUTH_URL=http://localhost:3200
NEXTAUTH_SECRET=your-secret-key-change-this-in-production
```

### 2. Database Migration

The database schema has been updated with NextAuth models:

```bash
cd /Users/marcusrawlins/.openclaw/workspace/anselai
bunx prisma migrate dev --name add-nextauth
```

### 3. Start the Server

```bash
bun run dev
```

The server will start on http://localhost:3200

### 4. Sign In

1. Open http://localhost:3200
2. Click "Sign in with Google"
3. Authorize with jtyler.reese@gmail.com
4. You'll be redirected to the dashboard

## Authentication Flow

### Sign In Process

```
User visits AnselAI
    ↓
Middleware checks auth (src/middleware.ts)
    ↓
Not authenticated → redirect to /auth/signin
    ↓
User clicks "Sign in with Google"
    ↓
NextAuth redirects to Google OAuth consent screen
    ↓
User authorizes requested scopes
    ↓
Google redirects back to /api/auth/callback/google
    ↓
NextAuth creates session & stores tokens in database
    ↓
User redirected to /dashboard
```

### Session Management

- **Server Components**: Use `auth()` from `@/lib/auth`
- **API Routes**: Use `auth()` to check authentication
- **Client Components**: Session data available via middleware

Example:
```typescript
import { auth } from "@/lib/auth"

export default async function Page() {
  const session = await auth()
  
  if (!session) {
    // Not authenticated
    return <div>Please sign in</div>
  }
  
  return <div>Hello {session.user.email}</div>
}
```

### Sign Out

```typescript
import { signOut } from "@/lib/auth"

// In a server action or route handler
await signOut()
```

## Using Google APIs

### 1. Check OAuth Status

Visit http://localhost:3200/api/test-oauth after signing in:

```json
{
  "success": true,
  "user": {
    "email": "jtyler.reese@gmail.com",
    "name": "Tyler Reese"
  },
  "oauth": {
    "provider": "google",
    "hasAccessToken": true,
    "hasRefreshToken": true,
    "accessTokenExpiry": "2024-02-21T22:30:00.000Z",
    "isExpired": false,
    "scopes": [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly",
      ...
    ]
  }
}
```

### 2. Example: Fetch Gmail Messages

Visit http://localhost:3200/api/gmail/messages?maxResults=10

This demonstrates:
- Retrieving stored access token
- Checking token expiration
- Refreshing if needed
- Making authenticated API call

### 3. Using Tokens in Your Code

```typescript
import { auth } from "@/lib/auth"
import { getGoogleTokensByEmail, refreshGoogleAccessToken } from "@/lib/google-oauth"
import { prisma } from "@/lib/prisma"

export async function callGoogleAPI() {
  // Get current user
  const session = await auth()
  if (!session?.user?.email) {
    throw new Error("Not authenticated")
  }

  // Get stored tokens
  let account = await getGoogleTokensByEmail(session.user.email)
  if (!account) {
    throw new Error("No Google account connected")
  }

  // Check if token is expired
  const isExpired = account.expires_at && 
    account.expires_at < Math.floor(Date.now() / 1000)

  if (isExpired && account.refresh_token) {
    // Refresh the token
    const newTokens = await refreshGoogleAccessToken(account.refresh_token)
    
    // Update database
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: newTokens.access_token,
        expires_at: newTokens.expires_at,
      },
    })
    
    account.access_token = newTokens.access_token
  }

  // Make API call
  const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages", {
    headers: {
      Authorization: `Bearer ${account.access_token}`,
    },
  })

  return response.json()
}
```

## Available Google APIs

With the current scopes, you can access:

### Gmail API
- **Read messages**: `GET /gmail/v1/users/me/messages`
- **Send messages**: `POST /gmail/v1/users/me/messages/send`
- **Read threads**: `GET /gmail/v1/users/me/threads`
- **Labels**: `GET /gmail/v1/users/me/labels`

Documentation: https://developers.google.com/gmail/api

### Google Calendar API
- **List calendars**: `GET /calendar/v3/users/me/calendarList`
- **List events**: `GET /calendar/v3/calendars/{calendarId}/events`
- **Create event**: `POST /calendar/v3/calendars/{calendarId}/events`
- **Update event**: `PUT /calendar/v3/calendars/{calendarId}/events/{eventId}`

Documentation: https://developers.google.com/calendar/api

### Google Analytics Data API
- **Run report**: `POST /v1beta/properties/{propertyId}:runReport`
- **Get metadata**: `GET /v1beta/properties/{propertyId}/metadata`

Documentation: https://developers.google.com/analytics/devguides/reporting/data/v1

### Google Business Profile API
- **List locations**: `GET /v1/accounts/{accountId}/locations`
- **Update location**: `PATCH /v1/{location.name}`
- **List reviews**: `GET /v1/{parent}/reviews`

Documentation: https://developers.google.com/my-business/reference/rest

## Helper Functions

### `getGoogleTokens(userId: string)`
Get OAuth tokens by user ID.

### `getGoogleTokensByEmail(email: string)`
Get OAuth tokens by email address.

### `refreshGoogleAccessToken(refreshToken: string)`
Refresh an expired access token using the refresh token.

## Database Schema

### User Table
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Account Table
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?  // Long-lived token for API access
  access_token      String?  // Short-lived token (expires in ~1 hour)
  expires_at        Int?     // Unix timestamp
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id])
}
```

## File Structure

```
anselai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts  # NextAuth API handler
│   │   │   ├── test-oauth/route.ts          # OAuth status checker
│   │   │   └── gmail/
│   │   │       └── messages/route.ts        # Gmail example
│   │   ├── auth/
│   │   │   └── signin/page.tsx              # Sign-in page
│   │   └── (app)/
│   │       └── dashboard/page.tsx           # Protected dashboard
│   ├── lib/
│   │   ├── auth.ts                          # NextAuth configuration
│   │   ├── google-oauth.ts                  # OAuth helper functions
│   │   └── prisma.ts                        # Prisma client
│   ├── types/
│   │   └── next-auth.d.ts                   # NextAuth type extensions
│   └── middleware.ts                        # Route protection
├── prisma/
│   └── schema.prisma                        # Database schema
├── .env.local                               # Environment variables
├── OAUTH-SETUP.md                           # Setup guide
├── GOOGLE-CLOUD-SETUP.md                    # Google Cloud Console guide
└── OAUTH-README.md                          # This file
```

## Security Best Practices

### 1. Never Expose Tokens

❌ **Don't do this:**
```typescript
return NextResponse.json({
  accessToken: account.access_token,  // NEVER expose tokens to client
  refreshToken: account.refresh_token // NEVER expose tokens to client
})
```

✅ **Do this:**
```typescript
// Keep tokens on the server
// Only expose the data fetched using the tokens
const messages = await fetchGmailMessages(account.access_token)
return NextResponse.json({ messages })
```

### 2. Always Check Authentication

```typescript
const session = await auth()
if (!session?.user?.email) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### 3. Handle Token Refresh

Always check token expiration and refresh when needed:

```typescript
const isExpired = account.expires_at && 
  account.expires_at < Math.floor(Date.now() / 1000)

if (isExpired && account.refresh_token) {
  // Refresh the token...
}
```

### 4. Production Secrets

Before deploying to production:

1. Generate a secure `NEXTAUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

2. Update `.env.local` (or production environment variables)

3. Add production redirect URI to Google Cloud Console:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```

## Troubleshooting

See `GOOGLE-CLOUD-SETUP.md` for detailed troubleshooting steps.

### Quick Fixes

**"Not authenticated" errors:**
- Clear browser cookies and sign in again
- Check that middleware.ts is configured correctly

**"No refresh token" in database:**
- Revoke access: https://myaccount.google.com/permissions
- Sign in again (first auth always gets refresh token)

**API calls failing:**
- Check token expiration with `/api/test-oauth`
- Verify scopes in Google Cloud Console
- Check that the specific API is enabled

## Next Steps

1. **Build API integrations** using the examples in `src/app/api/gmail/`
2. **Create background jobs** to sync data using stored refresh tokens
3. **Add error handling** for revoked tokens or API failures
4. **Monitor token usage** and implement rate limiting if needed

## Support

For questions or issues:
- Check NextAuth.js docs: https://next-auth.js.org/
- Check Google API docs: https://developers.google.com/
- Contact Brunel Edison
