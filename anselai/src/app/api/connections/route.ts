/**
 * Platform Connections API Routes
 * GET /api/connections - list all
 * POST /api/connections - create new
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConnectionManager } from '@/lib/integrations/connection-manager';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const connections = await ConnectionManager.getAllConnections();

    return NextResponse.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error('Failed to fetch connections:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch connections',
        code: 'FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, accountId, accessToken, refreshToken, tokenExpiresAt } =
      body;

    if (!platform || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: platform, accessToken',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    await ConnectionManager.saveConnection({
      platform,
      accountId,
      accessToken,
      refreshToken,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
      status: 'active',
    });

    return NextResponse.json(
      {
        success: true,
        message: `Connection saved for ${platform}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to save connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save connection',
        code: 'SAVE_ERROR',
      },
      { status: 500 }
    );
  }
}
