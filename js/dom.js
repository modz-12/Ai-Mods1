export const $=(selector,root=document)=>root.querySelector(selector);
export const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
export function create(tag,props={},children=[]){const el=document.createElement(tag);Object.assign(el,props);children.forEach(c=>el.append(c));return el}
