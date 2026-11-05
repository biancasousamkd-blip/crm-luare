/* ============================================================
   CRM LUARE EVENTOS — FASE 2 · camada de dados compartilhada
   Supabase (Postgres + Auth). Substitui o localStorage local.
   Carregado DEPOIS de app1/app2/app3: troca as funções de
   persistência e o login por versões com banco na nuvem.
   ============================================================ */
(function(){
'use strict';

const SB_URL = 'https://cpvqnvonltcuzsnoigci.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwdnFudm9ubHRjdXpzbm9pZ2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0Mjg2NDIsImV4cCI6MjEwOTAwNDY0Mn0.cO7VJhpDEIw9kHwAnZfFFi0jreoA7BHp5fnxNyTAJzs';
const SESSAO = 'luare_crm_sessao';
let TOKEN = null;          // access_token do Supabase
let USER_ID = null;

/* ---------- cliente REST mínimo (sem SDK, sem build) ---------- */
async function api(caminho, opcoes){
  opcoes = opcoes || {};
  const headers = Object.assign({
    'apikey': SB_KEY,
    'Content-Type': 'application/json'
  }, opcoes.headers || {});
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  const resp = await fetch(SB_URL + caminho, Object.assign({}, opcoes, { headers }));
  const texto = await resp.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch(e) { dados = texto; }
  if (!resp.ok) {
    const msg = (dados && (dados.message || dados.error_description || dados.error)) || ('HTTP ' + resp.status);
    throw new Error(msg);
  }
  return dados;
}

/* ---------- AUTH ---------- */
async function loginUsuario(usuario, senha){
  const email = usuario.toLowerCase().trim() + '@crm.luare.local';
  const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha })
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('Usuário ou senha incorretos.');
  TOKEN = d.access_token; USER_ID = d.user.id;
  try { sessionStorage.setItem(SESSAO, JSON.stringify({
    token: TOKEN, id: USER_ID, refresh: d.refresh_token, exp: Date.now() + (d.expires_in||3600)*1000
  })); } catch(e){}
  return d.user;
}

async function revalidarSessao(){
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(SESSAO) || 'null'); } catch(e){}
  if (!s || !s.token) return null;
  // tenta renovar com o refresh_token (a sessão dura dias, não 1 hora)
  if (s.refresh) {
    try {
      const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh })
      });
      const d = await r.json();
      if (r.ok && d.access_token) {
        TOKEN = d.access_token; USER_ID = d.user.id;
        sessionStorage.setItem(SESSAO, JSON.stringify({
          token: TOKEN, id: USER_ID, refresh: d.refresh_token, exp: Date.now() + (d.expires_in||3600)*1000
        }));
        return d.user;
      }
    } catch(e){}
  }
  TOKEN = s.token; USER_ID = s.id;
  return { id: s.id };
}

/* ---------- CONVERSÃO banco <-> tela ---------- */
const nz = v => (v === null || v === undefined) ? '' : v;
const vazio = v => (!v || v === '') ? null : v;

