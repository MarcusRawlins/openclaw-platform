/**
 * Platform-Specific Connection Routes
 * GET /api/connections/[platform] - get connection
 * PUT /api/connections/[platform] - update connection
 * DELETE /api/connections/[platform] - remove connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConnectionManager } from '@/lib/integrations/connection-manager';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    const connection = await ConnectionManager.getConnection(platform);

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error: `No connection found for platform: ${platform}`,
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        platform: connection.platform,
        accountId: connection.accountId,
        status: connection.status,
        tokenExpiresAt: connection.tokenExpiresAt,
        lastSyncAt: connection.lastSyncAt,
      },
    });
  } catch (error) {
    console.error('Failed to fetch connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch connection',
        code: 'FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;
    const body = await request.json();
    const { accessToken, refreshToken, tokenExpiresAt } = body;

    const existing = await ConnectionManager.getConnection(platform);

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: `No connection found for platform: ${platform}`,
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    await ConnectionManager.saveConnection({
      platform,
      accountId: existing.accountId,
      accessToken: accessToken || existing.accessToken,
      refreshToken: refreshToken || existing.refreshToken,
      tokenExpiresAt: tokenExpiresAt
        ? new Date(tokenExpiresAt)
        : existing.tokenExpiresAt,
      status: 'active',
    });

    return NextResponse.json({
      success: true,
      message: `Connection updated for ${platform}`,
    });
  } catch (error) {
    console.error('Failed to update connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update connection',
        code: 'UPDATE_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    await ConnectionManager.removeConnection(platform);

    return NextResponse.json({
      success: true,
      message: `Connection removed for ${platform}`,
    });
  } catch (error) {
    console.error('Failed to remove connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove connection',
        code: 'DELETE_ERROR',
      },
      { status: 500 }
    );
  }
}
