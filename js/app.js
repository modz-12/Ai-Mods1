import "./firebase.js";

const cropDefs = {
  wheat:{name:"قمح",icon:"🌾",seedPrice:5,sellPrice:12,growMs:30000,xp:5},
  corn:{name:"ذرة",icon:"🌽",seedPrice:8,sellPrice:20,growMs:45000,xp:8},
  tomato:{name:"طماطم",icon:"🍅",seedPrice:12,sellPrice:32,growMs:60000,xp:12},
  carrot:{name:"جزر",icon:"🥕",seedPrice:15,sellPrice:40,growMs:75000,xp:15}
};
const itemDefs = {
  bread:{name:"خبز",icon:"🍞",price:15,hunger:20},
  apple:{name:"تفاح",icon:"🍎",price:10,hunger:12},
  water:{name:"ماء",icon:"💧",price:5,thirst:30}
};
const animalDefs = {
  cow:{name:"بقرة",icon:"🐄",price:350,feed:"hay",locked:true,description:"نوع حيوان جاهز للنظام المستقبلي."},
  buffalo:{name:"جاموس",icon:"🐃",price:600,feed:"hay",locked:true,description:"سيتم تفعيل تربيته مع توسعة الحظيرة."},
  chicken:{name:"دجاجة",icon:"🐔",price:100,feed:"grain",locked:true,description:"نظام الحيوانات قابل للتوسعة."}
};

function defaultState(){
  return {
    version:1,money:250,xp:0,level:1,energy:100,hunger:100,thirst:100,
    inventory:{wheat:0,corn:0,tomato:0,carrot:0,bread:2,apple:2,water:3},
    plots:Array.from({length:24},(_,i)=>({id:i,status:"empty",crop:null,plantedAt:0,readyAt:0})),
    animals:[],missions:{plant:0,harvest:0,sell:0},lastTick:Date.now()
  };
}
window.FarmGame={defaultState};

let state=defaultState(), uid=null, user=null, activeScreen="farm", saveTimer=null;
const $=id=>document.getElementById(id);

