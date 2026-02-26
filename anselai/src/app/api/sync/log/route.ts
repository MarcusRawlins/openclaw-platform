/**
 * Sync Log Endpoint
 * GET /api/sync/log?platform=X - fetch sync history
 */

import { NextRequest, NextResponse } from 'next/server';
import { SyncScheduler } from '@/lib/integrations/sync-scheduler';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!platform) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: platform',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const history = await SyncScheduler.getSyncHistory(platform, limit);

    return NextResponse.json({
      success: true,
      data: {
        platform,
        history,
        count: history.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch sync log:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sync log',
        code: 'LOG_ERROR',
      },
      { status: 500 }
    );
  }
}