function cliDoBanco(r){
  return { id:r.id, nome:r.nome, telefone:nz(r.telefone), email:nz(r.email),
           origem:r.origem||'Outro', funil:r.funil||'Novo contato', obs:nz(r.obs),
           criado:r.criado, _db:true };
}
function cliParaBanco(c){
  return { nome:c.nome, telefone:vazio(c.telefone), email:vazio(c.email),
           origem:c.origem||'Outro', funil:c.funil||'Novo contato', obs:vazio(c.obs) };
}
function orcDoBanco(r){
  return { id:r.id, numero:r.numero, clienteId:r.cliente_id, dataEvento:nz(r.data_evento),
           duracao:r.duracao, buffet:r.buffet, dia:r.dia, convidados:r.convidados,
           desconto:Number(r.desconto||0), extras:r.extras||[],
           servicos:r.servicos||[],
           valorManual:Number(r.valor_manual||0),
           obs:nz(r.obs),
           total:Number(r.total||0), det:r.detalhe||{}, status:r.status,
           vistoEm:r.visto_em, criado:r.criado, _db:true };
}
function orcParaBanco(o, det){
  return { numero:o.numero, cliente_id:real(o.clienteId), data_evento:vazio(o.dataEvento),
           duracao:o.duracao, buffet:o.buffet, dia:o.dia, convidados:o.convidados,
           desconto:o.desconto||0, extras:o.extras||[],
           servicos:o.servicos||[],
           valor_manual:(parseFloat(o.valorManual)||0)||null,
           obs:vazio(o.obs),
           total:o.total, detalhe:det||null, status:o.status||'novo', visto_em:o.vistoEm||null };
}
function evDoBanco(r){
  return { id:r.id, orcId:r.orc_id, clienteId:r.cliente_id, tipo:nz(r.tipo), data:nz(r.data),
           hora:nz(r.hora), convidados:r.convidados||0, duracao:r.duracao||4,
           dia:r.dia||'semana', buffet:nz(r.buffet), valorTotal:Number(r.valor_total||0),
           status:r.status, obs:nz(r.obs), posContato:!!r.pos_contato, criado:r.criado, _db:true };
}
function evParaBanco(e){
  return { orc_id:real(e.orcId), cliente_id:real(e.clienteId), tipo:vazio(e.tipo),
           data:vazio(e.data), hora:vazio(e.hora), convidados:e.convidados||0,
           duracao:e.duracao||4, dia:e.dia||'semana', buffet:vazio(e.buffet),
           valor_total:e.valorTotal||0, status:e.status||'reservado',
           obs:vazio(e.obs), pos_contato:!!e.posContato };
}
function lanDoBanco(r){
  return { id:r.id, tipo:r.tipo, clienteId:r.cliente_id, eventoId:r.evento_id,
           desc:nz(r.descricao), valor:Number(r.valor||0), venc:nz(r.vencimento),
           pago:!!r.pago, pagoEm:nz(r.pago_em), criado:r.criado, _db:true };
}
function lanParaBanco(l){
  return { tipo:l.tipo, cliente_id:real(l.clienteId), evento_id:real(l.eventoId),
           descricao:vazio(l.desc), valor:l.valor, vencimento:vazio(l.venc),
           pago:!!l.pago, pago_em:vazio(l.pagoEm) };
}


/* ---------- ESCALA DA EQUIPE ---------- */
function escDoBanco(r){
  return { id:r.id, eventoId:r.evento_id, nome:r.nome, funcao:nz(r.funcao),
           telefone:nz(r.telefone), valor:Number(r.valor||0),
           pago:!!r.pago, pagoEm:nz(r.pago_em), obs:nz(r.obs), criado:r.criado, _db:true };
}
function escParaBanco(x){
  return { evento_id:real(x.eventoId), nome:x.nome, funcao:vazio(x.funcao),
           telefone:vazio(x.telefone), valor:x.valor||0, pago:!!x.pago,
           pago_em:vazio(x.pagoEm), obs:vazio(x.obs) };
}
/* ---------- FORNECEDORES EXTERNOS ---------- */
function fornDoBanco(r){
  return { id:r.id, eventoId:r.evento_id, nome:r.nome, servico:nz(r.servico),
           telefone:nz(r.telefone), custo:Number(r.custo||0), repasse:Number(r.repasse||0),
           pago:!!r.pago, recebido:!!r.recebido, obs:nz(r.obs), criado:r.criado, _db:true };
}
function fornParaBanco(x){
  return { evento_id:real(x.eventoId), nome:x.nome, servico:vazio(x.servico),
           telefone:vazio(x.telefone), custo:x.custo||0, repasse:x.repasse||0,
           pago:!!x.pago, recebido:!!x.recebido, obs:vazio(x.obs) };
}
/* ---------- CUSTOS FIXOS E VARIÁVEIS ---------- */
function custoDoBanco(r){
  return { id:r.id, nome:r.nome, tipo:r.tipo||'fixo', categoria:nz(r.categoria),
           valor:Number(r.valor||0), dia_venc:r.dia_venc, ativo:r.ativo!==false,
           obs:nz(r.obs), criado:r.criado, _db:true };
}
function custoParaBanco(c){
  return { nome:c.nome, tipo:c.tipo||'fixo', categoria:vazio(c.categoria),
           valor:c.valor||0, dia_venc:c.dia_venc||null, ativo:c.ativo!==false,
           obs:vazio(c.obs) };
}

