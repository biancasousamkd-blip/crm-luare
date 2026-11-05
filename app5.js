/* ============================================================
   CRM LUARE EVENTOS — app5
   Módulos novos: Custos fixos e variáveis · Equipe (escala) e
   Fornecedores externos contratados pela LUARE.
   Carregado DEPOIS de app1/app2 e ANTES de app3 (que dispara
   o primeiro render ao iniciar a sessão).
   ============================================================ */

/* ---------- CUSTOS FIXOS E VARIÁVEIS ---------- */
function actsCustos(){
  $('#pgActs').innerHTML=`<button class="btn s" onclick="lancarCustosMes()">📤 Lançar no financeiro</button>
  <button class="btn p" onclick="modalCusto()">＋ Novo custo</button>`;
}

function custosAtivos(){ return (DB.custos||[]).filter(c=>c.ativo!==false); }
function totalCusto(tipo){ return soma(custosAtivos().filter(c=>(c.tipo||'fixo')===tipo), c=>parseFloat(c.valor)||0); }

function renderCustos(){
  const lista=[...(DB.custos||[])].sort((a,b)=> (a.tipo||'').localeCompare(b.tipo||'') || (a.nome||'').localeCompare(b.nome||''));
  const fixos=lista.filter(c=>(c.tipo||'fixo')==='fixo');
  const vars=lista.filter(c=>c.tipo==='variavel');
  const m=mesAtual();
  const lancMes=(DB.lancamentos||[]).filter(l=>l.tipo==='saida' && (l.venc||'').slice(0,7)===m);
  const pagoMes=soma(lancMes.filter(l=>l.pago),l=>l.valor);
  const abertoMes=soma(lancMes.filter(l=>!l.pago),l=>l.valor);
  const tf=totalCusto('fixo'), tv=totalCusto('variavel');

  const linha=c=>`<tr>
    <td><b>${esc(c.nome)}</b>${c.obs?'<br><span style="font-size:11.5px;color:var(--mut)">'+esc(c.obs)+'</span>':''}</td>
    <td>${esc(c.categoria||'—')}</td>
    <td>${c.dia_venc?'todo dia '+c.dia_venc:'—'}</td>
    <td class="right"><b>${brl(c.valor)}</b></td>
    <td>${c.ativo===false?'<span class="tag t-mut">inativo</span>':'<span class="tag t-ok">ativo</span>'}</td>
    <td class="right">
      <button class="btn s sm" onclick="modalCusto('${c.id}')">Editar</button>
      <button class="btn s sm" onclick="alternarCusto('${c.id}')">${c.ativo===false?'Ativar':'Pausar'}</button>
    </td></tr>`;

  $('#view-custos').innerHTML=`
  <div class="kpis">
    <div class="kpi"><div class="l">Custo fixo mensal</div><div class="v">${brl0(tf)}</div><div class="x">${fixos.filter(c=>c.ativo!==false).length} conta(s) ativa(s)</div></div>
    <div class="kpi o"><div class="l">Custo variável</div><div class="v">${brl0(tv)}</div><div class="x">referência de ${vars.filter(c=>c.ativo!==false).length} item(ns)</div></div>
    <div class="kpi b"><div class="l">Total de estrutura</div><div class="v">${brl0(tf+tv)}</div><div class="x">fixo + variável</div></div>
    <div class="kpi g"><div class="l">Pago em ${mesNome(m)}</div><div class="v">${brl0(pagoMes)}</div><div class="x">em aberto: ${brl0(abertoMes)}</div></div>
  </div>

  <div class="card">
    <h3>Contas fixas <span style="font-size:12px;color:var(--mut);font-weight:400">aluguel, energia, internet, salários, contador…</span></h3>
    ${fixos.length?`<table><thead><tr><th>Conta</th><th>Categoria</th><th>Vencimento</th><th class="right">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${fixos.map(linha).join('')}</tbody></table>`:'<div class="empty"><span class="big">📉</span>Nenhuma conta fixa cadastrada.<br>Cadastre aluguel, energia, internet e salários para o sistema calcular seu custo real.</div>'}
  </div>

  <div class="card">
    <h3>Custos variáveis <span style="font-size:12px;color:var(--mut);font-weight:400">o que muda conforme o evento</span></h3>
    ${vars.length?`<table><thead><tr><th>Item</th><th>Categoria</th><th>Vencimento</th><th class="right">Valor</th><th>Situação</th><th></th></tr></thead><tbody>${vars.map(linha).join('')}</tbody></table>`:'<div class="empty" style="padding:16px">Nenhum custo variável cadastrado. Exemplos: gás, descartáveis, flor de temporada, frete.</div>'}
  </div>

  <div class="card">
    <h3>Como isso entra no seu resultado</h3>
    <div class="quote-note" style="font-size:13px;line-height:1.85">
      O botão <b>Lançar no financeiro</b> cria uma despesa no mês para cada conta <b>ativa</b> — as fixas sempre, as variáveis com valor de referência.
      A partir daí elas aparecem em Financeiro e no Relatório, e o <b>resultado do mês</b> passa a descontar a estrutura da casa, não só o custo de cada festa.<br>
      Pausar uma conta não apaga o histórico: ela só deixa de ser lançada.
    </div>
  </div>`;
}

