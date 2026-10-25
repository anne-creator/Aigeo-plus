export const needsDiscordSync = run => run.transport==='discord' && run.workflowMode==='discord-confirm-v1' &&
  (run.injection?.status==='waiting'||run.issue?.status==='awaiting'||run.messages.some(m=>m.author==='agent'&&['simulated','pending_transport'].includes(m.delivery)));
// One paginated channel read feeds every active run. Each run still authenticates
// the sender, direct-reply receipt, and proposal version through syncDiscord.
export async function pollDiscordRuns(runs,{channel,read,sync}) {
  const pending=runs.filter(needsDiscordSync);
  const cursors=pending.filter(r=>r.injection?.status==='waiting'||r.issue?.status==='awaiting').map(r=>r.discordAfter).filter(id=>/^\d+$/.test(id??''));
  let batch={messages:[]};
  if(cursors.length){
    const after=cursors.reduce((a,b)=>BigInt(a)<BigInt(b)?a:b);
    batch=await read(['read','--channel','discord','--target',`channel:${channel}`,'--after',after,'--limit','100','--json']);
  }
  for(const run of pending)await sync(run.runId,batch);
}
