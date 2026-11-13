/* ============================================================
   COZINHA LUARE — gravação e regras de negócio
   ============================================================ */
const ROTAS = {
  fornecedores: '/rest/v1/cozinha_fornecedores',
  insumos:      '/rest/v1/cozinha_insumos',
  fichas:       '/rest/v1/cozinha_fichas',
  itens:        '/rest/v1/cozinha_ficha_itens',
  eventos:      '/rest/v1/cozinha_eventos',
  pratos:       '/rest/v1/cozinha_evento_pratos',
  compras:      '/rest/v1/cozinha_compras',
  movimentos:   '/rest/v1/cozinha_movimentos',
  desperdicio:  '/rest/v1/cozinha_desperdicio'
};

function exigirEdicao(){
  if (!PERM.pode_editar){ toast('Seu acesso é somente leitura.', true); return false; }
  return true;
}

/* grava (novo ou edição) e recarrega a coleção */
async function gravar(col, dados, id){
  if (!exigirEdicao()) return null;
  try{
    const out = id ? await patch(ROTAS[col], id, dados) : await post(ROTAS[col], dados);
    await recarregar(col);
    return out && out[0] ? out[0] : true;
  }catch(e){
    toast('Não gravou: ' + e.message, true);
    return null;
  }
}

async function apagar(col, id){
  if (!PERM.pode_excluir){ toast('Você não tem permissão para excluir.', true); return false; }
  try{
    const r = await del(ROTAS[col], id);
    if (Array.isArray(r) && r.length === 0){
      toast('O banco recusou a exclusão.', true);
      return false;
    }
    await recarregar(col);
    return true;
  }catch(e){
    toast('Não excluiu: ' + e.message, true);
    return false;
  }
}

async function recarregar(col){
  const ordens = {
    fornecedores:'order=nome', insumos:'order=nome', fichas:'order=nome',
    eventos:'order=data.asc', compras:'order=criado.desc',
    movimentos:'order=criado.desc&limit=300', desperdicio:'order=data.desc&limit=300'
  };
  const q = ordens[col] || '';
  DB[col] = await get(ROTAS[col], q) || [];
  render();
}

/* ---------- insumos ---------- */
async function salvarInsumo(id){
  const nome = $('#iNome').value.trim();
  if (!nome){ toast('Dê um nome ao insumo.', true); return; }
  const dados = {
    nome,
    categoria: $('#iCat').value.trim() || null,
    unidade: $('#iUn').value || 'kg',
    preco: num($('#iPreco').value),
    estoque: num($('#iEstoque').value),
    estoque_minimo: num($('#iMin').value),
    fornecedor_id: $('#iForn').value || null,
    obs: $('#iObs').value.trim() || null
  };
  const r = await gravar('insumos', dados, id);
  if (r){ fecharModal(); toast(id ? 'Insumo atualizado.' : 'Insumo cadastrado.'); render(); }
}

/* ---------- fichas técnicas ---------- */
async function salvarFicha(id){
  const nome = $('#fNome').value.trim();
  if (!nome){ toast('Dê um nome ao prato.', true); return; }
  const dados = {
    nome,
    categoria: $('#fCat').value.trim() || null,
    rendimento: num($('#fRend').value) || 1,
    tempo_prep: $('#fTempo').value ? num($('#fTempo').value) : null,
    modo_preparo: $('#fModo').value.trim() || null,
    obs: $('#fObs').value.trim() || null
  };
  const r = await gravar('fichas', dados, id);
  if (r){
    fecharModal();
    toast(id ? 'Ficha atualizada.' : 'Ficha criada.');
    if (!id && r.id) abrirFicha(r.id);
    else render();
  }
}

async function salvarItemFicha(fichaId){
  const desc = $('#itDesc').value.trim();
  const insumoId = $('#itIns').value || null;
  if (!desc && !insumoId){ toast('Escolha um insumo ou descreva o item.', true); return; }
  const q = num($('#itQtd').value);
  const cu = num($('#itCusto').value);
  const dados = {
    ficha_id: fichaId,
    insumo_id: insumoId,
    descricao: desc || (insumoPorId(insumoId) || {}).nome || null,
    quantidade: q,
    unidade: $('#itUn').value.trim() || null,
    custo_unitario: cu
  };
  const r = await gravar('itens', dados);
  if (r){ await recarregar('fichas'); abrirFicha(fichaId); }
}

