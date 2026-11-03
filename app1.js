
/* ============================================================
   CRM LUARE EVENTOS — motor de dados + interface
   ============================================================ */
const LS='luare_crm_v1';
const TAB2027={
  // 4h — com buffet LUARE: espaço fixo 3.500 + buffet/pessoa (linear)
  espacoLuare4h: 3500,
  buffet4h:{ mini:75, miniBar:85, trad:85, tradBar:100 },
  // 4h — buffet externo
  externo4h:{ semana:4000, fds:4500 },
  // 6h — com buffet LUARE: espaço conforme dia + tabela publicada
  espacoLuare6h:{ semana:3500, fds:4000 },
  // 6h — buffet externo
  externo6h:{ semana:5000, fds:5500 },
  // tabelas de preço 6h (convidados 50..170), seg-qui e sex-dom/feriado
  conv6h:[50,80,100,120,140,160,170],
  tab6h:{
    mini:      {s:[11000,13500,15000,16500,18000,19500,20250], f:[11500,14000,15500,17000,18500,20000,20750]},
    miniBar:   {s:[12000,14500,16000,17500,19000,20500,21250], f:[12500,15000,16500,18000,19500,21000,21750]},
    trad:      {s:[12000,14500,16000,17500,19000,20500,21250], f:[12500,15000,16500,18000,19500,21000,21750]},
    tradBar:   {s:[13500,16000,17500,19000,20500,22000,22750], f:[14000,16500,18000,19500,21000,22500,23250]}
  }
};
const PACKS={ mini:'Mini Jantar', miniBar:'Mini Jantar + Barracas', trad:'Jantar Tradicional', tradBar:'Tradicional + Barracas' };
const STATUS_ORC={ novo:'Novo', enviado:'Enviado', aprovado:'Aprovado', recusado:'Recusado' };
const STATUS_EV={ reservado:'Reservado', confirmado:'Confirmado', realizado:'Realizado', cancelado:'Cancelado' };
const ORIGENS=['Instagram','WhatsApp','Indicação','Google','Facebook','Cliente antigo','Outro'];
const FUNIL=['Novo contato','Orçamento enviado','Negociando','Fechado','Perdido'];

