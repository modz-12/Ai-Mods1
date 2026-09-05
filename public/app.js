import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtMKT8F9R98LbZZwCfcaJgPvYQM3I2brg",
  authDomain: "modz-11.firebaseapp.com",
  projectId: "modz-11",
  storageBucket: "modz-11.firebasestorage.app",
  messagingSenderId: "257071976398",
  appId: "1:257071976398:web:1bdcf43ccef1b05ff1659f",
  measurementId: "G-V2YH1VDR1Y"
};

const app=initializeApp(firebaseConfig);
isSupported().then(ok=>{if(ok) getAnalytics(app)}).catch(()=>{});
const auth=getAuth(app), db=getFirestore(app), storage=getStorage(app);
const $=s=>document.querySelector(s);
let all=[], currentUser=null;

function toast(msg){const e=$("#toast");e.textContent=msg;e.className="show";setTimeout(()=>e.className="",3000)}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

onAuthStateChanged(auth,async user=>{currentUser=user;$("#loginBtn").classList.toggle("hidden",!!user);$("#logoutBtn").classList.toggle("hidden",!user);$("#addBtn").classList.toggle("hidden",!user);await load()});

async function load(){
  try{
    const snap=await getDocs(query(collection(db,"media"),orderBy("createdAt","desc")));
    all=snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  }catch(e){console.error(e);toast("تعذر تحميل المعرض: "+e.message)}
}
function render(){
  const term=$("#search").value.trim().toLowerCase(), type=$("#filter").value;
  const items=all.filter(x=>(type==="all"||x.type===type)&&((x.title||"")+" "+(x.description||"")).toLowerCase().includes(term));
  $("#count").textContent=items.length; $("#empty").classList.toggle("hidden",items.length!==0);
  $("#gallery").innerHTML=items.map(x=>`
    <article class="card" data-id="${x.id}">
      ${currentUser?`<button class="delete" data-delete="${x.id}">حذف</button>`:""}
      ${x.type==="video"?`<video src="${esc(x.url)}" preload="metadata"></video>`:`<img src="${esc(x.url)}" alt="${esc(x.title)}" loading="lazy">`}
      <div class="cardInfo"><h3>${esc(x.title||"بدون عنوان")}</h3><p>${esc(x.description||"")}</p></div>
    </article>`).join("");
  document.querySelectorAll(".card").forEach(c=>c.onclick=e=>{if(e.target.dataset.delete)return;const x=all.find(a=>a.id===c.dataset.id);openViewer(x)});
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async e=>{e.stopPropagation();await removeMedia(e.target.dataset.delete)});
}
function openViewer(x){$("#viewerContent").innerHTML=x.type==="video"?`<video src="${esc(x.url)}" controls autoplay></video>`:`<img src="${esc(x.url)}" alt="">`;$("#viewerTitle").textContent=x.title||"";$("#viewerDesc").textContent=x.description||"";$("#lightbox").classList.remove("hidden")}
async function removeMedia(id){
  if(!confirm("حذف هذا الملف نهائياً؟"))return;
  try{const x=all.find(a=>a.id===id);await deleteDoc(doc(db,"media",id));if(x?.path)await deleteObject(ref(storage,x.path)).catch(()=>{});toast("تم الحذف");load()}catch(e){toast("فشل الحذف: "+e.message)}
}

$("#loginBtn").onclick=()=>$("#authModal").classList.remove("hidden");
$("#doLogin").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("#email").value.trim(),$("#password").value);$("#authModal").classList.add("hidden");$("#authError").textContent=""}catch(e){$("#authError").textContent="بيانات الدخول غير صحيحة أو الحساب غير مصرح به."}};
$("#logoutBtn").onclick=()=>signOut(auth);
$("#addBtn").onclick=()=>$("#addModal").classList.remove("hidden");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).classList.add("hidden"));
$("#search").oninput=render;$("#filter").onchange=render;
$("#themeBtn").onclick=()=>document.body.classList.toggle("light");

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));t.classList.add("active");
  $("#uploadPane").classList.toggle("hidden",t.dataset.tab!=="upload");$("#linkPane").classList.toggle("hidden",t.dataset.tab!=="link");
});

$("#uploadBtn").onclick=async()=>{
  const file=$("#fileInput").files[0]; if(!file)return toast("اختر ملفاً أولاً");
  if(file.size>200*1024*1024)return toast("الحد الأقصى 200MB");
  const safe=file.name.replace(/[^\w\u0600-\u06FF.\- ]/g,"_"), path=`media/${Date.now()}_${crypto.randomUUID()}_${safe}`;
  const task=uploadBytesResumable(ref(storage,path),file,{contentType:file.type});
  $("#progressWrap").classList.remove("hidden");
  task.on("state_changed",s=>$("#progress").style.width=(s.bytesTransferred/s.totalBytes*100)+"%",async()=>{
    try{
      const url=await getDownloadURL(task.snapshot.ref);
      await addDoc(collection(db,"media"),{title:$("#titleInput").value.trim()||file.name,description:$("#descInput").value.trim(),url,path,type:file.type.startsWith("video/")?"video":"image",createdAt:serverTimestamp()});
      toast("تم الرفع بنجاح");$("#addModal").classList.add("hidden");$("#progressWrap").classList.add("hidden");$("#fileInput").value="";load();
    }catch(e){toast("فشل حفظ البيانات: "+e.message)}
  },e=>toast("فشل الرفع: "+e.message));
};

$("#linkBtn").onclick=async()=>{
  const url=$("#urlInput").value.trim();if(!url)return toast("ضع الرابط");
  const type=/\.(mp4|webm|ogg)(\?|#|$)/i.test(url)?"video":"image";
  try{await addDoc(collection(db,"media"),{title:$("#linkTitle").value.trim()||"رابط",description:$("#linkDesc").value.trim(),url,type,createdAt:serverTimestamp()});toast("تم حفظ الرابط");$("#addModal").classList.add("hidden");load()}catch(e){toast("فشل الحفظ: "+e.message)}
};