async function apagarItemFicha(itemId, fichaId){
  if (await apagar('itens', itemId)) abrirFicha(fichaId);
}

/* quando escolhe o insumo, já traz preço e unidade */
function preencherDoInsumo(){
  const i = insumoPorId($('#itIns').value);
  if (!i) return;
  $('#itCusto').value = num(i.preco);
  $('#itUn').value = i.unidade || '';
  if (!$('#itDesc').value.trim()) $('#itDesc').value = i.nome;
}

/* ---------- eventos ---------- */
function abrirEvento(id){ EV_ABERTO = id; ir('evento'); }

async function salvarPratosDoEvento(evId){
  const linhas = (DB.pratos || []).filter(p => p.cozinha_evento_id === evId);
  for (const p of linhas){
    const el = document.getElementById('pr-' + p.id);
    if (!el) continue;
    const v = num(el.value);
    if (v !== num(p.porcoes)){
      try{ await patch(ROTAS.pratos, p.id, { porcoes: v }); }catch(e){ toast('Não gravou a porção: ' + e.message, true); }
    }
  }
  await recarregar('pratos');
  toast('Porções atualizadas.');
  abrirEvento(evId);
}

async function escalarPrato(evId){
  const fichaId = $('#prFicha').value;
  if (!fichaId){ toast('Escolha o prato.', true); return; }
  const f = fichaPorId(fichaId);
  const ev = (DB.eventos || []).find(e => e.id === evId);
  const porcoes = $('#prPorcoes').value ? num($('#prPorcoes').value) : num(ev && ev.convidados);
  const r = await gravar('pratos', {
    cozinha_evento_id: evId, ficha_id: fichaId,
    nome: f ? f.nome : null, porcoes,
    obs: $('#prObs').value.trim() || null
  });
  if (r){ fecharModal(); abrirEvento(evId); }
}

/* ---------- lista de compras ----------
   Soma o que falta de cada insumo para os pratos escalados,
   desconta o estoque atual e monta a lista. */
async function gerarCompras(evId){
  const ev = (DB.eventos || []).find(e => e.id === evId);
  if (!ev) return;
  const linhas = (DB.pratos || []).filter(p => p.cozinha_evento_id === evId);
  if (!linhas.length){ toast('Escale os pratos do evento antes.', true); return; }

  // necessidade por insumo (regra de três pelo rendimento da ficha)
  const nec = {};
  linhas.forEach(p => {
    const f = p.ficha_id ? fichaPorId(p.ficha_id) : null;
    if (!f) return;
    const rend = num(f.rendimento) || 1;
    const vezes = num(p.porcoes) / rend;
    (DB.itens || []).filter(i => i.ficha_id === f.id).forEach(i => {
      const k = i.insumo_id || ('x:' + (i.descricao || i.id));
      if (!nec[k]) nec[k] = { insumo_id: i.insumo_id, nome: i.descricao || '', unidade: i.unidade || '', total: 0, custo: num(i.custo_unitario) };
      nec[k].total += num(i.quantidade) * vezes;
    });
  });

  const chaves = Object.keys(nec);
  if (!chaves.length){ toast('As fichas escaladas não têm ingredientes.', true); return; }

  // já existe lista para este evento? substitui
  const antigas = (DB.compras || []).filter(c => c.cozinha_evento_id === evId);
  for (const a of antigas){ try{ await del(ROTAS.compras, a.id); }catch(e){} }

  for (const k of chaves){
    const n = nec[k];
    const ins = n.insumo_id ? insumoPorId(n.insumo_id) : null;
    const disponivel = ins ? num(ins.estoque) : 0;
    const falta = Math.max(0, n.total - disponivel);
    if (falta <= 0.0001) continue;
    await post(ROTAS.compras, {
      cozinha_evento_id: evId,
      insumo_id: n.insumo_id || null,
      nome: (ins && ins.nome) || n.nome || 'Item',
      quantidade: Math.round(falta * 100) / 100,
      unidade: (ins && ins.unidade) || n.unidade || null,
      custo_estimado: Math.round(falta * num(n.custo) * 100) / 100,
      comprado: false
    });
  }
  await recarregar('compras');
  toast('Lista de compras gerada.');
  abrirEvento(evId);
}

