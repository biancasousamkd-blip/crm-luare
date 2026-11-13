/* ============================================================
   COZINHA LUARE — telas
   ============================================================ */
let EV_ABERTO = null;
let FICHA_ABERTA = null;

const TELAS = [
  { id:'painel',       ic:'◈', nome:'Painel' },
  { id:'eventos',      ic:'▤', nome:'Eventos' },
  { id:'fichas',       ic:'✎', nome:'Fichas' },
  { id:'insumos',      ic:'▦', nome:'Insumos' },
  { id:'compras',      ic:'⛬', nome:'Compras' },
  { id:'desperdicio',  ic:'◐', nome:'Sobras' },
  { id:'fornecedores', ic:'☎', nome:'Fornecedores' },
  { id:'equipe',       ic:'⚙', nome:'Acessos', soAdmin:true },
  { id:'conta',        ic:'◍', nome:'Conta' }
];
function telasPermitidas(){
  return TELAS.filter(t => !t.soAdmin || PERM.admin);
}

function pintarTabs(){
  $('#tabs').innerHTML = telasPermitidas().map(t =>
    `<button class="${TELA===t.id||(TELA==='evento'&&t.id==='eventos')||(TELA==='ficha'&&t.id==='fichas')?'on':''}" onclick="ir('${t.id}')"><i>${t.ic}</i>${t.nome}</button>`
  ).join('');
}

function render(){
  if (!USUARIO) return;
  pintarTabs();
  const v = $('#view');
  const fns = { painel:telaPainel, eventos:telaEventos, evento:telaEvento, fichas:telaFichas,
                ficha:telaFicha, insumos:telaInsumos, compras:telaCompras,
                desperdicio:telaDesperdicio, fornecedores:telaFornecedores,
                equipe:telaEquipe, conta:telaConta };
  const fn = fns[TELA] || telaPainel;
  v.innerHTML = fn();
  window.scrollTo(0,0);
}

/* ============================ PAINEL ============================ */
function telaPainel(){
  const prox = proximosEventos(7);
  const baixos = insumosBaixos();
  const hojeIso = hoje();
  const evHoje = (DB.eventos||[]).filter(e => e.data === hojeIso && e.status !== 'cancelado');
  const ev7 = proximosEventos(7);
  const abertas = (DB.compras||[]).filter(c => !c.comprado);
  const valorCompras = abertas.reduce((s,c)=>s+num(c.custo_estimado),0);
  const desp30 = (DB.desperdicio||[]).filter(d => {
    const lim = new Date(); lim.setDate(lim.getDate()-30);
    return d.data >= lim.toISOString().slice(0,10);
  });
  const custoDesp = desp30.reduce((s,d)=>s+num(d.custo),0);

  const html = [];
  html.push(`<div class="hero">
    <div class="l">Cozinha LUARE</div>
    <div class="n">${evHoje.length ? 'Hoje tem ' + evHoje.length + ' evento' + (evHoje.length>1?'s':'') : 'Nenhum evento hoje'}</div>
    <div class="d">${ev7.length} evento${ev7.length===1?'':'s'} nos próximos 7 dias · ${qtd(valorEstoque())} em estoque</div>
  </div>`);

  html.push(`<div class="kpis">
    <div class="kpi ${baixos.length?'warn':''}">
      <div class="l">Estoque baixo</div>
      <div class="v">${baixos.length}</div>
      <div class="s">${baixos.length?'itens no mínimo':'tudo abastecido'}</div>
    </div>
    <div class="kpi">
      <div class="l">Valor em estoque</div>
      <div class="v">${moeda(valorEstoque())}</div>
      <div class="s">${(DB.insumos||[]).length} insumos</div>
    </div>
    <div class="kpi ${abertas.length?'warn':''}">
      <div class="l">Compras abertas</div>
      <div class="v">${abertas.length}</div>
      <div class="s">${moeda(valorCompras)} estimado</div>
    </div>
    <div class="kpi ${custoDesp>0?'bad':'ok'}">
      <div class="l">Perdas (30 dias)</div>
      <div class="v">${moeda(custoDesp)}</div>
      <div class="s">${desp30.length} registro${desp30.length===1?'':'s'}</div>
    </div>
  </div>`);

  if (evHoje.length){
    html.push(`<div class="card"><h3>Hoje na cozinha</h3><div class="lista">` +
      evHoje.map(e => {
        const c = custoEvento(e.id);
        return `<div class="item" onclick="abrirEvento('${e.id}')">
          <div class="ic">${'▤'}</div>
          <div class="tx"><b>${esc(e.nome||'Evento')}</b>
          <span>${esc(e.tipo_evento||'—')} · ${e.convidados} convidados</span></div>
          <div class="vl">${c.linhas} prato${c.linhas===1?'':'s'}</div>
        </div>`;
      }).join('') + `</div></div>`);
  }

  if (ev7.length){
    html.push(`<div class="card"><h3>Próximos 7 dias</h3><div class="lista">` +
      ev7.slice(0,6).map(e => `<div class="item" onclick="abrirEvento('${e.id}')">
        <div class="ic">${diaSemana(e.data)}</div>
        <div class="tx"><b>${dataBR(e.data)} · ${esc(e.nome||'Evento')}</b>
        <span>${e.convidados} convidados · ${esc(e.tipo_evento||'—')}</span></div>
      </div>`).join('') + `</div></div>`);
  }

  if (baixos.length){
    html.push(`<div class="card"><h3>Repor no estoque <span class="mini">${baixos.length}</span></h3><div class="lista">` +
      baixos.slice(0,8).map(i => `<div class="item" onclick="abrirInsumo('${i.id}')">
        <div class="ic">▦</div>
        <div class="tx"><b>${esc(i.nome)}</b><span>tem ${qtd(i.estoque)} ${esc(i.unidade)} · mínimo ${qtd(i.estoque_minimo)}</span></div>
        <div class="vl"><span class="tag ${num(i.estoque)<=0?'bad':'warn'}">${num(i.estoque)<=0?'zerado':'baixo'}</span></div>
      </div>`).join('') + `</div></div>`);
  }

  if (!ev7.length && !baixos.length && !evHoje.length){
    html.push(`<div class="card"><div class="vazio"><b>Tudo em ordem</b>
      Nenhum evento nos próximos 7 dias e nenhum insumo abaixo do mínimo.<br>
      Comece cadastrando os ingredientes em <b>Insumos</b> e depois as receitas em <b>Fichas</b>.</div></div>`);
  }

  return html.join('');
}