function modalCusto(id){
  const c=id?(DB.custos||[]).find(x=>x.id===id):null;
  modal(`<h3>${c?'Editar custo':'Novo custo'}</h3>
  <div class="frow">
    <div><label>Nome da conta *</label><input id="mcNome" value="${esc(c?.nome||'')}" placeholder="Ex.: aluguel do imóvel"></div>
    <div><label>Tipo</label><select id="mcTipo">
      <option value="fixo" ${((c?.tipo)||'fixo')==='fixo'?'selected':''}>Fixo (todo mês)</option>
      <option value="variavel" ${c?.tipo==='variavel'?'selected':''}>Variável</option>
    </select></div>
  </div>
  <div class="frow">
    <div><label>Categoria</label><input id="mcCat" value="${esc(c?.categoria||'')}" placeholder="Estrutura, pessoal, insumos…"></div>
    <div><label>Valor (R$) *</label><input type="number" id="mcValor" step="0.01" value="${c?.valor||''}" placeholder="0,00"></div>
  </div>
  <div class="frow">
    <div><label>Dia do vencimento</label><input type="number" id="mcDia" min="1" max="31" value="${c?.dia_venc||''}" placeholder="Ex.: 10"></div>
    <div><label>Situação</label><select id="mcAtivo">
      <option value="1" ${c?.ativo!==false?'selected':''}>Ativa</option>
      <option value="0" ${c?.ativo===false?'selected':''}>Pausada</option>
    </select></div>
  </div>
  <label>Observações</label><input id="mcObs" value="${esc(c?.obs||'')}" placeholder="Opcional">
  <div class="macts">
    ${c?`<button class="btn d sm" onclick="excluirCusto('${c.id}')">Excluir</button>`:''}
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarCusto(${c?"'"+c.id+"'":'null'})">Salvar</button>
  </div>`);
}

function salvarCusto(id){
  const nome=$('#mcNome').value.trim();
  const valor=parseFloat($('#mcValor').value)||0;
  if(!nome){ alert('Informe o nome da conta.'); return; }
  if(valor<=0){ alert('Informe o valor da conta.'); return; }
  const dados={ nome, tipo:$('#mcTipo').value, categoria:$('#mcCat').value.trim(),
    valor, dia_venc:+$('#mcDia').value||null, ativo:$('#mcAtivo').value==='1',
    obs:$('#mcObs').value.trim() };
  if(id){ Object.assign((DB.custos||[]).find(c=>c.id===id), dados); }
  else{ if(!DB.custos) DB.custos=[]; DB.custos.push({ id:uid(), criado:new Date().toISOString(), ...dados }); }
  salvar(); fecharModal(); render();
}

function excluirCusto(id){
  if(!confirm('Excluir esta conta? Os lançamentos já criados no financeiro continuam lá.')) return;
  DB.custos=(DB.custos||[]).filter(c=>c.id!==id); salvar(); fecharModal(); render();
}

function alternarCusto(id){
  const c=(DB.custos||[]).find(x=>x.id===id); if(!c) return;
  c.ativo = c.ativo===false; salvar(); render();
}

/* Lança no financeiro uma despesa por conta ativa, no mês corrente.
   Evita duplicar: se já existe um lançamento com a mesma descrição e mês, pula. */
