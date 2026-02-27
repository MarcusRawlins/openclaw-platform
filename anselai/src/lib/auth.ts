import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

// Custom Meta OAuth Provider for Instagram Business
const MetaOAuth = {
  id: "meta",
  name: "Meta Business",
  type: "oauth" as const,
  clientId: process.env.META_APP_ID!,
  clientSecret: process.env.META_APP_SECRET!,
  authorization: {
    url: "https://www.facebook.com/v19.0/dialog/oauth",
    params: {
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
    url: "https://graph.facebook.com/v19.0/oauth/access_token",
    async request({ params, provider }: any) {
      // Step 1: Exchange authorization code for short-lived token
      const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", provider.clientId);
      tokenUrl.searchParams.set("client_secret", provider.clientSecret);
      tokenUrl.searchParams.set("redirect_uri", params.redirect_uri);
      tokenUrl.searchParams.set("code", params.code);

      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(`Meta OAuth token error: ${tokenData.error.message}`);
      }

      const shortLivedToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 3600; // Default 1 hour

      // Step 2: Exchange short-lived token for 60-day long-lived token
      const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", provider.clientId);
      longLivedUrl.searchParams.set("client_secret", provider.clientSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      const longLivedData = await longLivedResponse.json();

      if (longLivedData.error) {
        console.warn("Failed to exchange for long-lived token, using short-lived:", longLivedData.error);
        // Fallback to short-lived token if exchange fails
        return {
          tokens: {
            access_token: shortLivedToken,
            expires_in: expiresIn,
            expires_at: Math.floor(Date.now() / 1000) + expiresIn,
            token_type: "bearer",
          },
        };
      }

      const longLivedToken = longLivedData.access_token;
      const longLivedExpiresIn = longLivedData.expires_in || 5184000; // 60 days

      return {
        tokens: {
          access_token: longLivedToken,
          expires_in: longLivedExpiresIn,
          expires_at: Math.floor(Date.now() / 1000) + longLivedExpiresIn,
          token_type: "bearer",
        },
      };
    },
  },
  userinfo: {
    url: "https://graph.facebook.com/v19.0/me",
    params: {
      fields: "id,name,email,picture",
    },
    async request({ tokens, provider }: any) {
      // Get Facebook user info
      const userUrl = new URL("https://graph.facebook.com/v19.0/me");
      userUrl.searchParams.set("fields", "id,name,email,picture");
      userUrl.searchParams.set("access_token", tokens.access_token);

      const response = await fetch(userUrl.toString());
      return await response.json();
    },
  },
  profile(profile: any) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email || null,
      image: profile.picture?.data?.url || null,
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
    async jwt({ token, user, account, trigger }) {
      // Initial sign-in: store account details
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at; // Unix timestamp in seconds
        
        // For Meta, we've already exchanged for long-lived token in the provider
        if (account.provider === "meta") {
          token.metaTokenExpiresAt = account.expires_at;
        }
      }

      // Check if Meta token needs refresh (refresh 7 days before expiry)
      if (token.provider === "meta" && token.expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = token.expiresAt as number;
        const sevenDaysInSeconds = 7 * 24 * 60 * 60;

        // Refresh if token expires in less than 7 days
        if (expiresAt - now < sevenDaysInSeconds) {
          try {
            // Refresh the long-lived token
            const refreshUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
            refreshUrl.searchParams.set("grant_type", "fb_exchange_token");
            refreshUrl.searchParams.set("client_id", process.env.META_APP_ID!);
            refreshUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!);
            refreshUrl.searchParams.set("fb_exchange_token", token.accessToken as string);

            const response = await fetch(refreshUrl.toString());
            const data = await response.json();

            if (data.access_token) {
              token.accessToken = data.access_token;
              token.expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 5184000);
              
              // Update the database with new token
              if (token.providerAccountId) {
                await prisma.account.update({
                  where: {
                    provider_providerAccountId: {
                      provider: "meta",
                      providerAccountId: token.providerAccountId as string,
                    },
                  },
                  data: {
                    access_token: data.access_token,
                    expires_at: token.expiresAt,
                  },
                });
              }
            }
          } catch (error) {
            console.error("Error refreshing Meta token:", error);
            // Keep existing token if refresh fails
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      // Expose provider info to client-side session if needed
      if (token.provider) {
        session.provider = token.provider as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
})
