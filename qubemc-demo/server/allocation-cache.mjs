import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
export const allocationCacheKey = facts => createHash('sha256').update(JSON.stringify(facts)).digest('hex');
export function allocationCache(directory,key){
  const file=join(directory,`${key}.json`);
  return {
    read(){try{const entry=JSON.parse(readFileSync(file,'utf8'));return entry.key===key?entry.value:null;}catch{return null;}},
    write(value){mkdirSync(directory,{recursive:true,mode:0o700});writeFileSync(file+'.tmp',JSON.stringify({key,value}),{mode:0o600});renameSync(file+'.tmp',file);},
    remove(){try{unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}},
  };
}
