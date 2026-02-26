#!/usr/bin/env node

const ExpertAnalyzer = require('./expert-framework');
const MissionControlSync = require('./sync-mission-control');
const CRMSync = require('./sync-crm');
const SocialSync = require('./sync-social');
const FinancialImport = require('./import-financial');

// Scout → Market Analyst
const marketAnalyst = new ExpertAnalyzer({
  name: 'Scout',
  role: 'Market Analyst',
  focus: 'Competitive intelligence, market trends, audience behavior',
  dataSource: async () => {
    const mcSync = new MissionControlSync();
    const stats = mcSync.getTaskStats(7);
    const recent = mcSync.getRecentTasks(3);
    mcSync.close();

    return {
      taskCompletion: stats,
      recentActivity: recent,
      focus: 'Market trends and lead quality patterns'
    };
  },
  questions: [
    'What market signals are emerging from our recent activity?',
    'Are there untapped audience segments?',
    'What content or positioning could set us apart?',
    'Are there seasonal trends we should plan for?'
  ]
});

// Ada → Content Strategist
const contentStrategist = new ExpertAnalyzer({
  name: 'Ada',
  role: 'Content Strategist',
  focus: 'Content performance, audience engagement, editorial strategy',
  dataSource: async () => {
    const socialSync = new SocialSync();
    const instagram = socialSync.getGrowthTrends('instagram', 7);
    const topContent = socialSync.getTopContent('instagram', 30, 5);
    socialSync.close();

    return {
      platformTrends: instagram,
      topPerforming: topContent,
      focus: 'Engagement and content performance optimization'
    };
  },
  questions: [
    'Which content themes resonate most with our audience?',
    'Are engagement rates trending positively?',
    'What content gaps exist that we should fill?',
    'Is our posting cadence optimal?'
  ]
});

// Ed → Revenue Guardian
const revenueGuardian = new ExpertAnalyzer({
  name: 'Ed',
  role: 'Revenue Guardian',
  focus: 'Sales pipeline health, lead quality, conversion optimization',
  dataSource: async () => {
    const crmSync = new CRMSync();
    const pipeline = crmSync.getPipelineStats(30);
    const recent = crmSync.getRecentInquiries(5);
    crmSync.close();

    return {
      pipelineHealth: pipeline,
      recentInquiries: recent,
      focus: 'Revenue growth and lead conversion'
    };
  },
  questions: [
    'Is our lead volume trending in the right direction?',
    'Where are we losing deals in the pipeline?',
    'Which lead sources are highest quality?',
    'Can we optimize the sales process?'
  ]
});

// Dewey → Operations Analyst
const operationsAnalyst = new ExpertAnalyzer({
  name: 'Dewey',
  role: 'Operations Analyst',
  focus: 'System health, workflow efficiency, team productivity',
  dataSource: async () => {
    const mcSync = new MissionControlSync();
    const stats = mcSync.getTaskStats(7);
    mcSync.close();

    return {
      taskMetrics: stats,
      focus: 'Team productivity and system reliability'
    };
  },
  questions: [
    'Are tasks completing on schedule?',
    'Are there workflow bottlenecks?',
    'Is team velocity improving?',
    'Are there reliability or system issues?'
  ]
});

// Brunel → Growth Strategist
const growthStrategist = new ExpertAnalyzer({
  name: 'Brunel',
  role: 'Growth Strategist',
  focus: 'Cross-domain growth opportunities, strategic initiatives',
  dataSource: async () => {
    const mcSync = new MissionControlSync();
    const crmSync = new CRMSync();
    const socialSync = new SocialSync();

    const tasks = mcSync.getTaskStats(30);
    const pipeline = crmSync.getPipelineStats(30);
    const trends = socialSync.getGrowthTrends('instagram', 30);

    mcSync.close();
    crmSync.close();
    socialSync.close();

    return {
      taskTrends: tasks,
      pipelineTrends: pipeline,
      growthSignals: trends,
      focus: 'Multi-domain growth opportunities and strategic priorities'
    };
  },
  questions: [
    'Where are the highest-leverage growth opportunities?',
    'What strategic initiatives should we prioritize?',
    'Are we progressing toward long-term goals?',
    'What internal capabilities need development?'
  ]
});

// Walt → Financial Guardian
const financialGuardian = new ExpertAnalyzer({
  name: 'Walt',
  role: 'Financial Guardian',
  focus: 'Financial health, cost management, ROI analysis',
  dataSource: async () => {
    const finance = new FinancialImport();
    const summaries = finance.getMonthlySummaries(3);
    const ytd = finance.getYTDSummary();
    finance.close();

    return {
      monthlySummaries: summaries,
      ytdRevenue: ytd,
      focus: 'Financial performance and cost optimization'
    };
  },
  questions: [
    'Are we tracking to our revenue goals?',
    'Are costs trending in the right direction?',
    'What ROI improvements are possible?',
    'Are there financial risks to address?'
  ]
});

module.exports = {
  marketAnalyst,
  contentStrategist,
  revenueGuardian,
  operationsAnalyst,
  growthStrategist,
  financialGuardian
};