/* ============================ EVENTOS ============================ */
function telaEventos(){
  const hojeIso = hoje();
  const futuros = (DB.eventos||[]).filter(e => e.data >= hojeIso && e.status !== 'cancelado')
                    .sort((a,b)=>a.data.localeCompare(b.data));
  const passados = (DB.eventos||[]).filter(e => e.data && e.data < hojeIso && e.status !== 'cancelado')
                    .sort((a,b)=>b.data.localeCompare(a.data)).slice(0,10);

  const linha = e => {
    const c = custoEvento(e.id);
    return `<div class="item" onclick="abrirEvento('${e.id}')">
      <div class="ic">${diaSemana(e.data)}</div>
      <div class="tx"><b>${dataBR(e.data)} · ${esc(e.nome||'Evento')}</b>
        <span>${e.convidados} convidados · ${esc(e.tipo_evento||'—')}${c.linhas?' · '+c.linhas+' prato'+(c.linhas>1?'s':''):''}</span></div>
      <div class="vl">${c.total?moeda(c.total):'<span class="tag off">sem pratos</span>'}</div>
    </div>`;
  };

  return `<div class="card"><h3>Próximos eventos <span class="mini">${futuros.length}</span></h3>
    ${futuros.length ? `<div class="lista">${futuros.map(linha).join('')}</div>`
      : `<div class="vazio"><b>Nenhum evento futuro</b>Os eventos fechados no CRM de vendas aparecem aqui automaticamente.</div>`}
  </div>
  ${passados.length ? `<div class="card"><h3>Realizados <span class="mini">últimos 10</span></h3>
    <div class="lista">${passados.map(linha).join('')}</div></div>` : ''}`;
}

function telasEvento(){
  return (DB.eventos||[]).find(e => e.id === EV_ABERTO);
}

function telaEvento(){
  const ev = telasEvento();
  if (!ev) return `<div class="card"><div class="vazio"><b>Evento não encontrado</b></div></div>`;
  const linhas = (DB.pratos||[]).filter(p => p.cozinha_evento_id === ev.id);
  const compras = (DB.compras||[]).filter(c => c.cozinha_evento_id === ev.id);
  const custo = custoEvento(ev.id);
  const custoPrato = num(ev.convidados) ? custo.total / num(ev.convidados) : 0;
  const totalCompras = compras.reduce((s,c)=>s+num(c.custo_estimado),0);

  const html = [];
  html.push(`<div class="card">
    <button class="btn g sm" onclick="ir('eventos')" style="margin-bottom:12px">← Eventos</button>
    <h3>${esc(ev.nome||'Evento')}</h3>
    <div class="nota">${dataBR(ev.data)} (${diaSemana(ev.data)}) · ${ev.convidados} convidados · ${esc(ev.tipo_evento||'—')}
      ${ev.status==='cancelado'?' · <span class="tag bad">cancelado</span>':''}</div>
    <div class="sep"></div>
    <div class="kpis" style="margin:0">
      <div class="kpi"><div class="l">Custo da comida</div><div class="v">${moeda(custo.total)}</div><div class="s">${custo.linhas} prato${custo.linhas===1?'':'s'}</div></div>
      <div class="kpi"><div class="l">Custo por convidado</div><div class="v">${moeda(custoPrato)}</div><div class="s">${custo.porcao?qtd(custo.porcao)+' porções':'sem escala'}</div></div>
    </div>
  </div>`);

  html.push(`<div class="card"><h3>Pratos escalados <span class="mini">${linhas.length}</span></h3>
    ${linhas.length ? `<table><thead><tr><th>Prato</th><th class="right">Porções</th><th class="right">Custo</th><th></th></tr></thead><tbody>` +
      linhas.map(p => {
        const f = p.ficha_id ? fichaPorId(p.ficha_id) : null;
        const cp = f ? custoPorcao(f) : 0;
        return `<tr>
          <td><b>${esc((f&&f.nome)||p.nome||'—')}</b>${f?`<div class="nota">${moeda(cp)} por porção</div>`:''}</td>
          <td class="right"><input id="pr-${p.id}" value="${num(p.porcoes)}" inputmode="decimal"
              style="width:74px;text-align:right;padding:7px;border:1px solid var(--line);border-radius:8px"></td>
          <td class="right">${moeda(cp*num(p.porcoes))}</td>
          <td class="right">${PERM.pode_excluir?`<button class="btn g sm" onclick="removerPrato('${p.id}','${ev.id}')">×</button>`:''}</td>
        </tr>`;
      }).join('') + `</tbody></table>
      <div class="row" style="margin-top:12px">
        <button class="btn sm" onclick="salvarPratosDoEvento('${ev.id}')">Salvar porções</button>
      </div>`
      : `<div class="vazio"><b>Nenhum prato escalado</b>Escolha as fichas que vão para este evento.</div>`}
    ${PERM.pode_editar?`<button class="btn p full" style="margin-top:10px" onclick="modalEscalar('${ev.id}')">＋ Escalar prato</button>`:''}
  </div>`);

  html.push(`<div class="card"><h3>Lista de compras <span class="mini">${compras.length}</span></h3>
    ${compras.length ? `<div class="lista">` + compras.map(c => `<div class="item" onclick="marcarComprado('${c.id}',${!c.comprado},'${ev.id}')">
        <div class="ic" style="${c.comprado?'background:#E4F2EA;color:var(--ok)':''}">${c.comprado?'✓':'○'}</div>
        <div class="tx"><b style="${c.comprado?'text-decoration:line-through;opacity:.6':''}">${esc(c.nome)}</b>
          <span>${qtd(c.quantidade)} ${esc(c.unidade||'')}</span></div>
        <div class="vl">${moeda(c.custo_estimado)}</div>
      </div>`).join('') + `</div>
      <div class="nota">Total estimado: <b>${moeda(totalCompras)}</b>. Toque no item para marcar como comprado.</div>`
      : `<div class="vazio"><b>Sem lista ainda</b>A lista é calculada pelos ingredientes dos pratos menos o estoque.</div>`}
    ${PERM.pode_editar?`<div class="row" style="margin-top:10px">
      <button class="btn sm" onclick="gerarCompras('${ev.id}')">Gerar lista</button>
      ${compras.some(c=>c.comprado)?'':''}
    </div>`:''}
    ${PERM.pode_editar&&compras.length?`<button class="btn g full sm" style="margin-top:8px" onclick="modalEntradaCompras('${ev.id}')">Dar entrada no estoque das compras</button>`:''}
  </div>`);

  html.push(`<div class="card"><h3>Observações da produção</h3>
    ${PERM.pode_editar
      ? `<div class="campo"><textarea id="evObs" placeholder="Anotações do evento: horário de saída, restrições, equipe...">${esc(ev.obs||'')}</textarea></div>
         <button class="btn sm" onclick="salvarObsEvento('${ev.id}')">Salvar</button>`
      : `<div class="nota">${esc(ev.obs||'Nada anotado.')}</div>`}
  </div>`);

  return html.join('');
}

