import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

// Custom Meta OAuth Provider (Facebook Login)
const MetaOAuth = {
  id: "meta",
  name: "Meta Business",
  type: "oauth" as const,
  clientId: process.env.META_APP_ID!,
  clientSecret: process.env.META_APP_SECRET!,
  authorization: {
    url: "https://www.facebook.com/v19.0/dialog/oauth",
    params: {
      display: "popup",
      scope: [
        "instagram_basic",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "ads_read",
        "read_insights",
      ].join(","),
      auth_type: "rerequest",
    },
  },
  token: {
    url: "https://graph.instagram.com/v19.0/oauth/access_token",
    async request({ client, params }: any) {
      // Exchange short-lived token for 60-day long-lived token
      const res = await client({
        method: "POST",
        url: "https://graph.instagram.com/v19.0/oauth/access_token",
        data: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          grant_type: "authorization_code",
          redirect_uri: params.redirect_uri,
          code: params.code,
        },
      });

      const body = await res.json();

      if (body.access_token) {
        // Upgrade to long-lived token (60-day expiry)
        const longLivedRes = await client({
          method: "GET",
          url: "https://graph.instagram.com/v19.0/access_token",
          params: {
            grant_type: "ig_exchange_token",
            input_token: body.access_token,
            access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
          },
        });

        const longLivedBody = await longLivedRes.json();
        return {
          tokens: {
            access_token: longLivedBody.access_token || body.access_token,
            refresh_token: longLivedBody.access_token || body.access_token,
            expires_in: 5184000, // 60 days in seconds
            expires_at: Date.now() + 5184000 * 1000,
          },
        };
      }

      return res;
    },
  },
  userinfo: {
    url: "https://graph.instagram.com/v19.0/me",
    params: {
      fields: "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count",
    },
  },
  profile(profile: any) {
    return {
      id: profile.id,
      name: profile.name || profile.username,
      email: null,
      image: profile.profile_picture_url,
    };
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/analytics.readonly",
            "https://www.googleapis.com/auth/business.manage",
          ].join(" "),
        },
      },
    }),
    MetaOAuth as any,
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Store provider account info for token refresh
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        // Store token expiry for Meta (60-day expiry)
        if (account.provider === "meta" && account.expires_at) {
          token.expiresAt = account.expires_at;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
})