function lancarCustosMes(){
  const ativos=custosAtivos();
  if(!ativos.length){ alert('Cadastre ao menos uma conta ativa.'); return; }
  const m=mesAtual();
  const jaTem=desc=>DB.lancamentos.some(l=>l.tipo==='saida' && (l.venc||'').slice(0,7)===m && l.origemCustoId && desc(l));
  let criados=0, pulados=0;
  ativos.forEach(c=>{
    if(jaTem(l=>l.origemCustoId===c.id)){ pulados++; return; }
    const dia=Math.min(Math.max(parseInt(c.dia_venc)||10,1),28);
    DB.lancamentos.push({ id:uid(), tipo:'saida', clienteId:null, eventoId:null,
      desc:(c.nome||'Custo')+(c.tipo==='fixo'?' (fixo)':' (variável)'),
      valor:parseFloat(c.valor)||0, venc:`${m}-${pad(dia)}`,
      pago:false, pagoEm:'', origemCustoId:c.id });
    criados++;
  });
  salvar();
  alert(`${criados} despesa(s) lançada(s) em ${mesNome(m)}.` + (pulados?`\n${pulados} já estava(m) lançada(s) neste mês.`:''));
  ir('financeiro');
}

/* ---------- EQUIPE (ESCALA) E FORNECEDORES ---------- */
function escalaDoEvento(id){ return (DB.escala||[]).filter(x=>x.eventoId===id); }
function fornDoEvento(id){ return (DB.fornecedores||[]).filter(x=>x.eventoId===id); }

function actsEquipe(){
  $('#pgActs').innerHTML=`<button class="btn s" onclick="ir('agenda')">📅 Ver agenda</button>`;
}

function renderEquipe(){
  const evs=[...(DB.eventos||[])].filter(e=>e.status!=='cancelado')
    .sort((a,b)=>(a.data||'').localeCompare(b.data||''));
  const futuros=evs.filter(e=>(e.data||'')>=hoje());
  const todos=[...futuros, ...evs.filter(e=>(e.data||'')<hoje()).reverse()];

  // totais gerais
  const totEscala=soma(DB.escala||[],x=>parseFloat(x.valor)||0);
  const pagoEscala=soma((DB.escala||[]).filter(x=>x.pago),x=>parseFloat(x.valor)||0);
  const totCustoForn=soma(DB.fornecedores||[],x=>parseFloat(x.custo)||0);
  const totRepasse=soma(DB.fornecedores||[],x=>parseFloat(x.repasse)||0);

  const linhaEvento=e=>{
    const escala=escalaDoEvento(e.id);
    const forn=fornDoEvento(e.id);
    const diarias=soma(escala,x=>parseFloat(x.valor)||0);
    const custoF=soma(forn,x=>parseFloat(x.custo)||0);
    const repasse=soma(forn,x=>parseFloat(x.repasse)||0);
    return `<div class="item" style="align-items:flex-start">
      <div class="ico">🎉</div>
      <div class="m" style="flex:1">
        <b>${dt(e.data)} — ${esc(nomeCli(e.clienteId))}</b>
        <span>${esc(e.tipo||'Evento')} · ${e.convidados||0} conv.
        · <b style="color:var(--navy)">${escala.length} na equipe</b>
        · ${forn.length} fornecedor(es)</span>
        <span style="display:block;margin-top:5px;font-size:12px">
          Diárias <b>${brl0(diarias)}</b> ·
          Fornecedores custo <b>${brl0(custoF)}</b> ·
          Repasse do cliente <b>${brl0(repasse)}</b> ·
          <span class="tag ${(repasse-custoF)>=0?'t-ok':'t-bad'}" style="font-size:10.5px">margem ${brl0(repasse-custoF)}</span>
        </span>
      </div>
      <button class="btn p sm" onclick="fichaEscala('${e.id}')">Abrir</button>
    </div>`;
  };

  $('#view-equipe').innerHTML=`
  <div class="kpis">
    <div class="kpi"><div class="l">Diárias na escala</div><div class="v">${brl0(totEscala)}</div><div class="x">pago: ${brl0(pagoEscala)}</div></div>
    <div class="kpi b"><div class="l">Fornecedores (custo)</div><div class="v">${brl0(totCustoForn)}</div><div class="x">o que a LUARE paga</div></div>
    <div class="kpi g"><div class="l">Repasse do contratante</div><div class="v">${brl0(totRepasse)}</div><div class="x">dinheiro que entra para repassar</div></div>
    <div class="kpi o"><div class="l">Margem de repasse</div><div class="v">${brl0(totRepasse-totCustoForn)}</div><div class="x">repasse − custo</div></div>
  </div>

  <div class="card">
    <h3>Escala e fornecedores por evento</h3>
    ${todos.length?todos.slice(0,40).map(linhaEvento).join(''):'<div class="empty"><span class="big">🧑‍🍳</span>Nenhum evento cadastrado ainda.<br>Crie um orçamento aprovado para montar a escala.</div>'}
    ${todos.length>40?`<div class="quote-note">Mostrando os 40 eventos mais próximos de ${todos.length}.</div>`:''}
  </div>

  <div class="card">
    <h3>Como funciona</h3>
    <div class="quote-note" style="font-size:13px;line-height:1.85">
      <b>Equipe do evento:</b> cada pessoa escalada (freelancer, garçom, monitor) entra com nome, função, telefone e o valor da diária.
      Ao marcar como pago, a LUARE lança a despesa no financeiro.<br>
      <b>Fornecedores externos:</b> são contratados pela LUARE, mas o dinheiro vem do contratante.
      Você registra dois números — <b>custo</b> (o que pagamos) e <b>repasse</b> (o que o cliente paga para cobrir) — e o sistema mostra a margem.
    </div>
  </div>`;
}