let DB=null, USER=null, VIEW='painel', calRef=new Date();
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const uid=()=>{
  // UUID de verdade: o banco usa uuid como chave, e ids caseiros quebravam
  // os vínculos (um lançamento apontando para um evento que ainda não existia no banco).
  try{
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  }catch(e){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=Math.random()*16|0, v=c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
};
const hoje=()=>new Date().toISOString().slice(0,10);
const brl=n=>'R$ '+(Math.round((n||0)*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const brl0=n=>'R$ '+Math.round(n||0).toLocaleString('pt-BR');
const dt=s=>{ if(!s) return '—'; const [a,m,d]=s.split('-'); return `${d}/${m}/${a}`; };
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mesAtual=()=>new Date().toISOString().slice(0,7);
const soma=(a,f)=>a.reduce((t,x)=>t+(f?f(x):x),0);

/* ---------- PERSISTÊNCIA (com fallback em memória) ---------- */
const MEM={};
const store={
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return MEM[k]||null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){ MEM[k]=v; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){ delete MEM[k]; } }
};
function seed(){
  const u={ id:uid(), user:'bianca', pass:'luare2027', nome:'Bianca Cavalcante', cargo:'CEO', role:'admin' };
  const r={ id:uid(), user:'roan', pass:'roan2027', nome:'Roan', cargo:'Equipe', role:'equipe' };
  return { usuarios:[u,r], clientes:[], orcamentos:[], eventos:[], lancamentos:[], tarefas:[], config:{ proximoOrc:1, exemplo:false, seed2:true } };
}
function carregar(){
  try{ DB=JSON.parse(store.get(LS)) || seed(); }catch(e){ DB=seed(); }
  if(!DB.usuarios||!DB.usuarios.length) DB=seed();
  if(!DB.config) DB.config={proximoOrc:1,exemplo:false};
  // acesso do Roan: garante a conta em bancos já existentes (uma única vez)
  if(!DB.config.seed2){
    if(!DB.usuarios.find(u=>u.user==='roan'))
      DB.usuarios.push({ id:uid(), user:'roan', pass:'roan2027', nome:'Roan', cargo:'Equipe', role:'equipe' });
    DB.config.seed2=true; salvar();
  }
}
function salvar(){ store.set(LS, JSON.stringify(DB)); }

/* ---------- AUTENTICAÇÃO ---------- */
function entrar(){
  const u=$('#loginUser').value.trim().toLowerCase(), p=$('#loginPass').value;
  const achou=DB.usuarios.find(x=>x.user.toLowerCase()===u && x.pass===p);
  if(!achou){ $('#loginErr').textContent='Usuário ou senha incorretos.'; return; }
  USER=achou; sessionStorage.setItem('luare_user',achou.id);
  $('#loginErr').textContent=''; $('#login').style.display='none'; $('#app').classList.add('on');
  $('#whoName').textContent=achou.nome; $('#whoRole').textContent=achou.cargo;
  const sess=sessionStorage.getItem('luare_view'); VIEW=sess||'painel';
  render();
}
function sair(){ sessionStorage.removeItem('luare_user'); sessionStorage.removeItem('luare_view'); location.reload(); }

/* ---------- NAVEGAÇÃO ---------- */
const PAGINAS=[
  {id:'painel',    t:'Painel do mês',  ic:'▦'},
  {id:'clientes',  t:'Clientes',       ic:'👤'},
  {id:'orcamentos',t:'Orçamentos',     ic:'📋'},
  {id:'agenda',    t:'Agenda',         ic:'📅'},
  {id:'financeiro',t:'Financeiro',     ic:'💰'},
  {id:'followups', t:'Follow-ups',     ic:'🔔'},
  {id:'relatorio', t:'Relatório',      ic:'📊'},
  {id:'config',    t:'Configurações',  ic:'⚙'}
];
function nav(){
  const isAdmin=USER && USER.role==='admin';
  $('#nav').innerHTML=PAGINAS.filter(p=>p.id!=='config'||isAdmin).map(p=>{
    let b='';
    if(p.id==='followups'){ const n=followPendentes().length; if(n) b=`<span class="badge">${n}</span>`; }
    return `<button class="${VIEW===p.id?'act':''}" onclick="ir('${p.id}')"><span class="ic">${p.ic}</span>${p.t}${b}</button>`;
  }).join('');
}
function ir(v){
  VIEW=v; sessionStorage.setItem('luare_view',v);
  const at={painel:()=>{actsPainel()},clientes:()=>{actsClientes()},orcamentos:()=>{actsOrcamentos()},
    agenda:()=>{actsAgenda()},financeiro:()=>{actsFinanceiro()},followups:()=>{actsFollow()},
    relatorio:()=>{actsRelatorio()},config:()=>{actsConfig()}};
  (at[v]||(()=>{}))();
  render();
}
function render(){
  nav();
  $('#pgTitle').textContent=(PAGINAS.find(p=>p.id===VIEW)||{t:''}).t||'';
  document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));
  const vAtual=$('#view-'+VIEW); if(vAtual) vAtual.classList.add('on');
  const fns={painel:renderPainel,clientes:renderClientes,orcamentos:renderOrcamentos,agenda:renderAgenda,
    financeiro:renderFinanceiro,followups:renderFollowups,relatorio:renderRelatorio,config:renderConfig};
  (fns[VIEW]||renderPainel)();
}

