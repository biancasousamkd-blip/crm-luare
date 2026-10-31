function togglePago(id){
  const l=DB.lancamentos.find(x=>x.id===id); if(!l) return;
  l.pago=!l.pago; l.pagoEm=l.pago?hoje():null;
  salvar(); fecharModal(); render();
}
function excluirLanc(id){
  if(!confirm('Excluir este lançamento?')) return;
  DB.lancamentos=DB.lancamentos.filter(l=>l.id!==id); salvar(); render();
}
function modalLanc(){
  modal(`
  <h3>Novo lançamento</h3>
  <div class="frow">
    <div><label>Tipo</label><select id="mlTipo"><option value="entrada">Recebimento</option><option value="saida">Despesa</option></select></div>
    <div><label>Valor (R$) *</label><input type="number" id="mlValor" placeholder="0,00"></div>
  </div>
  <div class="frow">
    <div><label>Vencimento</label><input type="date" id="mlVenc"></div>
    <div><label>Cliente (opcional)</label><select id="mlCli"><option value="">—</option>${DB.clientes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
  </div>
  <label>Descrição</label><input id="mlDesc" placeholder="Ex.: decoração, dj, aluguel de cadeiras...">
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarLanc()">Salvar</button>
  </div>`);
}
function salvarLanc(){
  const v=parseFloat($('#mlValor').value);
  if(!v){ alert('Informe o valor.'); return; }
  DB.lancamentos.push({ id:uid(), tipo:$('#mlTipo').value, valor:v, venc:$('#mlVenc').value||'',
    clienteId:$('#mlCli').value||null, desc:$('#mlDesc').value.trim()||( $('#mlTipo').value==='entrada'?'Recebimento':'Despesa'), pago:false });
  salvar(); fecharModal(); render();
}

/* ============================================================
   FOLLOW-UPS
   ============================================================ */
