import { narrate, narrateDelivery } from './narration.mjs';
import { readFileSync } from 'node:fs';
const people = new Map(JSON.parse(readFileSync(new URL('../data/company/employees.json',import.meta.url),'utf8')).map(p=>[p.employee_id,p.name]));
import { openclawMessage, messageId, messagesOf } from './nemoclaw-discord.mjs';
export const ALEX_LEAVE_TEXT = "I'm taking sick leave from 1–6 p.m. today and can't do this task. Please reassign it.";
const normalizeLeave = text => String(text).replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
export const liveDiscord = () => process.env.COFLOOR_DISCORD === 'live';
export async function syncDiscord(run, {save, decide, receiveEvent, reload, command = openclawMessage}) {
  if (!liveDiscord()) return run;
  const channel = process.env.NEMOCLAW_DISCORD_CHANNEL_ID;
  const manager = process.env.COFLOOR_DISCORD_MANAGER_ID;
  const alex = process.env.COFLOOR_DISCORD_ALEX_ID;
  run.transport = 'discord';
  if (/^\d{17,20}$/.test(process.env.NEMOCLAW_DISCORD_SERVER_ID || '')) run.discordChannelUrl = `https://discord.com/channels/${process.env.NEMOCLAW_DISCORD_SERVER_ID}/${channel}`;
  if (!/^\d{17,20}$/.test(channel || '') || !/^\d{17,20}$/.test(manager || '')) {
    run.discordError = 'Discord manager/channel configuration is incomplete.'; narrate(run,'discord-configuration','delivery_error','The Discord project group is not fully configured. Please check the connection before expecting a confirmation.'); save(run); return run;
  }
  try {
    if (run.injection?.status === 'waiting' && !run.messages.some(m => m.kind === 'intake')) {
      if (!/^\d{17,20}$/.test(alex || '') || alex === manager) {
        run.discordError = 'Configure distinct Discord users for Alex and the project manager.'; narrate(run,'discord-identities','delivery_error','The Discord employee and manager accounts need configuration. Confirmation is not available yet.'); save(run); return run;
      }
      const assignments = run.tasks.map(t => `${t.title}: ${people.get(t.ownerId) || t.ownerId}; due ${t.due}`).join('\n');
      run.messages.push({id:`${run.runId}-intake`,kind:'intake',author:'agent',actorId:'cofloor',channelId:run.channelId,text:`Project team assigned.\n${assignments}`,delivery:'pending_transport'});
      save(run);
    }
    async function flushPending(){
    for (const item of run.messages.filter(m => m.author === 'agent' && ['simulated','pending_transport'].includes(m.delivery))) {
      // Mark before sending: an ambiguous crash must not silently duplicate a notification.
      item.delivery = 'sending'; save(run);
      const audience = item.kind === 'intake' ? `<@${alex}> <@${manager}>` : `<@${manager}>`;
      const footer = item.kind === 'intake' ? '' : run.issue?.status === 'awaiting' ? 'Reply directly to this proposal with confirm, or request changes.' : 'Decision recorded. No further reply is needed.';
      const sent = await command(['send','--channel','discord','--target',`channel:${channel}`,'--message',`${audience} CoFloor project group\n${item.text.replace(/\bEMP-\d{4}\b/g,id=>people.get(id)||id).slice(0,1600)}${footer ? `\n${footer}` : ''}`,'--json']);
      item.discordMessageId = messageId(sent);
      if (!/^\d+$/.test(item.discordMessageId || '')) throw new Error('Missing Discord delivery receipt.');
      item.proposalVersion = run.proposal?.version; item.delivery = 'sent';
      run.discordAfter ||= item.discordMessageId; narrateDelivery(run,item); save(run);
    }
    }
    await flushPending();
    if ((run.issue?.status === 'awaiting' || run.injection?.status === 'waiting') && run.discordAfter) {
      const result = await command(['read','--channel','discord','--target',`channel:${channel}`,'--after',run.discordAfter,'--limit','100','--json']);
      const messages = messagesOf(result).filter(m => /^\d+$/.test(m.id) && BigInt(m.id) > BigInt(run.discordAfter)).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
      for (const msg of messages) {
        const target = run.messages.find(m => m.discordMessageId === msg.message_reference?.message_id);
        if (run.injection?.status === 'waiting' && !msg.author?.bot && String(msg.author?.id) === alex && target?.kind === 'intake' && normalizeLeave(msg.content) === normalizeLeave(ALEX_LEAVE_TEXT)) {
          if (!receiveEvent) throw new Error('Discord employee event adapter is unavailable.');
          run = await receiveEvent({runId:run.runId,event:{id:`discord-${msg.id}`,type:'sick_leave',actorId:'EMP-0329',channelId:run.channelId,text:msg.content.trim(),start:'2026-10-26T13:00:00-07:00',end:'2026-10-26T18:00:00-07:00',reportedAt:'2026-10-26T10:32:00-07:00'}});
          const received = run.messages.find(m=>m.id===`discord-${msg.id}`);
          if(received){received.delivery='received';received.discordMessageId=msg.id;received.discordAuthorId=msg.author.id;received.discordTimestamp=msg.timestamp;}
          run.discordAfter=msg.id; save(run); break;
        }
        const valid = run.issue?.status === 'awaiting' && !msg.author?.bot && String(msg.author?.id) === manager && msg.content?.trim() && target && target.delivery === 'sent' && target.id === `${run.runId}-proposal-${run.proposal?.version}` && target.proposalVersion === run.proposal?.version;
        if (valid) {
          run = await decide({runId:run.runId,actorId:run.projectOwnerId,channelId:run.channelId,proposalVersion:target.proposalVersion,decisionId:`discord-${msg.id}`,text:msg.content},{discordMessageId:msg.id,discordAuthorId:String(msg.author.id),discordChannelId:channel,discordTimestamp:msg.timestamp,replyToMessageId:target.discordMessageId});
          const reply = run.messages.find(m=>m.id===`discord-${msg.id}`); if(reply)Object.assign(reply,{delivery:'received',discordMessageId:msg.id,discordAuthorId:String(msg.author.id),discordTimestamp:msg.timestamp,proposalVersion:target.proposalVersion});
        }
        run.discordAfter = msg.id; save(run);
        if(run.issue?.status==='resolved')break;
      }
    }
    // Deliver newly created proposals/confirmations in this same poll cycle.
    await flushPending();
    delete run.discordError; save(run);
  } catch { if (reload) run = reload(); run.discordError = 'Discord delivery or reply processing failed. Check the channel and retry. A sending receipt requires inspection before resending.'; narrate(run, `discord-error:${run.proposal?.version??0}`, 'delivery_error', 'Discord communication needs attention. Please check the project group; I cannot yet verify message delivery or reply processing.', {proposalVersion:run.proposal?.version}); save(run); }
  return run;
}
