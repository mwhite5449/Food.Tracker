import {initializeApp} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signInWithRedirect,getRedirectResult,signOut} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {getFirestore,doc,onSnapshot,setDoc} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
const config={apiKey:"AIzaSyAi_H2-r-ZBh_IjgfGjBQGEqSrSOR5B1vQ",authDomain:"food-tracker-1e5e8.firebaseapp.com",projectId:"food-tracker-1e5e8",storageBucket:"food-tracker-1e5e8.firebasestorage.app",messagingSenderId:"148761787142",appId:"1:148761787142:web:c8645091c7850cc26bfc87"};
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const $=id=>document.getElementById(id),store='food-tracker-entries-v1',lib='food-tracker-library-v1',goal='food-tracker-goal-v1';
let unsubscribe=null,activeUid=null,initialized=false,busy=false,queue=Promise.resolve(),lastLocal=null;
function status(msg){$('cloudStatus').textContent=msg}
function local(){return {entries:JSON.parse(localStorage.getItem(store)||'[]'),library:JSON.parse(localStorage.getItem(lib)||'[]'),goal:Number(localStorage.getItem(goal))||2000}}
function combine(a,b){const m=new Map();for(const x of [...(a||[]),...(b||[])])if(x&&typeof x.id==='string')m.set(x.id,x);return [...m.values()]}
function foods(a,b){const m=new Map();for(const x of [...(a||[]),...(b||[])])if(x&&typeof x.name==='string'&&typeof x.serving==='string')m.set(x.name.toLowerCase()+'|'+x.serving.toLowerCase(),x);return [...m.values()]}
function apply(data){busy=true;try{localStorage.setItem(store,JSON.stringify(data.entries||[]));localStorage.setItem(lib,JSON.stringify(data.library||[]));localStorage.setItem(goal,String(data.goal||2000));window.dispatchEvent(new CustomEvent('foodtracker-cloud-update',{detail:data}))}finally{busy=false}}
function enqueue(data){if(!activeUid)return;const uid=activeUid;queue=queue.catch(()=>{}).then(async()=>{if(uid!==activeUid)return;await setDoc(doc(db,'users',uid,'tracker','data'),{...data,updatedAt:new Date().toISOString()});status('Cloud sync complete ✓')}).catch(e=>status('Cloud sync failed: '+e.message))}
window.addEventListener('foodtracker-local-change',()=>{if(busy||!activeUid||!initialized)return;enqueue(local())});
async function login(){status('Opening Google sign-in…');try{await signInWithPopup(auth,provider)}catch(e){if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(e.code)){await signInWithRedirect(auth,provider)}else status('Sign-in failed: '+e.message)}}
$('cloudSignIn').addEventListener('click',login);
$('cloudSignOut').addEventListener('click',()=>signOut(auth).catch(e=>status(e.message)));
getRedirectResult(auth).catch(e=>status('Google sign-in: '+e.message));
onAuthStateChanged(auth,user=>{
 if(unsubscribe){unsubscribe();unsubscribe=null}activeUid=user?.uid||null;initialized=false;
 $('cloudSignIn').hidden=!!user;$('cloudSignOut').hidden=!user;
 if(!user){status('Not signed in. Meals are saved only on this device.');return}
 status('Signed in as '+(user.email||'Google user')+'. Connecting…');
 unsubscribe=onSnapshot(doc(db,'users',user.uid,'tracker','data'),snap=>{
  if(user.uid!==activeUid)return;
  if(!initialized){const current=local(),remote=snap.exists()?snap.data():{},merged={entries:combine(remote.entries,current.entries),library:foods(remote.library,current.library),goal:remote.goal||current.goal};initialized=true;apply(merged);enqueue(merged);return}
  if(snap.metadata.hasPendingWrites)return;
  const remote=snap.data();if(remote){apply({entries:remote.entries||[],library:remote.library||[],goal:remote.goal||2000});status('Cloud data updated ✓')}
 },e=>status('Cloud connection error: '+e.message+'. Check Firestore and security rules.'));
});