/* ---------- MODAL ---------- */
function modal(html){
  $('#modalBox').innerHTML=html;
  $('#modalBg').classList.add('on');
}
function fecharModal(){
  $('#modalBg').classList.remove('on');
  $('#modalBox').innerHTML='';
}
document.addEventListener('click',e=>{ if(e.target && e.target.id==='modalBg') fecharModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') fecharModal(); });

/* ============================================================
   MOTOR DE PREÇOS — Tabela LUARE 2027
   ============================================================ */
function tier6h(conv, key, dia){
  // menor faixa publicada >= convidados (faixas: 50,80,100,120,140,160,170)
  const arr=TAB2027.conv6h;
  let i=arr.findIndex(v=>v>=conv);
  if(i<0) i=arr.length-1;
  return TAB2027.tab6h[key][dia==='fds'?'f':'s'][i];
}
function calcOrc(o){
  const conv=Math.max(0, parseInt(o.convidados)||0);
  const dia=o.dia==='fds'?'fds':'semana';
  let espaco=0, buffetPp=0, buffetTotal=0, base=0, aviso='';
  if(o.buffet==='externo'){
    espaco = o.duracao===6 ? TAB2027.externo6h[dia] : TAB2027.externo4h[dia];
    base = espaco;
    buffetPp = 0; buffetTotal = 0;
  } else if(o.duracao===6){
    base = tier6h(conv, o.buffet, dia);
    espaco = TAB2027.espacoLuare6h[dia];
    buffetPp = TAB2027.buffet4h[o.buffet] || 0;   // valor do convidado extra
    buffetTotal = base - espaco;
  } else {
    espaco = TAB2027.espacoLuare4h;
    buffetPp = TAB2027.buffet4h[o.buffet] || 0;
    buffetTotal = buffetPp*conv;
    base = espaco + buffetTotal;
  }
  const extrasTotal = soma(o.extras||[], e=>parseFloat(e.valor)||0);
  const desconto = parseFloat(o.desconto)||0;
  const total = Math.max(0, base + extrasTotal - desconto);
  if(conv>170) aviso='Acima da capacidade (170 convidados).';
  if(conv>0 && conv<50 && o.buffet!=='externo') aviso='Mínimo de 50 convidados nos pacotes com buffet.';
  return {espaco,buffetPp,buffetTotal,base,extrasTotal,desconto,total,aviso,conv,dia};
}
function numOrc(){ const n=(DB.config.proximoOrc||1); DB.config.proximoOrc=n+1; salvar(); return 'ORC-'+new Date().getFullYear()+'-'+String(n).padStart(3,'0'); }
const nomeCli=id=>{const c=DB.clientes.find(x=>x.id===id);return c?c.nome:'—';};

/* ============================================================
   PAINEL
   ============================================================ */
function actsPainel(){
  $('#pgActs').innerHTML=`<button class="btn s" onclick="ir('relatorio')">📊 Fechamento do mês</button>
  <button class="btn p" onclick="modalOrcamento()">＋ Novo orçamento</button>`;
}
function renderPainel(){
  const m=mesAtual();
  const evs=DB.eventos.filter(e=>e.status!=='cancelado');
  const evMes=evs.filter(e=>(e.data||'').slice(0,7)===m);
  const receitaMes=soma(evMes,e=>e.valorTotal||0);
  const orcs=DB.orcamentos;
  const abertos=orcs.filter(o=>o.status==='novo'||o.status==='enviado');
  const aprov=orcs.filter(o=>o.status==='aprovado');
  const conv = orcs.length? Math.round(aprov.length/orcs.length*100):0;
  const aReceber=soma(DB.lancamentos.filter(l=>l.tipo==='entrada'&&!l.pago),l=>l.valor);
  const recebido=soma(DB.lancamentos.filter(l=>l.tipo==='entrada'&&l.pago),l=>l.valor);
  const aPagar=soma(DB.lancamentos.filter(l=>l.tipo==='saida'&&!l.pago),l=>l.valor);

  // próximos eventos
  const prox=evs.filter(e=>e.data>=hoje()).sort((a,b)=>a.data.localeCompare(b.data)).slice(0,4);
  const fu=followPendentes().slice(0,4);

  // gráfico 6 meses
  const meses=[];
  for(let i=5;i>=0;i--){ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i); meses.push(d.toISOString().slice(0,7)); }
  const vals=meses.map(mm=>soma(evs.filter(e=>(e.data||'').slice(0,7)===mm),e=>e.valorTotal||0));
  const maxV=Math.max(...vals,1);

  $('#view-painel').innerHTML=`
  <div class="kpis">
    <div class="kpi"><div class="l">Receita do mês</div><div class="v">${brl0(receitaMes)}</div><div class="x">${evMes.length} evento(s) em ${mesNome(m)}</div></div>
    <div class="kpi o"><div class="l">A receber</div><div class="v">${brl0(aReceber)}</div><div class="x">recebido: ${brl0(recebido)}</div></div>
    <div class="kpi"><div class="l">Orçamentos abertos</div><div class="v">${abertos.length}</div><div class="x">${brl0(soma(abertos,o=>o.total))} em negociação</div></div>
    <div class="kpi g"><div class="l">Taxa de conversão</div><div class="v">${conv}%</div><div class="x">${aprov.length} aprovados de ${orcs.length}</div></div>
    <div class="kpi b"><div class="l">A pagar</div><div class="v">${brl0(aPagar)}</div><div class="x">despesas em aberto</div></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>Receita dos últimos 6 meses</h3>
      <div class="bars">${meses.map((mm,i)=>`<div class="bw"><div class="bv">${vals[i]?Math.round(vals[i]/1000)+'k':''}</div><div class="bar" style="height:${Math.max(3,vals[i]/maxV*100)}%"></div><div class="bl">${mesNome(mm).slice(0,3)}</div></div>`).join('')}</div>
    </div>
    <div class="card"><h3>Próximos eventos <button class="btn s sm" onclick="ir('agenda')">ver agenda</button></h3>
      ${prox.length?prox.map(e=>`<div class="item"><div class="ico">🎉</div><div class="m"><b>${esc(nomeCli(e.clienteId))}</b><span>${dt(e.data)} · ${e.hora||'—'} · ${e.convidados||0} conv.</span></div><span class="tag ${e.status==='confirmado'?'t-ok':'t-warn'}">${STATUS_EV[e.status]}</span></div>`).join(''):'<div class="empty"><span class="big">📅</span>Nenhum evento agendado ainda</div>'}
    </div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Precisa da sua atenção <button class="btn s sm" onclick="ir('followups')">ver todos</button></h3>
    ${fu.length?fu.map(f=>`<div class="item"><div class="ico">${f.ic}</div><div class="m"><b>${esc(f.titulo)}</b><span>${esc(f.desc)}</span></div><span class="tag ${f.tone}">${f.tipo}</span></div>`).join(''):'<div class="empty"><span class="big">✅</span>Tudo em dia — nenhuma pendência</div>'}
  </div>`;
}
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function mesNome(mm){ const [a,m]=mm.split('-'); return MESES[parseInt(m)-1]+'/'+a; }

/* ============================================================
   CLIENTES
   ============================================================ */
function actsClientes(){
  $('#pgActs').innerHTML=`<input id="buscaCli" placeholder="🔍 Buscar cliente..." style="width:200px" oninput="renderClientes()">
  <button class="btn p" onclick="modalCliente()">＋ Novo cliente</button>`;
}
function renderClientes(){
  const q=($('#buscaCli')?.value||'').toLowerCase();
  const lista=DB.clientes.filter(c=>!q||c.nome.toLowerCase().includes(q)||(c.telefone||'').includes(q))
    .sort((a,b)=>(b.criado||'').localeCompare(a.criado||''));
  $('#view-clientes').innerHTML=`
  <div class="card">
    <h3>${lista.length} cliente(s)${q?' encontrados':''}</h3>
    ${lista.length?`<table><thead><tr><th>Cliente</th><th>Contato</th><th>Origem</th><th>Etapa</th><th class="right">Orçamentos</th><th></th></tr></thead><tbody>
    ${lista.map(c=>{
      const os=DB.orcamentos.filter(o=>o.clienteId===c.id);
      const tone={ 'Novo contato':'t-navy','Orçamento enviado':'t-gold','Negociando':'t-warn','Fechado':'t-ok','Perdido':'t-bad' }[c.funil]||'t-mut';
      return `<tr><td><b>${esc(c.nome)}</b></td>
      <td>${esc(c.telefone||'—')}<br><span style="font-size:11.5px;color:var(--mut)">${esc(c.email||'')}</span></td>
      <td>${esc(c.origem||'—')}</td><td><span class="tag ${tone}">${esc(c.funil||'Novo contato')}</span></td>
      <td class="right">${os.length}${os.length?' · '+brl0(soma(os,o=>o.total)):''}</td>
      <td class="right"><button class="btn s sm" onclick="fichaCliente('${c.id}')">Abrir</button>
      <button class="btn s sm" onclick="modalOrcamento('${c.id}')">Orçamento</button></td></tr>`;}).join('')}
    </tbody></table>`:'<div class="empty"><span class="big">👤</span>Nenhum cliente cadastrado ainda.<br>Cadastre o primeiro contato que chegar pelo Instagram ou WhatsApp.</div>'}
  </div>`;
}

/* ============================================================
   FICHA DO CLIENTE + MODAL CLIENTE
   ============================================================ */
function fichaCliente(id){
  const c=DB.clientes.find(x=>x.id===id); if(!c) return;
  const os=DB.orcamentos.filter(o=>o.clienteId===id);
  const evs=DB.eventos.filter(e=>e.clienteId===id);
  const lanc=DB.lancamentos.filter(l=>l.clienteId===id);
  modal(`
  <h3>${esc(c.nome)}</h3>
  <div style="font-size:13px;color:var(--mut);margin-bottom:14px">${esc(c.origem||'—')} · cliente desde ${dt((c.criado||'').slice(0,10))}</div>
  <div class="frow">
    <div><label>Telefone</label><input id="fcTel" value="${esc(c.telefone||'')}"></div>
    <div><label>E-mail</label><input id="fcEmail" value="${esc(c.email||'')}"></div>
  </div>
  <label>Etapa do funil</label>
  <select id="fcFunil">${FUNIL.map(f=>`<option ${c.funil===f?'selected':''}>${f}</option>`).join('')}</select>
  <label>Observações</label>
  <textarea id="fcObs" rows="2">${esc(c.obs||'')}</textarea>
  <div style="margin-top:16px">
    <h3 style="color:var(--navy);font-size:14px">Histórico</h3>
    ${os.length?os.map(o=>`<div class="item"><div class="ico">📋</div><div class="m"><b>${o.numero} · ${brl0(o.total)}</b><span>${PACKS[o.buffet]||'Buffet externo'} · ${o.convidados||0} conv. · ${dt(o.criado.slice(0,10))}</span></div><span class="tag ${o.status==='aprovado'?'t-ok':o.status==='recusado'?'t-bad':'t-gold'}">${STATUS_ORC[o.status]}</span></div>`).join(''):'<div class="empty" style="padding:12px">Sem orçamentos</div>'}
    ${evs.length?evs.map(e=>`<div class="item"><div class="ico">🎉</div><div class="m"><b>${dt(e.data)} · ${brl0(e.valorTotal||0)}</b><span>${e.tipo||''} · ${e.convidados||0} conv.</span></div><span class="tag ${e.status==='confirmado'?'t-ok':'t-warn'}">${STATUS_EV[e.status]}</span></div>`).join(''):'<div class="empty" style="padding:12px">Sem eventos</div>'}
    ${lanc.length?lanc.map(l=>`<div class="item"><div class="ico">${l.tipo==='entrada'?'💰':'💳'}</div><div class="m"><b>${brl(l.valor)}</b><span>${l.desc||''}</span></div><span class="tag ${l.pago?'t-ok':'t-warn'}">${l.pago?'pago':'em aberto'}</span></div>`).join(''):''}
  </div>
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Fechar</button>
    <button class="btn s" onclick="modalOrcamento('${c.id}')">＋ Orçamento</button>
    <button class="btn p" onclick="salvarFicha('${c.id}')">Salvar</button>
  </div>`);
}
function salvarFicha(id){
  const c=DB.clientes.find(x=>x.id===id); if(!c) return;
  c.telefone=$('#fcTel').value.trim(); c.email=$('#fcEmail').value.trim();
  c.funil=$('#fcFunil').value; c.obs=$('#fcObs').value.trim();
  salvar(); fecharModal(); render();
}
function modalCliente(editId){
  const c=editId?DB.clientes.find(x=>x.id===editId):null;
  modal(`
  <h3>${c?'Editar cliente':'Novo cliente'}</h3>
  <div class="frow">
    <div><label>Nome *</label><input id="mCliNome" value="${esc(c?.nome||'')}" placeholder="Nome do cliente"></div>
    <div><label>Telefone / WhatsApp</label><input id="mCliTel" value="${esc(c?.telefone||'')}" placeholder="(96) 9..."></div>
  </div>
  <div class="frow">
    <div><label>E-mail</label><input id="mCliEmail" value="${esc(c?.email||'')}" placeholder="email@exemplo.com"></div>
    <div><label>Origem do contato</label><select id="mCliOrigem">${ORIGENS.map(o=>`<option ${c?.origem===o?'selected':''}>${o}</option>`).join('')}</select></div>
  </div>
  <label>Etapa do funil</label>
  <select id="mCliFunil">${FUNIL.map(f=>`<option ${c?.funil===f?'selected':''}>${f}</option>`).join('')}</select>
  <label>Observações</label>
  <textarea id="mCliObs" rows="2" placeholder="Tipo de festa pretendida, data desejada, observações..."></textarea>
  <div class="macts">
    ${c?`<button class="btn d sm" onclick="excluirCliente('${c.id}')">Excluir</button>`:''}
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarCliente(${c?"'"+c.id+"'":'null'})">Salvar cliente</button>
  </div>`);
}
function salvarCliente(editId){
  const nome=$('#mCliNome').value.trim();
  if(!nome){ alert('Informe o nome do cliente.'); return; }
  const dados={ nome, telefone:$('#mCliTel').value.trim(), email:$('#mCliEmail').value.trim(),
    origem:$('#mCliOrigem').value, funil:$('#mCliFunil').value, obs:$('#mCliObs').value.trim() };
  if(editId){ Object.assign(DB.clientes.find(c=>c.id===editId), dados); }
  else{ DB.clientes.push({ id:uid(), criado:new Date().toISOString(), ...dados }); }
  salvar(); fecharModal(); render();
}
function excluirCliente(id){
  if(!confirm('Excluir este cliente? Orçamentos e eventos dele ficam órfãos.')) return;
  DB.clientes=DB.clientes.filter(c=>c.id!==id); salvar(); fecharModal(); render();
}

/* ============================================================
   ORÇAMENTOS
   ============================================================ */