import {promises as fs} from "node:fs";
import path from "node:path";

const ROOT=process.cwd();
const DIRS=[{dir:"css",type:"css"},{dir:"js",type:"js"},{dir:"components",type:"html"}];
const EXTS={css:[".css"],js:[".js",".mjs"],html:[".html",".htm"]};
const IGNORE=new Set(["node_modules",".git",".DS_Store"]);

async function walk(dir,type,out=[]){
  let entries=[];
  try{entries=await fs.readdir(dir,{withFileTypes:true})}catch{return out}
  for(const e of entries){
    if(IGNORE.has(e.name))continue;
    const full=path.join(dir,e.name);
    if(e.isDirectory())await walk(full,type,out);
    else if(EXTS[type].includes(path.extname(e.name).toLowerCase())){
      const rel=path.relative(ROOT,full).split(path.sep).join("/");
      const stat=await fs.stat(full);
      const base=path.basename(e.name,path.extname(e.name));
      out.push({
        id:`${type}-${Buffer.from(rel).toString("base64url").toLowerCase()}`,
        name:base.replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()),
        type,path:rel,size:stat.size,
        updatedAt:stat.mtime.toISOString(),
        tags:[type,...path.dirname(rel).split("/").filter(Boolean)]
      });
    }
  }
  return out;
}
const items=[];
for(const x of DIRS)await walk(path.join(ROOT,x.dir),x.type,items);
items.sort((a,b)=>a.path.localeCompare(b.path));
const manifest={version:1,schema:"modz-library-manifest/v1",generatedAt:new Date().toISOString(),total:items.length,items};
await fs.writeFile(path.join(ROOT,"library.manifest.json"),JSON.stringify(manifest,null,2)+"\n","utf8");
console.log(`Manifest generated: ${items.length} items`);
