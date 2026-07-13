
// === v5.2.0: ingresos extra + compras enlazadas a despensa/gastos ===
const __migrateV52=migrate;
migrate=function(d={}){const out=__migrateV52(d||{});out.extraIncomes=Array.isArray(d?.extraIncomes)?d.extraIncomes:[];out.pantry=Array.isArray(out.pantry)?out.pantry:[];return out};
data=migrate(data);

function monthKey(date=today()){return String(date||today()).slice(0,7)}
function extraIncomeForMonth(month=monthKey()){return (data.extraIncomes||[]).filter(x=>monthKey(x.date)===month).reduce((s,x)=>s+Number(x.amount||0),0)}
function openExtraIncomes(){extraIncomeModal.classList.add('open');renderExtraIncomes()}
function renderExtraIncomes(){
 const month=monthKey(), list=(data.extraIncomes||[]).filter(x=>monthKey(x.date)===month).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 extraIncomeMonthLabel.textContent=new Date(month+'-02').toLocaleDateString('es-PE',{month:'long',year:'numeric'});
 extraIncomeTotal.textContent=money(extraIncomeForMonth(month));
 extraIncomeList.innerHTML=list.length?list.map(x=>`<div class="card"><div class="extra-income-row"><div class="extra-income-icon">＋</div><div class="main"><div class="title">${esc(x.title)}</div><div class="meta"><span>${esc(x.date)}</span><span>${esc(x.receivedBy||'Ambos')}</span>${x.note?`<span>${esc(x.note)}</span>`:''}</div><div class="extra-income-amount">+ ${money(x.amount)}</div></div><div class="actions"><button class="mini" onclick="openExtraIncomeForm('${x.id}')">✎</button><button class="mini" onclick="deleteExtraIncome('${x.id}')">🗑️</button></div></div></div>`).join(''):'<div class="empty">Todavía no registraron ingresos extra este mes.</div>';
}
function openExtraIncomeForm(id=''){const x=(data.extraIncomes||[]).find(v=>v.id===id);extraIncomeForm.reset();extraIncomeFormTitle.textContent=x?'Editar ingreso extra':'Nuevo ingreso extra';extraIncomeForm.id.value=x?.id||'';extraIncomeForm.title.value=x?.title||'';extraIncomeForm.amount.value=x?.amount??'';extraIncomeForm.date.value=x?.date||today();extraIncomeForm.receivedBy.value=x?.receivedBy||'Yo';extraIncomeForm.note.value=x?.note||'';extraIncomeFormModal.classList.add('open')}
extraIncomeForm.onsubmit=e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));o.amount=Number(o.amount||0);if(!o.id)o.id=uid();const old=(data.extraIncomes||[]).find(x=>x.id===o.id);if(old)Object.assign(old,o);else data.extraIncomes.unshift(o);closeModal('extraIncomeFormModal');save();extraIncomeModal.classList.add('open');renderExtraIncomes();toast('Ingreso extra guardado')};
function deleteExtraIncome(id){if(!confirm('¿Eliminar este ingreso extra?'))return;data.extraIncomes=(data.extraIncomes||[]).filter(x=>x.id!==id);save();renderExtraIncomes();toast('Ingreso extra eliminado')}

// Reemplaza el resumen financiero para sumar ingresos extra solo en su mes.
renderIncomeSummary=function(){const el=document.getElementById('incomeHomeSummary');if(!el)return;const salary=Number(data.monthlyIncome||0),extra=extraIncomeForMonth(),income=salary+extra,fixed=fixedMonthlyTotal(),market=pendingMarketTotal(),other=currentMonthVariableExpenses(),commitments=fixed+market+other,balance=income-commitments;el.innerHTML=`<div class="budget-top"><div><small>INGRESOS DEL MES</small><strong>${money(income)}</strong></div><div class="income-actions"><button onclick="editMonthlyIncome()">Sueldo</button><button onclick="openExtraIncomes()">＋ Extra</button></div></div><div class="extra-summary"><div><small>Sueldo fijo</small><b>${money(salary)}</b></div><div style="text-align:right"><small>Ingresos extra</small><b>+ ${money(extra)}</b></div></div><div class="income-breakdown"><div class="income-cell"><small>Gastos fijos</small><b>− ${money(fixed)}</b></div><div class="income-cell"><small>Mercado pendiente</small><b>− ${money(market)}</b></div><div class="income-cell"><small>Otros gastos del mes</small><b>− ${money(other)}</b></div><div class="income-cell"><small>Compromisos totales</small><b>${money(commitments)}</b></div></div><div class="income-balance ${balance<0?'negative':''}"><span>${income?'Disponible estimado':'Configura tus ingresos'}</span><strong>${income?money(balance):'—'}</strong></div><div class="meta">Los ingresos extra solo cuentan en el mes de su fecha. El mercado pendiente es una proyección.</div>`}

