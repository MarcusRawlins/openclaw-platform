/**
 * Metrics Overview Endpoint
 * GET /api/metrics/overview - high-level KPIs
 * Stub implementation for Phase 1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Placeholder metrics - will be filled in Phase 2 when actual data flows in
    const metrics = {
      total_followers: 0,
      total_posts: 0,
      average_engagement_rate: 0,
      total_reach: 0,
      total_impressions: 0,
      active_campaigns: 0,
      total_ad_spend: 0,
      return_on_ad_spend: 0,
      platforms_connected: 0,
      last_updated: new Date(),
      note: 'Metrics will populate after platform syncs are configured',
    };

    // Get count of connected platforms
    const connectionCount = await prisma.platformConnection.count({
      where: { status: 'active' },
    });
    metrics.platforms_connected = connectionCount;

    // Get count of active campaigns
    const campaignCount = await prisma.adCampaign.count({
      where: { status: 'active' },
    });
    metrics.active_campaigns = campaignCount;

    // Get total ad spend
    const adSpend = await prisma.adCampaign.aggregate({
      _sum: {
        spent: true,
      },
    });
    metrics.total_ad_spend = adSpend._sum.spent || 0;

    // Get count of posts
    const postCount = await prisma.content.count({
      where: { status: 'published' },
    });
    metrics.total_posts = postCount;

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        code: 'METRICS_ERROR',
      },
      { status: 500 }
    );
  }
}
