
/* === v5.8.1 Mi Hogar + Despensa visual === */
(function(){
 const VERSION_56='5.7.0';
 const n=v=>Number(v||0);
 const safeDate=v=>{const d=v?new Date(v+'T12:00:00'):null;return d&&!isNaN(d)?d:null};
 function monthExpenses(){const mk=today().slice(0,7);return (data.expenses||[]).filter(x=>String(x.date||'').startsWith(mk)).reduce((s,x)=>s+n(x.amount),0)}
 function pantryStats(){
   const a=data.pantry||[], low=a.filter(x=>n(x.qty)<=n(x.minQty)), expiring=a.filter(x=>{const d=safeDate(x.expiry);if(!d)return false;const days=Math.ceil((d-new Date())/86400000);return days>=0&&days<=7});
   return {total:a.length,low:low.length,expiring:expiring.length,items:[...a].sort((x,y)=>{const rx=n(x.minQty)>0?n(x.qty)/n(x.minQty):999,ry=n(y.minQty)>0?n(y.qty)/n(y.minQty):999;return rx-ry}).slice(0,5)};
 }
 function financeSnapshot(){
   if(typeof ensurePayCycle==='function')ensurePayCycle();
   const received=(data.salaryPayments||[]).filter(x=>x.active!==false&&typeof paymentStatus==='function'&&paymentStatus(x)==='received').reduce((s,x)=>s+n(x.amount),0)+(typeof extraIncomeForMonth==='function'?extraIncomeForMonth():0);
   const paid=monthExpenses(), fixed=typeof fixedMonthlyTotal==='function'?fixedMonthlyTotal():0, market=typeof pendingMarketTotal==='function'?pendingMarketTotal():0;
   const available=received-paid-fixed-market;
   let next=null; try{ if(typeof nextPaymentInfo==='function') next=nextPaymentInfo(); }catch(e){}
   return {received,paid,fixed,market,available,next};
 }
 window.renderHomeControlPanel=function(){
   const el=document.getElementById('homeControlPanel');if(!el)return;
   const f=financeSnapshot(), ps=pantryStats(), tasks=(data.tasks||[]).filter(x=>!x.done).length, shopping=(data.shopping||[]).filter(x=>!x.done).length;
   const status=f.available<0?'red':f.available<Math.max(50,f.received*.1)?'amber':'';
   const icon=f.available<0?'!':f.available<Math.max(50,f.received*.1)?'◐':'✓';
   const msg=f.available<0?`Faltan ${money(Math.abs(f.available))} para cubrir reservas y mercado.`:f.available<Math.max(50,f.received*.1)?'Tus compromisos están cubiertos, pero el margen es ajustado.':'Tus compromisos principales están cubiertos.';
   const now=new Date(), date=now.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});
   el.innerHTML=`<section class="home-command"><div class="home-command-head"><div><h2>Mi Hogar</h2><p>Todo lo importante, en una sola vista</p></div><div class="home-date">${date}</div></div><div class="command-status ${status}"><div class="command-main"><div><small>MARGEN SEGURO HOY</small><strong>${money(f.available)}</strong></div><div class="command-light">${icon}</div></div><div class="command-message">${msg}${f.next?` Próximo ingreso: ${esc(f.next.title||'Pago')} ${money(f.next.amount)}.`:''}</div></div><div class="command-grid"><button class="command-tile ${shopping?'warn':''}" onclick="showView('market')"><span>🛒</span><small>MERCADO</small><b>${shopping} pendientes</b></button><button class="command-tile ${tasks?'warn':''}" onclick="showView('tasks')"><span>✓</span><small>TAREAS</small><b>${tasks} pendientes</b></button><button class="command-tile ${ps.low?'danger':''}" onclick="openPantry()"><span>🥫</span><small>DESPENSA</small><b>${ps.low} por reponer</b></button><button class="command-tile" onclick="openPayCycle()"><span>💰</span><small>GASTO DEL MES</small><b>${money(f.paid)}</b></button></div></section>`;
 }
 function daysRemaining(x){const use=n(x.dailyUse);return use>0?Math.max(0,Math.floor(n(x.qty)/use)):null}
 window.addPantryToMarket=function(id){const x=(data.pantry||[]).find(v=>v.id===id);if(!x)return;const target=Math.max(n(x.minQty),1),need=Math.max(0,target-n(x.qty));if(need<=0){toast('Este producto aún tiene stock suficiente');return}const name=String(x.name||'Producto'),existing=(data.shopping||[]).find(s=>!s.done&&String(s.title||'').toLowerCase()===name.toLowerCase());if(existing)existing.qty=n(existing.qty)+need;else{let p=(typeof catalog==='function'?catalog():[]).find(p=>String(p.name||'').toLowerCase()===name.toLowerCase());data.shopping.unshift({id:uid(),productId:p?.id||'',title:name,qty:need,unit:x.unit||p?.unit||'unidad',unitPrice:p?p[data.preferredStore]:0,store:data.preferredStore,assigned:'Ambos',category:p?.category||'Despensa',done:false,fromPantry:true})}save();toast(`${name} agregado al mercado`);renderPantryHomeVisual()}
 window.renderPantryHomeVisual=function(){
   const el=document.getElementById('pantryHomeVisual');if(!el)return;const ps=pantryStats();
   const cards=ps.items.map(x=>{const qty=n(x.qty),min=n(x.minQty),den=Math.max(min*2,qty,1),pct=Math.min(100,Math.max(0,qty/den*100)),state=qty<=0?'out':qty<=min?'low':'',days=daysRemaining(x),expiry=safeDate(x.expiry),expDays=expiry?Math.ceil((expiry-new Date())/86400000):null;let note=days!==null?`Dura aprox. ${days} día${days===1?'':'s'}`:'Configura consumo diario';if(expDays!==null&&expDays<=7)note=expDays<0?'Vencido':`Vence en ${expDays} día${expDays===1?'':'s'}`;return `<div class="pantry-visual-item"><div class="pantry-vtop"><div><b>${esc(x.name)}</b><span>${qty} ${esc(x.unit||'')}</span></div><span>${qty<=min?'Reponer':'En stock'}</span></div><div class="stock-bar ${state}"><i style="width:${pct}%"></i></div><div class="pantry-vmeta"><span>Mínimo ${min} ${esc(x.unit||'')}</span><span>${note}</span></div><div class="pantry-vactions"><button onclick="openPantryForm('${x.id}')">Editar</button>${qty<=min?`<button class="primary-mini" onclick="addPantryToMarket('${x.id}')">Añadir al mercado</button>`:''}</div></div>`}).join('');
   el.innerHTML=`<section class="pantry-home"><div class="pantry-home-head"><h2>Despensa inteligente</h2><button onclick="openPantry()">Ver todo</button></div><div class="pantry-overview"><div class="pantry-kpi"><small>PRODUCTOS</small><b>${ps.total}</b></div><div class="pantry-kpi"><small>REQUIEREN ATENCIÓN</small><b>${ps.low+ps.expiring}</b></div></div><div class="pantry-visual-list">${cards||'<div class="empty-compact">Agrega productos a tu despensa para controlar niveles y reposición.</div>'}</div></section>`;
 }
 const oldOpen=window.openPantryForm;window.openPantryForm=function(id=''){oldOpen(id);const x=(data.pantry||[]).find(v=>v.id===id);const f=document.getElementById('pantryForm');if(f?.elements.dailyUse)f.elements.dailyUse.value=x?.dailyUse??''};
 const oldSubmit=document.getElementById('pantryForm').onsubmit;document.getElementById('pantryForm').onsubmit=e=>{const f=e.currentTarget;const daily=n(f.elements.dailyUse?.value);if(f.elements.dailyUse)f.elements.dailyUse.value=String(daily||'');oldSubmit(e);setTimeout(()=>{const name=f.elements.name?.value;const x=(data.pantry||[]).find(v=>String(v.name).toLowerCase()===String(name).toLowerCase());if(x){x.dailyUse=daily;save();renderPantryHomeVisual()}},0)};
 const oldRenderAll56=window.renderAll;window.renderAll=function(){oldRenderAll56();renderHomeControlPanel();renderPantryHomeVisual()};
 document.querySelectorAll('.version-card small').forEach(x=>x.textContent=x.textContent.replace(/v\d+\.\d+\.\d+/,'v'+VERSION_56));const vs=document.getElementById('versionStatus');if(vs)vs.textContent='Compilación: 13/07/2026 · Navegación renovada y despensa avanzada';
 renderAll();
})();