async function salvarObsEvento(id){
  const r = await gravar('eventos', { obs: $('#evObs').value.trim() || null }, id);
  if (r){ toast('Observação salva.'); abrirEvento(id); }
}
async function removerPrato(pratoId, evId){
  if (!confirm('Tirar este prato do evento?')) return;
  if (await apagar('pratos', pratoId)) abrirEvento(evId);
}
function modalEscalar(evId){
  if (!exigirEdicao()) return;
  const ev = (DB.eventos||[]).find(e=>e.id===evId);
  const opts = (DB.fichas||[]).filter(f=>f.ativo!==false)
      .map(f=>`<option value="${f.id}">${esc(f.nome)} (${moeda(custoPorcao(f))}/porção)</option>`).join('');
  if (!opts){ toast('Cadastre uma ficha técnica primeiro.', true); return; }
  modal(`<h3>Escalar prato</h3>
    <div class="campo"><label>Prato</label><select id="prFicha"><option value="">Escolha…</option>${opts}</select></div>
    <div class="campo"><label>Porções</label><input id="prPorcoes" inputmode="decimal" value="${num(ev&&ev.convidados)}"></div>
    <div class="campo"><label>Observação</label><input id="prObs" placeholder="opcional"></div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="escalarPrato('${evId}')">Adicionar</button></div>`);
}
function modalEntradaCompras(evId){
  const pend = (DB.compras||[]).filter(c => c.cozinha_evento_id === evId && !c.comprado);
  if (!pend.length){ toast('Todas as compras já entraram no estoque.'); return; }
  modal(`<h3>Entrada no estoque</h3>
    <p class="nota">Vou somar estas quantidades no estoque e registrar a entrada:</p>
    <div class="lista" style="margin:10px 0">${pend.map(c=>`<div class="item"><div class="tx"><b>${esc(c.nome)}</b>
      <span>${qtd(c.quantidade)} ${esc(c.unidade||'')}</span></div></div>`).join('')}</div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="entradaTodas('${evId}')">Lançar</button></div>`);
}
async function entradaTodas(evId){
  const pend = (DB.compras||[]).filter(c => c.cozinha_evento_id === evId && !c.comprado);
  fecharModal();
  for (const c of pend){
    await patch(ROTAS.compras, c.id, { comprado:true });
    if (c.insumo_id){
      const ins = insumoPorId(c.insumo_id);
      if (ins){
        await patch(ROTAS.insumos, ins.id, { estoque: num(ins.estoque) + num(c.quantidade) });
        await post(ROTAS.movimentos, { insumo_id: ins.id, tipo:'entrada', quantidade:num(c.quantidade),
          custo_unitario:num(ins.preco), cozinha_evento_id: evId, obs:'Compra do evento' });
      }
    }
  }
  await recarregar('insumos');
  await recarregar('compras');
  toast('Entradas lançadas no estoque.');
  abrirEvento(evId);
}

/* ============================ FICHAS ============================ */
function telaFichas(){
  const fs = (DB.fichas||[]).slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  return `<div class="card"><h3>Fichas técnicas <span class="mini">${fs.length}</span></h3>
    ${fs.length ? `<div class="lista">` + fs.map(f => `<div class="item" onclick="abrirFicha('${f.id}')">
      <div class="ic">✎</div>
      <div class="tx"><b>${esc(f.nome)}</b><span>${f.rendimento} porções · ${(DB.itens||[]).filter(i=>i.ficha_id===f.id).length} ingredientes</span></div>
      <div class="vl">${moeda(custoPorcao(f))}<div class="nota" style="margin:0">por porção</div></div>
    </div>`).join('') + `</div>` : `<div class="vazio"><b>Nenhuma ficha ainda</b>Cadastre a receita com rendimento e ingredientes para saber o custo por porção.</div>`}
    ${PERM.pode_editar?`<button class="btn p full" style="margin-top:12px" onclick="modalFicha()">＋ Nova ficha</button>`:''}
  </div>`;
}

