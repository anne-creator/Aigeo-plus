import type { CompanyInput, ProjectInput } from './state';
import importedCompany from './company-data.json';
import documentText from '../data/projects/red-bull-x-launch/RED_BULL_X_LAUNCH_DEMO.md?raw';

export type DocumentProject = ProjectInput & {
  workflowId: string; businessDate: string; timezone: string; clientId: string;
  document: { filename: string; content: string; mediaType: 'text/markdown' };
  deliverables: string[]; releaseTime: string; closeoutTime: string;
};
export const project: DocumentProject = {
  id: 'P-DEMO-001', workflowId: 'RED-BULL-X-LAUNCH-V1',
  title: 'Red Bull Citrus Edition',
  brief: 'Prepare a coordinated X launch asset package for Red Bull Citrus Edition: teaser, launch and follow-up posts with matching visuals, editable sources, alt text, community-response material and a delivery manifest. Use supplied product facts, packshot, brand template and approved link. Deliver by 4 PM for a simulated 5 PM main launch.',
  deadline: '4:00 PM', file: 'RED_BULL_X_LAUNCH_DEMO.md',
  assets: ['Product facts', 'Packshot', 'Brand template', 'Approved destination link'],
  businessDate: '2026-10-26', timezone: 'America/Los_Angeles', clientId: 'CL-001',
  releaseTime: '5:00 PM', closeoutTime: '5:30 PM',
  document: { filename: 'RED_BULL_X_LAUNCH_DEMO.md', content: documentText, mediaType: 'text/markdown' },
  deliverables: ['Product-message sheet', 'Creative direction', 'Teaser, launch and follow-up X copy', '3 matching 1600 × 900 PNGs', 'Editable design sources', 'Alt text for each final image', 'FAQ and comment-reply drafts', 'Asset package with versions and link manifest'],
};
export const company: CompanyInput = importedCompany;