async function marcarComprado(id, comprado, evId){
  try{
    await patch(ROTAS.compras, id, { comprado });
    await recarregar('compras');
    if (evId) abrirEvento(evId);
  }catch(e){ toast('Não gravou: ' + e.message, true); }
}

/* compra marcada como comprada dá entrada no estoque */
async function darEntradaDaCompra(id, evId){
  const c = (DB.compras || []).find(x => x.id === id);
  if (!c){ return; }
  if (c.comprado){ toast('Esta compra já entrou no estoque.'); return; }
  try{
    await patch(ROTAS.compras, id, { comprado: true });
    if (c.insumo_id){
      const ins = insumoPorId(c.insumo_id);
      if (ins){
        await patch(ROTAS.insumos, ins.id, { estoque: num(ins.estoque) + num(c.quantidade) });
        await post(ROTAS.movimentos, {
          insumo_id: ins.id, tipo: 'entrada', quantidade: num(c.quantidade),
          custo_unitario: num(ins.preco), cozinha_evento_id: evId || null,
          obs: 'Compra do evento'
        });
      }
    }
    await recarregar('insumos');
    await recarregar('compras');
    toast('Entrada lançada no estoque.');
    if (evId) abrirEvento(evId); else render();
  }catch(e){ toast('Não gravou: ' + e.message, true); }
}

/* ---------- movimentos de estoque ---------- */
async function lancarMovimento(){
  const insumoId = $('#mvIns').value;
  if (!insumoId){ toast('Escolha o insumo.', true); return; }
  const tipo = $('#mvTipo').value;
  const q = num($('#mvQtd').value);
  if (!q){ toast('Informe a quantidade.', true); return; }
  const ins = insumoPorId(insumoId);
  const sinal = tipo === 'entrada' ? 1 : (tipo === 'ajuste' ? 0 : -1);
  try{
    await post(ROTAS.movimentos, {
      insumo_id: insumoId, tipo, quantidade: q,
      custo_unitario: num(ins.preco), obs: $('#mvObs').value.trim() || null
    });
    let novo = num(ins.estoque);
    if (tipo === 'ajuste') novo = q;        // ajuste grava o valor contado
    else novo = novo + sinal * q;
    await patch(ROTAS.insumos, insumoId, { estoque: Math.round(novo * 1000) / 1000 });
    fecharModal();
    await recarregar('insumos');
    toast('Movimento lançado.');
  }catch(e){ toast('Não gravou: ' + e.message, true); }
}

/* ---------- desperdício ---------- */
async function salvarDesperdicio(id){
  const dados = {
    cozinha_evento_id: $('#dEv').value || null,
    insumo_id: $('#dIns').value || null,
    prato: $('#dPrato').value.trim() || null,
    quantidade: num($('#dQtd').value),
    unidade: $('#dUn').value.trim() || null,
    motivo: $('#dMotivo').value.trim() || null,
    custo: num($('#dCusto').value),
    data: $('#dData').value || hoje(),
    obs: $('#dObs').value.trim() || null
  };
  if (!dados.quantidade && !dados.prato){ toast('Informe a quantidade ou o prato.', true); return; }
  const r = await gravar('desperdicio', dados, id);
  if (r){ fecharModal(); toast('Desperdício registrado.'); render(); }
}

/* ---------- fornecedores ---------- */
async function salvarFornecedor(id){
  const nome = $('#forNome').value.trim();
  if (!nome){ toast('Dê um nome ao fornecedor.', true); return; }
  const r = await gravar('fornecedores', {
    nome,
    contato: $('#forContato').value.trim() || null,
    telefone: $('#forTel').value.trim() || null,
    categoria: $('#forCat').value.trim() || null,
    prazo: $('#forPrazo').value.trim() || null,
    obs: $('#forObs').value.trim() || null
  }, id);
  if (r){ fecharModal(); toast('Fornecedor salvo.'); render(); }
}
