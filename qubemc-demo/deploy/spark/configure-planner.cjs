// Run inside the NemoClaw sandbox. Does not change the Discord gateway config.
const fs = require('node:fs');
const source = '/sandbox/.openclaw/openclaw.json';
const config = JSON.parse(fs.readFileSync(source, 'utf8'));
config.tools = {profile:'minimal',deny:['*']};
config.agents.defaults.models = {...config.agents.defaults.models,
  'inference/coo-llm': {params:{temperature:0.2,maxTokens:4096,chat_template_kwargs:{enable_thinking:false}}}};
config.agents.defaults.skipBootstrap = true;
config.agents.defaults.thinkingDefault = 'off';
fs.writeFileSync('/sandbox/.openclaw/cofloor-planner.json',JSON.stringify(config),{mode:0o600});
console.log('Dedicated CoFloor planner config installed.');
