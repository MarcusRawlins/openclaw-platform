const fs = require('fs');
const path = require('path');
const config = require('./config.json');

class TaskCreator {
  // Create a Mission Control task for the content idea
  static async createMissionControlTask(idea) {
    try {
      const tasksFile = config.mission_control.tasks_file;

      // Read existing tasks
      if (!fs.existsSync(tasksFile)) {
        throw new Error(`Tasks file not found: ${tasksFile}`);
      }

      const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));

      // Create new task
      const task = {
        id: `content-idea-${idea.id}`,
        title: idea.summary.title,
        description: this._formatTaskDescription(idea),
        assignedTo: config.mission_control.assign_to,
        status: 'queued',
        priority: config.mission_control.task_priority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        module: 'content-creation',
        metadata: {
          ideaId: idea.id,
          platform: idea.summary.platform,
          contentType: idea.summary.contentType,
          targetAudience: idea.summary.targetAudience
        }
      };

      // Add to tasks list
      tasks.push(task);

      // Write back to file
      fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));

      console.log(`✓ Task created: ${task.id}`);

      return {
        success: true,
        taskId: task.id,
        title: task.title
      };
    } catch (error) {
      console.error('Failed to create task:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Format task description with sources and outline
  static _formatTaskDescription(idea) {
    const sources = [];

    // Add KB sources
    if (idea.kbSources && idea.kbSources.length > 0) {
      sources.push('**Knowledge Base Sources:**');
      idea.kbSources.slice(0, 5).forEach(source => {
        sources.push(`- ${source.title} (${source.type})`);
      });
      sources.push('');
    }

    // Add social sources
    if (idea.socialSources) {
      sources.push('**Social Research:**');
      if (idea.socialSources.youtube && idea.socialSources.youtube.length > 0) {
        sources.push(`- YouTube: ${idea.socialSources.youtube.length} videos`);
      }
      if (idea.socialSources.instagram && idea.socialSources.instagram.length > 0) {
        sources.push(`- Instagram: ${idea.socialSources.instagram.length} posts`);
      }
      if (idea.socialSources.twitter && idea.socialSources.twitter.length > 0) {
        sources.push(`- Twitter: ${idea.socialSources.twitter.length} discussions`);
      }
      sources.push('');
    }

    const description = `
**${idea.summary.title}**

${idea.summary.description}

**Target Audience:** ${idea.summary.targetAudience}

**Platform:** ${idea.summary.platform}
**Format:** ${idea.summary.contentType}

**Suggested Outline:**
${idea.summary.suggestedOutline}

${sources.join('\n')}

**Instructions:**
1. Review the idea and research sources
2. Create draft content (script, outline, or copy)
3. Prepare visuals/thumbnails if applicable
4. Submit for review

**Status:** Awaiting review from Tyler. Mark as in_progress when starting.
`;

    return description.trim();
  }

  // Update task status in Mission Control
  static async updateTaskStatus(taskId, newStatus) {
    try {
      const tasksFile = config.mission_control.tasks_file;
      const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));

      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      task.status = newStatus;
      task.updatedAt = new Date().toISOString();

      fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));

      return { success: true };
    } catch (error) {
      console.error('Failed to update task:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete task from Mission Control
  static async deleteTask(taskId) {
    try {
      const tasksFile = config.mission_control.tasks_file;
      const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));

      const index = tasks.findIndex(t => t.id === taskId);
      if (index === -1) {
        throw new Error(`Task not found: ${taskId}`);
      }

      tasks.splice(index, 1);
      fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));

      return { success: true };
    } catch (error) {
      console.error('Failed to delete task:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = TaskCreator;