function telaFicha(){
  const f = fichaPorId(FICHA_ABERTA);
  if (!f) return `<div class="card"><div class="vazio"><b>Ficha não encontrada</b></div></div>`;
  const itens = (DB.itens||[]).filter(i => i.ficha_id === f.id);
  const total = custoFicha(f.id);
  const porcao = custoPorcao(f);

  return `<div class="card">
    <button class="btn g sm" onclick="ir('fichas')" style="margin-bottom:12px">← Fichas</button>
    <h3>${esc(f.nome)}</h3>
    <div class="nota">${esc(f.categoria||'—')} · rende <b>${f.rendimento}</b> porções${f.tempo_prep?' · '+f.tempo_prep+' min':''}</div>
    <div class="sep"></div>
    <div class="kpis" style="margin:0">
      <div class="kpi"><div class="l">Custo da receita</div><div class="v">${moeda(total)}</div><div class="s">${itens.length} ingredientes</div></div>
      <div class="kpi"><div class="l">Custo por porção</div><div class="v">${moeda(porcao)}</div><div class="s">divide por ${f.rendimento}</div></div>
    </div>
  </div>
  <div class="card"><h3>Ingredientes</h3>
    ${itens.length ? `<table><thead><tr><th>Item</th><th class="right">Qtd</th><th class="right">Unit.</th><th class="right">Total</th><th></th></tr></thead><tbody>` +
      itens.map(i => `<tr><td>${esc(i.descricao||'—')}</td>
        <td class="right">${qtd(i.quantidade)} ${esc(i.unidade||'')}</td>
        <td class="right">${moeda(i.custo_unitario)}</td>
        <td class="right"><b>${moeda(num(i.quantidade)*num(i.custo_unitario))}</b></td>
        <td class="right">${PERM.pode_excluir?`<button class="btn g sm" onclick="apagarItemFicha('${i.id}','${f.id}')">×</button>`:''}</td></tr>`).join('') +
      `</tbody></table>` : `<div class="vazio"><b>Sem ingredientes</b>Adicione para o custo aparecer.</div>`}
    ${PERM.pode_editar?`<div class="row" style="margin-top:12px">
      <button class="btn sm" onclick="modalItemFicha('${f.id}')">＋ Ingrediente</button>
      <button class="btn g sm" onclick="modalFicha('${f.id}')">Editar ficha</button>
    </div>`:''}
  </div>
  ${f.modo_preparo||f.obs?`<div class="card"><h3>Modo de preparo</h3>
     <div class="nota" style="white-space:pre-wrap">${esc(f.modo_preparo||'')}</div>
     ${f.obs?`<div class="sep"></div><div class="nota">${esc(f.obs)}</div>`:''}
  </div>`:''}`;
}

function abrirFicha(id){ FICHA_ABERTA = id; ir('ficha'); }

function modalFicha(id){
  if (!exigirEdicao()) return;
  const f = id ? fichaPorId(id) : null;
  modal(`<h3>${f?'Editar ficha':'Nova ficha técnica'}</h3>
    <div class="campo"><label>Prato</label><input id="fNome" value="${esc(f?f.nome:'')}" placeholder="Ex.: Frango ao molho"></div>
    <div class="duo">
      <div class="campo"><label>Categoria</label><input id="fCat" value="${esc(f?f.categoria||'':'')}" placeholder="Proteína, salgado..."></div>
      <div class="campo"><label>Rende (porções)</label><input id="fRend" inputmode="numeric" value="${f?f.rendimento:50}"></div>
    </div>
    <div class="campo"><label>Tempo de preparo (min)</label><input id="fTempo" inputmode="numeric" value="${f&&f.tempo_prep?f.tempo_prep:''}"></div>
    <div class="campo"><label>Modo de preparo</label><textarea id="fModo">${esc(f?f.modo_preparo||'':'')}</textarea></div>
    <div class="campo"><label>Observação</label><input id="fObs" value="${esc(f?f.obs||'':'')}"></div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="salvarFicha(${f?`'${f.id}'`:'null'})">Salvar</button></div>`);
}

function modalItemFicha(fichaId){
  if (!exigirEdicao()) return;
  const ins = (DB.insumos||[]).filter(i=>i.ativo!==false);
  const opts = ins.map(i=>`<option value="${i.id}">${esc(i.nome)} — ${moeda(i.preco)}/${esc(i.unidade)}</option>`).join('');
  modal(`<h3>Adicionar ingrediente</h3>
    ${opts?`<div class="campo"><label>Insumo do estoque</label>
      <select id="itIns" onchange="preencherDoInsumo()"><option value="">— descrever manualmente —</option>${opts}</select></div>`:`<input type="hidden" id="itIns" value="">`}
    <div class="campo"><label>Descrição</label><input id="itDesc" placeholder="Ex.: arroz branco"></div>
    <div class="trio">
      <div class="campo"><label>Quantidade</label><input id="itQtd" inputmode="decimal" placeholder="0"></div>
      <div class="campo"><label>Unidade</label><input id="itUn" placeholder="kg"></div>
      <div class="campo"><label>Custo unit.</label><input id="itCusto" inputmode="decimal" placeholder="0,00"></div>
    </div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="salvarItemFicha('${fichaId}')">Adicionar</button></div>`);
}

