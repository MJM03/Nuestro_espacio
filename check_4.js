
(()=>{
  const VERSION='5.5.0';
  const monthKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const lastDay=(date=new Date())=>new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
  const num=v=>Number(v||0);
  const periodLabel=v=>({first:'1.ª quincena',second:'Fin de mes',split:'Dividir entre ambas',auto:'Automático'}[v]||'Automático');

  function ensurePayCycle(){
    if(!Array.isArray(data.salaryPayments)||!data.salaryPayments.length){
      data.salaryPayments=[
        {id:'salary_mid',title:'Quincena',amount:500,day:15,active:true},
        {id:'salary_end',title:'Fin de mes',amount:900,day:'last',active:true}
      ];
    }
    data.salaryPaymentStatus=data.salaryPaymentStatus&&typeof data.salaryPaymentStatus==='object'?data.salaryPaymentStatus:{};
    data.salaryPaymentStatus[monthKey()]=data.salaryPaymentStatus[monthKey()]||{};
    data.monthlyIncome=data.salaryPayments.filter(x=>x.active!==false).reduce((s,x)=>s+num(x.amount),0);
    (data.fixedExpenses||[]).forEach(x=>{if(!x.payPeriod)x.payPeriod='auto'});
    (data.expenses||[]).forEach(x=>{if(!x.payPeriod)x.payPeriod='auto'});
    (data.shopping||[]).forEach(x=>{if(!x.payPeriod)x.payPeriod='auto'});
  }

  function paymentDay(p,base=new Date()){return p.day==='last'?lastDay(base):Math.max(1,Math.min(lastDay(base),num(p.day)||1))}
  function paymentStatus(p,base=new Date()){
    const override=data.salaryPaymentStatus?.[monthKey(base)]?.[p.id]||'auto';
    if(override!=='auto')return override;
    return base.getDate()>=paymentDay(p,base)?'received':'expected';
  }
  function paymentReceived(p,base=new Date()){return paymentStatus(p,base)==='received'}
  function autoPeriodByDay(day){return num(day)<=15?'first':'second'}
  function resolvePeriod(item,type='expense'){
    const p=item?.payPeriod||'auto';
    if(p!=='auto')return p;
    if(type==='fixed')return autoPeriodByDay(item.dueDay||1);
    if(type==='expense')return autoPeriodByDay(String(item.date||today()).slice(8,10));
    return new Date().getDate()<=15?'first':'second';
  }
  function splitAmount(amount,period,target){
    if(period==='split')return num(amount)/2;
    return period===target?num(amount):0;
  }
  function currentMonthExtraList(){const k=monthKey();return (data.extraIncomes||[]).filter(x=>String(x.date||'').slice(0,7)===k)}
  function extrasFor(target,receivedOnly=false){
    const now=today();return currentMonthExtraList().reduce((s,x)=>{
      if(receivedOnly&&String(x.date||'')>now)return s;
      const p=x.payPeriod&&x.payPeriod!=='auto'?x.payPeriod:autoPeriodByDay(String(x.date||today()).slice(8,10));
      return s+splitAmount(x.amount,p,target);
    },0)
  }
  function periodSalary(target,receivedOnly=false){
    const active=data.salaryPayments.filter(x=>x.active!==false);
    const p=target==='first'?active[0]:active[1];
    if(!p)return 0;
    if(receivedOnly&&!paymentReceived(p))return 0;
    return num(p.amount);
  }
  function fixedFor(target){return (data.fixedExpenses||[]).filter(x=>x.active!==false).reduce((s,x)=>s+splitAmount(normalizedMonthlyAmount(x),resolvePeriod(x,'fixed'),target),0)}
  function expensesFor(target){const k=monthKey();return (data.expenses||[]).filter(x=>String(x.date||'').slice(0,7)===k).reduce((s,x)=>s+splitAmount(x.amount,resolvePeriod(x,'expense'),target),0)}
  function marketFor(target){return (data.shopping||[]).filter(x=>!x.done).reduce((s,x)=>s+splitAmount(num(x.qty)*currentUnitPrice(x),resolvePeriod(x,'shopping'),target),0)}
  function periodData(target,receivedOnly=false){
    const salary=periodSalary(target,receivedOnly),extra=extrasFor(target,receivedOnly),fixed=fixedFor(target),expenses=expensesFor(target),market=marketFor(target);
    return {salary,extra,income:salary+extra,fixed,expenses,market,commitments:fixed+expenses+market,balance:salary+extra-fixed-expenses-market};
  }

  ensurePayCycle();

  const css=document.createElement('style');css.textContent=`
    .paycycle-card{margin-top:12px;background:linear-gradient(145deg,#173c36,#245c50);color:#fff;border:0}.paycycle-card .meta{color:rgba(255,255,255,.78)}
    .paycycle-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.paycycle-period{padding:12px;border-radius:15px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.1)}
    .paycycle-period small{font-size:10px;opacity:.8}.paycycle-period strong{display:block;font-size:20px;margin:5px 0}.paycycle-period.negative strong{color:#ffd2cc}
    .paycycle-line{display:flex;justify-content:space-between;gap:10px;font-size:11px;margin-top:5px}.paycycle-line span:first-child{opacity:.76}
    .next-pay{margin-top:10px;padding:11px 12px;border-radius:14px;background:rgba(212,170,93,.18);border:1px solid rgba(212,170,93,.28)}
    .cashflow-alert{padding:10px 12px;border-radius:13px;margin-top:8px;font-size:11px;line-height:1.45;background:#fff4e5;color:#8a4b08}.cashflow-alert.good{background:#eaf8ef;color:#176b3a}
    .salary-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.salary-payment-card{padding:13px;border:1px solid var(--line);border-radius:16px;background:var(--card);margin-bottom:10px}
    .salary-payment-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.salary-payment-head b{font-size:15px}.status-chip{font-size:10px;font-weight:800;padding:5px 8px;border-radius:999px;background:var(--soft)}
    .flow-table{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:7px;align-items:center;font-size:11px;padding:8px 0;border-bottom:1px solid var(--line)}.flow-table:last-child{border-bottom:0}.flow-table b{text-align:right}
    .cashflow-hero{padding:2px 0 4px}.cashflow-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.cashflow-hero-top small{display:block;font-size:10px;letter-spacing:.09em;opacity:.78}.cashflow-main{display:block;font-size:38px;line-height:1.05;margin:7px 0 3px}.cashflow-main.negative{color:#ffd1cb}.cashflow-hero-top span{font-size:12px;opacity:.78}.cashflow-config{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.1);color:#fff;border-radius:999px;padding:8px 12px;font-weight:800}.cashflow-explain{margin-top:12px;padding:10px 12px;border-radius:13px;background:rgba(255,255,255,.08);font-size:11px;line-height:1.45;color:rgba(255,255,255,.86)}
    .cashflow-breakdown{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.cashflow-breakdown>div{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.07);display:flex;justify-content:space-between;gap:8px;font-size:10px}.cashflow-breakdown span{opacity:.7}.cashflow-breakdown b{font-size:11px}
    .next-income-card{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:12px 13px;border-radius:15px;background:rgba(212,170,93,.18);border:1px solid rgba(212,170,93,.35)}.next-income-card.warning{background:rgba(232,112,95,.16);border-color:rgba(255,174,160,.35)}.next-income-card small{display:block;font-size:9px;letter-spacing:.08em;opacity:.72}.next-income-card b{display:block;font-size:14px;margin:3px 0}.next-income-card span{font-size:10px;opacity:.75}.next-income-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);font-weight:900}
    .period-title{display:flex;align-items:center;justify-content:space-between;margin-top:4px}.period-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.period-head span{font-size:8px;font-weight:900;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.1)}.period-sub{font-size:9px;opacity:.66;margin-top:-2px}.period-progress{height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin:9px 0}.period-progress i{display:block;height:100%;border-radius:inherit;background:#d7b465}
    .money-story-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.money-story{padding:11px;border-radius:14px;background:rgba(255,255,255,.08)}.money-story small,.money-story span{display:block;color:rgba(255,255,255,.68)}.money-story small{font-size:9px;text-transform:uppercase;letter-spacing:.05em}.money-story b{display:block;font-size:19px;margin:5px 0}.money-story span{font-size:9px;line-height:1.35}.coverage-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:13px}.coverage-row b,.coverage-row span{display:block}.coverage-row b{font-size:11px}.coverage-row span{font-size:9px;opacity:.68;margin-top:2px}.traffic-light{display:flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.08);font-size:9px;font-weight:900}.traffic-light i{width:8px;height:8px;border-radius:50%;background:#67d69a}.traffic-light.warning i{background:#f1c75b}.traffic-light.danger i{background:#ff8f82}.coverage-bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:8px}.coverage-bar i{display:block;height:100%;background:#67d69a;border-radius:inherit}.cashflow-warning .coverage-bar i{background:#f1c75b}.cashflow-danger .coverage-bar i{background:#ff8f82}.cashflow-explain b,.cashflow-explain span{display:block}.cashflow-explain b{font-size:11px}.cashflow-explain span{font-size:10px;opacity:.78;margin-top:4px}.next-income-card em{display:block;font-style:normal;font-weight:800;font-size:10px;margin-top:5px;color:#f5d98d}
    @media(max-width:390px){.paycycle-grid,.salary-row{grid-template-columns:1fr}.cashflow-breakdown{grid-template-columns:1fr 1fr}.cashflow-main{font-size:34px}}
  `;document.head.appendChild(css);

  const homeIncome=document.getElementById('incomeHomeSummary');
  if(homeIncome&&!document.getElementById('payCycleHomeSummary')){
    const card=document.createElement('div');card.id='payCycleHomeSummary';card.className='card paycycle-card';homeIncome.after(card);
  }

  const modal=document.createElement('div');modal.className='modal';modal.id='payCycleModal';modal.innerHTML=`<div class="sheet"><div class="handle"></div><div class="section-head" style="margin-top:0"><div><h2 style="margin:0">Flujo por quincena</h2><div class="meta" id="payCycleMonth"></div></div><button class="text-btn" onclick="closeModal('payCycleModal')">Cerrar</button></div><div class="ultra-banner">Configura cómo recibes el sueldo y asigna cada gasto a la quincena que realmente lo cubrirá.</div><div id="salaryPaymentsList" style="margin-top:12px"></div><button class="primary" type="button" onclick="openSalaryPaymentForm()">＋ Agregar pago de sueldo</button><div class="section-head"><h2>Distribución del mes</h2></div><div class="card" id="payCycleBreakdown"></div><div id="payCycleAlerts"></div></div>`;document.body.appendChild(modal);

  const formModal=document.createElement('div');formModal.className='modal';formModal.id='salaryPaymentFormModal';formModal.innerHTML=`<div class="sheet"><div class="handle"></div><h2 id="salaryPaymentFormTitle">Pago de sueldo</h2><form id="salaryPaymentForm"><input type="hidden" name="id"><div class="field"><label>Nombre del pago</label><input name="title" required placeholder="Ej. Quincena"></div><div class="salary-row"><div class="field"><label>Monto</label><input name="amount" type="number" min="0" step="0.01" required></div><div class="field"><label>Día de pago</label><select name="day"><option value="15">Día 15</option><option value="last">Último día del mes</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}">Día ${i+1}</option>`).join('')}</select></div></div><div class="field"><label>Estado este mes</label><select name="status"><option value="auto">Automático según la fecha</option><option value="expected">Esperado</option><option value="received">Recibido</option><option value="delayed">Retrasado</option></select></div><label class="field switchline"><input type="checkbox" name="active" checked><span><b>Incluir en los ingresos</b><span class="tiny" style="display:block">Puedes pausarlo sin eliminarlo.</span></span></label><button class="primary">Guardar pago</button><button type="button" class="secondary" onclick="closeModal('salaryPaymentFormModal')">Cancelar</button></form></div>`;document.body.appendChild(formModal);

  function addPayPeriodField(container){
    if(!container||container.querySelector('[name="payPeriod"]'))return;
    const field=document.createElement('div');field.className='field pay-period-field';field.innerHTML=`<label>Pagar con</label><select name="payPeriod"><option value="auto">Automático por fecha</option><option value="first">Primera quincena</option><option value="second">Fin de mes</option><option value="split">Dividir entre ambas</option></select>`;
    container.appendChild(field);
  }
  addPayPeriodField(document.getElementById('fixedForm'));

  const oldOpenFixed=window.openFixedForm;window.openFixedForm=function(id=''){oldOpenFixed(id);addPayPeriodField(document.getElementById('fixedForm'));const x=(data.fixedExpenses||[]).find(v=>v.id===id);const el=fixedForm.elements.payPeriod;if(el)el.value=x?.payPeriod||'auto'};
  const oldOpenForm=window.openForm;window.openForm=function(type,id=''){oldOpenForm(type,id);if(['shopping','expense'].includes(type)){addPayPeriodField(document.getElementById('formFields'));const src=type==='shopping'?data.shopping:data.expenses;const x=src.find(v=>v.id===id);const el=itemForm.elements.payPeriod;if(el)el.value=x?.payPeriod||'auto'}};

  const oldExtraForm=window.openExtraIncomeForm;window.openExtraIncomeForm=function(id=''){oldExtraForm(id);const form=document.getElementById('extraIncomeForm');if(form){addPayPeriodField(form);const x=(data.extraIncomes||[]).find(v=>v.id===id);form.elements.payPeriod.value=x?.payPeriod||'auto'}};

  function nextSalaryPayment(now=new Date()){
    const active=(data.salaryPayments||[]).filter(x=>x.active!==false);
    if(!active.length)return null;
    const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const candidates=[];
    for(const p of active){
      for(let offset=0;offset<=1;offset++){
        const base=new Date(now.getFullYear(),now.getMonth()+offset,1);
        const day=paymentDay(p,base);
        const date=new Date(base.getFullYear(),base.getMonth(),day);
        if(date>=todayStart)candidates.push({...p,date});
      }
    }
    candidates.sort((a,b)=>a.date-b.date);
    const next=candidates[0];
    if(!next)return null;
    next.days=Math.max(0,Math.round((next.date-todayStart)/86400000));
    return next;
  }
  function receivedIncomeSummary(now=new Date()){
    const salary=(data.salaryPayments||[]).filter(x=>x.active!==false&&paymentReceived(x,now)).reduce((s,x)=>s+num(x.amount),0);
    const todayIso=now.toISOString().slice(0,10),key=monthKey(now);
    const extra=(data.extraIncomes||[]).filter(x=>String(x.date||'').slice(0,7)===key&&String(x.date||todayIso)<=todayIso).reduce((s,x)=>s+num(x.amount),0);
    return {salary,extra,total:salary+extra};
  }
  function safeCashSummary(now=new Date()){
    const current=now.getDate()<=15?'first':'second';
    const received=receivedIncomeSummary(now);
    const actual=(data.expenses||[]).filter(x=>String(x.date||'').slice(0,7)===monthKey(now)).reduce((s,x)=>s+num(x.amount),0);
    const fixed=fixedFor(current);
    const market=marketFor(current);
    const reserved=fixed+market;
    return {current,received,actual,fixed,market,reserved,safe:received.total-actual-reserved};
  }
  function renderPayCycleHome(){
    ensurePayCycle();const el=document.getElementById('payCycleHomeSummary');if(!el)return;
    const now=new Date(),summary=safeCashSummary(now),first=periodData('first'),second=periodData('second'),next=nextSalaryPayment(now);
    const safe=summary.safe,currentCash=summary.received.total-summary.actual,commitments=summary.fixed+summary.market;
    const daysText=next?(next.days===0?'hoy':next.days===1?'mañana':`en ${next.days} días`):'';
    const afterNext=next?safe+num(next.amount):safe;
    const coverage=commitments>0?Math.max(0,Math.min(100,(currentCash/commitments)*100)):100;
    let tone='good',signal='Todo cubierto',signalIcon='✓',resultText=`Después de reservar tus compromisos, mantienes ${money(safe)} disponibles.`;
    let recommendation='Puedes continuar con tu planificación actual.';
    if(safe<0){tone='danger';signal='Falta por cubrir';signalIcon='!';resultText=`Hoy te faltan ${money(Math.abs(safe))} para cubrir todo lo reservado.`;recommendation=next&&afterNext>=0?`Al recibir ${esc(next.title)} quedarían aproximadamente ${money(afterNext)} disponibles.`:`Conviene postergar ${money(Math.abs(safe))} de compras no urgentes o mover gastos a otro periodo.`}
    else if(commitments>0&&safe<commitments*.15){tone='warning';signal='Margen ajustado';signalIcon='•';recommendation='Tienes cobertura, pero con poco margen. Evita compras no planificadas antes del próximo ingreso.'}
    el.innerHTML=`
      <div class="cashflow-hero cashflow-${tone}">
        <div class="cashflow-hero-top"><div><small>ESTADO FINANCIERO DE HOY</small><strong class="cashflow-main ${safe<0?'negative':''}">${safe<0?`Te faltan ${money(Math.abs(safe))}`:`${money(safe)} libres`}</strong><span>${signal}</span></div><button class="cashflow-config" onclick="openPayCycle()">Configurar</button></div>
        <div class="money-story-grid">
          <div class="money-story"><small>Lo que tienes ahora</small><b>${money(currentCash)}</b><span>Ingresos recibidos menos gastos ya pagados</span></div>
          <div class="money-story"><small>Ya comprometido</small><b>− ${money(commitments)}</b><span>Fijos reservados y mercado pendiente</span></div>
        </div>
        <div class="coverage-row"><div><b>Cobertura actual</b><span>${coverage.toFixed(0)}% de compromisos cubiertos</span></div><div class="traffic-light ${tone}"><i></i>${signal}</div></div>
        <div class="coverage-bar"><i style="width:${coverage}%"></i></div>
        <div class="cashflow-explain"><b>${resultText}</b><span>${recommendation}</span></div>
      </div>
      <div class="next-income-card ${safe<0?'warning':''}">
        <div><small>PRÓXIMO INGRESO</small><b>${next?`${esc(next.title)} · ${money(next.amount)}`:'Sin pagos configurados'}</b><span>${next?`${next.date.toLocaleDateString('es-PE',{day:'numeric',month:'long'})} · ${daysText}`:'Configura tus pagos de sueldo'}</span>${next?`<em>Después de cobrar: ${afterNext>=0?`${money(afterNext)} disponibles`:`faltarán ${money(Math.abs(afterNext))}`}</em>`:''}</div>
        <div class="next-income-icon">${signalIcon}</div>
      </div>
      <div class="period-title"><b>Proyección del mes</b><button class="text-btn" style="color:#d7b465" onclick="openPayCycle()">Ver detalle</button></div>
      <div class="paycycle-grid">${periodCard('Primera quincena',first,now.getDate()<=15?'current':'past')}${periodCard('Fin de mes',second,now.getDate()>15?'current':'next')}</div>`;
  }
  function periodCard(title,p,status='next'){
    const used=p.income>0?Math.min(100,Math.max(0,(p.commitments/p.income)*100)):p.commitments>0?100:0;
    const chip=status==='current'?'En curso':status==='past'?'Cerrada':'Próxima';
    return `<div class="paycycle-period ${p.balance<0?'negative':''}"><div class="period-head"><small>${title.toUpperCase()}</small><span>${chip}</span></div><strong>${money(p.balance)}</strong><div class="period-sub">Saldo proyectado</div><div class="period-progress"><i style="width:${used}%"></i></div><div class="paycycle-line"><span>Ingresos</span><b>${money(p.income)}</b></div><div class="paycycle-line"><span>Compromisos</span><b>− ${money(p.commitments)}</b></div></div>`}

  window.openPayCycle=function(){ensurePayCycle();renderPayCycleModal();document.getElementById('payCycleModal').classList.add('open')};
  function renderPayCycleModal(){
    const now=new Date(),fmt=now.toLocaleDateString('es-PE',{month:'long',year:'numeric'});document.getElementById('payCycleMonth').textContent=fmt.charAt(0).toUpperCase()+fmt.slice(1);
    const list=document.getElementById('salaryPaymentsList');list.innerHTML=data.salaryPayments.map(p=>{const st=paymentStatus(p);return `<div class="salary-payment-card"><div class="salary-payment-head"><div><b>${esc(p.title)}</b><div class="meta">${money(p.amount)} · día ${paymentDay(p)}</div></div><span class="status-chip">${{received:'Recibido',expected:'Esperado',delayed:'Retrasado'}[st]||'Automático'}</span></div><div class="actions" style="margin-top:10px"><button class="mini" onclick="openSalaryPaymentForm('${p.id}')">✎ Editar</button><button class="mini" onclick="deleteSalaryPayment('${p.id}')">🗑️</button></div></div>`}).join('')||'<div class="empty">Agrega al menos un pago de sueldo.</div>';
    const first=periodData('first'),second=periodData('second');document.getElementById('payCycleBreakdown').innerHTML=`${flowRows('Primera quincena',first)}${flowRows('Fin de mes',second)}`;
    const alerts=[];if(first.balance<0)alerts.push(`La primera quincena queda corta por ${money(Math.abs(first.balance))}.`);if(second.balance<0)alerts.push(`Fin de mes queda corto por ${money(Math.abs(second.balance))}.`);if(first.balance<0&&second.balance>0)alerts.push(`Puedes mover hasta ${money(Math.min(Math.abs(first.balance),second.balance))} de gastos flexibles a fin de mes.`);if(second.balance<0&&first.balance>0)alerts.push(`Puedes reservar ${money(Math.min(Math.abs(second.balance),first.balance))} de la primera quincena para fin de mes.`);document.getElementById('payCycleAlerts').innerHTML=alerts.length?alerts.map(x=>`<div class="cashflow-alert">${x}</div>`).join(''):'<div class="cashflow-alert good">Las dos quincenas cubren sus compromisos estimados.</div>';
  }
  function flowRows(title,p){return `<div style="padding:10px 0"><b>${title}</b><div class="flow-table"><span>Ingresos</span><span></span><b>${money(p.income)}</b></div><div class="flow-table"><span>Gastos fijos</span><span></span><b>− ${money(p.fixed)}</b></div><div class="flow-table"><span>Mercado pendiente</span><span></span><b>− ${money(p.market)}</b></div><div class="flow-table"><span>Otros gastos</span><span></span><b>− ${money(p.expenses)}</b></div><div class="flow-table"><strong>Disponible</strong><span></span><b>${money(p.balance)}</b></div></div>`}

  window.openSalaryPaymentForm=function(id=''){
    ensurePayCycle();const p=data.salaryPayments.find(x=>x.id===id),f=document.getElementById('salaryPaymentForm');f.reset();document.getElementById('salaryPaymentFormTitle').textContent=p?'Editar pago de sueldo':'Nuevo pago de sueldo';f.elements.id.value=p?.id||'';f.elements.title.value=p?.title||'';f.elements.amount.value=p?.amount??'';f.elements.day.value=String(p?.day??15);f.elements.active.checked=p?.active!==false;f.elements.status.value=data.salaryPaymentStatus?.[monthKey()]?.[p?.id]||'auto';document.getElementById('salaryPaymentFormModal').classList.add('open');
  };
  document.getElementById('salaryPaymentForm').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,o=Object.fromEntries(new FormData(f));o.amount=num(o.amount);o.day=o.day==='last'?'last':num(o.day);o.active=f.elements.active.checked;o.id=o.id||uid();const status=o.status;delete o.status;const old=data.salaryPayments.find(x=>x.id===o.id);if(old)Object.assign(old,o);else data.salaryPayments.push(o);data.salaryPaymentStatus[monthKey()]=data.salaryPaymentStatus[monthKey()]||{};data.salaryPaymentStatus[monthKey()][o.id]=status;ensurePayCycle();closeModal('salaryPaymentFormModal');save();renderPayCycleModal();toast('Pago de sueldo actualizado')};
  window.deleteSalaryPayment=function(id){if(data.salaryPayments.length<=1){toast('Debes conservar al menos un pago');return}if(confirm('¿Eliminar este pago de sueldo?')){data.salaryPayments=data.salaryPayments.filter(x=>x.id!==id);ensurePayCycle();save();renderPayCycleModal()}};

  const oldRenderIncome=window.renderIncomeSummary;window.renderIncomeSummary=function(){ensurePayCycle();const el=document.getElementById('incomeHomeSummary');if(!el)return;const salary=data.salaryPayments.filter(x=>x.active!==false).reduce((s,x)=>s+num(x.amount),0),extra=extraIncomeForMonth(),income=salary+extra,fixed=fixedMonthlyTotal(),market=pendingMarketTotal(),other=currentMonthVariableExpenses(),commitments=fixed+market+other,balance=income-commitments;el.innerHTML=`<div class="budget-top"><div><small>INGRESOS PROGRAMADOS DEL MES</small><strong>${money(income)}</strong></div><div class="income-actions"><button onclick="openPayCycle()">Pagos</button><button onclick="openExtraIncomes()">＋ Extra</button></div></div><div class="extra-summary"><div><small>Sueldo programado</small><b>${money(salary)}</b></div><div style="text-align:right"><small>Ingresos extra</small><b>+ ${money(extra)}</b></div></div><div class="income-breakdown"><div class="income-cell"><small>Gastos fijos</small><b>− ${money(fixed)}</b></div><div class="income-cell"><small>Mercado pendiente</small><b>− ${money(market)}</b></div><div class="income-cell"><small>Otros gastos del mes</small><b>− ${money(other)}</b></div><div class="income-cell"><small>Compromisos totales</small><b>${money(commitments)}</b></div></div><div class="income-balance ${balance<0?'negative':''}"><span>Disponible mensual estimado</span><strong>${money(balance)}</strong></div><div class="meta">Sueldo inicial: S/500 el día 15 y S/900 al fin de mes. Ambos montos son editables.</div>`;renderPayCycleHome()};
  window.editMonthlyIncome=function(){openPayCycle()};

  const oldRenderFixed=window.renderFixedExpenses;window.renderFixedExpenses=function(){oldRenderFixed();document.querySelectorAll('#fixedList .fixed-item').forEach((card,i)=>{const sorted=[...(data.fixedExpenses||[])].sort((a,b)=>num(a.dueDay)-num(b.dueDay)),x=sorted[i];if(!x)return;const meta=card.querySelector('.meta');if(meta&&!meta.textContent.includes('quincena'))meta.insertAdjacentHTML('beforeend',`<span>${periodLabel(resolvePeriod(x,'fixed'))}</span>`);})};

  const settings=document.querySelector('#moreView .settings');if(settings&&!document.getElementById('payCycleSetting')){const row=document.createElement('div');row.id='payCycleSetting';row.className='setting';row.innerHTML='<div><b>Flujo por quincena</b><small>S/500 el día 15 y S/900 a fin de mes, completamente editables</small></div><button class="text-btn" onclick="openPayCycle()">Configurar</button>';const salary=[...settings.children].find(x=>x.textContent.includes('Sueldo mensual'));salary?salary.replaceWith(row):settings.prepend(row)}

  const oldRenderAll=window.renderAll;window.renderAll=function(){ensurePayCycle();oldRenderAll();renderPayCycleHome()};
  document.querySelectorAll('.version-card small').forEach(x=>x.textContent=x.textContent.replace(/v\d+\.\d+\.\d+/,'v'+VERSION));
  const vs=document.getElementById('versionStatus');if(vs)vs.textContent='Compilación: 13/07/2026 · Semáforo financiero y proyección clara';
  renderAll();
})();
