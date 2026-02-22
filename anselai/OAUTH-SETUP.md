# Google OAuth Integration - AnselAI

## Overview

AnselAI now has full Google OAuth integration using NextAuth.js. Tyler can sign in with his Google account (jtyler.reese@gmail.com) and the system will store refresh tokens for API access to Gmail, Calendar, Analytics, and Business Profile APIs.

## How Tyler Signs In

1. **Navigate to AnselAI**: Open http://localhost:3200 in your browser
2. **Automatic Redirect**: You'll be automatically redirected to `/auth/signin`
3. **Click "Sign in with Google"**: This will redirect you to Google's OAuth consent screen
4. **Authorize Access**: Google will ask you to:
   - Select the account (jtyler.reese@gmail.com)
   - Review the requested permissions:
     - Email and profile information
     - Gmail (read and send)
     - Google Calendar (read and write)
     - Google Analytics (read-only)
     - Google Business Profile (manage)
   - Click "Allow" to grant access
5. **Redirected to Dashboard**: You'll be automatically redirected to `/dashboard`
6. **Session Persists**: Your session will remain active until you sign out

## Requested Scopes

The OAuth integration requests the following Google API scopes:

- `openid` - Basic OpenID Connect
- `userinfo.email` - Email address
- `userinfo.profile` - Profile information (name, picture)
- `gmail.readonly` - Read Gmail messages
- `gmail.send` - Send emails via Gmail
- `calendar` - Read/write Google Calendar
- `calendar.events` - Manage calendar events
- `analytics.readonly` - Read Google Analytics data
- `business.manage` - Manage Google Business Profile

## Refresh Token Storage

When Tyler signs in for the first time with `access_type: "offline"` and `prompt: "consent"`, Google will provide a refresh token. This refresh token is stored in the database in the `Account` table and can be used to:

1. Refresh expired access tokens automatically
2. Make API calls on Tyler's behalf even when he's not actively signed in
3. Enable background jobs to access Google APIs

### Database Schema

**User Table:**
- Stores Tyler's basic profile (email, name, image)

**Account Table:**
- Stores OAuth tokens:
  - `access_token` - Short-lived token for API calls (expires in ~1 hour)
  - `refresh_token` - Long-lived token to get new access tokens
  - `expires_at` - Unix timestamp when access token expires
  - `scope` - The granted permissions

## Using the Refresh Token in Code

### Retrieve Google Tokens

```typescript
import { getGoogleTokensByEmail } from "@/lib/google-oauth"

// Get tokens by email
const account = await getGoogleTokensByEmail("jtyler.reese@gmail.com")

if (account?.access_token) {
  // Use the access token to call Google APIs
  const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages", {
    headers: {
      Authorization: `Bearer ${account.access_token}`,
    },
  })
}
```

### Refresh Expired Tokens

```typescript
import { refreshGoogleAccessToken } from "@/lib/google-oauth"
import { prisma } from "@/lib/prisma"

const account = await getGoogleTokensByEmail("jtyler.reese@gmail.com")

if (!account) {
  throw new Error("No Google account found")
}

// Check if token is expired
const isExpired = account.expires_at && account.expires_at < Math.floor(Date.now() / 1000)

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
  
  // Now use the new access token
  const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages", {
    headers: {
      Authorization: `Bearer ${newTokens.access_token}`,
    },
  })
}
```

## Architecture

### Files Created/Modified

**Auth Configuration:**
- `src/lib/auth.ts` - NextAuth.js configuration with Google provider
- `src/types/next-auth.d.ts` - TypeScript definitions for session

**API Routes:**
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth.js API handler

**Pages:**
- `src/app/auth/signin/page.tsx` - Custom sign-in page

**Middleware:**
- `src/middleware.ts` - Route protection (redirects unauthenticated users)

**Utilities:**
- `src/lib/google-oauth.ts` - Helper functions for token management

**Database:**
- `prisma/schema.prisma` - Added User, Account, Session, VerificationToken models

**Environment:**
- `.env.local` - Contains Google OAuth credentials

### Environment Variables

```env
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
NEXTAUTH_URL=http://localhost:3200
NEXTAUTH_SECRET=your-secret-key-change-this-in-production-use-openssl-rand-base64-32
```

**⚠️ IMPORTANT:** In production, generate a secure `NEXTAUTH_SECRET` using:
```bash
openssl rand -base64 32
```

## Testing the Flow

1. **Start the dev server:**
   ```bash
   cd /Users/marcusrawlins/.openclaw/workspace/anselai
   bun run dev
   ```

2. **Open browser:**
   Navigate to http://localhost:3200

3. **Sign in:**
   Click "Sign in with Google" and authorize with jtyler.reese@gmail.com

4. **Verify in database:**
   ```bash
   psql -d anselai -c "SELECT email, name FROM \"User\";"
   psql -d anselai -c "SELECT provider, scope, refresh_token IS NOT NULL as has_refresh FROM \"Account\";"
   ```

5. **Test API access:**
   Create a simple API route that uses the stored tokens to call a Google API

## Next Steps

1. **Build API integrations** for:
   - Gmail (reading/sending emails)
   - Calendar (syncing events)
   - Analytics (fetching metrics)
   - Business Profile (managing listings)

2. **Create background jobs** that use the refresh token to:
   - Auto-sync emails to contacts
   - Update calendar availability
   - Pull analytics data

3. **Add refresh token rotation** - Update tokens when they're refreshed

4. **Production security**:
   - Use a secure NEXTAUTH_SECRET
   - Enable HTTPS
   - Review Google Cloud Console security settings

## Troubleshooting

### "Redirect URI mismatch" error
- Check that `http://localhost:3200/api/auth/callback/google` is added to the authorized redirect URIs in Google Cloud Console

### No refresh token stored
- Make sure `access_type: "offline"` and `prompt: "consent"` are set in the authorization params
- Google only provides a refresh token on the first authorization - revoke access in Google Account settings and sign in again

### Token expired errors
- Use the `refreshGoogleAccessToken()` function to get a new access token
- Check that the refresh token exists in the database

## Support

For issues or questions, contact Brunel Edison or check the NextAuth.js documentation:
- https://next-auth.js.org/
- https://authjs.dev/reference/adapter/prisma