function fichaEscala(eventoId){
  const e=DB.eventos.find(x=>x.id===eventoId); if(!e) return;
  const escala=escalaDoEvento(eventoId);
  const forn=fornDoEvento(eventoId);
  const diarias=soma(escala,x=>parseFloat(x.valor)||0);
  const custoF=soma(forn,x=>parseFloat(x.custo)||0);
  const repasse=soma(forn,x=>parseFloat(x.repasse)||0);

  modal(`
  <h3>${esc(nomeCli(e.clienteId))} — ${dt(e.data)}</h3>
  <div style="font-size:12.5px;color:var(--mut);margin-bottom:10px">${esc(e.tipo||'Evento')} · ${e.convidados||0} convidados · ${brl0(e.valorTotal||0)}</div>

  <h3 style="color:var(--navy);font-size:14px;margin-top:6px">Equipe do evento <span style="font-size:11.5px;color:var(--mut);font-weight:400">— ${escala.length} pessoa(s) · ${brl0(diarias)} em diárias</span></h3>
  ${escala.length?escala.map(x=>`<div class="item">
      <div class="m"><b>${esc(x.nome)}</b><span>${esc(x.funcao||'—')}${x.telefone?' · '+esc(x.telefone):''}${x.obs?' · '+esc(x.obs):''}</span></div>
      <b style="margin-right:8px">${brl(x.valor)}</b>
      <button class="btn ${x.pago?'s':'p'} sm" onclick="pagarEscala('${x.id}','${eventoId}')">${x.pago?'Pago ✓':'Pagar'}</button>
      <button class="btn s sm" onclick="excluirEscala('${x.id}','${eventoId}')">✕</button>
    </div>`).join(''):'<div class="empty" style="padding:12px">Ninguém escalado ainda</div>'}
  <div style="margin:6px 0 14px"><button class="btn s sm" onclick="modalEscala('${eventoId}')">＋ Adicionar pessoa</button></div>

  <h3 style="color:var(--navy);font-size:14px">Fornecedores externos <span style="font-size:11.5px;color:var(--mut);font-weight:400">— ${forn.length} · custo ${brl0(custoF)} · repasse ${brl0(repasse)}</span></h3>
  ${forn.length?forn.map(x=>`<div class="item">
      <div class="m"><b>${esc(x.nome)}</b><span>${esc(x.servico||'—')}${x.telefone?' · '+esc(x.telefone):''}</span></div>
      <span style="font-size:12px;margin-right:8px;text-align:right">custo <b>${brl0(x.custo)}</b><br>repasse <b>${brl0(x.repasse)}</b></span>
      <button class="btn ${x.pago?'s':'p'} sm" onclick="pagarForn('${x.id}','${eventoId}')">${x.pago?'Pago ✓':'Pagar'}</button>
      <button class="btn s sm" onclick="excluirForn('${x.id}','${eventoId}')">✕</button>
    </div>`).join(''):'<div class="empty" style="padding:12px">Nenhum fornecedor neste evento</div>'}
  <div style="margin:6px 0 12px"><button class="btn s sm" onclick="modalForn('${eventoId}')">＋ Adicionar fornecedor</button></div>

  <div class="quote-note" style="font-size:12.5px">
    Margem de repasse deste evento: <b>${brl(repasse-custoF)}</b><br>
    Custo total da festa (diárias + fornecedores): <b>${brl(diarias+custoF)}</b>
  </div>

  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Fechar</button>
  </div>`);
}