/* ============================ INSUMOS ============================ */
function telaInsumos(){
  const ins = (DB.insumos||[]).slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  const baixos = ins.filter(i=>num(i.estoque)<=num(i.estoque_minimo));
  const cats = {};
  ins.forEach(i => { const c = i.categoria || 'Sem categoria'; (cats[c] = cats[c]||[]).push(i); });

  return `<div class="kpis">
    <div class="kpi ${baixos.length?'warn':''}"><div class="l">Abaixo do mínimo</div><div class="v">${baixos.length}</div><div class="s">de ${ins.length} insumos</div></div>
    <div class="kpi"><div class="l">Valor em estoque</div><div class="v">${moeda(valorEstoque())}</div><div class="s">preço médio atual</div></div>
  </div>
  <div class="card"><h3>Estoque</h3>
    ${ins.length ? Object.keys(cats).sort().map(c => `<div class="nota" style="margin:14px 0 6px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.6px;font-size:10.5px">${esc(c)}</div>
      <div class="lista">` + cats[c].map(i => {
        const baixo = num(i.estoque) <= num(i.estoque_minimo);
        return `<div class="item" onclick="abrirInsumo('${i.id}')">
          <div class="ic" style="${baixo?'background:#FBF0DA;color:var(--warn)':''}">${baixo?'!':'▦'}</div>
          <div class="tx"><b>${esc(i.nome)}</b><span>${qtd(i.estoque)} ${esc(i.unidade)} · mín. ${qtd(i.estoque_minimo)} · ${moeda(i.preco)}/${esc(i.unidade)}</span></div>
          <div class="vl">${moeda(num(i.estoque)*num(i.preco))}</div>
        </div>`;
      }).join('') + `</div>`).join('')
      : `<div class="vazio"><b>Estoque vazio</b>Cadastre os ingredientes que você usa.</div>`}
    ${PERM.pode_editar?`<div class="row" style="margin-top:12px">
      <button class="btn p" onclick="modalInsumo()">＋ Insumo</button>
      <button class="btn g" onclick="modalMovimento()">↕ Movimentar</button>
    </div>`:''}
  </div>`;
}

function abrirInsumo(id){
  const i = insumoPorId(id);
  if (!i) return;
  const movs = (DB.movimentos||[]).filter(m=>m.insumo_id===id).slice(0,12);
  modal(`<h3>${esc(i.nome)}</h3>
    <div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><div class="l">Em estoque</div><div class="v">${qtd(i.estoque)} ${esc(i.unidade)}</div><div class="s">mínimo ${qtd(i.estoque_minimo)}</div></div>
      <div class="kpi"><div class="l">Custo unitário</div><div class="v">${moeda(i.preco)}</div><div class="s">${esc(i.unidade)}</div></div>
    </div>
    <div class="nota">${esc(i.categoria||'Sem categoria')}${i.fornecedor_id&&fornecedorPorId(i.fornecedor_id)?' · '+esc(fornecedorPorId(i.fornecedor_id).nome):''}${i.obs?'<br>'+esc(i.obs):''}</div>
    ${movs.length?`<div class="sep"></div><div class="nota" style="font-weight:700">Últimos movimentos</div>
      <table><tbody>${movs.map(m=>`<tr><td>${dataBR((m.criado||'').slice(0,10))}</td>
        <td>${esc(m.tipo)}</td><td class="right">${qtd(m.quantidade)}</td></tr>`).join('')}</tbody></table>`:''}
    <div class="row" style="margin-top:14px">
      ${PERM.pode_editar?`<button class="btn p sm" onclick="modalInsumo('${i.id}')">Editar</button>
      <button class="btn g sm" onclick="modalMovimento('${i.id}')">Movimentar</button>`:''}
      ${PERM.pode_excluir?`<button class="btn d sm" onclick="excluirInsumo('${i.id}')">Excluir</button>`:''}
      <button class="btn g sm" onclick="fecharModal()">Fechar</button>
    </div>`);
}

async function excluirInsumo(id){
  if (!confirm('Excluir este insumo? O histórico de movimentos dele também sai.')) return;
  if (await apagar('insumos', id)){ fecharModal(); toast('Insumo excluído.'); render(); }
}

function modalInsumo(id){
  if (!exigirEdicao()) return;
  const i = id ? insumoPorId(id) : null;
  const forns = (DB.fornecedores||[]).map(f=>`<option value="${f.id}" ${i&&i.fornecedor_id===f.id?'selected':''}>${esc(f.nome)}</option>`).join('');
  const un = ['kg','g','L','ml','un','cx','pct','dz'];
  modal(`<h3>${i?'Editar insumo':'Novo insumo'}</h3>
    <div class="campo"><label>Nome</label><input id="iNome" value="${esc(i?i.nome:'')}" placeholder="Ex.: Arroz branco"></div>
    <div class="duo">
      <div class="campo"><label>Categoria</label><input id="iCat" value="${esc(i?i.categoria||'':'')}" placeholder="Grãos, carnes..."></div>
      <div class="campo"><label>Unidade</label><select id="iUn">${un.map(u=>`<option ${i&&i.unidade===u?'selected':''}>${u}</option>`).join('')}</select></div>
    </div>
    <div class="trio">
      <div class="campo"><label>Preço unit.</label><input id="iPreco" inputmode="decimal" value="${i?i.preco:''}" placeholder="0,00"></div>
      <div class="campo"><label>Estoque</label><input id="iEstoque" inputmode="decimal" value="${i?i.estoque:''}" placeholder="0"></div>
      <div class="campo"><label>Mínimo</label><input id="iMin" inputmode="decimal" value="${i?i.estoque_minimo:''}" placeholder="0"></div>
    </div>
    ${forns?`<div class="campo"><label>Fornecedor</label><select id="iForn"><option value="">—</option>${forns}</select></div>`:`<input type="hidden" id="iForn" value="">`}
    <div class="campo"><label>Observação</label><input id="iObs" value="${esc(i?i.obs||'':'')}"></div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="salvarInsumo(${i?`'${i.id}'`:'null'})">Salvar</button></div>`);
}

