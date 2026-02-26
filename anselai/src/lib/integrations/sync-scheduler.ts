/**
 * Sync Scheduler
 * Manages scheduled data syncs from external platforms
 */

import { prisma } from '@/lib/prisma';
import { ConnectionManager } from './connection-manager';

export interface SyncJob {
  platform: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  syncType: string;
  lastRun?: Date;
  nextRun?: Date;
}

export class SyncScheduler {
  private static activeSyncs: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Log a sync attempt
   */
  static async logSync(
    platform: string,
    syncType: string,
    status: 'started' | 'success' | 'failed',
    recordsProcessed: number = 0,
    errorMessage?: string,
    durationMs?: number
  ): Promise<void> {
    try {
      const connection = await prisma.platformConnection.findUnique({
        where: { platform },
      });

      if (!connection) {
        console.warn(`No connection found for platform: ${platform}`);
        return;
      }

      await prisma.syncLog.create({
        data: {
          connectionId: connection.id,
          syncType,
          status,
          recordsProcessed,
          errorMessage: errorMessage || null,
          completedAt: status === 'started' ? null : new Date(),
          durationMs,
        },
      });
    } catch (error) {
      console.error('Failed to log sync:', error);
    }
  }

  /**
   * Start a manual sync
   */
  static async runSyncNow(platform: string, syncType?: string): Promise<void> {
    console.log(`\n🔄 Starting manual sync for ${platform}...`);

    const startTime = Date.now();

    try {
      // Verify connection exists
      const connection = await ConnectionManager.getConnection(platform);
      if (!connection) {
        throw new Error(`No connection found for platform: ${platform}`);
      }

      // Log start
      await this.logSync(platform, syncType || 'manual', 'started');

      // Platform-specific sync logic would go here in Phase 2
      // For now, just simulate a successful sync
      await new Promise(resolve => setTimeout(resolve, 100));

      const durationMs = Date.now() - startTime;

      // Log success
      await this.logSync(platform, syncType || 'manual', 'success', 0, undefined, durationMs);

      // Mark connection as synced
      await ConnectionManager.markSyncSuccess(platform);

      console.log(`✅ Sync completed for ${platform} (${durationMs}ms)`);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failure
      await this.logSync(
        platform,
        syncType || 'manual',
        'failed',
        0,
        errorMessage,
        durationMs
      );

      // Mark connection as having an error
      await ConnectionManager.markError(platform, errorMessage);

      console.error(`❌ Sync failed for ${platform}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Schedule periodic syncs
   * In production, this would use a cron library or external scheduler
   */
  static async scheduleSync(
    platform: string,
    frequency: 'hourly' | 'daily' | 'weekly',
    syncType: string = 'metrics'
  ): Promise<void> {
    try {
      // Check if already scheduled
      const key = `${platform}_${frequency}`;
      if (this.activeSyncs.has(key)) {
        console.log(`Sync already scheduled for ${key}`);
        return;
      }

      const intervals = {
        hourly: 60 * 60 * 1000, // 1 hour
        daily: 24 * 60 * 60 * 1000, // 24 hours
        weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      const interval = intervals[frequency];

      console.log(
        `📅 Scheduled ${frequency} sync for ${platform} (interval: ${interval}ms)`
      );

      // Run immediately
      await this.runSyncNow(platform, syncType).catch(err =>
        console.error(`Initial sync failed: ${err.message}`)
      );

      // Schedule recurring
      const timeout = setInterval(
        () => {
          this.runSyncNow(platform, syncType).catch(err =>
            console.error(`Scheduled sync failed: ${err.message}`)
          );
        },
        interval
      );

      this.activeSyncs.set(key, timeout);
    } catch (error) {
      console.error(`Failed to schedule sync for ${platform}:`, error);
    }
  }

  /**
   * Get next scheduled sync time
   */
  static async getNextSync(platform: string): Promise<Date | null> {
    try {
      const log = await prisma.syncLog.findFirst({
        where: { platformConnection: { platform } },
        orderBy: { startedAt: 'desc' },
        select: { completedAt: true },
      });

      if (!log || !log.completedAt) {
        return null;
      }

      // Estimate next sync based on frequency
      // For now, assume daily syncs
      const nextSync = new Date(log.completedAt);
      nextSync.setDate(nextSync.getDate() + 1);

      return nextSync;
    } catch (error) {
      console.error(`Failed to get next sync for ${platform}:`, error);
      return null;
    }
  }

  /**
   * Get sync history for a platform
   */
  static async getSyncHistory(
    platform: string,
    limit: number = 10
  ): Promise<Array<{
    syncType: string;
    status: string;
    recordsProcessed: number;
    durationMs: number | null;
    startedAt: Date;
    completedAt: Date | null;
  }>> {
    try {
      const logs = await prisma.syncLog.findMany({
        where: { platformConnection: { platform } },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          syncType: true,
          status: true,
          recordsProcessed: true,
          durationMs: true,
          startedAt: true,
          completedAt: true,
        },
      });

      return logs;
    } catch (error) {
      console.error(`Failed to get sync history for ${platform}:`, error);
      return [];
    }
  }

  /**
   * Get sync status across all platforms
   */
  static async getSyncStatus(): Promise<
    Array<{
      platform: string;
      lastSync: Date | null;
      status: string;
      recentErrors: number;
    }>
  > {
    try {
      const connections = await prisma.platformConnection.findMany({
        include: {
          syncLogs: {
            orderBy: { startedAt: 'desc' },
            take: 5,
          },
        },
      });

      return connections.map(conn => {
        const recentErrors = conn.syncLogs.filter(
          log => log.status === 'failed'
        ).length;

        return {
          platform: conn.platform,
          lastSync: conn.lastSyncAt,
          status: conn.status,
          recentErrors,
        };
      });
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return [];
    }
  }

  /**
   * Stop all scheduled syncs
   */
  static stopAllSyncs(): void {
    console.log('Stopping all scheduled syncs...');
    this.activeSyncs.forEach(timeout => clearInterval(timeout));
    this.activeSyncs.clear();
    console.log('✅ All syncs stopped');
  }
}
