const fs = require('fs');
const path = require('path');

const TASKS_PATH = '/Users/marcusrawlins/.openclaw/workspace/mission_control/data/tasks.json';

function getTasks() {
  try {
    if (!fs.existsSync(TASKS_PATH)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
  } catch (err) {
    console.error('Error reading tasks:', err.message);
    return [];
  }
}

function getTodaysTasks() {
  const tasks = getTasks();
  const today = new Date().toISOString().split('T')[0];
  
  // Standing orders (daily recurring)
  const standingOrders = tasks.filter(t => 
    (t.title.includes('standing order') || t.description?.includes('Daily'))
    && t.status === 'queued'
  );
  
  // Urgent queued tasks
  const urgent = tasks.filter(t => 
    t.priority === 'urgent' && 
    (t.status === 'queued' || t.status === 'active')
  );
  
  // High priority active/queued
  const highPriority = tasks.filter(t => 
    t.priority === 'high' && 
    (t.status === 'queued' || t.status === 'active') &&
    !urgent.find(u => u.id === t.id)
  );
  
  return {
    standingOrders: standingOrders.slice(0, 5),
    urgent: urgent.slice(0, 5),
    highPriority: highPriority.slice(0, 3)
  };
}

function getTasksNeedingReview() {
  const tasks = getTasks();
  return tasks.filter(t => 
    t.status === 'needs_review' || 
    t.status === 'needs-review'
  );
}

function getCompletedToday() {
  const tasks = getTasks();
  const today = new Date().toISOString().split('T')[0];
  
  return tasks.filter(t => {
    if (!t.completedAt) return false;
    const completedDate = t.completedAt.split('T')[0];
    return completedDate === today && (t.status === 'done' || t.reviewGrade === 'pass');
  });
}

function getTaskStats() {
  const tasks = getTasks();
  
  const stats = {
    total: tasks.length,
    queued: tasks.filter(t => t.status === 'queued').length,
    active: tasks.filter(t => t.status === 'active').length,
    needs_review: tasks.filter(t => t.status === 'needs_review' || t.status === 'needs-review').length,
    done: tasks.filter(t => t.status === 'done').length,
    pass_rate: 0
  };
  
  const completed = tasks.filter(t => t.status === 'done');
  const passed = completed.filter(t => t.reviewGrade === 'pass');
  
  if (completed.length > 0) {
    stats.pass_rate = (passed.length / completed.length * 100).toFixed(1);
  }
  
  return stats;
}

// CLI export
if (require.main === module) {
  console.log('Today\'s tasks:');
  console.log(JSON.stringify(getTodaysTasks(), null, 2));
  
  console.log('\nNeeding review:');
  console.log(JSON.stringify(getTasksNeedingReview().slice(0, 3), null, 2));
  
  console.log('\nCompleted today:');
  console.log(JSON.stringify(getCompletedToday(), null, 2));
  
  console.log('\nTask stats:');
  console.log(JSON.stringify(getTaskStats(), null, 2));
}

module.exports = {
  getTodaysTasks,
  getTasksNeedingReview,
  getCompletedToday,
  getTaskStats,
  getTasks
};