function modalMovimento(insumoId){
  if (!exigirEdicao()) return;
  const ins = (DB.insumos||[]);
  if (!ins.length){ toast('Cadastre um insumo primeiro.', true); return; }
  const opts = ins.map(i=>`<option value="${i.id}" ${insumoId===i.id?'selected':''}>${esc(i.nome)} (${qtd(i.estoque)} ${esc(i.unidade)})</option>`).join('');
  modal(`<h3>Movimentar estoque</h3>
    <div class="campo"><label>Insumo</label><select id="mvIns">${opts}</select></div>
    <div class="campo"><label>Tipo</label><select id="mvTipo">
      <option value="entrada">Entrada (compra)</option>
      <option value="saida">Saída (uso na produção)</option>
      <option value="perda">Perda</option>
      <option value="ajuste">Ajuste (contagem)</option>
    </select></div>
    <div class="campo"><label>Quantidade</label><input id="mvQtd" inputmode="decimal" placeholder="0"></div>
    <div class="campo"><label>Observação</label><input id="mvObs" placeholder="opcional"></div>
    <div class="nota">No ajuste, a quantidade digitada passa a ser o estoque atual.</div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="lancarMovimento()">Lançar</button></div>`);
}

/* ============================ COMPRAS ============================ */
function telaCompras(){
  const todas = (DB.compras||[]);
  const abertas = todas.filter(c=>!c.comprado);
  const porEvento = {};
  abertas.forEach(c => { const k = c.cozinha_evento_id || 'sem'; (porEvento[k]=porEvento[k]||[]).push(c); });

  const bloco = (k) => {
    const ev = (DB.eventos||[]).find(e=>e.id===k);
    const lista = porEvento[k];
    const total = lista.reduce((s,c)=>s+num(c.custo_estimado),0);
    return `<div class="nota" style="margin:14px 0 6px;font-weight:700;color:var(--navy);font-size:11.5px">
      ${ev?esc(ev.nome)+' · '+dataBR(ev.data):'Sem evento'} — ${moeda(total)}</div>
      <div class="lista">${lista.map(c=>`<div class="item" onclick="marcarComprado('${c.id}',true,${ev?`'${ev.id}'`:'null'})">
        <div class="ic">○</div>
        <div class="tx"><b>${esc(c.nome)}</b><span>${qtd(c.quantidade)} ${esc(c.unidade||'')}</span></div>
        <div class="vl">${moeda(c.custo_estimado)}</div></div>`).join('')}</div>`;
  };

  return `<div class="card"><h3>Compras em aberto <span class="mini">${abertas.length}</span></h3>
    ${abertas.length ? Object.keys(porEvento).map(bloco).join('')
      : `<div class="vazio"><b>Nada pendente</b>Abra um evento e toque em "Gerar lista" para montar a lista de compras.</div>`}
  </div>
  <div class="card"><h3>Já comprado</h3>
    ${todas.filter(c=>c.comprado).length ? `<div class="lista">${todas.filter(c=>c.comprado).slice(0,20).map(c=>`<div class="item">
      <div class="ic" style="background:#E4F2EA;color:var(--ok)">✓</div>
      <div class="tx"><b>${esc(c.nome)}</b><span>${qtd(c.quantidade)} ${esc(c.unidade||'')}</span></div>
      <div class="vl">${moeda(c.custo_estimado)}</div></div>`).join('')}</div>`
      : `<div class="nota">Nada comprado ainda.</div>`}
  </div>`;
}

/* ============================ DESPERDÍCIO ============================ */
function telaDesperdicio(){
  const ds = (DB.desperdicio||[]);
  const lim30 = new Date(); lim30.setDate(lim30.getDate()-30);
  const d30 = ds.filter(d => d.data >= lim30.toISOString().slice(0,10));
  const custo30 = d30.reduce((s,d)=>s+num(d.custo),0);
  const porMotivo = {};
  d30.forEach(d => { const k = d.motivo || 'sem motivo'; porMotivo[k] = (porMotivo[k]||0) + num(d.custo); });

  return `<div class="kpis">
    <div class="kpi ${custo30>0?'bad':''}"><div class="l">Perdas (30 dias)</div><div class="v">${moeda(custo30)}</div><div class="s">${d30.length} registros</div></div>
    <div class="kpi"><div class="l">Total registrado</div><div class="v">${moeda(ds.reduce((s,d)=>s+num(d.custo),0))}</div><div class="s">${ds.length} registros</div></div>
  </div>
  <div class="card"><h3>Registros</h3>
    ${ds.length ? `<div class="lista">${ds.slice(0,30).map(d=>{
      const ev = (DB.eventos||[]).find(e=>e.id===d.cozinha_evento_id);
      return `<div class="item">
        <div class="ic">◐</div>
        <div class="tx"><b>${esc(d.prato||(insumoPorId(d.insumo_id)||{}).nome||'—')}</b>
          <span>${dataBR(d.data)} · ${qtd(d.quantidade)} ${esc(d.unidade||'')} · ${esc(d.motivo||'sem motivo')}${ev?' · '+esc(ev.nome):''}</span></div>
        <div class="vl">${moeda(d.custo)}</div></div>`;
    }).join('')}</div>` : `<div class="vazio"><b>Nada registrado</b>Anote as sobras e perdas para ver o quanto isso custa por mês.</div>`}
    ${PERM.pode_editar?`<button class="btn p full" style="margin-top:12px" onclick="modalDesperdicio()">＋ Registrar sobra ou perda</button>`:''}
  </div>
  ${Object.keys(porMotivo).length?`<div class="card"><h3>Por motivo (30 dias)</h3><table><tbody>
    ${Object.keys(porMotivo).sort((a,b)=>porMotivo[b]-porMotivo[a]).map(k=>`<tr><td>${esc(k)}</td><td class="right"><b>${moeda(porMotivo[k])}</b></td></tr>`).join('')}
  </tbody></table></div>`:''}`;
}

