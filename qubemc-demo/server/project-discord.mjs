import { readFileSync } from 'node:fs';
const people = new Map(JSON.parse(readFileSync(new URL('../data/company/employees.json',import.meta.url),'utf8')).map(p=>[p.employee_id,p.name]));
import { openclawMessage, messageId, messagesOf } from './nemoclaw-discord.mjs';
export const liveDiscord = () => process.env.COFLOOR_DISCORD === 'live';
export async function syncDiscord(run, {save, decide, command = openclawMessage}) {
  if (!liveDiscord()) return run;
  const channel = process.env.NEMOCLAW_DISCORD_CHANNEL_ID;
  const manager = process.env.COFLOOR_DISCORD_MANAGER_ID;
  run.transport = 'discord';
  if (!/^\d{17,20}$/.test(channel || '') || !/^\d{17,20}$/.test(manager || '')) {
    run.discordError = 'Discord manager/channel configuration is incomplete.'; save(run); return run;
  }
  try {
    for (const item of run.messages.filter(m => m.author === 'agent' && m.delivery === 'simulated')) {
      // Mark before sending: an ambiguous crash must not silently duplicate a notification.
      item.delivery = 'sending'; save(run);
      const sent = await command(['send','--channel','discord','--target',`channel:${channel}`,'--message',`<@${manager}> CoFloor deployment test\n${item.text.replace(/\bEMP-\d{4}\b/g,id=>people.get(id)||id).slice(0,1600)}\n${run.issue?.status === 'awaiting' ? 'Reply directly to this message with your decision.' : 'Decision recorded. No further reply is needed.'}`,'--json']);
      item.discordMessageId = messageId(sent); item.delivery = 'sent';
      run.discordAfter ||= item.discordMessageId; save(run);
    }
    if (run.issue?.status === 'awaiting' && run.discordAfter) {
      const result = await command(['read','--channel','discord','--target',`channel:${channel}`,'--after',run.discordAfter,'--limit','100','--json']);
      const messages = messagesOf(result).filter(m => /^\d+$/.test(m.id)).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
      for (const msg of messages) {
        const valid = !msg.author?.bot && String(msg.author?.id) === manager && msg.content?.trim() && run.messages.some(m => m.discordMessageId === msg.message_reference?.message_id);
        if (valid) {
          run = await decide({runId:run.runId,actorId:run.projectOwnerId,decisionId:`discord-${msg.id}`,text:msg.content});
          const reply = run.messages.find(m=>m.id===`discord-${msg.id}`); if(reply)reply.delivery='received';
        }
        run.discordAfter = msg.id; save(run);
        if(run.issue?.status==='resolved')break;
      }
    }
    delete run.discordError; save(run);
  } catch { run.discordError = 'Discord delivery or reply processing failed. Check the channel and retry. A sending receipt requires inspection before resending.'; save(run); }
  return run;
}