function modalEscala(eventoId){
  modal(`<h3>Adicionar à equipe</h3>
  <div class="frow">
    <div><label>Nome *</label><input id="meNome" placeholder="Nome do freelancer"></div>
    <div><label>Função</label><input id="meFuncao" placeholder="garçom, monitor, DJ…"></div>
  </div>
  <div class="frow">
    <div><label>Telefone</label><input id="meTel" placeholder="(96) 9..."></div>
    <div><label>Valor da diária (R$) *</label><input type="number" id="meValor" step="0.01" placeholder="0,00"></div>
  </div>
  <label>Observações</label><input id="meObs" placeholder="horário de chegada, uniforme…">
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarEscala('${eventoId}')">Adicionar</button>
  </div>`);
}

function salvarEscala(eventoId){
  const nome=$('#meNome').value.trim();
  const valor=parseFloat($('#meValor').value)||0;
  if(!nome){ alert('Informe o nome.'); return; }
  if(!DB.escala) DB.escala=[];
  DB.escala.push({ id:uid(), eventoId, nome, funcao:$('#meFuncao').value.trim(),
    telefone:$('#meTel').value.trim(), valor, pago:false, pagoEm:'',
    obs:$('#meObs').value.trim(), criado:new Date().toISOString() });
  salvar(); fecharModal();
  setTimeout(()=>fichaEscala(eventoId),200);
}

function pagarEscala(id, eventoId){
  const x=(DB.escala||[]).find(y=>y.id===id); if(!x) return;
  x.pago=!x.pago; x.pagoEm=x.pago?hoje():'';
  if(x.pago && !DB.lancamentos.some(l=>l.origemEscalaId===id)){
    DB.lancamentos.push({ id:uid(), tipo:'saida', clienteId:null, eventoId,
      desc:'Diária — '+(x.nome||'equipe')+(x.funcao?' ('+x.funcao+')':''),
      valor:parseFloat(x.valor)||0, venc:hoje(), pago:true, pagoEm:hoje(), origemEscalaId:id });
  }
  if(!x.pago){
    DB.lancamentos=DB.lancamentos.filter(l=>l.origemEscalaId!==id);
  }
  salvar(); fecharModal();
  setTimeout(()=>fichaEscala(eventoId),200);
}

function excluirEscala(id, eventoId){
  if(!confirm('Remover esta pessoa da escala?')) return;
  DB.escala=(DB.escala||[]).filter(x=>x.id!==id);
  DB.lancamentos=DB.lancamentos.filter(l=>l.origemEscalaId!==id);
  salvar(); fecharModal();
  setTimeout(()=>fichaEscala(eventoId),200);
}

