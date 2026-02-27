# Meta OAuth Setup - Action Required

**Status:** Code complete, needs Meta App credentials  
**Updated:** Feb 27, 2026  
**Blocker:** Tyler must create Meta App and add credentials to .env.local

---

## What's Already Done

✅ Meta OAuth provider configured in `src/lib/auth.ts`  
✅ Instagram scopes requested: insights, media, pages, ads  
✅ Token exchange for long-lived tokens (60-day expiry)  
✅ Sign-in UI with "Sign in with Facebook / Instagram" button  
✅ Database schema ready (NextAuth tables)

---

## What Tyler Needs to Do

### Step 1: Create Meta App

1. **Go to Meta Developers Console:**
   - https://developers.facebook.com/apps/

2. **Create New App:**
   - Click "Create App"
   - Type: Business
   - Display name: "AnselAI CRM"
   - Contact email: jtyler.reese@gmail.com

3. **Add Instagram Basic Display Product:**
   - In app dashboard, click "Add Product"
   - Find "Instagram Basic Display"
   - Click "Set Up"

4. **Configure OAuth Settings:**
   - Valid OAuth Redirect URIs: `http://localhost:3200/api/auth/callback/meta`
   - Deauthorize Callback URL: `http://localhost:3200/api/auth/signout`
   - Data Deletion Request URL: `http://localhost:3200/api/auth/signout`

5. **Get App Credentials:**
   - Go to Settings → Basic
   - Copy "App ID" and "App Secret"

### Step 2: Add to AnselAI

Open `/Users/marcusrawlins/.openclaw/workspace/anselai/.env.local` and add:

```env
# Meta OAuth (Facebook/Instagram)
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
```

### Step 3: Test

1. Restart AnselAI: `cd /Users/marcusrawlins/.openclaw/workspace/anselai && npm run dev`
2. Visit http://localhost:3200/auth/signin
3. Click "Sign in with Facebook / Instagram"
4. Authorize the app with Tyler's Instagram business account
5. Should redirect to dashboard with Instagram connected

---

## Instagram Business Account Required

Meta OAuth requires an **Instagram Business Account** (not personal).

**To convert Tyler's Instagram to Business:**
1. Open Instagram app
2. Go to Settings → Account
3. Switch to Professional Account
4. Choose "Business"
5. Connect to Facebook Page (anselreesephotography)

---

## Scopes Requested

When Tyler authorizes, Meta will ask permission for:

- `instagram_basic` - Profile info
- `instagram_manage_insights` - View insights/analytics
- `pages_show_list` - List Facebook Pages
- `pages_read_engagement` - Read Page engagement
- `ads_read` - Read ad data
- `read_insights` - Read insights across platforms

---

## What Happens After Setup

Once credentials are added and Tyler signs in:

1. **Refresh token stored** in database (60-day expiry)
2. **Auto-refresh** when token expires
3. **Background jobs can sync** Instagram data:
   - Posts and reels
   - Insights (views, likes, comments, engagement)
   - Follower count
   - Story performance
4. **Dashboard shows** Instagram metrics in AnselAI

---

## Testing the Integration

After Tyler signs in, test the OAuth flow:

```bash
# Test OAuth status
curl http://localhost:3200/api/test-oauth

# Should return:
# { "authenticated": true, "provider": "meta", "tokens": { "access_token": "...", "expires_at": ... } }
```

---

## Troubleshooting

**"App ID is invalid"**
- Double-check META_APP_ID in .env.local
- Make sure App is in "Live" mode (not Development mode)

**"Redirect URI mismatch"**
- Add exact redirect URI in Meta App settings: `http://localhost:3200/api/auth/callback/meta`

**"This app is not approved for Instagram Basic Display"**
- You need to submit app for review OR add Tyler's Instagram as a test user
- For testing: App Dashboard → Roles → Instagram Testers → Add @bythereeeses

---

## Next Steps

1. Tyler creates Meta App (5-10 min)
2. Add credentials to .env.local
3. Restart AnselAI
4. Tyler signs in with Instagram
5. Mark task as complete

**Once complete, AnselAI can:**
- Sync Instagram posts automatically
- Track engagement metrics
- Show analytics in dashboard
- Auto-respond to DMs (future phase)

---

**Brunel Edison**  
Feb 27, 2026