/* ---------- sincronização ----------
   Estratégia: compara o que está em memória (alterado pela tela)
   com o último estado conhecido do banco e envia só a diferença.
   Simples, sem reescrever cada função da interface. */
let ULTIMO = { clientes:{}, orcamentos:{}, eventos:{}, lancamentos:{},
               escala:{}, fornecedores:{}, custos:{} };
let SINCRONIZANDO = false;
let MAPA_ID = {};      // id criado na tela -> id gerado pelo banco
let ERROS = [];        // falhas de gravação, para mostrar ao usuário

// traduz um id local para o id real do banco (quando já existe)
function real(id){ return MAPA_ID[id] || vazio(id); }

function indexar(lista){ const m={}; (lista||[]).forEach(x=>m[x.id]=JSON.stringify(x)); return m; }

async function enviarDiferencas(){
  if (SINCRONIZANDO) return;
  SINCRONIZANDO = true;
  ERROS = [];
  try {
    // A ORDEM IMPORTA: cliente -> orçamento -> evento -> lançamento.
    // Antes o lançamento era gravado antes do evento existir, e o vínculo
    // (evento_id) ia com um id que ainda não estava no banco — o banco recusava
    // e a parcela nunca aparecia. Foi por isso que o financeiro ficou vazio.
    const mapa = [
      ['clientes',   '/rest/v1/clientes',    cliDoBanco, cliParaBanco, 'nome'],
      ['orcamentos', '/rest/v1/orcamentos',  orcDoBanco, (o)=>orcParaBanco(o, o.det), 'numero'],
      ['eventos',    '/rest/v1/eventos',     evDoBanco,  evParaBanco, 'tipo'],
      ['lancamentos','/rest/v1/lancamentos', lanDoBanco, lanParaBanco, 'desc'],
      // dependem do evento já existir no banco, por isso vêm depois
      ['escala',     '/rest/v1/escala',      escDoBanco, escParaBanco, 'nome'],
      ['fornecedores','/rest/v1/fornecedores_evento', fornDoBanco, fornParaBanco, 'nome'],
      ['custos',     '/rest/v1/custos',      custoDoBanco, custoParaBanco, 'nome']
    ];
    for (const [chave, rota, deBanco, paraBanco, rotulo] of mapa){
      const atual = DB[chave] || [];
      const antes = ULTIMO[chave] || {};
      const vistos = {};
      for (const item of atual){
        vistos[item.id] = true;
        const json = JSON.stringify(item);
        if (antes[item.id] === json) continue;          // não mudou
        if (item._db){
          // UPDATE
          try{
            const corpo = paraBanco(item);
            await api(rota + '?id=eq.' + encodeURIComponent(item.id), {
              method:'PATCH', body: JSON.stringify(corpo), headers:{'Prefer':'return=minimal'}
            });
          }catch(e){ console.warn('falha ao atualizar', chave, item.id, e.message); }
        } else {
          // INSERT
          try{
            const corpo = paraBanco(item);
            const feito = await api(rota, { method:'POST',
              body: JSON.stringify(corpo),
              headers:{'Prefer':'return=representation'} });
            if (feito && feito[0] && feito[0].id){
              const novo = deBanco(feito[0]);
              // troca o objeto na lista pelo que veio do banco (id real)
              const i = atual.findIndex(x=>x.id===item.id);
              if (i >= 0) atual[i] = novo;
              // guarda a tradução id-local -> id-do-banco para os filhos
              MAPA_ID[item.id] = novo.id;
            }
          }catch(e){
            console.warn('falha ao inserir', chave, rotulo, e.message);
            ERROS.push(rotulo + ': ' + e.message);
          }
        }
      }
      // REMOÇÕES
      for (const id in antes){
        if (!vistos[id] && antes[id] !== undefined){
          try{ await api(rota + '?id=eq.' + encodeURIComponent(id), { method:'DELETE' }); }
          catch(e){ console.warn('falha ao excluir', chave, id, e.message); }
        }
      }
      ULTIMO[chave] = indexar(DB[chave]);
    }
  } finally {
    SINCRONIZANDO = false;
    // se algo não gravou, a pessoa PRECISA saber — antes falhava em silêncio
    if (ERROS.length){
      console.warn('não gravou:', ERROS);
      mostrarFalha(ERROS);
    }
  }
}