function toast(msg,type="normal"){
  const el=$("toast"); el.textContent=msg; el.className=`toast show ${type}`;
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2600);
}
function normalize(data){
  const d=defaultState();
  state={...d,...(data||{})};
  state.inventory={...d.inventory,...(data?.inventory||{})};
  state.plots=Array.isArray(data?.plots)&&data.plots.length?data.plots:d.plots;
  state.animals=Array.isArray(data?.animals)?data.animals:[];
  state.missions={...d.missions,...(data?.missions||{})};
  return state;
}
function renderAll(){
  renderHeader(); renderFarm(); renderShop(); renderMarket(); renderHouse(); renderAnimals(); renderInventory(); renderMissions();
}
function renderHeader(){
  $("money").textContent=Math.floor(state.money);
  $("energy").textContent=Math.floor(state.energy);
  $("hunger").textContent=Math.floor(state.hunger);
  $("thirst").textContent=Math.floor(state.thirst);
  $("xp").textContent=Math.floor(state.xp);
  $("userEmail").textContent=user?.email||"";
}
function renderFarm(){
  $("farmBoard").innerHTML=state.plots.map((p,i)=>{
    let icon="🟫", cls="plot empty", label="أرض فارغة";
    if(p.status==="growing"){icon=cropDefs[p.crop].icon;cls="plot growing";label="ينمو";}
    if(p.status==="ready"){icon=cropDefs[p.crop].icon;cls="plot ready";label="جاهز للحصاد";}
    return `<button class="${cls}" data-plot="${i}" title="${label}">${icon}<small>${p.status==="empty"?"ازرع":p.status==="ready"?"احصد":timeLeft(p.readyAt)}</small></button>`;
  }).join("");
  document.querySelectorAll("[data-plot]").forEach(b=>b.onclick=()=>plotAction(+b.dataset.plot));
}
function timeLeft(t){
  const s=Math.max(0,Math.ceil((t-Date.now())/1000));
  return s<60?`${s}ث`:`${Math.ceil(s/60)}د`;
}
function plotAction(i){
  const p=state.plots[i];
  if(p.status==="ready"){ harvest(i); return; }
  if(p.status==="growing"){toast("المحصول لم ينضج بعد 🌱");return;}
  const options=Object.entries(cropDefs).map(([k,v])=>`${v.icon} ${v.name}: $${v.seedPrice}`).join("  ");
  const key=prompt(`اختر نوع المحصول بكتابة: wheat أو corn أو tomato أو carrot\n\n${options}`);
  if(key&&cropDefs[key]) plant(i,key); else if(key) toast("نوع غير صحيح","error");
}
function plant(i,key){
  const c=cropDefs[key];
  if(state.money<c.seedPrice){toast("لا تملك نقودًا كافية","error");return;}
  if(state.energy<5){toast("تحتاج إلى الراحة أولًا","error");return;}
  state.money-=c.seedPrice; state.energy=Math.max(0,state.energy-5);
  state.plots[i]={...state.plots[i],status:"growing",crop:key,plantedAt:Date.now(),readyAt:Date.now()+c.growMs};
  state.missions.plant++; gainXP(2); scheduleSave(); renderAll(); toast(`تمت زراعة ${c.name} 🌱`,"success");
}
function harvest(i){
  const p=state.plots[i], c=cropDefs[p.crop];
  state.inventory[p.crop]=(state.inventory[p.crop]||0)+1;
  state.energy=Math.max(0,state.energy-2); state.missions.harvest++;
  gainXP(c.xp); state.plots[i]={...state.plots[i],status:"empty",crop:null,plantedAt:0,readyAt:0};
  scheduleSave(); renderAll(); toast(`حصدت ${c.name} ${c.icon}`,"success");
}
function renderShop(){
  const seeds=Object.entries(cropDefs).map(([k,c])=>card(c.icon,c.name,`البذرة • نمو ${c.growMs/1000} ثانية`,`$${c.seedPrice}`,()=>buySeed(k))).join("");
  const food=Object.entries(itemDefs).map(([k,c])=>card(c.icon,c.name,"طعام / شراب",`$${c.price}`,()=>buyItem(k))).join("");
  $("shopGrid").innerHTML=seeds+food;
}
function card(icon,title,desc,price,action){
  return `<article class="item-card"><div class="item-icon">${icon}</div><h3>${title}</h3><p>${desc}</p><strong>${price}</strong><button class="primary-btn small">شراء</button></article>`;
}
function buySeed(k){
  const c=cropDefs[k]; if(state.money<c.seedPrice)return toast("الرصيد غير كافٍ","error");
  state.money-=c.seedPrice; state.inventory[`${k}_seed`]=(state.inventory[`${k}_seed`]||0)+1; scheduleSave();renderAll();toast(`اشتريت بذرة ${c.name}`);
}
function buyItem(k){
  const c=itemDefs[k]; if(state.money<c.price)return toast("الرصيد غير كافٍ","error");
  state.money-=c.price; state.inventory[k]=(state.inventory[k]||0)+1;scheduleSave();renderAll();toast(`اشتريت ${c.name}`);
}
function renderMarket(){
  $("marketGrid").innerHTML=Object.entries(cropDefs).map(([k,c])=>{
    const n=state.inventory[k]||0;
    return `<article class="item-card"><div class="item-icon">${c.icon}</div><h3>${c.name}</h3><p>المخزون: ${n}</p><strong>$${c.sellPrice} / وحدة</strong><button class="primary-btn small" data-sell="${k}">بيع وحدة</button></article>`;
  }).join("");
  document.querySelectorAll("[data-sell]").forEach(b=>b.onclick=()=>sellOne(b.dataset.sell));
}
function sellOne(k){
  if(!(state.inventory[k]>0))return toast("لا يوجد محصول في المخزون","error");
  const c=cropDefs[k];state.inventory[k]--;state.money+=c.sellPrice;state.missions.sell++;gainXP(3);scheduleSave();renderAll();toast(`تم بيع ${c.name} مقابل $${c.sellPrice}`,"success");
}
function sellAll(){
  let total=0;
  for(const [k,c] of Object.entries(cropDefs)){const n=state.inventory[k]||0;total+=n*c.sellPrice;state.inventory[k]=0;state.missions.sell+=n;state.xp+=n*3;}
  if(!total)return toast("لا يوجد محصول للبيع");
  state.money+=total;scheduleSave();renderAll();toast(`تم بيع المحاصيل مقابل $${total}`,"success");
}
function renderHouse(){
  $("statsPanel").innerHTML=[
    ["❤️","الصحة",Math.min(100,state.health??100)],
    ["🍖","الجوع",state.hunger],["💧","العطش",state.thirst],["⚡","الطاقة",state.energy]
  ].map(x=>`<div class="stat-row"><span>${x[0]} ${x[1]}</span><b>${Math.floor(x[2])}%</b><i><em style="width:${Math.max(0,x[2])}%"></em></i></div>`).join("");
}
function eat(){
  if(!(state.inventory.bread>0||state.inventory.apple>0))return toast("لا يوجد طعام","error");
  const k=state.inventory.bread>0?"bread":"apple",c=itemDefs[k];state.inventory[k]--;state.hunger=Math.min(100,state.hunger+(c.hunger||0));state.energy=Math.min(100,state.energy+5);scheduleSave();renderAll();toast("تناولت الطعام 🍎");
}
function drink(){
  if(!(state.inventory.water>0))return toast("لا يوجد ماء","error");
  state.inventory.water--;state.thirst=Math.min(100,state.thirst+30);scheduleSave();renderAll();toast("شربت الماء 💧");
}
function sleep(){
  state.energy=100;state.hunger=Math.max(0,state.hunger-10);state.thirst=Math.max(0,state.thirst-12);scheduleSave();renderAll();toast("استرحت واستعدت طاقتك 😴","success");
}
function renderAnimals(){
  $("animalsGrid").innerHTML=Object.entries(animalDefs).map(([k,a])=>`
  <article class="item-card animal-card"><div class="item-icon">${a.icon}</div><h3>${a.name}</h3><p>${a.description}</p><strong>${a.locked?"🔒 قريبًا":"$"+a.price}</strong><button class="secondary-btn small" disabled>${a.locked?"مغلق حاليًا":"شراء"}</button></article>`).join("");
}
function renderInventory(){
  const all={...cropDefs,...itemDefs};
  $("inventoryGrid").innerHTML=Object.entries(all).map(([k,x])=>`<div class="inventory-item"><span>${x.icon}</span><b>${x.name}</b><strong>${state.inventory[k]||0}</strong></div>`).join("");
}
function gainXP(n){state.xp+=n;const newLevel=Math.floor(state.xp/100)+1;if(newLevel>state.level){state.level=newLevel;toast(`وصلت للمستوى ${newLevel}! ⭐`,"success")}}
function renderMissions(){
  const missions=[
    ["plant","🌱","ازرع 3 خانات",3,30],["harvest","🌾","احصد 3 محاصيل",3,45],["sell","💰","بع 3 محاصيل",3,60]
  ];
  $("missionsGrid").innerHTML=missions.map(([k,ic,name,target,reward])=>{
    const value=Math.min(target,state.missions[k]||0),done=value>=target;
    return `<article class="mission"><span>${ic}</span><div><h3>${name}</h3><p>${value}/${target} • مكافأة ${reward} XP</p><i><em style="width:${value/target*100}%"></em></i></div>${done?"✅":"⏳"}</article>`;
  }).join("");
}
function scheduleSave(){
  $("saveDot").className="dirty";$("saveText").textContent="جاري الحفظ...";
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveRemote(),700);
}
async function saveRemote(){
  if(!uid)return;
  try{await window.FirebaseGame.saveGame(uid,state);$("saveDot").className="";$("saveText").textContent="محفوظ الآن";}
  catch(e){$("saveText").textContent="تعذر الحفظ";toast("تعذر حفظ التقدم. تحقق من Firestore Rules.","error");}
}
function openScreen(name){
  activeScreen=name;document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
  $("screen-"+name).classList.add("active");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.screen===name));
}
function tick(){
  const now=Date.now(),elapsed=Math.max(0,Math.min(now-(state.lastTick||now),3600000));state.lastTick=now;
  const mins=elapsed/60000;
  if(mins>0){state.hunger=Math.max(0,state.hunger-mins*1.2);state.thirst=Math.max(0,state.thirst-mins*1.8);state.energy=Math.max(0,state.energy-mins*.8);if(state.hunger===0||state.thirst===0)state.health=Math.max(0,(state.health??100)-mins*.8);}
  state.plots.forEach(p=>{if(p.status==="growing"&&Date.now()>=p.readyAt)p.status="ready";});
  renderHeader();renderFarm();renderHouse();
}
async function enterGame(firebaseUser){
  user=firebaseUser;uid=firebaseUser.uid;
  $("authView").classList.add("hidden");$("gameView").classList.remove("hidden");
  let data=await window.FirebaseGame.loadGame(uid);
  state=normalize(data||await window.FirebaseGame.createGame(uid,firebaseUser.email));
  tick();renderAll();await saveRemote();
}
function setAuthMode(mode){
  document.querySelectorAll(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  $("confirmWrap").classList.toggle("hidden",mode!=="register");$("authSubmit").textContent=mode==="register"?"إنشاء المزرعة":"دخول إلى المزرعة";$("authForm").dataset.mode=mode;$("authMessage").textContent="";
}
document.querySelectorAll(".auth-tab").forEach(b=>b.onclick=()=>setAuthMode(b.dataset.mode));
$("authForm").onsubmit=async e=>{
  e.preventDefault();const email=$("email").value.trim(),pass=$("password").value,mode=e.currentTarget.dataset.mode||"login";
  if(mode==="register"&&pass!==$("confirmPassword").value)return $("authMessage").textContent="كلمتا المرور غير متطابقتين.";
  $("authSubmit").disabled=true;
  try{mode==="register"?await window.FirebaseGame.register(email,pass):await window.FirebaseGame.login(email,pass);}
  catch(err){$("authMessage").textContent=humanAuthError(err);}
  finally{$("authSubmit").disabled=false;}
};
$("forgotBtn").onclick=async()=>{const email=$("email").value.trim();if(!email)return $("authMessage").textContent="اكتب بريدك الإلكتروني أولًا.";try{await window.FirebaseGame.resetPassword(email);$("authMessage").textContent="تم إرسال رابط إعادة تعيين كلمة المرور."}catch(e){$("authMessage").textContent=humanAuthError(e)}};
$("logoutBtn").onclick=()=>window.FirebaseGame.logout();
$("saveNow").onclick=()=>saveRemote();$("saveHouse").onclick=()=>saveRemote();$("sellAll").onclick=sellAll;$("eatBtn").onclick=eat;$("drinkBtn").onclick=drink;$("sleepBtn").onclick=sleep;
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>openScreen(b.dataset.screen));
function humanAuthError(e){
 const map={"auth/email-already-in-use":"البريد مستخدم بالفعل.","auth/invalid-credential":"البريد أو كلمة المرور غير صحيحة.","auth/weak-password":"كلمة المرور ضعيفة.","auth/invalid-email":"البريد الإلكتروني غير صالح.","auth/too-many-requests":"محاولات كثيرة، حاول لاحقًا."};
 return map[e.code]||"حدث خطأ أثناء المصادقة.";
}
window.FirebaseGame.onAuthStateChanged(async u=>{
  if(u){await enterGame(u);}else{$("gameView").classList.add("hidden");$("authView").classList.remove("hidden");}
});

let p=0;
const bootInterval=setInterval(()=>{
  p=Math.min(100,p+Math.floor(Math.random()*12)+5);$("bootProgress").style.width=p+"%";$("bootPercent").textContent=p+"%";
  $("bootStatus").textContent=p<35?"تحميل المحرك":p<65?"تجهيز المزرعة":p<90?"توصيل الحفظ السحابي":"جاهز";
  if(p>=100){clearInterval(bootInterval);setTimeout(()=>$("bootScreen").classList.add("hidden"),350);}
},120);
setInterval(tick,1000);setInterval(()=>{if(uid)saveRemote()},60000);
window.addEventListener("beforeunload",()=>{if(uid)saveRemote()});
