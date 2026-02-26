/**
 * Test Connection Endpoint
 * POST /api/connections/[platform]/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConnectionManager } from '@/lib/integrations/connection-manager';

export const runtime = 'nodejs';

interface RouteParams {
  params: {
    platform: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { platform } = params;

    const isValid = await ConnectionManager.testConnection(platform);

    if (!isValid) {
      return NextResponse.json({
        success: false,
        data: {
          platform,
          valid: false,
          message: 'Connection is invalid or expired',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        platform,
        valid: true,
        message: 'Connection is valid',
      },
    });
  } catch (error) {
    console.error('Failed to test connection:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test connection',
        code: 'TEST_ERROR',
      },
      { status: 500 }
    );
  }
}
