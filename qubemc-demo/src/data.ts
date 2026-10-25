import type { CompanyInput, Person, ProjectInput } from './state';
export const project: ProjectInput = { id: 'launch-01', title: 'New product launch', brief: 'Three social stories. One key visual. Ready for the world by 4 PM.', deadline: '4:00 PM', file: 'product-launch.brief', assets: ['Brand guidelines', 'Product kit', 'Production SOP'] };
const departments = ['Client Services','PMO','Strategy','Creative','Copywriting','Production','Media','Social','Influencer','Research','Analytics','Technology','Finance','People','Operations','Legal','Leadership'];
export const featured: Person[] = [
  { id: 'maya', name: 'Maya Chen', role: 'Copywriter', initials: 'MC', department: 'Copywriting', skills: ['Social copy','Brand voice'], availableHours: 5, color: 'rose' },
  { id: 'alex', name: 'Alex Rivera', role: 'Visual designer', initials: 'AR', department: 'Creative', skills: ['Art direction','Product launches'], availableHours: 4, color: 'mint' },
  { id: 'jordan', name: 'Jordan Lee', role: 'Project lead', initials: 'JL', department: 'PMO', skills: ['Coordination','Brand review'], availableHours: 6, color: 'sand' },
];
// Deterministic synthetic company input; the three showcased assignments are mock fixtures.
export const company: CompanyInput = { departments, people: [...featured, ...Array.from({ length: 997 }, (_, i): Person => ({ id: `employee-${i+4}`, name: `Team member ${i+4}`, initials: 'TM', role: ['Designer','Strategist','Coordinator','Specialist'][i%4], department: departments[i%17], skills: [['Design'],['Planning'],['Coordination'],['Research']][i%4], availableHours: 1+i%7, color: 'mint' }))] };