function modalDesperdicio(){
  if (!exigirEdicao()) return;
  const evs = (DB.eventos||[]).filter(e=>e.status!=='cancelado').sort((a,b)=>(b.data||'').localeCompare(a.data||'')).slice(0,40)
      .map(e=>`<option value="${e.id}">${dataBR(e.data)} — ${esc(e.nome||'Evento')}</option>`).join('');
  const ins = (DB.insumos||[]).map(i=>`<option value="${i.id}">${esc(i.nome)}</option>`).join('');
  modal(`<h3>Sobra ou perda</h3>
    <div class="campo"><label>Evento</label><select id="dEv"><option value="">—</option>${evs}</select></div>
    <div class="campo"><label>Prato</label><input id="dPrato" placeholder="Ex.: farofa"></div>
    <div class="campo"><label>Insumo (opcional)</label><select id="dIns"><option value="">—</option>${ins}</select></div>
    <div class="trio">
      <div class="campo"><label>Qtd</label><input id="dQtd" inputmode="decimal" placeholder="0"></div>
      <div class="campo"><label>Unid.</label><input id="dUn" placeholder="kg"></div>
      <div class="campo"><label>Custo</label><input id="dCusto" inputmode="decimal" placeholder="0,00"></div>
    </div>
    <div class="campo"><label>Motivo</label><input id="dMotivo" placeholder="sobra de buffet, estragou, erro de produção..."></div>
    <div class="campo"><label>Data</label><input id="dData" type="date" value="${hoje()}"></div>
    <div class="campo"><label>Observação</label><input id="dObs"></div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="salvarDesperdicio()">Registrar</button></div>`);
}

/* ============================ FORNECEDORES ============================ */
function telaFornecedores(){
  const fs = (DB.fornecedores||[]);
  return `<div class="card"><h3>Fornecedores <span class="mini">${fs.length}</span></h3>
    ${fs.length ? `<div class="lista">${fs.map(f=>{
      const n = (DB.insumos||[]).filter(i=>i.fornecedor_id===f.id).length;
      return `<div class="item" onclick="modalFornecedor('${f.id}')">
        <div class="ic">☎</div>
        <div class="tx"><b>${esc(f.nome)}</b><span>${esc(f.categoria||'—')}${f.prazo?' · entrega '+esc(f.prazo):''}${n?' · '+n+' insumo'+(n>1?'s':''):''}</span></div>
        <div class="vl" style="font-weight:400;font-size:12px">${esc(f.telefone||'')}</div></div>`;
    }).join('')}</div>` : `<div class="vazio"><b>Nenhum fornecedor</b>Cadastre de quem você compra hortifruti, carnes, bebidas.</div>`}
    ${PERM.pode_editar?`<button class="btn p full" style="margin-top:12px" onclick="modalFornecedor()">＋ Fornecedor</button>`:''}
  </div>`;
}

function modalFornecedor(id){
  if (!exigirEdicao()) return;
  const f = id ? fornecedorPorId(id) : null;
  modal(`<h3>${f?'Editar fornecedor':'Novo fornecedor'}</h3>
    <div class="campo"><label>Nome</label><input id="forNome" value="${esc(f?f.nome:'')}" placeholder="Ex.: Hortifruti Central"></div>
    <div class="duo">
      <div class="campo"><label>Contato</label><input id="forContato" value="${esc(f?f.contato||'':'')}"></div>
      <div class="campo"><label>Telefone</label><input id="forTel" value="${esc(f?f.telefone||'':'')}" inputmode="tel"></div>
    </div>
    <div class="duo">
      <div class="campo"><label>Categoria</label><input id="forCat" value="${esc(f?f.categoria||'':'')}" placeholder="Hortifruti, carnes..."></div>
      <div class="campo"><label>Prazo de entrega</label><input id="forPrazo" value="${esc(f?f.prazo||'':'')}" placeholder="24h"></div>
    </div>
    <div class="campo"><label>Observação</label><input id="forObs" value="${esc(f?f.obs||'':'')}"></div>
    <div class="acts">
      <button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="salvarFornecedor(${f?`'${f.id}'`:'null'})">Salvar</button></div>`);
}

/* ============================ ACESSOS (admin) ============================ */
function telaEquipe(){
  if (!PERM.admin) return `<div class="card"><div class="vazio"><b>Acesso restrito</b>Só a Bianca vê esta tela.</div></div>`;
  const permissoes = DB.perfis || [];
  return `<div class="card"><h3>Quem entra na cozinha</h3>
    <div class="lista">${permissoes.map(p=>`<div class="item" onclick="modalAcesso('${p.id}')">
      <div class="ic">${p.papel==='admin'?'★':'◍'}</div>
      <div class="tx"><b>${esc(p.nome)}</b><span>${esc(p.cargo||'')} · ${p.papel==='admin'?'administradora':(p.papel==='cozinha'?'cozinha':'equipe de vendas')}</span></div>
      <div class="vl"><span class="tag ${p.papel==='admin'?'gold':(p.papel==='cozinha'?'ok':'off')}">${p.papel}</span></div>
    </div>`).join('')}</div>
    <button class="btn p full" style="margin-top:12px" onclick="modalNovoAcesso()">＋ Criar pessoa</button>
    <div class="nota">Quem é da cozinha enxerga somente a cozinha. A equipe de vendas não entra aqui, e a cozinha não vê clientes, orçamentos nem financeiro.</div>
  </div>`;
}

