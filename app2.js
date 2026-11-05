function actsOrcamentos(){
  $('#pgActs').innerHTML=`<button class="btn s" onclick="exportarCSV('orcamentos')">⬇ CSV</button>
  <button class="btn p" onclick="modalOrcamento()">＋ Novo orçamento</button>`;
}
function renderOrcamentos(){
  const lista=[...DB.orcamentos].sort((a,b)=>(b.criado||'').localeCompare(a.criado||''));
  $('#view-orcamentos').innerHTML=`
  <div class="card">
    <h3>${lista.length} orçamento(s)</h3>
    ${lista.length?`<table><thead><tr><th>Nº</th><th>Cliente</th><th>Pacote</th><th>Data evento</th><th class="right">Valor</th><th>Status</th><th></th></tr></thead><tbody>
    ${lista.map(o=>`<tr>
      <td><b>${o.numero}</b></td>
      <td>${esc(nomeCli(o.clienteId))}</td>
      <td>${o.buffet==='externo'?'Buffet externo':PACKS[o.buffet]}<br><span style="font-size:11.5px;color:var(--mut)">${o.duracao}h · ${o.dia==='fds'?'sex–dom/feriado':'seg–qui'} · ${o.convidados||0} conv.</span></td>
      <td>${dt(o.dataEvento)}</td>
      <td class="right"><b>${brl0(o.total)}</b></td>
      <td><span class="tag ${o.status==='aprovado'?'t-ok':o.status==='recusado'?'t-bad':'t-gold'}">${STATUS_ORC[o.status]}</span><br><span style="font-size:11px;color:var(${o.vistoEm?'var(--ok)':'var(--mut)'})">${o.vistoEm?'👁 visto '+dt(o.vistoEm.slice(0,10)):'não visto'}</span></td>
      <td class="right">
        <button class="btn s sm" onclick="verOrc('${o.id}')">Abrir</button>
        ${o.status==='aprovado'&&!DB.eventos.find(e=>e.orcId===o.id)?`<button class="btn p sm" onclick="aprovarOrc('${o.id}')">Gerar evento</button>`:''}
      </td></tr>`).join('')}
    </tbody></table>`:'<div class="empty"><span class="big">📋</span>Nenhum orçamento ainda. Crie o primeiro e o PDF já sai pronto com a tabela 2027.</div>'}
  </div>`;
}
function modalOrcamento(clienteId){
  if(!DB.clientes.length){ alert('Cadastre um cliente primeiro.'); ir('clientes'); return; }
  const o={ duracao:4, buffet:'miniBar', dia:'semana', convidados:100, extras:[], desconto:0 };
  modal(`
  <h3>Novo orçamento</h3>
  <div class="frow">
    <div><label>Cliente *</label><select id="moCli">${DB.clientes.map(c=>`<option value="${c.id}" ${c.id===clienteId?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div>
    <div><label>Data do evento</label><input type="date" id="moData" min="${hoje()}"></div>
  </div>
  <div class="frow">
    <div><label>Duração</label><select id="moDur"><option value="4">4 horas</option><option value="6">6 horas (casamento)</option></select></div>
    <div><label>Tipo de dia</label><select id="moDia"><option value="semana">Segunda a quinta</option><option value="fds">Sex–dom e feriados</option></select></div>
  </div>
  <div class="frow">
    <div><label>Pacote de buffet</label><select id="moBuffet">
      <option value="miniBar">Mini Jantar + Barracas — R$ 85/pessoa</option>
      <option value="trad">Jantar Tradicional — R$ 85/pessoa</option>
      <option value="tradBar">Tradicional + Barracas — R$ 100/pessoa</option>
      <option value="externo">Buffet externo (só o espaço)</option>
    </select></div>
    <div><label>Convidados</label><input type="number" id="moConv" value="100" min="0" max="300"></div>
  </div>
  <div class="frow">
    <div><label>Extras (R$)</label><input type="number" id="moExtras" value="0" min="0"></div>
    <div><label>Desconto (R$)</label><input type="number" id="moDesc" value="0" min="0"></div>
  </div>

  <label style="margin-top:6px">Serviços contratados à parte</label>
  <div class="quote-note" style="margin:0 0 8px">Decoração, plataforma 360, totem, DJ — o que entra na proposta além do espaço e do buffet.</div>
  <div id="moServList"></div>
  <button class="btn s sm" type="button" onclick="addServico()">＋ Adicionar serviço</button>

  <div class="frow" style="margin-top:14px">
    <div><label>Valor fechado à mão (R$)</label><input type="number" id="moManual" step="0.01" placeholder="deixe vazio para usar a tabela"></div>
    <div><label style="opacity:.75">Usar quando der desconto</label><div class="quote-note" style="margin:8px 0 0">Se preencher, este passa a ser o total da proposta e o desconto aparece na diferença.</div></div>
  </div>

  <label>Observações para o cliente</label>
  <textarea id="moObs" rows="2" placeholder="Ex.: topo de bolo incluso, horário de montagem..."></textarea>
  <div class="card" style="background:#f4f6fb;border:none;margin-top:14px">
    <div class="quote-line"><span>Espaço</span><span id="qEsp">—</span></div>
    <div class="quote-line"><span>Buffet</span><span id="qBuf">—</span></div>
    <div class="quote-line"><span>Serviços à parte</span><span id="qServ">—</span></div>
    <div class="quote-line"><span>Extras − desconto</span><span id="qExt">—</span></div>
    <div class="quote-line"><span>Pela tabela</span><span id="qCalc">—</span></div>
    <div class="quote-line total"><span>TOTAL</span><span id="qTot">—</span></div>
    <div class="quote-note" id="qAviso"></div>
    <div class="quote-note">Reserva com 30% · saldo parcelado (cartão ou PIX parcelado) · quitação até 7 dias antes do evento. Convidado extra: mesmo valor por pessoa, pago após o evento.</div>
  </div>
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarOrc()">Salvar e ver proposta</button>
  </div>`);
  const upd=()=>{ 
    const servicos=[...document.querySelectorAll('#moServList .serv-row')].map(r=>({
      nome:r.querySelector('.serv-nome').value.trim(),
      valor:parseFloat(r.querySelector('.serv-valor').value)||0
    })).filter(s=>s.nome||s.valor);
    const o={duracao:+$('#moDur').value,buffet:$('#moBuffet').value,dia:$('#moDia').value,
      convidados:+$('#moConv').value||0,extras:[{valor:+$('#moExtras').value||0}],
      desconto:+$('#moDesc').value||0, servicos,
      valorManual:parseFloat($('#moManual')?.value)||0};
    const c=calcOrc(o);
    $('#qEsp').textContent=brl0(c.espaco);
    $('#qBuf').textContent=o.buffet==='externo'?'— (externo)':brl0(c.buffetTotal)+' ('+brl0(c.buffetPp)+'/pessoa)';
    $('#qServ').textContent=c.servicosTotal?brl0(c.servicosTotal):'—';
    $('#qExt').textContent=brl0(c.extrasTotal)+' − '+brl0(c.desconto);
    $('#qCalc').textContent=brl0(c.calculado);
    $('#qTot').textContent=brl0(c.total)+(c.aviso?' · ⚠ '+c.aviso:'');
    const av=[];
    if(c.manual>0){
      const dif=c.calculado-c.manual;
      av.push(dif>0?`Valor fechado à mão: ${brl(dif)} abaixo da tabela (${Math.round(dif/c.calculado*100)}%).`
                    :dif<0?`Valor fechado à mão: ${brl(-dif)} ACIMA da tabela.`:'Valor igual ao da tabela.');
    }
    $('#qAviso').textContent=av.join(' ');
  };
  ['moDur','moBuffet','moDia','moConv','moDesc','moExtras','moManual'].forEach(id=>{const el=$('#'+id); if(el) el.addEventListener('input',upd);});
  $('#moServList').addEventListener('input',upd);
  upd();
}

/* linha de serviço no formulário de orçamento */
function addServico(nome,valor){
  const box=document.getElementById('moServList'); if(!box) return;
  const div=document.createElement('div');
  div.className='frow serv-row';
  div.style.marginBottom='6px';
  div.innerHTML=`<div><input class="serv-nome" placeholder="Decoração, plataforma 360, totem…" value="${esc(nome||'')}"></div>
    <div style="display:flex;gap:6px;align-items:center">
      <input class="serv-valor" type="number" step="0.01" placeholder="0,00" value="${valor||''}" style="flex:1">
      <button class="btn s sm" type="button" onclick="this.closest('.serv-row').remove();document.getElementById('moServList').dispatchEvent(new Event('input'))">✕</button>
    </div>`;
  box.appendChild(div);
  box.dispatchEvent(new Event('input'));
}
function salvarOrc(){
  const servicos=[...document.querySelectorAll('#moServList .serv-row')].map(r=>({
    nome:r.querySelector('.serv-nome').value.trim(),
    valor:parseFloat(r.querySelector('.serv-valor').value)||0
  })).filter(s=>s.nome||s.valor);
  const o={
    id:uid(), numero:numOrc(), criado:new Date().toISOString(),
    clienteId:$('#moCli').value, dataEvento:$('#moData').value||'',
    duracao:+$('#moDur').value, buffet:$('#moBuffet').value, dia:$('#moDia').value,
    convidados:+$('#moConv').value||0, desconto:+$('#moDesc').value||0,
    extras: (+$('#moExtras').value>0? [{nome:'Extra',valor:+$('#moExtras').value}]:[]),
    servicos,
    valorManual: parseFloat($('#moManual')?.value)||0,
    obs:$('#moObs').value.trim(),
    status:'novo', vistoEm:null
  };
  const c=calcOrc(o); o.total=c.total;
  o.det={espaco:c.espaco,buffetPp:c.buffetPp,buffetTotal:c.buffetTotal,base:c.base,
         extrasTotal:c.extrasTotal,servicosTotal:c.servicosTotal,
         calculado:c.calculado,descontoEfetivo:c.descontoEfetivo};
  DB.orcamentos.push(o);
  // atualiza funil do cliente
  const cli=DB.clientes.find(x=>x.id===o.clienteId);
  if(cli && (cli.funil==='Novo contato'||!cli.funil)) cli.funil='Orçamento enviado';
  salvar(); fecharModal();
  verOrc(o.id);
}
function verOrc(id){
  const o=DB.orcamentos.find(x=>x.id===id); if(!o) return;
  const c=calcOrc(o);
  modal(`
  <h3>${o.numero} · ${esc(nomeCli(o.clienteId))}</h3>
  <div style="font-size:13px;color:var(--mut)">Evento em ${dt(o.dataEvento)} · ${o.duracao}h · ${o.dia==='fds'?'sex–dom/feriado':'seg–qui'} · ${o.convidados} convidados</div>
  <div style="margin-top:14px">
    <div class="quote-line"><span>Espaço (${o.duracao}h)</span><span>${brl0(c.espaco)}</span></div>
    ${o.buffet!=='externo'?`<div class="quote-line"><span>Buffet ${PACKS[o.buffet]} — ${o.convidados} × ${brl0(c.buffetPp)}</span><span>${brl0(c.buffetTotal)}</span></div>`:'<div class="quote-line"><span>Buffet externo (por conta do cliente)</span><span>—</span></div>'}
    ${(c.servicos||[]).map(sv=>`<div class="quote-line"><span>${esc(sv.nome||'Serviço')}</span><span>${brl0(parseFloat(sv.valor)||0)}</span></div>`).join('')}
    ${c.extrasTotal?`<div class="quote-line"><span>Extras</span><span>${brl0(c.extrasTotal)}</span></div>`:''}
    ${c.desconto?`<div class="quote-line"><span>Desconto</span><span>− ${brl0(c.desconto)}</span></div>`:''}
    ${c.manual>0?`<div class="quote-line"><span>Valor pela tabela</span><span>${brl0(c.calculado)}</span></div>`:''}
    <div class="quote-line total"><span>TOTAL</span><span>${brl0(c.total)}</span></div>
    ${c.manual>0&&c.calculado>c.manual?`<div class="quote-note">Desconto concedido: <b>${brl(c.calculado-c.manual)}</b> (${Math.round((c.calculado-c.manual)/c.calculado*100)}% abaixo da tabela)</div>`:''}
    <div class="quote-note">Reserva: 30% (${brl0(c.total*0.3)}) · Saldo 70% parcelado · Quitação até 7 dias antes. Extra no dia: ${o.buffet!=='externo'?brl0(c.buffetPp):'a combinar'}/pessoa, pago após o evento.</div>
  </div>
  ${o.obs?`<label>Observações</label><textarea rows="2" readonly>${esc(o.obs)}</textarea>`:''}
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Fechar</button>
    <button class="btn s" onclick="imprimirOrc('${o.id}')">🖨 Imprimir / PDF</button>
    ${o.status!=='aprovado'?`<button class="btn p" onclick="aprovarOrc('${o.id}')">✓ Aprovar → evento</button>`:DB.eventos.find(e=>e.orcId===o.id)?'<span class="tag t-ok" style="align-self:center">Evento criado</span>':''}
  </div>`);
  if(o.status==='novo'){ o.status='enviado'; salvar(); nav(); }
}
function aprovarOrc(id){
  const o=DB.orcamentos.find(x=>x.id===id); if(!o) return;
  if(DB.eventos.find(e=>e.orcId===id)){ alert('Já existe evento para este orçamento.'); return; }
  const ev={
    id:uid(), orcId:id, clienteId:o.clienteId, tipo:PACKS[o.buffet]||'Buffet externo',
    data:o.dataEvento||'', hora:'', convidados:o.convidados, duracao:o.duracao, dia:o.dia, buffet:o.buffet,
    valorTotal:o.total, status:'reservado', obs:o.obs||'', criado:new Date().toISOString()
  };
  DB.eventos.push(ev);
  // lançamentos: sinal 30% + saldo 70%
  const sinal=Math.round(o.total*0.3);
  DB.lancamentos.push({ id:uid(), tipo:'entrada', clienteId:o.clienteId, eventoId:ev.id, desc:'Sinal 30% — '+o.numero, valor:sinal, venc:o.dataEvento? addDias(o.dataEvento,-7):'', pago:false });
  DB.lancamentos.push({ id:uid(), tipo:'entrada', clienteId:o.clienteId, eventoId:ev.id, desc:'Saldo 70% — '+o.numero, valor:o.total-sinal, venc:o.dataEvento? addDias(o.dataEvento,-7):'', pago:false });
  // funil
  const cli=DB.clientes.find(x=>x.id===o.clienteId);
  if(cli) cli.funil='Fechado';
  salvar(); fecharModal(); ir('agenda');
}
function addDias(dstr,n){ const d=new Date(dstr+'T12:00:00'); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function imprimirOrc(id){
  const o=DB.orcamentos.find(x=>x.id===id); if(!o) return;
  const c=calcOrc(o);
  const cli=DB.clientes.find(x=>x.id===o.clienteId);
  $('#printArea').innerHTML=`
  <div class="ph"><h1>LUARE EVENTOS</h1><div class="sl">Porque celebrar importa</div></div>
  <p style="font-size:13px">Proposta nº <b>${o.numero}</b> — ${new Date().toLocaleDateString('pt-BR')}<br>
  Cliente: <b>${esc(cli?cli.nome:'—')}</b>${cli&&cli.telefone?' · '+esc(cli.telefone):''}<br>
  Evento: ${dt(o.dataEvento)} · ${o.duracao}h · ${o.convidados} convidados</p>
  <table><tr><th>Descrição</th><th>Valor</th></tr>
  <tr><td>Espaço (${o.duracao}h${o.buffet==='externo'?', buffet externo':''})</td><td>${brl0(c.espaco)}</td></tr>
  ${o.buffet!=='externo'?`<tr><td>Buffet ${PACKS[o.buffet]} — ${o.convidados} convidados × ${brl0(c.buffetPp)}</td><td>${brl0(c.buffetTotal)}</td></tr>`:''}
  ${(c.servicos||[]).map(sv=>`<tr><td>${esc(sv.nome||'Serviço')}</td><td>${brl0(parseFloat(sv.valor)||0)}</td></tr>`).join('')}
  ${c.extrasTotal?`<tr><td>Extras</td><td>${brl0(c.extrasTotal)}</td></tr>`:''}
  ${c.desconto?`<tr><td>Desconto</td><td>− ${brl0(c.desconto)}</td></tr>`:''}
  <tr><td><b>TOTAL</b></td><td><b>${brl0(c.total)}</b></td></tr>
  </table>
  <div class="cond"><b>Reserva:</b> 30% na assinatura (${brl0(c.total*0.3)}).<br>
  <b>Saldo:</b> parcelado no cartão ou PIX parcelado (data a combinar).<br>
  <b>Quitação:</b> 100% até 7 dias antes do evento.<br>
  <b>Convidados extras:</b> mesmo valor por pessoa do buffet escolhido, pago após o evento.<br>
  ${o.obs?esc(o.obs)+'<br>':''}</div>
  <div class="ft">Porque celebrar importa · LUARE EVENTOS · Santana/AP</div>`;
  window.print();
}

/* ============================================================
   AGENDA
   ============================================================ */
function actsAgenda(){
  $('#pgActs').innerHTML=`<button class="btn s" onclick="ir('orcamentos')">📋 Orçamentos</button>
  <button class="btn p" onclick="modalEvento()">＋ Evento avulso</button>`;
}
function renderAgenda(){
  const agora=new Date(); const y=calRef.getFullYear(), m=calRef.getMonth();
  const primeiro=new Date(y,m,1); const inicio=(primeiro.getDay()+6)%7; // seg=0
  const dias=new Date(y,m+1,0).getDate();
  const hojeS=hoje();
  const evs=DB.eventos.filter(e=>e.status!=='cancelado');
  let celulas='';
  for(let i=0;i<inicio;i++) celulas+='<div class="dd out"></div>';
  for(let d=1;d<=dias;d++){
    const ds=`${y}-${pad(m+1)}-${pad(d)}`;
    const doDia=evs.filter(e=>e.data===ds);
    const cls=[ 'dd', ds===hojeS?'today':'', doDia.length?'ho':'' ].join(' ');
    celulas+=`<div class="${cls}" onclick="diaAgenda('${ds}')"><div class="dnum">${d}</div>
      ${doDia.slice(0,2).map(e=>`<div class="ev ${e.status==='confirmado'?'r':e.status==='realizado'?'c':'p'}" title="${esc(nomeCli(e.clienteId))}">${e.hora?e.hora+' ':''}${esc(nomeCli(e.clienteId))}</div>`).join('')}
      ${doDia.length>2?`<div class="ev c">+${doDia.length-2}</div>`:''}</div>`;
  }
  const evMes=evs.filter(e=>(e.data||'').slice(0,7)===`${y}-${pad(m+1)}`).sort((a,b)=>a.data.localeCompare(b.data));
  $('#view-agenda').innerHTML=`
  <div class="card">
    <h3><span>
      <button class="btn s sm" onclick="mudarMes(-1)">‹</button>
      ${MESES[m].charAt(0).toUpperCase()+MESES[m].slice(1)} ${y}
      <button class="btn s sm" onclick="mudarMes(1)">›</button>
      <button class="btn s sm" onclick="calRef=new Date();renderAgenda()">Hoje</button>
    </span><span style="font-size:12px;color:var(--mut);font-weight:400">${evMes.length} evento(s) no mês</span></h3>
    <div class="cal">
      <div class="dh">Seg</div><div class="dh">Ter</div><div class="dh">Qua</div><div class="dh">Qui</div><div class="dh">Sex</div><div class="dh">Sáb</div><div class="dh">Dom</div>
      ${celulas}
    </div>
  </div>
  <div class="card"><h3>Eventos do mês</h3>
    ${evMes.length?evMes.map(e=>linhaEvento(e)).join(''):'<div class="empty"><span class="big">🎉</span>Nenhum evento neste mês. Aproveite para vender!</div>'}
  </div>`;
}
function mudarMes(n){ calRef=new Date(calRef.getFullYear(),calRef.getMonth()+n,1); renderAgenda(); }
function linhaEvento(e){
  const lanc=DB.lancamentos.filter(l=>l.eventoId===e.id&&l.tipo==='entrada');
  const pago=soma(lanc.filter(l=>l.pago),l=>l.valor), tot=e.valorTotal||0;
  const pct=tot?Math.round(pago/tot*100):0;
  return `<div class="item"><div class="ico">🎉</div>
  <div class="m"><b>${dt(e.data)}${e.hora?' · '+e.hora:''} — ${esc(nomeCli(e.clienteId))}</b>
  <span>${e.tipo} · ${e.convidados||0} conv. · ${brl0(tot)} · pago ${pct}%</span></div>
  <span class="tag ${e.status==='confirmado'?'t-ok':e.status==='realizado'?'t-mut':e.status==='cancelado'?'t-bad':'t-warn'}">${STATUS_EV[e.status]}</span>
  <button class="btn s sm" onclick="fichaEvento('${e.id}')">Abrir</button></div>`;
}
function diaAgenda(ds){
  const evs=DB.eventos.filter(e=>e.data===ds&&e.status!=='cancelado');
  modal(`<h3>${dt(ds)}</h3>
  ${evs.length?evs.map(e=>`<div class="item"><div class="ico">🎉</div><div class="m"><b>${esc(nomeCli(e.clienteId))}</b><span>${e.tipo} · ${e.hora||'—'} · ${e.convidados||0} conv.</span></div><button class="btn s sm" onclick="fichaEvento('${e.id}')">Abrir</button></div>`).join(''):'<div class="empty" style="padding:14px">Nenhum evento nesta data — <b>data livre</b> para vender.</div>'}
  <div class="macts"><button class="btn s" onclick="fecharModal()">Fechar</button><button class="btn p" onclick="modalEvento('${ds}')">＋ Reservar esta data</button></div>`);
}
function fichaEvento(id){
  const e=DB.eventos.find(x=>x.id===id); if(!e) return;
  const lanc=DB.lancamentos.filter(l=>l.eventoId===id);
  modal(`
  <h3>${esc(nomeCli(e.clienteId))} — ${dt(e.data)}</h3>
  <div style="font-size:13px;color:var(--mut)">${e.tipo} · ${e.duracao}h · ${e.convidados||0} convidados · ${brl0(e.valorTotal||0)}</div>
  <div class="frow">
    <div><label>Data</label><input type="date" id="feData" value="${e.data||''}"></div>
    <div><label>Hora de início</label><input id="feHora" value="${esc(e.hora||'')}" placeholder="19:00"></div>
  </div>
  <div class="frow">
    <div><label>Convidados</label><input type="number" id="feConv" value="${e.convidados||0}"></div>
    <div><label>Status</label><select id="feStatus">${Object.entries(STATUS_EV).map(([k,v])=>`<option value="${k}" ${e.status===k?'selected':''}>${v}</option>`).join('')}</select></div>
  </div>
  <label>Valor total do evento (R$)</label>
  <input type="number" id="feValor" value="${e.valorTotal||''}" placeholder="0">
  ${(()=>{const pago=soma(lanc.filter(l=>l.pago),l=>l.valor);
          const aberto=soma(lanc.filter(l=>!l.pago),l=>l.valor);
          const tot=e.valorTotal||0;
          const falta=Math.max(tot-pago,0);
          return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 4px;font-size:12.5px">
    <span class="tag t-ok">Pago ${brl(pago)}</span>
    <span class="tag ${aberto>0?'t-warn':'t-ok'}">Em aberto ${brl(aberto)}</span>
    <span class="tag ${falta>0?'t-bad':'t-ok'}">${falta>0?'Falta '+brl(falta):'Quitado ✓'}</span>
  </div>`;})()}
  <label>Pagamentos</label>
  ${lanc.length?lanc.sort((a,b)=>(a.venc||'9').localeCompare(b.venc||'9')).map(l=>`<div class="item"><div class="m"><b>${brl(l.valor)}</b><span>${esc(l.desc)}${l.venc?' · venc. '+dt(l.venc):''}${l.pago&&l.pagoEm?' · pago em '+dt(l.pagoEm):''}</span></div>
    <button class="btn ${l.pago?'s':'p'} sm" onclick="togglePago('${l.id}')">${l.pago?'Pago ✓':'Marcar pago'}</button>
    <button class="btn s sm" onclick="excluirLanc('${l.id}')">✕</button></div>`).join(''):'<div class="empty" style="padding:10px">Sem lançamentos — informe o valor total e salve para gerar as parcelas</div>'}
  <div style="margin-top:8px"><button class="btn s sm" onclick="modalLanc('${e.id}')">＋ Adicionar pagamento avulso</button>
  <button class="btn s sm" onclick="regerarParcelas('${e.id}')">↻ Regerar parcelas (30/70)</button></div>
  <label>Observações</label><textarea id="feObs" rows="2">${esc(e.obs||'')}</textarea>
  <div class="macts">
    <button class="btn d sm" onclick="cancelarEvento('${e.id}')">Cancelar evento</button>
    <button class="btn s" onclick="fecharModal()">Fechar</button>
    <button class="btn p" onclick="salvarEvento('${e.id}')">Salvar</button>
  </div>`);
}
function salvarEvento(id){
  const e=DB.eventos.find(x=>x.id===id); if(!e) return;
  const valorAntigo = e.valorTotal||0;
  e.data=$('#feData').value; e.hora=$('#feHora').value.trim(); e.convidados=+$('#feConv').value||0;
  e.status=$('#feStatus').value; e.obs=$('#feObs').value.trim();
  const campoValor = $('#feValor');
  if (campoValor) e.valorTotal = +campoValor.value || 0;

  // o valor mudou (ou não existia)? acerta as parcelas em aberto
  const semParcelas = DB.lancamentos.filter(l=>l.eventoId===e.id).length === 0;
  if (e.valorTotal > 0 && (e.valorTotal !== valorAntigo || semParcelas)){
    gerarParcelasEvento(e);
  }
  salvar(); fecharModal(); render();
}

function regerarParcelas(id){
  const e=DB.eventos.find(x=>x.id===id); if(!e) return;
  if(!(e.valorTotal>0)){ alert('Informe o valor total do evento primeiro.'); return; }
  const pagas=DB.lancamentos.filter(l=>l.eventoId===id&&l.pago);
  if(pagas.length && !confirm('Já existe pagamento registrado. As parcelas EM ABERTO serão recalculadas descontando o que já foi pago. Continuar?')) return;
  gerarParcelasEvento(e);
  salvar(); fecharModal(); render();
  setTimeout(()=>fichaEvento(id),200);
}
function cancelarEvento(id){
  if(!confirm('Cancelar este evento? A data volta a ficar livre.')) return;
  const e=DB.eventos.find(x=>x.id===id); if(e) e.status='cancelado';
  salvar(); fecharModal(); render();
}
function modalEvento(ds){
  if(!DB.clientes.length){ alert('Cadastre um cliente primeiro.'); ir('clientes'); return; }
  modal(`
  <h3>Evento avulso</h3>
  <div class="frow">
    <div><label>Cliente *</label><select id="meCli">${DB.clientes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
    <div><label>Data *</label><input type="date" id="meData" value="${ds||''}"></div>
  </div>
  <div class="frow">
    <div><label>Hora</label><input id="meHora" placeholder="19:00"></div>
    <div><label>Tipo de festa</label><input id="meTipo" placeholder="Aniversário, casamento..."></div>
  </div>
  <div class="frow">
    <div><label>Convidados</label><input type="number" id="meConv" value="100"></div>
    <div><label>Valor total (R$)</label><input type="number" id="meValor" placeholder="0"></div>
  </div>
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarEventoAvulso()">Salvar evento</button>
  </div>`);
}
function salvarEventoAvulso(){
  const data=$('#meData').value; if(!data){ alert('Informe a data.'); return; }
  const valor=+$('#meValor').value||0;
  const ev={ id:uid(), clienteId:$('#meCli').value, data, hora:$('#meHora').value.trim(),
    tipo:$('#meTipo').value.trim()||'Evento', convidados:+$('#meConv').value||0, duracao:4,
    valorTotal:valor, status:'reservado', obs:'', criado:new Date().toISOString() };
  DB.eventos.push(ev);
  if(valor>0) gerarParcelasEvento(ev);
  salvar(); fecharModal(); render();
  if(!valor){
    setTimeout(()=>alert('Evento criado sem valor.\n\nAbra o evento na Agenda e informe o valor total para o sistema gerar as parcelas (sinal 30% + saldo 70%).'), 120);
  }
}

/* Gera (ou regera) as parcelas de um evento: sinal 30% + saldo 70%.
   Usado ao criar o evento e ao corrigir o valor depois. */
function gerarParcelasEvento(ev){
  const venc = ev.data ? addDias(ev.data,-7) : '';
  // não mexe em parcelas que já foram pagas
  const existentes = DB.lancamentos.filter(l=>l.eventoId===ev.id && l.tipo==='entrada');
  const pagas = existentes.filter(l=>l.pago);
  const totalPago = soma(pagas,l=>l.valor);
  // remove as em aberto (serão recriadas com o valor certo)
  DB.lancamentos = DB.lancamentos.filter(l=>!(l.eventoId===ev.id && l.tipo==='entrada' && !l.pago));
  const restante = Math.max((ev.valorTotal||0) - totalPago, 0);
  if(restante <= 0) return totalPago;
  const sinal = Math.round(restante*0.3);
  DB.lancamentos.push({ id:uid(), tipo:'entrada', clienteId:ev.clienteId, eventoId:ev.id,
    desc:'Sinal 30%'+(pagas.length?' (ajuste)':''), valor:sinal, venc, pago:false });
  DB.lancamentos.push({ id:uid(), tipo:'entrada', clienteId:ev.clienteId, eventoId:ev.id,
    desc:'Saldo 70%'+(pagas.length?' (ajuste)':''), valor:restante-sinal, venc, pago:false });
  return totalPago;
}

/* ============================================================
   FINANCEIRO
   ============================================================ */
function actsFinanceiro(){
  $('#pgActs').innerHTML=`<button class="btn s" onclick="exportarCSV('lancamentos')">⬇ CSV</button>
  <button class="btn s" onclick="ir('custos')">📉 Custos fixos e variáveis</button>
  <button class="btn p" onclick="modalLanc()">＋ Lançamento</button>`;
}
function renderFinanceiro(){
  const m=mesAtual();
  const lmes=DB.lancamentos.filter(l=>(l.venc||'').slice(0,7)===m || (l.pagoEm||'').slice(0,7)===m);
  const ent=soma(DB.lancamentos.filter(l=>l.tipo==='entrada'&&l.pago),l=>l.valor);
  const sai=soma(DB.lancamentos.filter(l=>l.tipo==='saida'&&l.pago),l=>l.valor);
  const abertas=DB.lancamentos.filter(l=>!l.pago).sort((a,b)=>(a.venc||'9999').localeCompare(b.venc||'9999'));
  const pagas=[...DB.lancamentos].filter(l=>l.pago).sort((a,b)=>(b.pagoEm||'').localeCompare(a.pagoEm||'')).slice(0,10);
  $('#view-financeiro').innerHTML=`
  <div class="kpis">
    <div class="kpi g"><div class="l">Recebido (total)</div><div class="v">${brl0(ent)}</div></div>
    <div class="kpi b"><div class="l">Pago em despesas</div><div class="v">${brl0(sai)}</div></div>
    <div class="kpi o"><div class="l">Em aberto</div><div class="v">${brl0(soma(abertas,l=>l.valor))}</div><div class="x">${abertas.length} parcela(s)</div></div>
    <div class="kpi"><div class="l">Resultado</div><div class="v">${brl0(ent-sai)}</div><div class="x">entradas − despesas pagas</div></div>
  </div>
  <div class="card"><h3>Custos da operação <button class="btn s sm" onclick="ir('custos')">gerenciar</button></h3>
    <div class="kpis" style="margin-top:4px">
      <div class="kpi"><div class="l">Fixo mensal</div><div class="v">${brl0(typeof totalCusto==='function'?totalCusto('fixo'):0)}</div></div>
      <div class="kpi o"><div class="l">Variável</div><div class="v">${brl0(typeof totalCusto==='function'?totalCusto('variavel'):0)}</div></div>
      <div class="kpi b"><div class="l">Estrutura total</div><div class="v">${brl0(typeof totalCusto==='function'?totalCusto('fixo')+totalCusto('variavel'):0)}</div></div>
    </div>
    <div class="quote-note">Contas fixas (aluguel, energia, internet, salários) e variáveis (gás, insumos, frete). Lance no mês com um clique em <b>Custos</b>.</div>
  </div>

  <div class="card"><h3>Parcelas em aberto</h3>
    ${abertas.length?`<table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Cliente</th><th class="right">Valor</th><th></th></tr></thead><tbody>
    ${abertas.map(l=>`<tr><td>${dt(l.venc)}${l.venc&&l.venc<hoje()?' <span class="tag t-bad">atrasada</span>':''}</td>
      <td>${esc(l.desc)}</td><td>${esc(nomeCli(l.clienteId))}</td>
      <td class="right"><b>${brl(l.valor)}</b></td>
      <td class="right"><button class="btn p sm" onclick="togglePago('${l.id}')">Marcar pago</button>
      <button class="btn s sm" onclick="excluirLanc('${l.id}')">✕</button></td></tr>`).join('')}
    </tbody></table>`:'<div class="empty"><span class="big">✅</span>Nenhuma parcela em aberto</div>'}
  </div>
  <div class="card"><h3>Últimos pagamentos</h3>
    ${pagas.length?`<table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th class="right">Valor</th></tr></thead><tbody>
    ${pagas.map(l=>`<tr><td>${dt(l.pagoEm)}</td><td>${esc(l.desc)}</td>
      <td><span class="tag ${l.tipo==='entrada'?'t-ok':'t-bad'}">${l.tipo==='entrada'?'recebimento':'despesa'}</span></td>
      <td class="right">${brl(l.valor)}</td></tr>`).join('')}
    </tbody></table>`:'<div class="empty" style="padding:14px">Sem pagamentos registrados ainda</div>'}
  </div>`;
}