function modalForn(eventoId){
  modal(`<h3>Fornecedor externo</h3>
  <div style="font-size:12.5px;color:var(--mut);margin-bottom:10px">Contratado pela LUARE, pago pelo contratante. Registre os dois valores.</div>
  <div class="frow">
    <div><label>Fornecedor *</label><input id="mfNome" placeholder="Ex.: banda, buffet externo, DJ"></div>
    <div><label>Serviço</label><input id="mfServico" placeholder="som, decoração, fotografia…"></div>
  </div>
  <div class="frow">
    <div><label>Custo para a LUARE (R$)</label><input type="number" id="mfCusto" step="0.01" placeholder="0,00"></div>
    <div><label>Repasse do contratante (R$)</label><input type="number" id="mfRepasse" step="0.01" placeholder="0,00"></div>
  </div>
  <div class="frow">
    <div><label>Telefone</label><input id="mfTel" placeholder="(96) 9..."></div>
    <div><label>Observações</label><input id="mfObs" placeholder="Opcional"></div>
  </div>
  <div class="quote-note" id="mfMargem" style="font-size:12.5px">Margem: —</div>
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarForn('${eventoId}')">Adicionar</button>
  </div>`);
  const upd=()=>{
    const c=parseFloat($('#mfCusto').value)||0, r=parseFloat($('#mfRepasse').value)||0;
    $('#mfMargem').innerHTML=`Margem para a LUARE: <b>${brl(r-c)}</b> (repasse ${brl(r)} − custo ${brl(c)})`;
  };
  ['mfCusto','mfRepasse'].forEach(id=>$('#'+id).addEventListener('input',upd));
  upd();
}

function salvarForn(eventoId){
  const nome=$('#mfNome').value.trim();
  if(!nome){ alert('Informe o nome do fornecedor.'); return; }
  if(!DB.fornecedores) DB.fornecedores=[];
  DB.fornecedores.push({ id:uid(), eventoId, nome,
    servico:$('#mfServico').value.trim(), telefone:$('#mfTel').value.trim(),
    custo:parseFloat($('#mfCusto').value)||0, repasse:parseFloat($('#mfRepasse').value)||0,
    pago:false, recebido:false, obs:$('#mfObs').value.trim(), criado:new Date().toISOString() });
  salvar(); fecharModal();
  setTimeout(()=>fichaEscala(eventoId),200);
}

function pagarForn(id, eventoId){
  const x=(DB.fornecedores||[]).find(y=>y.id===id); if(!x) return;
  x.pago=!x.pago;
  if(x.pago && !DB.lancamentos.some(l=>l.origemFornId===id)){
    DB.lancamentos.push({ id:uid(), tipo:'saida', clienteId:null, eventoId,
      desc:'Fornecedor — '+(x.nome||'')+(x.servico?' ('+x.servico+')':''),
      valor:parseFloat(x.custo)||0, venc:hoje(), pago:true, pagoEm:hoje(), origemFornId:id });
  }
  if(!x.pago) DB.lancamentos=DB.lancamentos.filter(l=>l.origemFornId!==id);
  salvar(); fecharModal();
  setTimeout(()=>fichaEscala(eventoId),200);
}

function excluirForn(id, eventoId){
  if(!confirm('Remover este fornecedor?')) return;
  DB.fornecedores=(DB.fornecedores||[]).filter(x=>x.id!==id);
  DB.lancamentos=DB.lancamentos.filter(l=>l.origemFornId!==id);
  salvar(); fecharModal();
  setTimeout(()=>fichaEscala(eventoId),200);
}

/* ============================================================
   VISITAS AGENDADAS PELO SITE
   ============================================================ */
const VIS_STATUS = { solicitada:'Solicitada', confirmada:'Confirmada', realizada:'Realizada', cancelada:'Cancelada' };

function actsVisitas(){ $('#pgActs').innerHTML=''; }