function pantryMatchForPurchase(x){const pid=String(x.productId||'');const name=String(x.title||'').trim().toLowerCase();return (data.pantry||[]).find(p=>(pid&&String(p.productId||'')===pid)||String(p.name||p.title||'').trim().toLowerCase()===name)}
function applyPurchaseToPantry(x){
 const qty=Number(x.qty||0);if(!(qty>0))return;
 let item=pantryMatchForPurchase(x);let created=false;
 if(!item){item={id:uid(),productId:x.productId||'',name:x.title,qty:0,minQty:0,unit:x.unit||'unidad',expiry:'',createdFromPurchase:true};data.pantry.unshift(item);created=true}
 item.qty=Number(item.qty||0)+qty;if(!item.unit)item.unit=x.unit||'unidad';
 x.pantryMovement={itemId:item.id,qty,created};
}
function removePurchaseFromPantry(x){const move=x.pantryMovement;if(!move)return;const item=(data.pantry||[]).find(p=>p.id===move.itemId)||pantryMatchForPurchase(x);if(!item)return;item.qty=Math.max(0,Number(item.qty||0)-Number(move.qty||0));if(move.created&&item.qty<=0&&Number(item.minQty||0)<=0)data.pantry=data.pantry.filter(p=>p.id!==item.id);delete x.pantryMovement}
function removeFirstMatching(arr,predicate){let removed=false;return arr.filter(v=>{if(!removed&&predicate(v)){removed=true;return false}return true})}
function rollbackCompletedPurchase(x){
 if(!x)return;
 const expenseMatch=e=>e.sourcePurchaseId===x.id||(e.title===('Mercado: '+x.title)&&String(e.date||'')===String(x.purchaseDate||'')&&Math.abs(Number(e.amount||0)-Number(x.actualTotal||0))<0.001);
 const historyMatch=h=>h.sourcePurchaseId===x.id||(h.productId===x.productId&&String(h.date||'')===String(x.purchaseDate||'')&&Math.abs(Number(h.actualTotal||0)-Number(x.actualTotal||0))<0.001);
 data.expenses=removeFirstMatching(data.expenses||[],expenseMatch);data.priceHistory=removeFirstMatching(data.priceHistory||[],historyMatch);removePurchaseFromPantry(x);
 delete x.linkedExpenseId;delete x.linkedPriceHistoryId;delete x.actualTotal;delete x.purchaseDate;delete x.purchasePlace;
}

purchaseForm.onsubmit=e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target)),x=data.shopping.find(v=>v.id===o.id);if(!x)return;rollbackCompletedPurchase(x);const est=Number(x.qty||0)*currentUnitPrice(x),actual=Number(o.actualTotal||0),historyId=uid(),expenseId=uid();x.done=true;x.actualTotal=actual;x.purchaseDate=o.date;x.purchasePlace=o.place;x.linkedExpenseId=expenseId;x.linkedPriceHistoryId=historyId;data.priceHistory.unshift({id:historyId,sourcePurchaseId:x.id,productId:x.productId,title:x.title,qty:Number(x.qty||0),unit:x.unit,store:x.store||data.preferredStore,estimatedTotal:est,actualTotal:actual,unitActual:Number(x.qty||0)>0?actual/Number(x.qty):actual,place:o.place,date:o.date});data.expenses.unshift({id:expenseId,sourcePurchaseId:x.id,title:'Mercado: '+x.title,amount:actual,date:o.date,paidBy:x.assigned||'Ambos',category:'Mercado'});applyPurchaseToPantry(x);closeModal('purchaseModal');save();toast('Compra guardada · añadida a despensa')};
reopenPurchase=function(id){const x=data.shopping.find(v=>v.id===id);if(x&&confirm('¿Volver a pendiente? Se retirará el gasto y se descontará de la despensa.')){rollbackCompletedPurchase(x);x.done=false;save();toast('Compra reabierta y movimientos revertidos')}};
removeItem=function(type,id){if(type==='task'){if(!confirm('¿Eliminar esta tarea?'))return;data.tasks=data.tasks.filter(x=>x.id!==id);save();return}const x=data.shopping.find(v=>v.id===id);if(!x)return;const message=x.done?'¿Eliminar esta compra realizada? También se eliminará su gasto y se ajustará la despensa.':'¿Eliminar este producto pendiente?';if(!confirm(message))return;if(x.done)rollbackCompletedPurchase(x);data.shopping=data.shopping.filter(v=>v.id!==id);save();toast(x.done?'Compra, gasto y despensa actualizados':'Producto eliminado')};

// Acceso visible desde Más.
(()=>{const settings=document.querySelector('#moreView .settings');if(settings&&!document.getElementById('extraIncomeSetting')){const el=document.createElement('div');el.id='extraIncomeSetting';el.className='setting';el.innerHTML='<div><b>Ingresos extra</b><small>Bonos, horas extra, ventas y otros ingresos del mes</small></div><button class="text-btn" onclick="openExtraIncomes()">Administrar</button>';const salary=[...settings.children].find(x=>x.textContent.includes('Sueldo mensual'));salary?salary.after(el):settings.prepend(el)}})();

const __renderAllV52=renderAll;renderAll=function(){__renderAllV52();renderIncomeSummary();if(document.getElementById('extraIncomeModal')?.classList.contains('open'))renderExtraIncomes()};
renderAll();
