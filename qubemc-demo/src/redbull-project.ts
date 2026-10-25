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
  brief: 'Create one X post announcing Red Bull Citrus Edition, with short post copy, one launch image, image alt text and the approved product-page link. Prepare for a simulated 5 PM launch.',
  deadline: '4:00 PM', file: 'RED_BULL_X_LAUNCH_DEMO.md',
  assets: ['Product facts', 'Packshot', 'Brand template'],
  businessDate: '2026-10-26', timezone: 'America/Los_Angeles', clientId: 'CL-001',
  releaseTime: '5:00 PM', closeoutTime: '5:30 PM',
  document: { filename: 'RED_BULL_X_LAUNCH_DEMO.md', content: documentText, mediaType: 'text/markdown' },
  deliverables: ['1 X post', '1600 × 900 PNG', 'Editable design source', 'Image alt text', 'Approved destination link', 'Approval record', 'Simulated release receipt'],
};
export const company: CompanyInput = importedCompany;
