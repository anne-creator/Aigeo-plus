import type { CompanyInput, ProjectInput } from './state';
import importedCompany from './company-data.json';

// Project scenario is still the existing development fixture. The provided
// package's six-node workflow and reassignment scripts are not executed.
export const project: ProjectInput = { id: 'launch-01', title: 'New product launch', brief: 'Three social posts and one key visual.', deadline: '4:00 PM', file: 'product-launch.brief', assets: ['Brand guidelines', 'Product kit', 'Production SOP'] };
export const company: CompanyInput = importedCompany;

// Development example only: directory IDs, never a model ranking or live dispatch.
export const demoOwners = { copy: 'EMP-0349', visual: 'EMP-0329', lead: 'EMP-0218' };