function renderVisitas(){
  const todas=[...(DB.visitas||[])].sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora));
  const hj=hoje();
  const futuras=todas.filter(v=>v.data>=hj && v.status!=='cancelada');
  const pendentes=todas.filter(v=>v.status==='solicitada' && v.data>=hj);
  const passadas=todas.filter(v=>v.data<hj || v.status==='cancelada' || v.status==='realizada').reverse();

  const linha=v=>{
    const st=v.status||'solicitada';
    const tone={solicitada:'t-warn',confirmada:'t-ok',realizada:'t-mut',cancelada:'t-bad'}[st]||'t-mut';
    const tel=(v.telefone||'').replace(/\D/g,'');
    return `<div class="item" style="align-items:flex-start">
      <div class="ico">🚪</div>
      <div class="m" style="flex:1">
        <b>${dt(v.data)} · ${esc(v.hora)} — ${esc(v.nome)}</b>
        <span>${esc(v.tipoEvento||'tipo não informado')}${v.convidados?' · '+v.convidados+' conv.':''}${v.dataEvento?' · festa em '+dt(v.dataEvento):''}</span>
        ${v.decoracao?`<span style="display:block;font-size:12px">Decoração: ${esc(v.decoracao)}</span>`:''}
        ${v.obs?`<span style="display:block;font-size:12px;color:var(--mut)">"${esc(v.obs)}"</span>`:''}
        <span style="display:block;font-size:12px;margin-top:3px">${esc(v.telefone||'')}${v.email?' · '+esc(v.email):''}${v.comoConheceu?' · veio do '+esc(v.comoConheceu):''}</span>
      </div>
      <span class="tag ${tone}">${VIS_STATUS[st]||st}</span>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${st!=='confirmada'&&st!=='cancelada'?`<button class="btn p sm" onclick="mudarVisita('${v.id}','confirmada')">Confirmar</button>`:''}
        <button class="btn s sm" onclick="viraClienteDaVisita('${v.id}')">→ Cliente</button>
        ${tel?`<a class="btn s sm" style="text-decoration:none;text-align:center" target="_blank" href="https://wa.me/55${tel}?text=${encodeURIComponent('Olá, '+(v.nome||'').split(' ')[0]+'! Confirmando sua visita à LUARE em '+v.data.split('-').reverse().join('/')+' às '+v.hora+'. Até lá!')}">WhatsApp</a>`:''}
        ${st!=='cancelada'?`<button class="btn s sm" onclick="mudarVisita('${v.id}','cancelada')">Cancelar</button>`:''}
      </div>
    </div>`;
  };

  $('#view-visitas').innerHTML=`
  <div class="kpis">
    <div class="kpi g"><div class="l">Visitas futuras</div><div class="v">${futuras.length}</div><div class="x">agendadas pelo site</div></div>
    <div class="kpi o"><div class="l">Aguardando confirmação</div><div class="v">${pendentes.length}</div><div class="x">precisa responder</div></div>
    <div class="kpi"><div class="l">Total recebido</div><div class="v">${todas.length}</div><div class="x">desde o início</div></div>
  </div>

  <div class="card">
    <h3>Próximas visitas</h3>
    ${futuras.length?futuras.map(linha).join(''):'<div class="empty"><span class="big">🚪</span>Nenhuma visita agendada ainda.<br>O calendário fica na seção "Agendar visita" do site.</div>'}
  </div>

  <div class="card">
    <h3>Histórico</h3>
    ${passadas.length?passadas.slice(0,25).map(linha).join(''):'<div class="empty" style="padding:14px">Sem histórico ainda</div>'}
  </div>

  <div class="card">
    <h3>Como funciona</h3>
    <div class="quote-note" style="font-size:13px;line-height:1.85">
      O visitante escolhe dia e horário no site — cada visita reserva <b>1 hora</b> e o horário fica bloqueado para os outros.
      Aqui você confirma, cancela ou transforma em cliente com o botão <b>→ Cliente</b>, que já cadastra o nome e o telefone dele.
      Cancelar libera o horário de volta no site.
    </div>
  </div>`;
}

function mudarVisita(id, status){
  const v=(DB.visitas||[]).find(x=>x.id===id); if(!v) return;
  v.status=status;
  salvar(); render();
}

function viraClienteDaVisita(id){
  const v=(DB.visitas||[]).find(x=>x.id===id); if(!v) return;
  const ja=DB.clientes.find(c=>(c.telefone||'').replace(/\D/g,'')===(v.telefone||'').replace(/\D/g,''));
  if(ja){ alert('Já existe cliente com este telefone: '+ja.nome); return; }
  DB.clientes.push({
    id:uid(), nome:v.nome, telefone:v.telefone||'', email:v.email||'',
    origem:v.comoConheceu||'Site — agendou visita', funil:'Novo contato',
    obs:[v.tipoEvento?'Evento: '+v.tipoEvento:'', v.convidados?v.convidados+' convidados':'',
         v.dataEvento?'Data desejada: '+dt(v.dataEvento):'', v.decoracao?'Decoração: '+v.decoracao:'',
         v.obs?v.obs:''].filter(Boolean).join(' · '),
    criado:new Date().toISOString()
  });
  salvar(); render();
  alert('Cliente cadastrado! Abra Clientes para criar o orçamento.');
}
