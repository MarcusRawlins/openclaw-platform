# Google Cloud Console Configuration

## Required Setup in Google Cloud Console

To complete the OAuth integration, ensure the following configuration in Google Cloud Console:

### 1. OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Configure:
   - **User Type:** External (or Internal if using Google Workspace)
   - **App name:** AnselAI
   - **User support email:** jtyler.reese@gmail.com
   - **Developer contact:** jtyler.reese@gmail.com

3. **Scopes:** Add the following scopes:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/business.manage`

4. **Test users:** Add `jtyler.reese@gmail.com` (only needed if app is in "Testing" status)

### 2. OAuth 2.0 Client ID

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID (or create a new one)
3. **Client ID:** `YOUR_GOOGLE_CLIENT_ID_HERE`

4. **Authorized redirect URIs:** Add these EXACTLY:
   ```
   http://localhost:3200/api/auth/callback/google
   ```
   
   For production, add:
   ```
   https://yourdomain.com/api/auth/callback/google
   ```

### 3. Enable Required APIs

Make sure these APIs are enabled in your Google Cloud project:

1. Go to: https://console.cloud.google.com/apis/library
2. Enable:
   - Gmail API
   - Google Calendar API
   - Google Analytics Data API
   - Google My Business API (Business Profile API)

## Verification Checklist

- [ ] OAuth consent screen configured
- [ ] Scopes added to consent screen
- [ ] Test user (jtyler.reese@gmail.com) added
- [ ] Redirect URI added: `http://localhost:3200/api/auth/callback/google`
- [ ] Gmail API enabled
- [ ] Google Calendar API enabled
- [ ] Google Analytics Data API enabled
- [ ] Google My Business API enabled
- [ ] Credentials stored in `.env.local`

## Testing

After configuration:

1. Visit http://localhost:3200
2. Click "Sign in with Google"
3. You should see the Google OAuth consent screen
4. Authorize all requested permissions
5. You should be redirected to `/dashboard`
6. Visit http://localhost:3200/api/test-oauth to verify tokens are stored

## Common Issues

### "Redirect URI mismatch"
**Cause:** The redirect URI in Google Cloud Console doesn't match the one used by NextAuth.

**Fix:** 
1. Check the error message for the actual redirect URI being used
2. Add it EXACTLY to the authorized redirect URIs in Google Cloud Console
3. For localhost: `http://localhost:3200/api/auth/callback/google`

### "Access blocked: This app's request is invalid"
**Cause:** Missing or incorrect OAuth consent screen configuration.

**Fix:**
1. Complete all required fields in the OAuth consent screen
2. Add all requested scopes to the consent screen
3. Make sure the app is in "Testing" mode and jtyler.reese@gmail.com is added as a test user

### No refresh token received
**Cause:** Google only provides a refresh token on the first authorization.

**Fix:**
1. Go to: https://myaccount.google.com/permissions
2. Remove AnselAI from connected apps
3. Sign in again - this will be treated as a "first" authorization and provide a refresh token

### "The app is not verified"
**Cause:** Apps requesting sensitive scopes need verification for production use.

**Fix:**
- For development: Click "Advanced" → "Go to AnselAI (unsafe)"
- For production: Submit your app for verification in Google Cloud Console

## Current Credentials

```
Client ID: YOUR_GOOGLE_CLIENT_ID_HERE
Client Secret: YOUR_GOOGLE_CLIENT_SECRET_HERE
```

**⚠️ Keep these secret!** Never commit to version control.
