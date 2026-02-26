/**
 * Sync Trigger Endpoint
 * POST /api/sync/[platform] - trigger manual sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { SyncScheduler } from '@/lib/integrations/sync-scheduler';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const body = await request.json().catch(() => ({}));
    const { syncType } = body;

    console.log(`🔄 Manual sync triggered for ${platform}`);

    // Run sync in background (don't wait for completion)
    SyncScheduler.runSyncNow(platform, syncType || 'manual').catch(err =>
      console.error(`Sync failed: ${err.message}`)
    );

    return NextResponse.json({
      success: true,
      message: `Sync started for ${platform}`,
      data: {
        platform,
        started: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to trigger sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger sync',
        code: 'SYNC_ERROR',
      },
      { status: 500 }
    );
  }
}
