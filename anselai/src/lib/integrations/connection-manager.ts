/**
 * Platform Connection Manager
 * Manages OAuth tokens, platform connections, and token refresh
 */

import { prisma } from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/security/encrypt';

export interface PlatformConnection {
  platform: string;
  accountId?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  status: 'active' | 'expired' | 'error';
  lastSyncAt?: Date;
  lastErrorMessage?: string;
}

export class ConnectionManager {
  /**
   * Save a platform connection
   */
  static async saveConnection(connection: PlatformConnection): Promise<void> {
    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(connection.accessToken);
    const encryptedRefreshToken = connection.refreshToken 
      ? encryptToken(connection.refreshToken)
      : null;

    try {
      await prisma.platformConnection.upsert({
        where: { platform: connection.platform },
        update: {
          accountId: connection.accountId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: connection.tokenExpiresAt,
          status: connection.status,
          updatedAt: new Date(),
        },
        create: {
          platform: connection.platform,
          accountId: connection.accountId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: connection.tokenExpiresAt,
          status: connection.status,
        },
      });

      console.log(`✅ Connection saved for platform: ${connection.platform}`);
    } catch (error) {
      console.error(`❌ Failed to save connection for ${connection.platform}:`, error);
      throw new Error(`Failed to save connection: ${String(error)}`);
    }
  }

  /**
   * Get a platform connection
   */
  static async getConnection(platform: string): Promise<PlatformConnection | null> {
    try {
      const conn = await prisma.platformConnection.findUnique({
        where: { platform },
      });

      if (!conn) {
        return null;
      }

      // Decrypt tokens
      const decryptedAccessToken = decryptToken(conn.accessToken);
      const decryptedRefreshToken = conn.refreshToken
        ? decryptToken(conn.refreshToken)
        : undefined;

      return {
        platform: conn.platform,
        accountId: conn.accountId || undefined,
        accessToken: decryptedAccessToken,
        refreshToken: decryptedRefreshToken,
        tokenExpiresAt: conn.tokenExpiresAt || undefined,
        status: conn.status as 'active' | 'expired' | 'error',
        lastSyncAt: conn.lastSyncAt || undefined,
        lastErrorMessage: conn.lastErrorMessage || undefined,
      };
    } catch (error) {
      console.error(`Failed to retrieve connection for ${platform}:`, error);
      return null;
    }
  }

  /**
   * Get all connections
   */
  static async getAllConnections(): Promise<Array<{ platform: string; status: string }>> {
    try {
      const connections = await prisma.platformConnection.findMany({
        select: {
          platform: true,
          status: true,
          accountId: true,
          lastSyncAt: true,
        },
      });

      return connections.map(c => ({
        platform: c.platform,
        status: c.status,
        accountId: c.accountId || '',
        lastSyncAt: c.lastSyncAt?.toISOString() || 'never',
      })) as any;
    } catch (error) {
      console.error('Failed to retrieve connections:', error);
      return [];
    }
  }

  /**
   * Test if a connection is valid
   * This is a basic test - can be extended per platform
   */
  static async testConnection(platform: string): Promise<boolean> {
    try {
      const connection = await this.getConnection(platform);

      if (!connection) {
        console.log(`No connection found for platform: ${platform}`);
        return false;
      }

      // Check if token is expired
      if (
        connection.tokenExpiresAt &&
        new Date(connection.tokenExpiresAt) < new Date()
      ) {
        console.log(`Token expired for platform: ${platform}`);
        return false;
      }

      // Token exists and not expired
      return true;
    } catch (error) {
      console.error(`Failed to test connection for ${platform}:`, error);
      return false;
    }
  }

  /**
   * Mark token as expired and attempt refresh
   */
  static async refreshToken(platform: string): Promise<boolean> {
    try {
      const connection = await this.getConnection(platform);

      if (!connection) {
        throw new Error(`Connection not found for platform: ${platform}`);
      }

      if (!connection.refreshToken) {
        throw new Error(
          `No refresh token available for platform: ${platform}`
        );
      }

      // Platform-specific refresh logic would go here
      // For now, just mark as needing refresh
      await prisma.platformConnection.update({
        where: { platform },
        data: {
          status: 'expired',
          lastErrorMessage: 'Token refresh required',
          updatedAt: new Date(),
        },
      });

      console.log(`Token marked for refresh: ${platform}`);
      return true;
    } catch (error) {
      console.error(`Failed to refresh token for ${platform}:`, error);
      return false;
    }
  }

  /**
   * Remove a connection
   */
  static async removeConnection(platform: string): Promise<void> {
    try {
      await prisma.platformConnection.delete({
        where: { platform },
      });

      console.log(`✅ Connection removed for platform: ${platform}`);
    } catch (error) {
      console.error(`Failed to remove connection for ${platform}:`, error);
      throw new Error(`Failed to remove connection`);
    }
  }

  /**
   * Mark a connection as having an error
   */
  static async markError(
    platform: string,
    errorMessage: string
  ): Promise<void> {
    try {
      await prisma.platformConnection.update({
        where: { platform },
        data: {
          status: 'error',
          lastErrorMessage: errorMessage,
          updatedAt: new Date(),
        },
      });

      console.log(`⚠️  Error marked for platform ${platform}: ${errorMessage}`);
    } catch (error) {
      console.error(`Failed to mark error for ${platform}:`, error);
    }
  }

  /**
   * Mark sync as successful
   */
  static async markSyncSuccess(platform: string): Promise<void> {
    try {
      await prisma.platformConnection.update({
        where: { platform },
        data: {
          status: 'active',
          lastSyncAt: new Date(),
          lastErrorMessage: null,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Sync successful for platform: ${platform}`);
    } catch (error) {
      console.error(`Failed to mark sync success for ${platform}:`, error);
    }
  }
}
