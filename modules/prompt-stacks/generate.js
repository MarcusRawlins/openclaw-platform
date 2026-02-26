const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = '/Users/marcusrawlins/.openclaw/workspace/prompts';
const FACTS_PATH = path.join(PROMPTS_DIR, 'shared', 'facts.json');

class PromptGenerator {
  constructor() {
    this.facts = JSON.parse(fs.readFileSync(FACTS_PATH, 'utf8'));
  }

  /**
   * Generate operational facts section for Claude-style prompts
   */
  generateClaudeFactsSection() {
    const facts = this.facts;
    
    let output = '\n## Operational Facts\n\n';
    
    // User info
    output += `**User:** ${facts.user.name} (${facts.user.pronouns})\n`;
    output += `**Timezone:** ${facts.user.timezone}\n`;
    output += `**Primary Channel:** ${facts.channels.primary_channel} (chat ID: ${facts.channels.telegram_chat_id})\n\n`;
    
    // Services
    output += '**Services:**\n';
    output += `- Gateway: ${facts.services.gateway_url} (port ${facts.services.gateway_port})\n`;
    output += `- LM Studio: ${facts.services.lm_studio_url}\n`;
    output += `- Mission Control: port ${facts.services.mission_control_port}\n`;
    output += `- AnselAI CRM: port ${facts.services.anselai_port}\n\n`;
    
    // Paths
    output += '**Paths:**\n';
    output += `- Workspace: ${facts.paths.workspace}\n`;
    output += `- Memory Drive: ${facts.paths.memory_drive}\n`;
    output += `- Backup: ${facts.paths.backup_drive}\n`;
    output += `- Env File: ${facts.paths.env_file}\n`;
    output += `- Agents: ${facts.paths.agents_dir}\n`;
    output += `- Skills: ${facts.paths.skills_dir}\n\n`;
    
    // Emails
    output += '**Emails:**\n';
    output += `- Photography: ${facts.emails.photography}\n`;
    output += `- Personal: ${facts.emails.personal}\n`;
    output += `- Rehive: ${facts.emails.rehive}\n\n`;
    
    // Model assignments
    output += '**Model Assignments:**\n';
    output += `- Marcus: ${facts.models.marcus} (default: ${facts.models.marcus_default})\n`;
    output += `- Brunel: ${facts.models.brunel}\n`;
    output += `- Walt: ${facts.models.walt}\n`;
    output += `- Scout, Dewey, Ada, Ed: ${facts.models.scout}\n`;
    output += `- Heartbeat: ${facts.models.heartbeat}\n`;
    
    return output;
  }

  /**
   * Generate operational facts section for GPT-style prompts (XML)
   */
  generateGptFactsSection() {
    const facts = this.facts;
    
    let output = '\n## Operational Facts\n\n';
    output += '<operational_facts>\n';
    
    // User info
    output += '  <user>\n';
    output += `    <name>${facts.user.name}</name>\n`;
    output += `    <pronouns>${facts.user.pronouns}</pronouns>\n`;
    output += `    <timezone>${facts.user.timezone}</timezone>\n`;
    output += `    <primary_user_id>${facts.user.primary_user_id}</primary_user_id>\n`;
    output += '  </user>\n\n';
    
    // Channels
    output += '  <channels>\n';
    output += `    <primary>${facts.channels.primary_channel}</primary>\n`;
    output += `    <telegram_chat_id>${facts.channels.telegram_chat_id}</telegram_chat_id>\n`;
    output += '  </channels>\n\n';
    
    // Services
    output += '  <services>\n';
    output += '    <gateway>\n';
    output += `      <url>${facts.services.gateway_url}</url>\n`;
    output += `      <port>${facts.services.gateway_port}</port>\n`;
    output += '    </gateway>\n';
    output += '    <lm_studio>\n';
    output += `      <url>${facts.services.lm_studio_url}</url>\n`;
    output += '    </lm_studio>\n';
    output += '    <mission_control>\n';
    output += `      <port>${facts.services.mission_control_port}</port>\n`;
    output += '    </mission_control>\n';
    output += '    <anselai_crm>\n';
    output += `      <port>${facts.services.anselai_port}</port>\n`;
    output += '    </anselai_crm>\n';
    output += '  </services>\n\n';
    
    // Paths
    output += '  <paths>\n';
    for (const [key, value] of Object.entries(facts.paths)) {
      output += `    <${key}>${value}</${key}>\n`;
    }
    output += '  </paths>\n\n';
    
    // Emails
    output += '  <emails>\n';
    for (const [key, value] of Object.entries(facts.emails)) {
      output += `    <${key}>${value}</${key}>\n`;
    }
    output += '  </emails>\n\n';
    
    // Models
    output += '  <models>\n';
    output += '    <marcus>\n';
    output += `      <primary>${facts.models.marcus}</primary>\n`;
    output += `      <default>${facts.models.marcus_default}</default>\n`;
    output += '    </marcus>\n';
    output += `    <brunel>${facts.models.brunel}</brunel>\n`;
    output += `    <walt>${facts.models.walt}</walt>\n`;
    output += `    <scout>${facts.models.scout}</scout>\n`;
    output += `    <dewey>${facts.models.dewey}</dewey>\n`;
    output += `    <ada>${facts.models.ada}</ada>\n`;
    output += `    <ed>${facts.models.ed}</ed>\n`;
    output += `    <heartbeat>${facts.models.heartbeat}</heartbeat>\n`;
    output += '  </models>\n';
    
    output += '</operational_facts>\n';
    
    return output;
  }

  /**
   * Generate both stacks with facts embedded
   */
  generate() {
    console.log('Generating prompt stacks from facts.json...\n');
    
    const claudeFacts = this.generateClaudeFactsSection();
    const gptFacts = this.generateGptFactsSection();
    
    console.log('Claude-style facts section:');
    console.log(claudeFacts);
    console.log('\nGPT-style facts section:');
    console.log(gptFacts);
    console.log('\n✓ Generation complete');
    console.log('\nNote: This is a template generator. To fully regenerate AGENTS.md files,');
    console.log('you would need to combine these fact sections with the style templates.');
    console.log('For now, the AGENTS.md files have been manually created with facts embedded.');
    
    return { claude: claudeFacts, gpt: gptFacts };
  }
}

// CLI
if (require.main === module) {
  const generator = new PromptGenerator();
  generator.generate();
}

module.exports = PromptGenerator;
