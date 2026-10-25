import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
const validId = id => { if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)) throw Error('Invalid run ID.'); return id; };
export function createPlanJobs({ storeDir, plan, timeout = 600000 }) {
  const directory = join(storeDir, 'jobs');
  const active = new Map();
  let queue = Promise.resolve();
  const path = id => join(directory, `${validId(id)}.json`);
  const save = job => {
    mkdirSync(directory, {recursive:true});
    writeFileSync(path(job.runId)+'.tmp',JSON.stringify(job));
    renameSync(path(job.runId)+'.tmp',path(job.runId));
  };
  function saved(runId) {
    const file=join(storeDir,`${validId(runId)}.json`);
    if(!existsSync(file)) return null;
    const {specs,externalConflicts,...run}=JSON.parse(readFileSync(file,'utf8'));
    if(run.workflowMode!=='discord-confirm-v1') throw Error('Invalid legacy workflow. Start a new project.');
    run.activity=(run.activity??[]).filter(item=>!item.startsWith('Separate conflict:'));
    return {runId,status:'complete',run};
  }
  function status(runId) {
    const complete=saved(runId); if(complete)return complete;
    if(!existsSync(path(runId)))throw Error('Missing allocation. Retry to start this project.');
    const job=JSON.parse(readFileSync(path(runId),'utf8'));
    if(['queued','running','complete'].includes(job.status)&&!active.has(runId)) {
      job.status='failed';job.error='Allocation was interrupted by a server restart. Retry resumes this project.';save(job);
    }
    return job;
  }
  function start(input) {
    const runId=validId(input.runId);
    if(input.project?.id!=='P-DEMO-001'||input.project?.workflowId!=='RED-BULL-X-LAUNCH-V1')throw Error('Unknown preloaded project.');
    const complete=saved(runId);if(complete)return complete;
    if(active.has(runId))return status(runId);
    const job={runId,status:'queued',startedAt:new Date().toISOString()};save(job);
    const work=queue.then(async()=>{
      job.status='running';save(job);
      try {
        await plan(input,AbortSignal.timeout(timeout));
        job.status='complete';
      } catch(error) {
        job.status='failed';
        job.error=/^(Model |Invalid |Missing |No )/.test(error?.message??'')?error.message:'Allocation could not finish. Retry resumes this project; local inference may be busy.';
      } finally {save(job);active.delete(runId);}
    });
    active.set(runId,work);queue=work.catch(()=>{});
    return {...job};
  }
  return {start,status,settled:()=>queue};
}