function modalNovoAcesso(){
  if (!PERM.admin) return;
  modal(`<h3>Criar pessoa</h3>
    <div class="campo"><label>Nome</label><input id="acNome" placeholder="Nome completo"></div>
    <div class="duo">
      <div class="campo"><label>Usuário</label><input id="acUser" placeholder="ex.: stefanie" autocapitalize="none"></div>
      <div class="campo"><label>Senha</label><input id="acPass" placeholder="mínimo 4"></div>
    </div>
    <div class="campo"><label>Cargo</label><input id="acCargo" placeholder="Ex.: Coordenação da Cozinha"></div>
    <div class="campo"><label>Acesso</label><select id="acPapel">
      <option value="cozinha">Cozinha</option>
      <option value="equipe">Equipe de vendas</option>
      <option value="admin">Administradora</option>
    </select></div>
    <div class="campo"><label><input type="checkbox" id="acCustos" checked> Pode ver custos e valores</label></div>
    <div class="campo"><label><input type="checkbox" id="acExcluir"> Pode excluir registros</label></div>
    <div class="acts"><button class="btn g" onclick="fecharModal()">Cancelar</button>
      <button class="btn p" onclick="criarAcesso()">Criar</button></div>`);
}

async function criarAcesso(){
  const usuario = $('#acUser').value.trim().toLowerCase();
  const senha = $('#acPass').value;
  const nome = $('#acNome').value.trim();
  const cargo = $('#acCargo').value.trim();
  const papel = $('#acPapel').value;
  if (!usuario || !senha || !nome){ toast('Preencha nome, usuário e senha.', true); return; }
  try{
    await api('/rest/v1/rpc/crm_criar_usuario', { method:'POST', body: JSON.stringify({
      p_usuario: usuario, p_senha: senha, p_nome: nome, p_cargo: cargo, p_papel: papel,
      p_cozinha: papel === 'cozinha', p_pode_custos: $('#acCustos').checked, p_pode_excluir: $('#acExcluir').checked
    })});
    fecharModal();
    DB.perfis = await get('/rest/v1/perfis', 'select=id,nome,cargo,papel&order=nome') || [];
    toast('Pessoa criada. Login: ' + usuario);
    render();
  }catch(e){ toast('Não criou: ' + e.message, true); }
}

function modalAcesso(id){
  if (!PERM.admin) return;
  const p = (DB.perfis||[]).find(x=>x.id===id);
  if (!p) return;
  modal(`<h3>${esc(p.nome)}</h3>
    <div class="nota">${esc(p.cargo||'')} · perfil ${esc(p.papel)}</div>
    <div class="sep"></div>
    <div class="campo"><label>Nova senha</label><input id="asPass" placeholder="deixe vazio para não trocar"></div>
    <div class="row">
      <button class="btn sm" onclick="redefinirSenhaAcesso('${p.id}')">Redefinir senha</button>
      ${p.id!==USUARIO.id?`<button class="btn d sm" onclick="excluirAcesso('${p.id}','${esc(p.nome)}')">Excluir pessoa</button>`:''}
      <button class="btn g sm" onclick="fecharModal()">Fechar</button>
    </div>
    <div class="nota">Excluir remove o login de vez. A cozinha perde o acesso na hora.</div>`);
}

async function redefinirSenhaAcesso(id){
  const s = $('#asPass').value;
  if (!s || s.length < 4){ toast('Digite a nova senha (mínimo 4).', true); return; }
  try{
    await api('/rest/v1/rpc/crm_redefinir_senha', { method:'POST', body: JSON.stringify({ p_perfil: id, p_senha: s })});
    fecharModal(); toast('Senha redefinida.');
  }catch(e){ toast('Não trocou: ' + e.message, true); }
}

async function excluirAcesso(id, nome){
  if (!confirm('Excluir o acesso de ' + nome + '? Isso não pode ser desfeito.')) return;
  try{
    await api('/rest/v1/rpc/crm_excluir_usuario', { method:'POST', body: JSON.stringify({ p_perfil: id })});
    fecharModal();
    DB.perfis = await get('/rest/v1/perfis', 'select=id,nome,cargo,papel&order=nome') || [];
    toast('Acesso excluído.'); render();
  }catch(e){ toast('Não excluiu: ' + e.message, true); }
}

/* ============================ CONTA ============================ */
function telaConta(){
  return `<div class="card"><h3>Minha conta</h3>
    <div class="nota">${esc(USUARIO.nome)} · ${esc(USUARIO.cargo||'')}</div>
    <div class="nota">Perfil: <b>${PERM.admin?'Administradora':(PERM.pode_editar?'Cozinha (pode editar)':'Cozinha (somente leitura)')}</b>
      ${PERM.pode_custos?' · vê custos':''}${PERM.pode_excluir?' · pode excluir':''}</div>
    <div class="sep"></div>
    <div class="campo"><label>Nova senha</label><input id="ctPass" type="password" placeholder="mínimo 4 caracteres"></div>
    <button class="btn p" onclick="trocarMinhaSenha()">Trocar senha</button>
  </div>
  <div class="card"><h3>Acesso</h3>
    <div class="nota">Este sistema é só da cozinha. Clientes, orçamentos e financeiro ficam no CRM de vendas, com outro login.</div>
  </div>`;
}

async function trocarMinhaSenha(){
  const s = $('#ctPass').value;
  if (!s || s.length < 4){ toast('A senha precisa de 4 caracteres.', true); return; }
  try{
    await fetch(SB_URL + '/auth/v1/user', {
      method:'PUT',
      headers:{ apikey: SB_KEY, 'Content-Type':'application/json', Authorization:'Bearer ' + TOKEN },
      body: JSON.stringify({ password: s })
    });
    toast('Senha alterada.');
    $('#ctPass').value = '';
  }catch(e){ toast('Não trocou.', true); }
}
