# Meta OAuth Integration for AnselAI

## Overview

This integration enables AnselAI to authenticate with Meta (Facebook) and access Instagram Business account data for social media management, analytics, and insights.

## Architecture

### OAuth Flow

1. **Authorization**: User is redirected to Facebook OAuth dialog (v19.0)
2. **Token Exchange**: Authorization code → short-lived access token (1 hour)
3. **Token Upgrade**: Short-lived token → long-lived token (60 days)
4. **Token Refresh**: Automatic refresh 7 days before expiry

### Scopes Requested

- `instagram_basic` - Basic Instagram account info
- `instagram_manage_insights` - Access to Instagram insights and analytics
- `pages_show_list` - List Facebook Pages connected to the account
- `pages_read_engagement` - Read engagement metrics for Pages
- `ads_read` - Read ad account data
- `read_insights` - Access to Facebook Insights

## Implementation Details

### Provider Configuration (`src/lib/auth.ts`)

The custom Meta OAuth provider handles:
- Authorization via Facebook OAuth dialog
- Two-step token exchange (short-lived → long-lived)
- User profile fetching from Facebook Graph API
- Error handling with fallback to short-lived tokens

### Token Management

**Storage**: Tokens are stored in the database via Prisma adapter:
- `access_token`: The long-lived access token
- `expires_at`: Unix timestamp (seconds) of expiration

**Refresh Strategy**: 
- JWT callback checks token expiry on each request
- Automatically refreshes tokens within 7 days of expiration
- Updates both JWT and database record on successful refresh

### Session Management

Sessions include:
- Standard user info (id, name, email, image)
- Provider identifier ("meta")
- Secure token storage (server-side only)

## Environment Variables

Required in `~/.openclaw/.env`:

```env
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
```

## API Endpoints

- Authorization: `https://www.facebook.com/v19.0/dialog/oauth`
- Token exchange: `https://graph.facebook.com/v19.0/oauth/access_token`
- User info: `https://graph.facebook.com/v19.0/me`

## Usage

### Sign In

```typescript
import { signIn } from "@/lib/auth";

// Server action or API route
await signIn("meta", { redirectTo: "/dashboard" });
```

### Access Session

```typescript
import { auth } from "@/lib/auth";

// Server component
const session = await auth();
if (session?.provider === "meta") {
  // User authenticated via Meta
}
```

### Client Component

```typescript
"use client";
import { useSession } from "next-auth/react";

export function Component() {
  const { data: session } = useSession();
  
  if (session?.provider === "meta") {
    // Meta-specific UI
  }
}
```

## Error Handling

- Token exchange errors: Logs warning, falls back to short-lived token
- Refresh errors: Logs error, keeps existing token
- Authorization errors: Handled by NextAuth error page

## Testing

1. Ensure Meta App is configured with correct OAuth redirect URIs
2. Test authorization flow in development
3. Verify token exchange produces long-lived token
4. Confirm token refresh occurs before expiry

## Maintenance

- Monitor token refresh logs for failures
- Keep Facebook Graph API version updated (currently v19.0)
- Review scope requirements as Instagram API evolves

## References

- [Facebook Login](https://developers.facebook.com/docs/facebook-login/)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)
- [Long-Lived Access Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived)