function followPendentes(){
  const out=[]; const hj=hoje();
  // 1. orçamentos enviados sem resposta há 4+ dias
  DB.orcamentos.filter(o=>o.status==='enviado').forEach(o=>{
    const dias=Math.floor((new Date(hj)-new Date((o.vistoEm||o.criado).slice(0,10)))/86400000);
    if(dias>=4) out.push({ ic:'📋', tipo:'Orçamento', tone:'t-warn', titulo:`${o.numero} sem resposta há ${dias} dias`,
      desc:`${nomeCli(o.clienteId)} · ${brl0(o.total)} — vale um toque no WhatsApp`, acao:`fichaCliente('${o.clienteId}')` });
  });
  // 2. parcelas vencidas
  DB.lancamentos.filter(l=>!l.pago&&l.tipo==='entrada'&&l.venc&&l.venc<hj).forEach(l=>{
    out.push({ ic:'💰', tipo:'Pagamento', tone:'t-bad', titulo:`Parcela vencida em ${dt(l.venc)}`,
      desc:`${nomeCli(l.clienteId)} · ${brl(l.valor)} · ${l.desc}`, acao:`togglePago('${l.id}')` });
  });
  // 3. quitação a 7 dias do evento
  DB.eventos.filter(e=>e.status==='reservado'||e.status==='confirmado').forEach(e=>{
    if(!e.data) return;
    const faltam=Math.ceil((new Date(e.data)-new Date(hj))/86400000);
    if(faltam>=0&&faltam<=7){
      const aberto=soma(DB.lancamentos.filter(l=>l.eventoId===e.id&&!l.pago),l=>l.valor);
      if(aberto>0) out.push({ ic:'⚠', tipo:'Quitação', tone:'t-warn', titulo:`Evento em ${faltam} dia(s) com ${brl0(aberto)} em aberto`,
        desc:`${nomeCli(e.clienteId)} · quitação até 7 dias antes`, acao:`fichaEvento('${e.id}')` });
      if(!e.confirmado) out.push({ ic:'📞', tipo:'Confirmar', tone:'t-gold', titulo:`Confirmar detalhes do evento em ${faltam} dia(s)`,
        desc:`${nomeCli(e.clienteId)} · ${e.convidados||0} conv. · horário`, acao:`fichaEvento('${e.id}')` });
    }
  });
  // 4. pós-evento (3 dias depois)
  DB.eventos.filter(e=>e.status==='realizado').forEach(e=>{
    if(!e.data) return;
    const passou=Math.floor((new Date(hj)-new Date(e.data))/86400000);
    if(passou>=3&&passou<=10&&!e.posContato) out.push({ ic:'💌', tipo:'Pós-evento', tone:'t-navy', titulo:`Enviar mensagem de pós-evento`,
      desc:`${nomeCli(e.clienteId)} · evento foi em ${dt(e.data)} — pedir fotos e avaliação`, acao:`posContato('${e.id}')` });
  });
  return out;
}
function actsFollow(){ $('#pgActs').innerHTML=''; }
function renderFollowups(){
  const fu=followPendentes();
  $('#view-followups').innerHTML=`
  <div class="card"><h3>${fu.length} pendência(s)</h3>
  ${fu.length?fu.map(f=>`<div class="item"><div class="ico">${f.ic}</div>
    <div class="m"><b>${esc(f.titulo)}</b><span>${esc(f.desc)}</span></div>
    <span class="tag ${f.tone}">${f.tipo}</span>
    <button class="btn s sm" onclick="${f.acao}">Resolver</button></div>`).join(''):'<div class="empty"><span class="big">✅</span>Tudo em dia! Nenhuma cobrança pendente.</div>'}
  </div>
  <div class="card"><h3>Como o follow-up automático funciona</h3>
    <div class="quote-note" style="font-size:13px;line-height:1.8">
    • Orçamento enviado sem resposta por <b>4 dias ou mais</b> → aparece aqui para você dar um toque.<br>
    • Parcela vencida → alerta vermelho no dia seguinte ao vencimento.<br>
    • Evento a <b>7 dias</b> com saldo em aberto → lembrete de quitação (regra do contrato).<br>
    • 3 a 10 dias após o evento → sugestão de mensagem de pós-evento (fotos + avaliação).
    </div>
  </div>`;
}
function posContato(id){
  const e=DB.eventos.find(x=>x.id===id); if(!e) return;
  e.posContato=true; salvar(); render();
  const c=DB.clientes.find(x=>x.id===e.clienteId);
  const tel=(c?.telefone||'').replace(/\D/g,'');
  modal(`<h3>Mensagem de pós-evento</h3>
  <p style="font-size:13.5px;line-height:1.7">Oi, ${esc((c?.nome||'').split(' ')[0])}! 💛 Passando para agradecer a confiança na LUARE. Esperamos que a festa tenha sido tudo o que você sonhou! Se puder, nos marque nas fotos e conte como foi sua experiência — adoram saber. Até a próxima celebração! ✨</p>
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Fechar</button>
    ${tel?`<a class="btn p" style="text-decoration:none" target="_blank" href="https://wa.me/55${tel}?text=${encodeURIComponent('Oi, '+((c?.nome||'').split(' ')[0])+'! 💛 Passando para agradecer a confiança na LUARE. Esperamos que a festa tenha sido tudo o que você sonhou! Se puder, nos marque nas fotos e conte como foi sua experiência — adoram saber. Até a próxima celebração! ✨')}">Abrir no WhatsApp</a>`:''}
  </div>`);
}

/* ============================================================
   RELATÓRIO MENSAL
   ============================================================ */
