
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, updateDoc, writeBatch, onSnapshot, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyCETXStRJ9xFhf93NwkQTHZIKGiIV230y8',authDomain:'nuestro-espacio-d7132.firebaseapp.com',projectId:'nuestro-espacio-d7132',storageBucket:'nuestro-espacio-d7132.firebasestorage.app',messagingSenderId:'294993809967',appId:'1:294993809967:web:6ef43d122d4947aa2cacda'};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
let db;
try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});}catch(error){console.warn('Persistencia avanzada no disponible',error);db=getFirestore(app);}

const $=id=>document.getElementById(id);
const gate=$('firebaseGate'),authStage=$('authStage'),setupStage=$('setupStage'),loadingStage=$('loadingStage'),authError=$('authError'),setupError=$('setupError'),syncPill=$('syncPill'),syncText=$('syncText');
let currentUser=null,currentHouseholdId='',currentInviteCode='',unsubscribeState=null,remoteApplying=false,saveTimer=null,firstSnapshot=true;
document.body.classList.add('firebase-locked');

function setStage(name,text=''){
 authStage.hidden=name!=='auth';setupStage.hidden=name!=='setup';loadingStage.hidden=name!=='loading';
 if(text)$('loadingText').textContent=text;
}
function showError(el,error){const messages={'auth/invalid-credential':'Correo o contraseña incorrectos.','auth/email-already-in-use':'Ese correo ya tiene una cuenta.','auth/weak-password':'Usa una contraseña de al menos 6 caracteres.','auth/invalid-email':'El correo no es válido.','auth/too-many-requests':'Demasiados intentos. Inténtalo más tarde.','permission-denied':'Firebase rechazó la operación. Revisa las reglas de Firestore.'};el.textContent=messages[error?.code]||error?.message||'Ocurrió un error.';el.classList.add('show');}
function clearErrors(){authError.classList.remove('show');setupError.classList.remove('show')}
function initials(name,email){return String(name||email||'U').trim().slice(0,1).toUpperCase()}
function setSync(status,label){syncPill.hidden=false;syncPill.className='sync-pill '+status;syncText.textContent=label;$('accountStatus').textContent=label;const mode=$('connectionMode');if(mode)mode.textContent=navigator.onLine?'En línea':'Sin conexión';if(status==='online'){const t=new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});const el=$('lastSyncAt');if(el)el.textContent='Hoy, '+t;localStorage.setItem('neLastSyncAt',t)}}
function openApp(){gate.classList.add('hidden');document.body.classList.remove('firebase-locked');syncPill.hidden=false;}
function closeApp(){gate.classList.remove('hidden');document.body.classList.add('firebase-locked');syncPill.hidden=true;}
function localCounts(){const d=window.NEBridge.getData();return {Compras:d.shopping?.length||0,Tareas:d.tasks?.length||0,Gastos:d.expenses?.length||0,Notas:d.notes?.length||0,Despensa:d.pantry?.length||0};}
function hasMeaningfulLocalData(){const c=localCounts();return c.Compras+c.Gastos+c.Notas+c.Despensa>0||c.Tareas>2;}
function stateRef(){return doc(db,'households',currentHouseholdId,'appState','main')}
function sanitizeState(value){return JSON.parse(JSON.stringify(value,(key,val)=>val===undefined?null:val));}
function scheduleCloudSave(){if(!currentUser||!currentHouseholdId||remoteApplying)return;clearTimeout(saveTimer);setSync(navigator.onLine?'saving':'offline',navigator.onLine?'Guardando…':'Sin conexión · cambios pendientes');saveTimer=setTimeout(pushState,650);}
async function pushState(){if(!currentUser||!currentHouseholdId)return;try{const payload=sanitizeState(window.NEBridge.getData());await setDoc(stateRef(),{state:payload,updatedAt:serverTimestamp(),updatedBy:currentUser.uid,version:'5.8.0'},{merge:true});setSync(navigator.onLine?'online':'offline',navigator.onLine?'Sincronizado':'Sin conexión · cambios pendientes');}catch(error){console.error(error);setSync('error','Error de sincronización');}}
window.NEBridge.cloudSave=scheduleCloudSave;

