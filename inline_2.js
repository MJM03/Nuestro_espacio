
window.NEBridge={
  getData:()=>JSON.parse(JSON.stringify(data)),
  applyRemote:(next)=>{data=migrate(next||{});localStorage.setItem('nuestroEspacioPro',JSON.stringify(data));applyTheme();renderAll();if(typeof renderUltraHome==='function')renderUltraHome();},
  render:()=>{renderAll();if(typeof renderUltraHome==='function')renderUltraHome();},
  cloudSave:null,
  household:null,
  user:null
};
const __firebaseLocalSave=save;
save=function(){__firebaseLocalSave();if(typeof window.NEBridge.cloudSave==='function')window.NEBridge.cloudSave();};
window.openFirebaseAccount=function(){document.getElementById('accountModal').classList.add('open')};
