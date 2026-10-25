import { readFileSync } from 'node:fs';

const people = new Map(JSON.parse(readFileSync(new URL('../data/company/employees.json', import.meta.url), 'utf8')).map(p => [p.employee_id, p.name]));
const time = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const person = id => people.get(id) || 'a team member';
const title = (run, id) => (run.tasks.find(t => t.id === id)?.title || 'the affected task').replace(/\bEMP-\d{4}\b/g, person);

export function narrate(run, key, kind, text, extra = {}) {
  const events = run.narrationEvents ??= [];
  const id = `${run.runId}:${key}`;
  if (!events.some(e => e.id === id)) events.push({ id, sequence: events.length + 1, kind, text, ...extra });
}

export function narrateAllocation(run) {
  narrate(run, 'allocated', 'allocated', `The Red Bull Citrus Edition team is assigned, led by ${person(run.projectOwnerId)}: ${run.tasks.map(t => `${person(t.ownerId)} will handle ${title(run, t.id)}`).join('; ')}. The project has started.`);
}

export function narrateLeave(run) {
  const fact = run.injection.fact;
  const tasks = run.tasks.filter(t => t.status === 'attention').map(t => title(run, t.id)).join(', ');
  narrate(run, `leave:${fact.id}`, 'leave', `${person(fact.employeeId)} reported sick leave from ${time(fact.start)} to ${time(fact.end)} Pacific time, blocking ${tasks}. Other work can continue while I prepare a reassignment proposal.`);
}

export function narrateProposal(run) {
  const proposalVersion = run.proposal.version;
  if (run.proposal.status === 'unavailable') {
    narrate(run, `unavailable:${proposalVersion}`, 'unavailable', 'No feasible replacement is available yet. The affected work remains blocked and needs a revised plan.', { proposalVersion });
    return;
  }
  const details = run.proposal.updates.map(u => `${person(u.ownerId)} to handle ${title(run, u.taskId)} from ${time(u.start)} to ${time(u.end)} Pacific time`).join('; ');
  const retrospectiveText = `The reassignment plan selected ${details}.`;
  narrate(run, `proposal:${proposalVersion}`, 'proposal', `I propose ${details}. This plan is awaiting ${person(run.projectOwnerId)}'s confirmation.`, { proposalVersion, retrospectiveText });
}

export function narrateApplied(run) {
  const confirmation = run.confirmation;
  if (!confirmation || run.proposal?.status !== 'applied' || confirmation.proposalVersion !== run.proposal.version) return;
  const extra = { proposalVersion: confirmation.proposalVersion };
  const isDiscord = confirmation.source === 'discord';
  narrate(run, `confirmed:${confirmation.decisionId}`, 'confirmed', isDiscord
    ? `${person(run.projectOwnerId)} confirmed the reassignment in Discord.`
    : `In this local test, ${person(run.projectOwnerId)} confirmed the reassignment.`, extra);
  const details = run.proposal.updates.map(u => {
    const task = run.tasks.find(t => t.id === u.taskId);
    const waiting = task.dependencies.some(id => run.tasks.find(t => t.id === id)?.status !== 'done');
    return `${title(run, u.taskId)} is reassigned to ${person(u.ownerId)}${waiting ? ' and scheduled pending its dependencies' : ' with the leave blocker cleared'}`;
  }).join('; ');
  narrate(run, `resumed:${confirmation.decisionId}`, 'resumed', `${isDiscord ? '' : 'In this local test, '}${details}. ${isDiscord ? 'Project coordination can now continue.' : 'The test project can now continue.'}`, extra);
}

export function narrateDelivery(run, message) {
  if (message.id !== `${run.runId}-proposal-${run.proposal?.version}` || run.proposal.status !== 'pending') return;
  narrate(run, `sent:${run.proposal.version}`, 'sent', `The reassignment proposal has been sent to ${person(run.projectOwnerId)} in Discord for confirmation.`, { proposalVersion: run.proposal.version });
}
