import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
  doc, getDoc, setDoc, serverTimestamp
} from "./firebase.js";

const $ = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const qa = sel => [...document.querySelectorAll(sel)];

const CROP_DEFS = {
  wheat:{name:"قمح",icon:"🌾",seed:"wheatSeed",seedPrice:8,sell:22,grow:2,xp:8,food:"bread",water:true},
  corn:{name:"ذرة",icon:"🌽",seed:"cornSeed",seedPrice:12,sell:34,grow:3,xp:12,water:true},
  tomato:{name:"طماطم",icon:"🍅",seed:"tomatoSeed",seedPrice:18,sell:48,grow:4,xp:16,water:true},
  carrot:{name:"جزر",icon:"🥕",seed:"carrotSeed",seedPrice:10,sell:28,grow:2,xp:10,water:true},
  potato:{name:"بطاطس",icon:"🥔",seed:"potatoSeed",seedPrice:15,sell:40,grow:3,xp:13,water:true}
};

const ITEM_DEFS = {
  wheatSeed:{name:"بذور القمح",icon:"🌾",type:"seed",crop:"wheat"},
  cornSeed:{name:"بذور الذرة",icon:"🌽",type:"seed",crop:"corn"},
  tomatoSeed:{name:"بذور الطماطم",icon:"🍅",type:"seed",crop:"tomato"},
  carrotSeed:{name:"بذور الجزر",icon:"🥕",type:"seed",crop:"carrot"},
  potatoSeed:{name:"بذور البطاطس",icon:"🥔",type:"seed",crop:"potato"},
  bread:{name:"خبز",icon:"🍞",type:"food",price:16,hunger:28,energy:8},
  apple:{name:"تفاحة",icon:"🍎",type:"food",price:12,hunger:20,energy:4},
  water:{name:"ماء",icon:"💧",type:"drink",price:5,thirst:35,energy:3},
  juice:{name:"عصير",icon:"🧃",type:"drink",price:11,thirst:55,energy:6},
  wheat:{name:"قمح",icon:"🌾",type:"produce"},
  corn:{name:"ذرة",icon:"🌽",type:"produce"},
  tomato:{name:"طماطم",icon:"🍅",type:"produce"},
  carrot:{name:"جزر",icon:"🥕",type:"produce"},
  potato:{name:"بطاطس",icon:"🥔",type:"produce"}
};

const SHOP = [
  {item:"wheatSeed",price:8,unit:"بذور"},
  {item:"cornSeed",price:12,unit:"بذور"},
  {item:"tomatoSeed",price:18,unit:"بذور"},
  {item:"carrotSeed",price:10,unit:"بذور"},
  {item:"potatoSeed",price:15,unit:"بذور"},
  {item:"bread",price:16,unit:"طعام"},
  {item:"apple",price:12,unit:"طعام"},
  {item:"water",price:5,unit:"شراب"},
  {item:"juice",price:11,unit:"شراب"}
];

const ANIMALS = [
  {id:"chicken",name:"دجاجة",icon:"🐔",cost:80,unlock:2,desc:"تنتج البيض بعد تطوير الحظيرة."},
  {id:"cow",name:"بقرة",icon:"🐄",cost:350,unlock:4,desc:"مصدر للحليب ويمكن توسيع إنتاجها."},
  {id:"buffalo",name:"جاموس",icon:"🐃",cost:700,unlock:7,desc:"حيوان قوي لإنتاج الحليب عالي القيمة."},
  {id:"sheep",name:"خروف",icon:"🐑",cost:500,unlock:5,desc:"إضافة مستقبلية للصوف والمنتجات الحيوانية."}
];

const TIPS = [
  "ازرع القمح أولًا؛ رخيص وسريع.",
  "الماء والطعام يرفعان قدرتك على العمل.",
  "النوم يعيد الطاقة ويبدأ يومًا جديدًا.",
  "لا تبع كل شيء؛ احتفظ ببعض الطعام والشراب.",
  "كلما ارتفع مستواك ستفتح أنظمة جديدة.",
  "الحيوانات مصممة لتضاف لاحقًا بدون تغيير بنية اللعبة."
];

