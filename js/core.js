export class LibraryRegistry{
  constructor(manifest){this.manifest=manifest;this.items=manifest.items||[];this.cache=new Map()}
  count(type=null){return type?this.items.filter(x=>x.type===type).length:this.items.length}
  find(query){const q=String(query).toLowerCase();return this.items.filter(x=>`${x.name} ${x.path} ${(x.tags||[]).join(" ")}`.toLowerCase().includes(q))}
  async load(path){if(this.cache.has(path))return this.cache.get(path);const r=await fetch("./"+path);if(!r.ok)throw new Error(r.status);const text=await r.text();this.cache.set(path,text);return text}
}