function mostrarFalha(lista){
  let el = document.getElementById('falhaBanco');
  if (!el){
    el = document.createElement('div');
    el.id = 'falhaBanco';
    el.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;max-width:520px;margin:auto;'+
      'background:#7a1f1f;color:#fff;padding:12px 40px 12px 14px;border-radius:8px;font-size:12.5px;'+
      'z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.3);line-height:1.45';
    document.body.appendChild(el);
  }
  el.innerHTML = '<b>Não consegui salvar no banco</b><br>' +
    lista.slice(0,2).map(e=>String(e).replace(/</g,'&lt;')).join('<br>') +
    '<span style="position:absolute;right:10px;top:8px;cursor:pointer;font-size:16px" ' +
    'onclick="this.parentNode.remove()">×</span>';
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 12000);
}

async function carregarTudo(){
  const [cli, orc, ev, lan, perf, esc, forn, cust] = await Promise.all([
    api('/rest/v1/clientes?select=*&order=criado.desc'),
    api('/rest/v1/orcamentos?select=*&order=criado.desc'),
    api('/rest/v1/eventos?select=*&order=data.desc'),
    api('/rest/v1/lancamentos?select=*&order=criado.desc'),
    api('/rest/v1/perfis?select=*'),
    api('/rest/v1/escala?select=*&order=criado.desc'),
    api('/rest/v1/fornecedores_evento?select=*&order=criado.desc'),
    api('/rest/v1/custos?select=*&order=criado.desc')
  ]);
  DB.clientes    = (cli||[]).map(cliDoBanco);
  DB.orcamentos  = (orc||[]).map(orcDoBanco);
  DB.eventos     = (ev||[]).map(evDoBanco);
  DB.lancamentos = (lan||[]).map(lanDoBanco);
  DB.escala      = (esc||[]).map(escDoBanco);
  DB.fornecedores= (forn||[]).map(fornDoBanco);
  DB.custos      = (cust||[]).map(custoDoBanco);
  ULTIMO = {
    clientes: indexar(DB.clientes), orcamentos: indexar(DB.orcamentos),
    eventos: indexar(DB.eventos), lancamentos: indexar(DB.lancamentos),
    escala: indexar(DB.escala), fornecedores: indexar(DB.fornecedores),
    custos: indexar(DB.custos)
  };
  return perf||[];
}

/* ---------- assume o controle ---------- */

// 1. salvar() passa a gravar no banco (mantendo o cache local como espelho)
window.salvar = function(){
  store.set(LS, JSON.stringify(DB));
  enviarDiferencas().catch(e=>console.warn('sincronização:', e.message));
};

// 2. login real
window.entrar = async function(){
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  try{
    const conta = await loginUsuario(u, p);
    const perfis = await carregarTudo();
    const meu = (perfis||[]).find(x=>x.id===conta.id) || {};
    USER = { id:conta.id, user:u.toLowerCase(), nome:meu.nome || conta.email,
             cargo:meu.cargo || '', role:meu.papel || 'equipe' };
    try{ sessionStorage.setItem('luare_user', USER.id); }catch(e){}
    document.getElementById('login').style.display='none';
    document.getElementById('app').classList.add('on');
    document.getElementById('whoName').textContent = USER.nome;
    document.getElementById('whoRole').textContent = USER.cargo;
    let v = 'painel';
    try{ v = sessionStorage.getItem('luare_view') || 'painel'; }catch(e){}
    VIEW = v; ir(VIEW);
    iniciarTempoReal();
  }catch(e){
    err.textContent = e.message || 'Não foi possível entrar.';
  }
};

