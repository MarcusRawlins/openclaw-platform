import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    provider?: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    provider?: string;
    providerAccountId?: string;
    accessToken?: string;
    expiresAt?: number;
    metaTokenExpiresAt?: number;
  }
}
