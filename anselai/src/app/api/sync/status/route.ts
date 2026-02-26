/**
 * Sync Status Endpoint
 * GET /api/sync/status - check sync status across all platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { SyncScheduler } from '@/lib/integrations/sync-scheduler';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const status = await SyncScheduler.getSyncStatus();

    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get sync status',
        code: 'STATUS_ERROR',
      },
      { status: 500 }
    );
  }
}