// 3. sair limpa a sessão do banco
window.sair = function(){
  try{ sessionStorage.removeItem(SESSAO); sessionStorage.removeItem('luare_user'); sessionStorage.removeItem('luare_view'); }catch(e){}
  location.reload();
};

// 4. número de orçamento vem do banco (sem duplicar entre as pessoas)
async function numeroReal(){
  try{ return await api('/rest/v1/rpc/proximo_numero_orcamento', { method:'POST', body:'{}' }); }
  catch(e){ return 'ORC-' + new Date().getFullYear() + '-' + Math.floor(Math.random()*900+100); }
}

// 5. tela de carregamento e retomada de sessão
async function iniciar(){
  const alvo = document.getElementById('login');
  const caixa = alvo && alvo.querySelector('.login-box');
  if (caixa) {
    const aviso = document.createElement('div');
    aviso.id = 'sbStatus';
    aviso.style.cssText = 'font-size:11.5px;margin-top:12px;color:#6b7285';
    aviso.textContent = 'Banco compartilhado · conectando…';
    caixa.appendChild(aviso);
  }
  try{
    const conta = await revalidarSessao();
    if (conta && conta.id){
      const perfis = await carregarTudo();
      const meu = (perfis||[]).find(x=>x.id===conta.id) || {};
      USER = { id:conta.id, user:'', nome:meu.nome||'', cargo:meu.cargo||'', role:meu.papel||'equipe' };
      if (alvo) alvo.style.display='none';
      document.getElementById('app').classList.add('on');
      document.getElementById('whoName').textContent = USER.nome;
      document.getElementById('whoRole').textContent = USER.cargo;
      let v='painel'; try{ v = sessionStorage.getItem('luare_view')||'painel'; }catch(e){}
      VIEW=v; ir(VIEW);
      iniciarTempoReal();
      return;
    }
  }catch(e){ console.warn('sessão:', e.message); }
  const st = document.getElementById('sbStatus');
  if (st) st.textContent = 'Banco compartilhado conectado ✓';
  render();
}

/* ---------- tempo real: quando o outro cadastra, aparece aqui ---------- */
let CANAL = null;
function iniciarTempoReal(){
  if (CANAL || !TOKEN) return;
  // atualiza a cada 20s (simples e confiável, sem depender de websocket)
  CANAL = setInterval(async ()=>{
    if (document.getElementById('modalBg').classList.contains('on')) return; // não atrapalha quem está editando
    try{
      const antes = JSON.stringify([DB.clientes.length, DB.orcamentos.length, DB.eventos.length, DB.lancamentos.length,
                                   soma(DB.lancamentos.filter(l=>l.pago),l=>l.valor)]);
      await carregarTudo();
      const depois = JSON.stringify([DB.clientes.length, DB.orcamentos.length, DB.eventos.length, DB.lancamentos.length,
                                    soma(DB.lancamentos.filter(l=>l.pago),l=>l.valor)]);
      if (antes !== depois) render();
    }catch(e){}
  }, 20000);
}

// expõe o número real para a criação de orçamento
window.__numeroOrcamento = numeroReal;

// expõe a API para outros módulos (painel de atendimento)
window.__sbApi = api;
window.__sbConfig = { url: SB_URL, key: SB_KEY };

// espera a sincronização terminar e devolve os ids que o banco gerou
window.__aposSalvar = async function(){
  // dá até 6s para o envio terminar
  for (let i=0; i<24; i++){
    if (!SINCRONIZANDO) break;
    await new Promise(r=>setTimeout(r,250));
  }
  await new Promise(r=>setTimeout(r,150));
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();

})();
