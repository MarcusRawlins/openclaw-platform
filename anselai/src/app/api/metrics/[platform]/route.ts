/**
 * Platform-Specific Metrics Endpoint
 * GET /api/metrics/[platform] - platform-specific metrics
 * Stub implementation for Phase 1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  let platform = '';
  try {
    platform = (await params).platform;

    // Verify platform has a connection
    const connection = await prisma.platformConnection.findUnique({
      where: { platform },
    });

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

    // Placeholder metrics - will be filled in Phase 2
    const metrics = {
      platform,
      followers: 0,
      posts: 0,
      engagement_rate: 0,
      reach: 0,
      impressions: 0,
      active_campaigns: 0,
      campaigns_data: [],
      recent_content: [],
      note: 'Metrics will populate after initial sync is completed',
      last_synced: connection.lastSyncAt,
      connection_status: connection.status,
    };

    // Get content for this platform
    const content = await prisma.content.findMany({
      where: {
        platform,
        status: 'published',
      },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        metrics: {
          select: {
            views: true,
            likes: true,
            engagement: true,
          },
          take: 1,
          orderBy: {
            measuredAt: 'desc',
          },
        },
      },
      take: 5,
      orderBy: {
        publishedAt: 'desc',
      },
    });

    metrics.posts = await prisma.content.count({
      where: { platform, status: 'published' },
    });

    metrics.recent_content = content as any;

    // Get active campaigns
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        platform,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        budget: true,
        spent: true,
        metrics: {
          select: {
            impressions: true,
            clicks: true,
            conversions: true,
            roas: true,
          },
          take: 1,
          orderBy: {
            measuredAt: 'desc',
          },
        },
      },
    });

    metrics.active_campaigns = campaigns.length;
    metrics.campaigns_data = campaigns as any;

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error(`Failed to fetch metrics for ${platform}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch platform metrics',
        code: 'METRICS_ERROR',
      },
      { status: 500 }
    );
  }
}