function actsRelatorio(){ $('#pgActs').innerHTML=''; }
function renderRelatorio(){
  const m=$('#relMes')?.value||mesAtual();
  const evs=DB.eventos.filter(e=>(e.data||'').slice(0,7)===m&&e.status!=='cancelado');
  const orcs=DB.orcamentos.filter(o=>(o.criado||'').slice(0,7)===m);
  const ent=soma(DB.lancamentos.filter(l=>l.tipo==='entrada'&&l.pago&&(l.pagoEm||'').slice(0,7)===m),l=>l.valor);
  const sai=soma(DB.lancamentos.filter(l=>l.tipo==='saida'&&l.pago&&(l.pagoEm||'').slice(0,7)===m),l=>l.valor);
  const prev=soma(evs,e=>e.valorTotal||0);
  const novos=DB.clientes.filter(c=>(c.criado||'').slice(0,7)===m).length;
  const aprov=orcs.filter(o=>o.status==='aprovado').length;
  $('#view-relatorio').innerHTML=`
  <div class="card"><h3>Mês de referência
    <input type="month" id="relMes" value="${m}" onchange="renderRelatorio()" style="width:170px">
  </h3>
  <div class="kpis">
    <div class="kpi"><div class="l">Eventos do mês</div><div class="v">${evs.length}</div><div class="x">${brl0(prev)} previstos</div></div>
    <div class="kpi g"><div class="l">Recebido</div><div class="v">${brl0(ent)}</div></div>
    <div class="kpi b"><div class="l">Despesas pagas</div><div class="v">${brl0(sai)}</div></div>
    <div class="kpi"><div class="l">Resultado do mês</div><div class="v">${brl0(ent-sai)}</div></div>
    <div class="kpi"><div class="l">Novos clientes</div><div class="v">${novos}</div></div>
    <div class="kpi"><div class="l">Orçamentos</div><div class="v">${orcs.length}</div><div class="x">${aprov} aprovados</div></div>
  </div></div>
  <div class="card"><h3>Eventos de ${mesNome(m)}</h3>
    ${evs.length?`<table><thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Conv.</th><th class="right">Valor</th><th>Status</th></tr></thead><tbody>
    ${evs.sort((a,b)=>a.data.localeCompare(b.data)).map(e=>`<tr><td>${dt(e.data)}</td><td>${esc(nomeCli(e.clienteId))}</td><td>${esc(e.tipo)}</td><td>${e.convidados||0}</td><td class="right">${brl0(e.valorTotal||0)}</td><td><span class="tag ${e.status==='confirmado'?'t-ok':'t-warn'}">${STATUS_EV[e.status]}</span></td></tr>`).join('')}
    </tbody></table>`:'<div class="empty" style="padding:14px">Sem eventos neste mês</div>'}
  </div>`;
}
function exportarCSV(tipo){
  let linhas=[['Tipo','Descricao','Cliente','Valor','Vencimento','Pago','Data pagamento']];
  if(tipo==='lancamentos'){
    DB.lancamentos.forEach(l=>linhas.push([l.tipo==='entrada'?'Recebimento':'Despesa',l.desc||'',nomeCli(l.clienteId),l.valor,l.venc||'',l.pago?'Sim':'Não',l.pagoEm||'']));
  } else {
    linhas=[['Numero','Cliente','Pacote','Duracao','Dia','Convidados','Data evento','Total','Status']];
    DB.orcamentos.forEach(o=>linhas.push([o.numero,nomeCli(o.clienteId),o.buffet==='externo'?'Buffet externo':PACKS[o.buffet],o.duracao+'h',o.dia,o.convidados,o.dataEvento||'',o.total,o.status]));
  }
  const csv=linhas.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(';')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent('\ufeff'+csv);
  a.download='luare_'+tipo+'_'+hoje()+'.csv'; a.click();
}

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */
function actsConfig(){ $('#pgActs').innerHTML=''; }
function renderConfig(){
  if(USER.role!=='admin'){ return renderMinhaConta(); }
  const equipe=DB.usuarios.map(u=>`<tr><td><b>${esc(u.nome)}</b></td><td>${esc(u.user)}</td><td>${esc(u.cargo||'—')}</td>
    <td><span class="tag ${u.role==='admin'?'t-gold':'t-navy'}">${u.role==='admin'?'administradora':'equipe'}</span></td>
    <td class="right">${u.id===USER.id?'<span class="tag t-ok">você</span>':`<button class="btn s sm" onclick="resetarSenha('${u.id}')">Resetar senha</button><button class="btn s sm" onclick="excluirUsuario('${u.id}')">Remover</button>`}</td></tr>`).join('');
  $('#view-config').innerHTML=`
  <div class="card"><h3>Equipe</h3>
    <table><thead><tr><th>Nome</th><th>Usuário</th><th>Cargo</th><th>Perfil</th><th></th></tr></thead><tbody>${equipe}</tbody></table>
    <button class="btn s" style="margin-top:12px" onclick="modalUsuario()">＋ Adicionar pessoa</button>
    <div class="quote-note">Cada pessoa entra com seu usuário e senha. Acesso por link no navegador — os dados ficam salvos neste navegador.</div>
  </div>
  <div class="card"><h3>Minha conta</h3>
    <div class="frow">
      <div><label>Nome</label><input id="cfgNome" value="${esc(USER.nome)}"></div>
      <div><label>Cargo</label><input id="cfgCargo" value="${esc(USER.cargo||'')}"></div>
    </div>
    <div class="frow">
      <div><label>Nova senha</label><input type="password" id="cfgPass" placeholder="deixe vazio para manter"></div>
      <div><label>Confirmar</label><input type="password" id="cfgPass2" placeholder="repita a nova senha"></div>
    </div>
    <button class="btn p" style="margin-top:12px" onclick="salvarConta()">Salvar conta</button>
  </div>
  <div class="card"><h3>Dados</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn s" onclick="exportarCSV('orcamentos')">⬇ Orçamentos em CSV</button>
      <button class="btn s" onclick="exportarCSV('lancamentos')">⬇ Financeiro em CSV</button>
      <button class="btn s" onclick="backup()">⬇ Backup completo (JSON)</button>
      <button class="btn s" onclick="$('#restoreFile').click()">⬆ Restaurar backup</button>
      <input type="file" id="restoreFile" accept=".json" style="display:none" onchange="restaurar(event)">
    </div>
    <div class="quote-note">O backup contém clientes, orçamentos, eventos, financeiro e usuários. Guarde em local seguro.</div>
  </div>
  <div class="card"><h3>Zona de teste</h3>
    <p style="font-size:13px;color:var(--mut);margin-bottom:10px">Cria 3 clientes de exemplo com orçamentos, evento e parcelas para você explorar o sistema antes de usar de verdade.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn s" onclick="carregarExemplo()">Popular com exemplo</button>
      <button class="btn d" onclick="zerarTudo()">Apagar tudo e começar do zero</button>
    </div>
  </div>`;
}
function renderMinhaConta(){
  $('#view-config').innerHTML=`
  <div class="card"><h3>Minha conta</h3>
    <div class="frow">
      <div><label>Nome</label><input id="cfgNome" value="${esc(USER.nome)}"></div>
      <div><label>Cargo</label><input id="cfgCargo" value="${esc(USER.cargo||'')}"></div>
    </div>
    <div class="frow">
      <div><label>Nova senha</label><input type="password" id="cfgPass" placeholder="deixe vazio para manter"></div>
      <div><label>Confirmar</label><input type="password" id="cfgPass2" placeholder="repita a nova senha"></div>
    </div>
    <button class="btn p" style="margin-top:12px" onclick="salvarConta()">Salvar conta</button>
  </div>
  <div class="card"><h3>Acesso</h3>
    <div class="quote-note">Perfil: <b>${USER.role==='admin'?'Administradora (acesso total)':'Equipe'}</b>.<br>
    A gestão da equipe, o backup e a limpeza dos dados ficam com a administradora.</div>
  </div>`;
}
function soAdmin(){ if(!USER||USER.role!=='admin'){ alert('Ação restrita à administradora.'); return true; } return false; }
function modalUsuario(){
  if(soAdmin()) return;
  modal(`<h3>Adicionar pessoa da equipe</h3>
  <div class="frow">
    <div><label>Nome</label><input id="muNome" placeholder="Nome completo"></div>
    <div><label>Usuário</label><input id="muUser" placeholder="ex.: maria"></div>
  </div>
  <div class="frow">
    <div><label>Senha</label><input id="muPass" placeholder="senha de acesso"></div>
    <div><label>Cargo</label><input id="muCargo" placeholder="ex.: Atendimento"></div>
  </div>
  <label>Perfil de acesso</label>
  <select id="muRole"><option value="equipe">Equipe (atendimento)</option><option value="admin">Administradora (acesso total)</option></select>
  <div class="macts">
    <button class="btn s" onclick="fecharModal()">Cancelar</button>
    <button class="btn p" onclick="salvarUsuario()">Adicionar</button>
  </div>`);
}
function salvarUsuario(){
  if(soAdmin()) return;
  const nome=$('#muNome').value.trim(), user=$('#muUser').value.trim().toLowerCase(), pass=$('#muPass').value;
  if(!nome||!user||!pass){ alert('Preencha nome, usuário e senha.'); return; }
  if(DB.usuarios.find(u=>u.user===user)){ alert('Este usuário já existe.'); return; }
  DB.usuarios.push({ id:uid(), user, pass, nome, cargo:$('#muCargo').value.trim(), role:$('#muRole').value });
  salvar(); fecharModal(); render();
}
function resetarSenha(id){
  if(soAdmin()) return;
  const u=DB.usuarios.find(x=>x.id===id); if(!u) return;
  const nova=prompt(`Nova senha para ${u.nome}:`);
  if(nova===null) return;
  if(nova.length<4){ alert('A senha precisa ter pelo menos 4 caracteres.'); return; }
  u.pass=nova; salvar(); alert(`Senha de ${u.nome} atualizada. Informe a nova senha a ele(a).`);
}
function excluirUsuario(id){
  if(soAdmin()) return;
  if(id===USER.id){ alert('Você não pode remover a si mesma.'); return; }
  if(!confirm('Remover esta pessoa da equipe?')) return;
  DB.usuarios=DB.usuarios.filter(u=>u.id!==id); salvar(); render();
}
function salvarConta(){
  USER.nome=$('#cfgNome').value.trim()||USER.nome; USER.cargo=$('#cfgCargo').value.trim();
  const p1=$('#cfgPass').value, p2=$('#cfgPass2').value;
  if(p1||p2){
    if(p1!==p2){ alert('As senhas não conferem.'); return; }
    if(p1.length<4){ alert('A senha precisa ter pelo menos 4 caracteres.'); return; }
    USER.pass=p1;
  }
  salvar(); render(); alert('Conta atualizada!');
}
function backup(){
  if(soAdmin()) return;
  const a=document.createElement('a');
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(DB,null,1));
  a.download='luare_crm_backup_'+hoje()+'.json'; a.click();
}
function restaurar(ev){
  if(soAdmin()) return;
  const f=ev.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ DB=JSON.parse(r.result); salvar(); alert('Backup restaurado!'); location.reload(); }
    catch(e){ alert('Arquivo inválido.'); } };
  r.readAsText(f);
}
function zerarTudo(){
  if(soAdmin()) return;
  if(!confirm('APAGAR TODOS os dados do CRM? Isso não pode ser desfeito.')) return;
  if(!confirm('Tem certeza? Faça um backup antes se já tem dados reais.')) return;
  store.del(LS); DB=seed(); salvar(); location.reload();
}
function carregarExemplo(){
  const c1={id:uid(),nome:'Ana Beatriz Farias',telefone:'(96) 98111-2233',email:'ana.b@gmail.com',origem:'Instagram',funil:'Fechado',obs:'Festa dos 15 anos, tema jardim encantado',criado:'2026-10-05T14:00:00'};
  const c2={id:uid(),nome:'Carlos Eduardo Martins',telefone:'(96) 98222-3344',email:'cadu.m@hotmail.com',origem:'WhatsApp',funil:'Negociando',obs:'Casamento em julho, pediu desconto',criado:'2026-10-12T10:30:00'};
  const c3={id:uid(),nome:'Juliana Almeida',telefone:'(96) 98333-4455',email:'',origem:'Indicação',funil:'Orçamento enviado',obs:'1 aninho da Sofia',criado:'2026-10-20T16:45:00'};
  DB.clientes.push(c1,c2,c3);
  const o1={id:uid(),numero:numOrc(),criado:'2026-10-05T15:00:00',clienteId:c1.id,dataEvento:'2026-12-12',duracao:4,buffet:'tradBar',dia:'fds',convidados:120,desconto:0,extras:[],obs:'Topo de bolo incluso',status:'aprovado',vistoEm:'2026-10-06T12:00:00',total:19000,det:{espaco:3500,buffetPp:100,buffetTotal:12000,base:15500,extrasTotal:0}};
  o1.total=15500;
  const o2={id:uid(),numero:numOrc(),criado:'2026-10-12T11:00:00',clienteId:c2.id,dataEvento:'2027-07-17',duracao:6,buffet:'trad',dia:'fds',convidados:140,desconto:0,extras:[],obs:'Pediu visita ao espaço',status:'enviado',vistoEm:'2026-10-14T09:00:00',total:18500,det:{espaco:4000,buffetPp:85,buffetTotal:14500,base:18500,extrasTotal:0}};
  const o3={id:uid(),numero:numOrc(),criado:'2026-10-20T17:00:00',clienteId:c3.id,dataEvento:'2027-03-20',duracao:4,buffet:'mini',dia:'semana',convidados:80,desconto:0,extras:[],obs:'',status:'novo',vistoEm:null,total:9500,det:{espaco:3500,buffetPp:75,buffetTotal:6000,base:9500,extrasTotal:0}};
  o3.total=9500;
  DB.orcamentos.push(o1,o2,o3);
  const ev1={id:uid(),orcId:o1.id,clienteId:c1.id,tipo:'Jantar Tradicional + Barracas',data:'2026-12-12',hora:'19:00',convidados:120,duracao:4,dia:'fds',buffet:'tradBar',valorTotal:15500,status:'confirmado',obs:'Topo de bolo incluso',criado:'2026-10-06T12:00:00'};
  DB.eventos.push(ev1);
  DB.lancamentos.push(
    {id:uid(),tipo:'entrada',clienteId:c1.id,eventoId:ev1.id,desc:'Sinal 30% — '+o1.numero,valor:4650,venc:'2026-11-05',pago:true,pagoEm:'2026-10-06'},
    {id:uid(),tipo:'entrada',clienteId:c1.id,eventoId:ev1.id,desc:'Saldo 70% — '+o1.numero,valor:10850,venc:'2026-12-05',pago:false},
    {id:uid(),tipo:'saida',clienteId:null,eventoId:null,desc:'Decoracao — fornecedor parceiro',valor:1200,venc:'2026-12-10',pago:false}
  );
  DB.config.exemplo=true; salvar();
  alert('Dados de exemplo criados! Explore o painel, agenda e financeiro. Depois use "Apagar tudo" em Configurações.');
  location.reload();
}

/* ---------- INICIALIZAÇÃO ---------- */
carregar();
(function initSessao(){
  const sid=sessionStorage.getItem('luare_user');
  if(sid){
    const u=DB.usuarios.find(x=>x.id===sid);
    if(u){
      USER=u; VIEW=sessionStorage.getItem('luare_view')||'painel';
      $('#login').style.display='none'; $('#app').classList.add('on');
      $('#whoName').textContent=u.nome; $('#whoRole').textContent=u.cargo||'';
    }
  }
  render();
  try{ localStorage.setItem('_t','1'); localStorage.removeItem('_t'); }
  catch(e){ setTimeout(()=>{ const b=document.createElement('div');
    b.style.cssText='background:#fbf0da;border-bottom:1px solid #ecd9ae;color:#7a5a10;padding:8px 14px;font-size:12.5px;text-align:center';
    b.textContent='Modo visualização: neste ambiente os dados não ficam salvos. Baixe o arquivo e abra no navegador para uso real.';
    document.body.prepend(b); },400); }
})();
