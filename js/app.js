const state={
  manifest:{version:1,items:[]},items:[],filtered:[],filter:"all",query:"",
  page:1,pageSize:Number(localStorage.getItem("hubPageSize")||24),layout:"grid",preview:true,
  cache:new Map()
};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const typeLabel=t=>({css:"CSS",js:"JS",html:"HTML"}[t]||String(t).toUpperCase());
const extType=p=>/\.css$/i.test(p)?"css":/\.m?js$/i.test(p)?"js":"html";

async function boot(){
  const progress=$("#bootProgress"),status=$("#bootStatus");
  const set=(n,t)=>{progress.style.width=n+"%";status.textContent=t};
  set(15,"تحميل الفهرس...");
  try{
    const r=await fetch("./library.manifest.json?ts="+Date.now(),{cache:"no-store"});
    if(!r.ok) throw new Error("Manifest HTTP "+r.status);
    state.manifest=await r.json();
  }catch(e){
    console.warn(e); state.manifest={version:1,generatedAt:null,items:[]};
    set(100,"تعذر قراءة الفهرس — وضع فارغ");
  }
  set(55,"بناء Registry...");
  state.items=(state.manifest.items||[]).map((x,i)=>({...x,id:x.id||`${x.type}-${i}`,type:x.type||extType(x.path)}));
  state.items.sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
  set(80,"تهيئة الواجهة...");
  bind();
  renderCounts();
  renderRecent();
  renderLibrary();
  renderComponents();
  set(100,"جاهز");
  setTimeout(()=>{$("#boot").remove();$("#app").hidden=false},250);
}
function bind(){
  $$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  $$("[data-type]").forEach(b=>b.addEventListener("click",()=>{showView("library");setFilter(b.dataset.type)}));
  $$("[data-filter]").forEach(b=>b.addEventListener("click",()=>setFilter(b.dataset.filter)));
  $$("[data-layout]").forEach(b=>b.addEventListener("click",()=>{state.layout=b.dataset.layout;$$("[data-layout]").forEach(x=>x.classList.toggle("active",x===b));renderLibrary()}));
  $("#searchInput").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();state.page=1;renderLibrary()});
  $("#sortSelect").addEventListener("change",renderLibrary);
  $("#pageSizeSelect").value=state.pageSize;
  $("#pageSizeSelect").addEventListener("change",e=>{state.pageSize=Number(e.target.value);localStorage.setItem("hubPageSize",state.pageSize);state.page=1;renderLibrary()});
  $("#previewToggle").addEventListener("change",e=>{state.preview=e.target.checked;renderLibrary()});
  $("#themeBtn").addEventListener("click",()=>document.body.classList.toggle("light-mode"));
  $("#refreshBtn").addEventListener("click",()=>location.reload());
  $("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#closeModal").addEventListener("click",closeModal);
  $("#assetModal").addEventListener("click",e=>{if(e.target.id==="assetModal")closeModal()});
  $("#modalCopy").addEventListener("click",()=>copyText($("#modalCode").textContent));
  $("#clearCacheBtn").addEventListener("click",()=>{state.cache.clear();showToast("تم مسح الذاكرة المؤقتة")});
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#searchInput").focus()}if(e.key==="Escape")closeModal()});
}
function showView(view){
  $$(".page").forEach(p=>p.hidden=true);
  const target=$("#"+view+"View"); if(target) target.hidden=false;
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===view));
  if(view==="library")renderLibrary();
  if(window.innerWidth<900)$("#sidebar").classList.remove("open");
}
function setFilter(f){state.filter=f;state.page=1;$$("[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===f));renderLibrary()}
function renderCounts(){
  const c={css:0,js:0,html:0};state.items.forEach(x=>c[x.type]=(c[x.type]||0)+1);
  $("#totalCount").textContent=state.items.length.toLocaleString("en-US");
  $("#cssCount").textContent=c.css;$("#jsCount").textContent=c.js;$("#htmlCount").textContent=c.html;
  $("#statCss").textContent=c.css;$("#statJs").textContent=c.js;$("#statHtml").textContent=c.html;
  $("#allTabCount").textContent=state.items.length;$("#cssTabCount").textContent=c.css;$("#jsTabCount").textContent=c.js;$("#htmlTabCount").textContent=c.html;
}
function getFiltered(){
  let a=state.items;
  if(state.filter!=="all")a=a.filter(x=>x.type===state.filter);
  if(state.query)a=a.filter(x=>`${x.name} ${x.path} ${x.description||""} ${(x.tags||[]).join(" ")}`.toLowerCase().includes(state.query));
  const sort=$("#sortSelect")?.value||"name";
  a=[...a].sort((x,y)=>sort==="size"?Number(y.size||0)-Number(x.size||0):sort==="newest"?String(y.updatedAt||"").localeCompare(String(x.updatedAt||"")):String(x.name).localeCompare(String(y.name),"ar"));
  return a;
}
function renderLibrary(){
  const grid=$("#libraryGrid"),items=getFiltered(),pages=Math.max(1,Math.ceil(items.length/state.pageSize));
  state.page=Math.min(state.page,pages);state.filtered=items;
  const start=(state.page-1)*state.pageSize;const slice=items.slice(start,start+state.pageSize);
  grid.className="asset-grid "+(state.layout==="list"?"list-layout":"");grid.innerHTML="";
  if(!slice.length){grid.innerHTML=`<div class="empty-state">لا توجد نتائج مطابقة.</div>`;$("#pagination").innerHTML="";$("#resultCount").textContent="0 عنصر";return}
  const frag=document.createDocumentFragment();slice.forEach(x=>frag.appendChild(card(x)));grid.appendChild(frag);
  $("#resultCount").textContent=`${items.length.toLocaleString("en-US")} عنصر`;
  $("#pageInfo").textContent=`صفحة ${state.page} / ${pages}`;
  renderPagination(pages);
}
function card(x){
  const el=document.createElement("article");el.className="asset-card";el.dataset.id=x.id;
  el.innerHTML=`<div class="asset-preview">${state.preview?preview(x):`<span class="badge">${typeLabel(x.type)}</span>`}</div>
    <div class="asset-info"><div class="asset-name">${esc(x.name)}</div><div class="asset-path">${esc(x.path)}</div>
    <div class="asset-foot"><span class="badge">${typeLabel(x.type)}</span><button class="copy-mini" data-copy>نسخ</button></div></div>`;
  el.addEventListener("click",e=>{if(e.target.closest("[data-copy]")){e.stopPropagation();loadAndCopy(x);return}openAsset(x)});
  return el;
}
function renderPagination(pages){
  const p=$("#pagination");p.innerHTML="";const add=(label,n,active=false)=>{const b=document.createElement("button");b.className="page-btn"+(active?" active":"");b.textContent=label;b.disabled=n===state.page;b.onclick=()=>{state.page=n;renderLibrary();window.scrollTo({top:0,behavior:"smooth"})};p.appendChild(b)};
  if(pages<=1)return;
  if(state.page>1)add("‹",state.page-1);
  const from=Math.max(1,state.page-2),to=Math.min(pages,state.page+2);for(let n=from;n<=to;n++)add(n,n,n===state.page);
  if(state.page<pages)add("›",state.page+1);
}
function renderRecent(){
  const a=[...state.items].sort((x,y)=>String(y.updatedAt||"").localeCompare(String(x.updatedAt||""))).slice(0,6);
  const g=$("#recentGrid");g.innerHTML="";a.forEach(x=>g.appendChild(card(x)));
}
function preview(x){
  if(x.previewHtml)return x.previewHtml;
  if(x.type==="css")return `<div class="live-card"><h4>CSS Component</h4><button class="live-btn">Preview</button></div>`;
  if(x.type==="js")return `<div><span class="badge">JS</span><p style="color:var(--muted);font-size:11px">JavaScript Module</p></div>`;
  return `<div class="live-card"><h4>${esc(x.name)}</h4><button class="live-btn">Open</button></div>`;
}
function renderComponents(){
  $("#componentLab").innerHTML=`
  <article class="lab-card"><div class="eyebrow">BUTTONS</div><h3>أزرار النظام</h3><div class="lab-stage"><button class="live-btn">زر أساسي</button></div></article>
  <article class="lab-card"><div class="eyebrow">FORMS</div><h3>حقول الإدخال</h3><div class="lab-stage"><input class="live-input" placeholder="اكتب شيئًا..."></div></article>
  <article class="lab-card"><div class="eyebrow">CARDS</div><h3>بطاقات المحتوى</h3><div class="lab-stage"><div class="live-card"><h4>Component Card</h4><p style="color:var(--muted);font-size:11px">نواة قابلة لإعادة الاستخدام.</p></div></div></article>
  <article class="lab-card"><div class="eyebrow">BADGES</div><h3>الشارات</h3><div class="lab-stage"><span class="badge">READY</span></div></article>`;
}
async function readContent(x){
  if(state.cache.has(x.path))return state.cache.get(x.path);
  const r=await fetch("./"+x.path,{cache:"force-cache"});if(!r.ok)throw new Error("HTTP "+r.status);
  const text=await r.text();state.cache.set(x.path,text);return text;
}
async function openAsset(x){
  $("#assetModal").hidden=false;$("#modalTitle").textContent=x.name;$("#modalType").textContent=typeLabel(x.type);$("#modalCode").textContent="جاري التحميل...";$("#modalPreview").innerHTML=preview(x);
  try{const code=await readContent(x);$("#modalCode").textContent=code;buildModalPreview(x,code)}catch(e){$("#modalCode").textContent="تعذر تحميل الملف: "+e.message}
}
function buildModalPreview(x,code){
  const box=$("#modalPreview");
  if(x.type==="html"){const frame=document.createElement("iframe");frame.sandbox="allow-scripts";frame.style.cssText="width:100%;height:280px;border:0;background:#fff;border-radius:10px";frame.srcdoc=code;box.innerHTML="";box.appendChild(frame)}
  else if(x.type==="css"){box.innerHTML=`<div class="live-card"><h4>CSS Preview</h4><button class="live-btn">Styled Button</button></div>`}
  else box.innerHTML=`<div><span class="badge">JavaScript</span><p style="color:var(--muted);font-size:11px">تم تحميل ${code.length.toLocaleString()} حرف.</p></div>`;
}
function closeModal(){$("#assetModal").hidden=true}
async function loadAndCopy(x){try{await copyText(await readContent(x));showToast("تم نسخ "+x.name)}catch(e){showToast("فشل النسخ")}}
async function copyText(text){await navigator.clipboard.writeText(text);showToast("تم النسخ ✓")}
let toastTimer;function showToast(t){$("#toastText").textContent=t;$("#toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("show"),1800)}
boot();