async function loadUserProfile(user){const snap=await getDoc(doc(db,'users',user.uid));return snap.exists()?snap.data():null;}
function fillUserUI(user,profile={}){const name=profile.name||user.displayName||user.email?.split('@')[0]||'Usuario';['setupName','accountName'].forEach(id=>$(id).textContent=name);['setupEmail','accountEmail'].forEach(id=>$(id).textContent=user.email||'');['setupAvatar','accountAvatar'].forEach(id=>$(id).textContent=initials(name,user.email));}
async function connectHousehold(profile){currentHouseholdId=profile.householdId;currentInviteCode=profile.inviteCode||'';window.NEBridge.household=currentHouseholdId;$('accountInviteCode').textContent=currentInviteCode||'------';setStage('loading','Cargando datos compartidos…');
 if(unsubscribeState)unsubscribeState();firstSnapshot=true;
 unsubscribeState=onSnapshot(stateRef(),{includeMetadataChanges:true},async snap=>{
   const pending=snap.metadata.hasPendingWrites;
   if(snap.exists()&&snap.data()?.state){remoteApplying=true;window.NEBridge.applyRemote(snap.data().state);remoteApplying=false;openApp();setSync(pending?'saving':(navigator.onLine?'online':'offline'),pending?'Guardando…':(navigator.onLine?'Sincronizado':'Sin conexión'));
   }else if(firstSnapshot&&!pending){firstSnapshot=false;if(hasMeaningfulLocalData()){showMigration();}else{await pushState();openApp();}}
   firstSnapshot=false;
 },error=>{console.error(error);showError(setupError,error);setStage('setup');});
}
function showMigration(){const counts=localCounts();$('migrationSummary').innerHTML=Object.entries(counts).map(([k,v])=>`<div><b>${v}</b><span>${k}</span></div>`).join('');$('migrationModal').classList.add('open');openApp();}
async function handleAuthenticated(user){currentUser=user;window.NEBridge.user=user;closeApp();setStage('loading','Verificando tu cuenta…');try{const profile=await loadUserProfile(user);fillUserUI(user,profile||{});if(profile?.householdId){await connectHousehold(profile);}else{setStage('setup');}}catch(error){console.error(error);showError(setupError,error);setStage('setup');}}

$('loginTab').onclick=()=>{$('loginTab').classList.add('active');$('registerTab').classList.remove('active');$('loginForm').classList.add('active');$('registerForm').classList.remove('active');clearErrors()};
$('registerTab').onclick=()=>{$('registerTab').classList.add('active');$('loginTab').classList.remove('active');$('registerForm').classList.add('active');$('loginForm').classList.remove('active');clearErrors()};
$('loginForm').onsubmit=async e=>{e.preventDefault();clearErrors();const f=new FormData(e.currentTarget);try{setStage('loading','Iniciando sesión…');await signInWithEmailAndPassword(auth,f.get('email').trim(),f.get('password'));}catch(error){setStage('auth');showError(authError,error)}};
$('registerForm').onsubmit=async e=>{e.preventDefault();clearErrors();const f=new FormData(e.currentTarget);try{setStage('loading','Creando tu cuenta…');const cred=await createUserWithEmailAndPassword(auth,f.get('email').trim(),f.get('password'));await updateProfile(cred.user,{displayName:f.get('name').trim()});await setDoc(doc(db,'users',cred.user.uid),{name:f.get('name').trim(),email:cred.user.email,createdAt:serverTimestamp(),householdId:null});}catch(error){setStage('auth');showError(authError,error)}};
$('forgotPasswordBtn').onclick=async()=>{const email=$('loginForm').elements.email.value.trim();if(!email){showError(authError,{message:'Escribe primero tu correo.'});return}try{await sendPasswordResetEmail(auth,email);authError.textContent='Te enviamos un correo para restablecer tu contraseña.';authError.style.background='#ecfdf3';authError.style.color='#067647';authError.classList.add('show')}catch(error){showError(authError,error)}};

function makeCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('')}
async function uniqueCode(){for(let i=0;i<8;i++){const c=makeCode();if(!(await getDoc(doc(db,'invites',c))).exists())return c}throw new Error('No se pudo generar el código. Inténtalo otra vez.')}
$('createHouseholdForm').onsubmit=async e=>{e.preventDefault();clearErrors();const name=new FormData(e.currentTarget).get('name').trim();try{setStage('loading','Creando el hogar…');const householdRef=doc(db,'households',crypto.randomUUID());const code=await uniqueCode();const batch=writeBatch(db);batch.set(householdRef,{name,createdBy:currentUser.uid,createdAt:serverTimestamp(),currency:'PEN',inviteCode:code});batch.set(doc(db,'households',householdRef.id,'members',currentUser.uid),{name:currentUser.displayName||currentUser.email,email:currentUser.email,role:'owner',joinedAt:serverTimestamp()});batch.set(doc(db,'invites',code),{householdId:householdRef.id,householdName:name,createdBy:currentUser.uid,status:'active',createdAt:serverTimestamp(),uses:0});batch.set(doc(db,'users',currentUser.uid),{name:currentUser.displayName||currentUser.email?.split('@')[0],email:currentUser.email,householdId:householdRef.id,inviteCode:code,updatedAt:serverTimestamp()},{merge:true});await batch.commit();await connectHousehold({householdId:householdRef.id,inviteCode:code,name});}catch(error){console.error(error);setStage('setup');showError(setupError,error)}};
$('joinHouseholdForm').onsubmit=async e=>{e.preventDefault();clearErrors();const code=String(new FormData(e.currentTarget).get('code')).trim().toUpperCase();try{setStage('loading','Uniéndote al hogar…');const inviteSnap=await getDoc(doc(db,'invites',code));if(!inviteSnap.exists()||inviteSnap.data().status!=='active')throw new Error('El código no existe o ya no está activo.');const invite=inviteSnap.data(),batch=writeBatch(db);batch.set(doc(db,'households',invite.householdId,'members',currentUser.uid),{name:currentUser.displayName||currentUser.email,email:currentUser.email,role:'member',joinedAt:serverTimestamp()});batch.set(doc(db,'users',currentUser.uid),{name:currentUser.displayName||currentUser.email?.split('@')[0],email:currentUser.email,householdId:invite.householdId,inviteCode:code,updatedAt:serverTimestamp()},{merge:true});batch.update(doc(db,'invites',code),{uses:increment(1),lastUsedAt:serverTimestamp()});await batch.commit();await connectHousehold({householdId:invite.householdId,inviteCode:code});}catch(error){console.error(error);setStage('setup');showError(setupError,error)}};

$('migrateUploadBtn').onclick=async()=>{try{$('migrateUploadBtn').disabled=true;$('migrateUploadBtn').textContent='Subiendo datos…';await pushState();$('migrationModal').classList.remove('open');toast('Datos migrados correctamente');}finally{$('migrateUploadBtn').disabled=false;$('migrateUploadBtn').textContent='Subir mis datos a Firebase'}};
$('migrateCleanBtn').onclick=async()=>{if(!confirm('El hogar comenzará vacío. Tu respaldo local seguirá en este dispositivo.'))return;remoteApplying=true;window.NEBridge.applyRemote({});remoteApplying=false;await pushState();$('migrationModal').classList.remove('open');toast('Hogar creado vacío')};
$('syncPill').onclick=()=>window.openFirebaseAccount();$('forceSyncBtn').onclick=async()=>{await pushState();toast('Sincronización solicitada')};$('copyInviteBtn').onclick=async()=>{await navigator.clipboard.writeText(currentInviteCode);toast('Código copiado')};$('shareInviteBtn').onclick=async()=>{const text='Únete a nuestro hogar en Nuestro Espacio con el código: '+currentInviteCode;try{if(navigator.share)await navigator.share({title:'Nuestro Espacio',text});else{await navigator.clipboard.writeText(text);toast('Invitación copiada')}}catch{}};$('exportBeforeLogoutBtn').onclick=()=>window.exportData?.();
async function logout(){if(!confirm('¿Cerrar sesión en este dispositivo?'))return;if(unsubscribeState)unsubscribeState();currentHouseholdId='';await signOut(auth);$('accountModal').classList.remove('open')}
$('logoutBtn').onclick=logout;$('setupLogoutBtn').onclick=logout;
window.addEventListener('online',()=>{setSync('saving','Reconectando…');pushState()});window.addEventListener('offline',()=>setSync('offline','Sin conexión · cambios pendientes'));

// Add account access to More section without depending on a specific layout.
const moreView=document.getElementById('moreView');if(moreView){const card=document.createElement('button');card.className='card';card.type='button';card.style.cssText='width:100%;text-align:left;margin-bottom:12px';card.innerHTML='<div class="item"><div class="insight-icon">☁️</div><div class="main"><div class="title">Cuenta y sincronización</div><div class="meta">Hogar compartido, código de invitación y respaldo</div></div><b>›</b></div>';card.onclick=()=>window.openFirebaseAccount();moreView.prepend(card)}

onAuthStateChanged(auth,user=>{clearErrors();if(user)handleAuthenticated(user);else{currentUser=null;currentHouseholdId='';if(unsubscribeState){unsubscribeState();unsubscribeState=null}closeApp();setStage('auth')}});