const defaultState = () => ({
  version:2, day:1, money:150, xp:0, level:1, energy:100, hunger:100, thirst:100, health:100,
  weather:"مشمس", selectedSeed:"wheatSeed",
  inventory:{wheatSeed:6,cornSeed:2,tomatoSeed:0,carrotSeed:2,potatoSeed:0,bread:2,apple:1,water:3,juice:0,wheat:0,corn:0,tomato:0,carrot:0,potato:0},
  plots:Array.from({length:24},()=>({crop:null,plantedAt:0,watered:false,ready:false})),
  animals:[], missions:{plant:0,harvest:0,sell:0,days:0},
  createdAt:null, updatedAt:null
});

let state = defaultState();
let currentUser = null;
let saveTimer = null;
let saveBusy = false;
let pendingSave = false;

function clone(x){ return JSON.parse(JSON.stringify(x)); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function toast(msg,type="ok"){
  const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=msg;
  $("toastRoot").appendChild(el); setTimeout(()=>el.remove(),3200);
}
function setAuthMessage(msg,error=true){ $("authMessage").textContent=msg; $("authMessage").style.color=error?"var(--red)":"var(--green)"; }
function levelForXp(xp){ return Math.max(1,Math.floor(Math.sqrt(xp/25))+1); }
function levelXp(lvl){ return Math.pow(Math.max(0,lvl-1),2)*25; }
function xpProgress(){ const base=levelXp(state.level), next=levelXp(state.level+1); return clamp((state.xp-base)/(next-base)*100,0,100); }
function inventoryCount(id){ return Number(state.inventory[id]||0); }
function addItem(id,n){ state.inventory[id]=Math.max(0,inventoryCount(id)+n); }
function spendMoney(n){ if(state.money<n){toast("رصيدك غير كافٍ","error");return false;} state.money-=n; return true; }
function gainXp(n){
  const old=state.level; state.xp+=n; state.level=levelForXp(state.xp);
  if(state.level>old) toast(`🎉 ارتقيت إلى المستوى ${state.level}!`);
}
function markDirty(){ renderAll(); scheduleSave(); }
function scheduleSave(){
  $("saveIndicator").textContent="جاري الحفظ...";
  clearTimeout(saveTimer); saveTimer=setTimeout(()=>saveRemote(false),900);
}
async function saveRemote(manual=true){
  if(!currentUser){ return; }
  if(saveBusy){ pendingSave=true; return; }
  saveBusy=true;
  try{
    const clean=clone(state); clean.updatedAt=serverTimestamp();
    if(!clean.createdAt) clean.createdAt=serverTimestamp();
    await setDoc(doc(db,"players",currentUser.uid,"game","state"),clean,{merge:true});
    $("saveIndicator").textContent="محفوظ";
    if(manual) toast("تم حفظ المزرعة بنجاح");
  }catch(err){
    console.error(err); $("saveIndicator").textContent="فشل الحفظ"; toast("تعذر حفظ التقدم. تحقق من Firestore والقواعد.","error");
  }finally{
    saveBusy=false;
    if(pendingSave){pendingSave=false;setTimeout(()=>saveRemote(false),150);}
  }
}
async function loadRemote(user){
  const ref=doc(db,"players",user.uid,"game","state");
  const snap=await getDoc(ref);
  if(snap.exists()){
    const remote=snap.data();
    state={...defaultState(),...remote};
    state.inventory={...defaultState().inventory,...(remote.inventory||{})};
    state.plots=(remote.plots||defaultState().plots).map(p=>({...{crop:null,plantedAt:0,watered:false,ready:false},...p}));
    state.missions={...defaultState().missions,...(remote.missions||{})};
    state.level=levelForXp(Number(state.xp)||0);
  }else{
    state=defaultState();
    await setDoc(ref,{...clone(state),createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
  }
}
function enterGame(){
  $("authScreen").classList.add("hidden"); $("gameApp").classList.remove("hidden");
  $("playerEmail").textContent=currentUser?.email||"لاعب";
  renderAll();
}
function showAuth(){ $("gameApp").classList.add("hidden"); $("authScreen").classList.remove("hidden"); }

function renderFarm(){
  $("farmDay").textContent=state.day; $("farmLevel").textContent=`المستوى ${state.level}`;
  $("weatherValue").textContent=state.weather; $("healthValue").textContent=Math.round(state.health);
  $("farmGrid").innerHTML="";
  state.plots.forEach((p,i)=>{
    const el=document.createElement("div");
    const crop=p.crop?CROP_DEFS[p.crop]:null;
    const progress=crop&&p.plantedAt?clamp((state.day-p.plantedAt+1)/crop.grow*100,0,100):0;
    const ready=!!(crop&&(p.ready||progress>=100));
    if(ready&&!p.ready){p.ready=true;}
    el.className=`plot ${p.crop?"":"empty"} ${p.watered?"watered":""} ${ready?"ready":""}`;
    let body="🟫", foot="أرض فارغة", action="ازرع";
    if(crop){body=crop.icon;foot=ready?"جاهز للحصاد":`النمو ${Math.round(progress)}%`;action=ready?"احصد":p.watered?"ينمو...":"اسقِ";}
    el.innerHTML=`<div class="plot-head"><span>قطعة ${i+1}</span><span>${p.watered?"💧":""}</span></div>
      <div class="plot-body">${body}</div><div class="growth"><i style="width:${progress}%"></i></div>
      <div class="plot-foot">${foot}</div><button class="plot-action">${action}</button>`;
    el.querySelector("button").onclick=()=>plotAction(i);
    $("farmGrid").appendChild(el);
  });
}
function plotAction(i){
  const p=state.plots[i];
  if(!p.crop){
    const seed=state.selectedSeed;
    const cropKey=Object.keys(CROP_DEFS).find(k=>CROP_DEFS[k].seed===seed);
    if(!cropKey){toast("اختر بذورًا أولًا","error");return;}
    if(inventoryCount(seed)<=0){toast("لا تملك هذه البذور","error");return;}
    if(state.energy<3){toast("طاقتك منخفضة. نم أو تناول طعامًا.","error");return;}
    addItem(seed,-1); state.energy-=3; p.crop=cropKey;p.plantedAt=state.day;p.watered=false;p.ready=false;
    state.missions.plant++; gainXp(2); toast(`🌱 زرعت ${CROP_DEFS[cropKey].name}`); markDirty(); return;
  }
  const crop=CROP_DEFS[p.crop];
  const progress=clamp((state.day-p.plantedAt+1)/crop.grow*100,0,100);
  if(p.ready||progress>=100){
    addItem(p.crop,1); p.crop=null;p.plantedAt=0;p.watered=false;p.ready=false;
    state.energy=clamp(state.energy-2,0,100); state.missions.harvest++; gainXp(crop.xp);
    toast(`🧺 حصدت ${crop.name}`); markDirty(); return;
  }
  if(!p.watered){
    if(state.energy<1){toast("لا توجد طاقة للري","error");return;}
    p.watered=true; state.energy--; gainXp(1); toast("💧 تم ري المحصول"); markDirty();
  }else toast("المحصول ينمو. تقدم الأيام بالنوم.", "info");
}
function waterAll(){
  let count=0;
  state.plots.forEach(p=>{if(p.crop&&!p.watered&&!p.ready){p.watered=true;count++;}});
  if(count){state.energy=clamp(state.energy-count,0,100);gainXp(count);toast(`💧 تم ري ${count} قطعة`);markDirty();}
  else toast("لا توجد محاصيل تحتاج إلى ري","info");
}
function harvestAll(){
  let count=0;
  state.plots.forEach(p=>{
    if(p.crop){
      const crop=CROP_DEFS[p.crop], progress=clamp((state.day-p.plantedAt+1)/crop.grow*100,0,100);
      if(p.ready||progress>=100){addItem(p.crop,1);p.crop=null;p.ready=false;p.watered=false;p.plantedAt=0;state.missions.harvest++;gainXp(crop.xp);count++;}
    }
  });
  if(count){toast(`🧺 جمعت ${count} محصول`);markDirty();}else toast("لا يوجد محصول جاهز","info");
}

function renderShop(){
  $("shopGrid").innerHTML="";
  SHOP.forEach(x=>{
    const item=ITEM_DEFS[x.item];
    const card=document.createElement("article");card.className="item-card";
    card.innerHTML=`<div class="item-icon">${item.icon}</div><h3>${item.name}</h3><p>${x.unit} — لديك <b>${inventoryCount(x.item)}</b></p><div class="price-row"><span class="price">🪙 ${x.price}</span><button class="primary">شراء</button></div>`;
    card.querySelector("button").onclick=()=>buyItem(x.item,x.price);
    $("shopGrid").appendChild(card);
  });
}
function buyItem(id,price){
  if(!spendMoney(price))return;
  addItem(id,1); toast(`تم شراء ${ITEM_DEFS[id].name}`); markDirty();
}
function renderMarket(){
  const produce=Object.keys(CROP_DEFS);
  $("marketGrid").innerHTML="";
  produce.forEach(id=>{
    const crop=CROP_DEFS[id], qty=inventoryCount(id);
    const card=document.createElement("article");card.className="item-card";
    card.innerHTML=`<div class="item-icon">${crop.icon}</div><h3>${crop.name}</h3><p>سعر البيع الحالي: <b>${crop.sell}</b> عملة. الكمية: <b>${qty}</b></p><div class="price-row"><span class="price">🪙 +${crop.sell}</span><button class="primary" ${qty?"":"disabled"}>بيع 1</button></div>`;
    card.querySelector("button").onclick=()=>sellItem(id);
    $("marketGrid").appendChild(card);
  });
}
function sellItem(id){
  if(inventoryCount(id)<=0)return;
  const crop=CROP_DEFS[id];addItem(id,-1);state.money+=crop.sell;state.missions.sell++;gainXp(3);toast(`🪙 بعت ${crop.name} بـ ${crop.sell}`);markDirty();
}
function eatBest(){
  const foods=["bread","apple"];
  const id=foods.find(x=>inventoryCount(x)>0);
  if(!id){toast("لا يوجد طعام. اشترِ من المتجر.","error");return;}
  const item=ITEM_DEFS[id];addItem(id,-1);state.hunger=clamp(state.hunger+item.hunger,0,100);state.energy=clamp(state.energy+item.energy,0,100);toast(`🍞 تناولت ${item.name}`);markDirty();
}
function drink(){
  const id=inventoryCount("juice")>0?"juice":inventoryCount("water")>0?"water":null;
  if(!id){toast("لا يوجد شراب.","error");return;}
  const item=ITEM_DEFS[id];addItem(id,-1);state.thirst=clamp(state.thirst+item.thirst,0,100);state.energy=clamp(state.energy+item.energy,0,100);toast(`💧 استخدمت ${item.name}`);markDirty();
}
function sleep(){
  state.day++;
  state.energy=100;state.hunger=clamp(state.hunger-12,0,100);state.thirst=clamp(state.thirst-15,0,100);
  if(state.hunger<20||state.thirst<20)state.health=clamp(state.health-8,0,100);else state.health=clamp(state.health+5,0,100);
  state.missions.days++;
  const weather=["مشمس","غائم","نسيم","مشمس"][Math.floor(Math.random()*4)];state.weather=weather;
  state.plots.forEach(p=>{if(p.crop&&p.watered)p.watered=false;});
  gainXp(5);toast(`🌅 صباح اليوم ${state.day}`);markDirty();
}
function renderHouse(){
  $("energyBar").style.width=state.energy+"%";$("hungerBar").style.width=state.hunger+"%";$("thirstBar").style.width=state.thirst+"%";$("healthBar").style.width=state.health+"%";
}
function renderAnimals(){
  $("animalGrid").innerHTML="";
  ANIMALS.forEach(a=>{
    const unlocked=state.level>=a.unlock;
    const card=document.createElement("article");card.className="animal-card";
    card.innerHTML=`<div class="animal-icon">${a.icon}</div><h3>${a.name}</h3><p>${a.desc}</p><span class="tag">فتح عند المستوى ${a.unlock}</span>${unlocked?"":'<div class="lock">🔒</div>'}`;
    if(unlocked){const b=document.createElement("button");b.className="secondary";b.style.width="100%";b.style.marginTop="10px";b.textContent=`شراء بـ ${a.cost} 🪙`;b.onclick=()=>buyAnimal(a);card.appendChild(b);}
    $("animalGrid").appendChild(card);
  });
}
function buyAnimal(a){
  if(state.animals.includes(a.id)){toast("لديك هذا الحيوان بالفعل","info");return;}
  if(!spendMoney(a.cost))return;
  state.animals.push(a.id);gainXp(10);toast(`🐾 تمت إضافة ${a.name}`);markDirty();
}
function renderInventory(){
  const ids=Object.keys(ITEM_DEFS).filter(id=>inventoryCount(id)>0).sort((a,b)=>inventoryCount(b)-inventoryCount(a));
  $("inventoryGrid").innerHTML="";
  if(!ids.length){$("inventoryGrid").innerHTML='<div class="empty-state">الحقيبة فارغة.</div>';return;}
  ids.forEach(id=>{
    const item=ITEM_DEFS[id], el=document.createElement("div");el.className="inventory-item";
    el.innerHTML=`<div class="ico">${item.icon}</div><b>${item.name}</b><small>x${inventoryCount(id)}</small>`;
    $("inventoryGrid").appendChild(el);
  });
}
function renderMissions(){
  const defs=[
    {id:"plant",icon:"🌱",name:"زارع صغير",desc:"ازرع 5 قطع أرض.",goal:5,reward:35,xp:12},
    {id:"harvest",icon:"🧺",name:"حصاد أول",desc:"احصد 5 محاصيل.",goal:5,reward:50,xp:18},
    {id:"sell",icon:"🪙",name:"تاجر المزرعة",desc:"بع 5 منتجات.",goal:5,reward:60,xp:20},
    {id:"days",icon:"🌅",name:"أسبوع في المزرعة",desc:"نم وانتقل 7 أيام.",goal:7,reward:100,xp:30}
  ];
  $("missionGrid").innerHTML="";
  defs.forEach(m=>{
    const cur=Math.min(m.goal,Number(state.missions[m.id]||0)),done=cur>=m.goal;
    const el=document.createElement("div");el.className="mission";
    el.innerHTML=`<div class="mission-icon">${m.icon}</div><div><h3>${m.name}</h3><p>${m.desc} — ${cur}/${m.goal}</p><div class="mission-progress"><i style="width:${cur/m.goal*100}%"></i></div></div><button class="${done?"secondary":"primary"}" ${done?"disabled":""}>${done?"تمت":"استلام"}</button>`;
    if(done && !state["claimed_"+m.id]){
      el.querySelector("button").disabled=false;el.querySelector("button").textContent=`استلام +${m.reward}`;
      el.querySelector("button").onclick=()=>{state["claimed_"+m.id]=true;state.money+=m.reward;gainXp(m.xp);toast(`🎁 حصلت على ${m.reward} عملة`);markDirty();};
    }
    $("missionGrid").appendChild(el);
  });
}
function renderTop(){
  $("moneyValue").textContent=Math.floor(state.money);
  $("energyValue").textContent=Math.round(state.energy);
  $("hungerValue").textContent=Math.round(state.hunger);
  $("thirstValue").textContent=Math.round(state.thirst);
  $("xpValue").textContent=Math.floor(state.xp);
  $("levelValue").textContent=state.level;
  $("dayLabel").textContent=`اليوم ${state.day}`;
  $("tipText").textContent=TIPS[(state.day-1)%TIPS.length];
}
function renderAll(){
  renderTop();renderFarm();renderShop();renderMarket();renderHouse();renderAnimals();renderInventory();renderMissions();
}
function openScreen(name){
  qa(".screen").forEach(x=>x.classList.remove("active"));
  const target=$(`screen-${name}`);if(target)target.classList.add("active");
  qa(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.screen===name));
  $("sidebar").classList.remove("open");
}

qa(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>openScreen(btn.dataset.screen)));
$("mobileMenuBtn").onclick=()=>$("sidebar").classList.toggle("open");
$("waterAllBtn").onclick=waterAll;
$("clearReadyBtn").onclick=harvestAll;
$("sleepBtn").onclick=sleep;
$("eatBtn").onclick=eatBest;
$("drinkBtn").onclick=drink;
$("manualSaveBtn").onclick=()=>saveRemote(true);
$("houseSaveBtn").onclick=()=>saveRemote(true);
$("sortInventoryBtn").onclick=()=>renderInventory();

qa("[data-auth-tab]").forEach(btn=>btn.onclick=()=>{
  qa("[data-auth-tab]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  $("loginForm").classList.toggle("hidden",btn.dataset.authTab!=="login");
  $("registerForm").classList.toggle("hidden",btn.dataset.authTab!=="register");
  setAuthMessage("");
});

$("loginForm").onsubmit=async e=>{
  e.preventDefault();setAuthMessage("جاري تسجيل الدخول...",false);
  try{await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);setAuthMessage("تم الدخول",false);}
  catch(err){console.error(err);setAuthMessage(authError(err));}
};
$("registerForm").onsubmit=async e=>{
  e.preventDefault();
  if($("registerPassword").value!==$("registerConfirm").value){setAuthMessage("كلمتا المرور غير متطابقتين");return;}
  setAuthMessage("جاري إنشاء الحساب...",false);
  try{await createUserWithEmailAndPassword(auth,$("registerEmail").value.trim(),$("registerPassword").value);setAuthMessage("تم إنشاء الحساب",false);}
  catch(err){console.error(err);setAuthMessage(authError(err));}
};
$("resetPasswordBtn").onclick=async()=>{
  const email=$("loginEmail").value.trim();if(!email){setAuthMessage("اكتب بريدك أولًا");return;}
  try{await sendPasswordResetEmail(auth,email);setAuthMessage("تم إرسال رابط إعادة التعيين إلى بريدك.",false);}
  catch(err){setAuthMessage(authError(err));}
};
$("logoutBtn").onclick=async()=>{await saveRemote(true);await signOut(auth);};

function authError(err){
  const map={
    "auth/invalid-credential":"البريد أو كلمة المرور غير صحيحة.",
    "auth/email-already-in-use":"هذا البريد مستخدم بالفعل.",
    "auth/invalid-email":"البريد الإلكتروني غير صالح.",
    "auth/weak-password":"كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.",
    "auth/too-many-requests":"محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
    "auth/network-request-failed":"تحقق من اتصال الإنترنت."
  };return map[err?.code]||"تعذر تنفيذ العملية. افتح Console لمعرفة التفاصيل.";
}

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden" && currentUser) saveRemote(false);
});
window.addEventListener("pagehide",()=>{if(currentUser)saveRemote(false);});
setInterval(()=>{if(currentUser)saveRemote(false);},60000);

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){showAuth();return;}
  try{
    $("authScreen").classList.add("hidden");
    await loadRemote(user);
    enterGame();
  }catch(err){
    console.error(err);showAuth();setAuthMessage("تم تسجيل الدخول، لكن تعذر تحميل الحفظ. تأكد من Firestore وقواعده.");
  }
});
