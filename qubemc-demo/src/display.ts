// Presentation-only labels. IDs remain untouched in requests, state and audit records.
const referenceTasks:Record<string,string>={
  'RB-01':'Launch outline','RB-02':'Direction review','RB-03':'X copy and alt text',
  'RB-04':'Launch image','RB-05':'Combined review','RB-06':'Client review',
  'RB-07':'Simulated publishing','RB-08':'Archive',
};
const taskCode=/\b(?:RB-\d+(?:-[\w]+)*|TASK-\d+|T-\d+)\b/g;
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function createDisplayLabels(people:readonly {id:string;name:string}[],tasks:readonly {id:string;title:string}[]){
  const names=new Map(people.map(p=>[p.id,p.name]));
  const titles=new Map(Object.entries(referenceTasks));
  for(const t of tasks)titles.set(t.id,t.title.replace(taskCode,'').replace(/^\s*[:·—–-]+\s*/,'').trim()||referenceTasks[t.id]||'Project task');
  const task=(id:string)=>titles.get(id)??'Project task';
  const person=(id:string|undefined)=>id?names.get(id)??'Team member':'Team member';
  const codes=[...titles.keys()].filter(id=>/[\d_-]/.test(id)).sort((a,b)=>b.length-a.length);
  const known=new RegExp(`(?<![\\w-])(?:${codes.map(escape).join('|')})(?![\\w-])`,'g');
  const text=(value:string)=>{
    if(titles.has(value))return task(value);
    let result=value.replace(known,id=>task(id)).replace(taskCode,'Project task');
    for(const t of tasks.filter(t=>!/[\d_-]/.test(t.id)))result=result.replace(new RegExp(`\\b(task\\s+)${escape(t.id)}\\b`,'gi'),(_,prefix)=>prefix+task(t.id));
    return result.replace(/\bEMP-\d+\b/g,id=>person(id)).replace(/\bEXT-CLIENT-001\b/g,'Casey Williams');
  };
  return {text,task,person};
}
