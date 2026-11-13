/* ============================================================
   COZINHA LUARE — núcleo: login, sessão, banco, utilidades
   Banco: mesmo projeto Supabase do CRM, isolado por papel 'cozinha'
   ============================================================ */
const SB_URL = 'https://cpvqnvonltcuzsnoigci.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwdnFudm9ubHRjdXpzbm9pZ2NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0Mjg2NDIsImV4cCI6MjEwOTAwNDY0Mn0.cO7VJhpDEIw9kHwAnZfFFi0jreoA7BHp5fnxNyTAJzs';
const CHAVE_SESSAO = 'luare_cozinha_sessao';

let TOKEN = null;
let USUARIO = null;        // { id, nome, cargo, papel }
let PERM = { pode_editar:false, pode_custos:false, pode_excluir:false };
const DB = {};             // coleções carregadas

/* ---------- REST ---------- */
async function api(caminho, opcoes){
  opcoes = opcoes || {};
  const h = Object.assign({ apikey: SB_KEY, 'Content-Type':'application/json' }, opcoes.headers || {});
  if (TOKEN) h['Authorization'] = 'Bearer ' + TOKEN;
  const r = await fetch(SB_URL + caminho, Object.assign({}, opcoes, { headers:h }));
  const txt = await r.text();
  let d = null;
  try { d = txt ? JSON.parse(txt) : null; } catch(e){ d = txt; }
  if (!r.ok) {
    const m = (d && (d.message || d.hint || d.error_description || d.error)) || ('Erro ' + r.status);
    throw new Error(m);
  }
  return d;
}
const get  = (rota, q) => api(rota + (q ? '?' + q : ''));
const post = (rota, corpo) => api(rota, { method:'POST', body: JSON.stringify(corpo), headers:{ 'Prefer':'return=representation' } });
const patch= (rota, id, corpo) => api(rota + '?id=eq.' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify(corpo), headers:{ 'Prefer':'return=representation' } });
const del  = (rota, id) => api(rota + '?id=eq.' + encodeURIComponent(id), { method:'DELETE' });

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s === null || s === undefined ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const num = v => Number(String(v == null ? 0 : v).replace(',', '.')) || 0;
const moeda = v => (Number(v)||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const qtd = v => (Number(v)||0).toLocaleString('pt-BR', { maximumFractionDigits:2 });
const iso = d => { const x = d ? new Date(d + 'T12:00:00') : new Date(); return x.toISOString().slice(0,10); };
const hoje = () => iso();
const dataBR = d => {
  if (!d) return '—';
  const p = String(d).slice(0,10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d;
};
const diaSemana = d => {
  if (!d) return '';
  return ['dom','seg','ter','qua','qui','sex','sáb'][new Date(d + 'T12:00:00').getDay()];
};
const uid = () => crypto.randomUUID();

function toast(msg, erro){
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast on' + (erro ? ' erro' : '');
  clearTimeout(t._t);
  t._t = setTimeout(()=>{ t.className = 'toast'; }, 2600);
}
function soNomeLogado(){ return USUARIO ? (USUARIO.nome || '').split(' ')[0] : ''; }

/* ---------- sessão ---------- */
async function loginUsuario(usuario, senha){
  const email = usuario.toLowerCase().trim() + '@crm.luare.local';
  const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method:'POST',
    headers:{ apikey: SB_KEY, 'Content-Type':'application/json' },
    body: JSON.stringify({ email, password: senha })
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('Usuário ou senha incorretos.');
  TOKEN = d.access_token;
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify({
    token: TOKEN, refresh: d.refresh_token, id: d.user.id, exp: Date.now() + (d.expires_in || 3600) * 1000
  }));
  return d.user;
}
async function retomarSessao(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch(e){}
  if (!s || !s.token) return null;
  if (s.refresh){
    try{
      const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
        method:'POST', headers:{ apikey: SB_KEY, 'Content-Type':'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh })
      });
      const d = await r.json();
      if (r.ok && d.access_token){
        TOKEN = d.access_token;
        localStorage.setItem(CHAVE_SESSAO, JSON.stringify({
          token: TOKEN, refresh: d.refresh_token, id: d.user.id, exp: Date.now() + (d.expires_in || 3600) * 1000
        }));
        return d.user;
      }
    } catch(e){}
  }
  TOKEN = s.token;
  return { id: s.id };
}
function sair(){
  localStorage.removeItem(CHAVE_SESSAO);
  location.reload();
}

/* ---------- perfil e permissões ---------- */
async function carregarPerfil(id){
  const [perfis, perm] = await Promise.all([
    get('/rest/v1/perfis', 'select=id,nome,cargo,papel&id=eq.' + encodeURIComponent(id)),
    get('/rest/v1/cozinha_permissoes', 'select=*&perfil_id=eq.' + encodeURIComponent(id))
  ]);
  const p = (perfis || [])[0];
  if (!p) throw new Error('Perfil não encontrado.');
  USUARIO = p;
  const adm = p.papel === 'admin';
  const c = (perm || [])[0];
  // administradora manda em tudo; a cozinha segue a permissão gravada
  PERM = adm
    ? { pode_editar:true, pode_custos:true, pode_excluir:true, admin:true }
    : {
        pode_editar: !!(c && c.pode_editar),
        pode_custos: !!(c && c.pode_custos),
        pode_excluir: !!(c && c.pode_excluir),
        admin:false
      };
  if (!adm && !c) throw new Error('Seu acesso à cozinha foi desativado. Fale com a Bianca.');
  return p;
}

/* ---------- carregar tudo ---------- */
async function carregarDados(){
  const [
    fornecedores, insumos, fichas, itens, eventos, pratos, compras, movs, desperdicio, perfis
  ] = await Promise.all([
    get('/rest/v1/cozinha_fornecedores', 'select=*&order=nome'),
    get('/rest/v1/cozinha_insumos', 'select=*&order=nome'),
    get('/rest/v1/cozinha_fichas', 'select=*&order=nome'),
    get('/rest/v1/cozinha_ficha_itens', 'select=*'),
    get('/rest/v1/cozinha_eventos', 'select=*&order=data.asc'),
    get('/rest/v1/cozinha_evento_pratos', 'select=*'),
    get('/rest/v1/cozinha_compras', 'select=*&order=criado.desc'),
    get('/rest/v1/cozinha_movimentos', 'select=*&order=criado.desc&limit=300'),
    get('/rest/v1/cozinha_desperdicio', 'select=*&order=data.desc&limit=300'),
    PERM.admin ? get('/rest/v1/perfis', 'select=id,nome,cargo,papel&order=nome') : Promise.resolve([])
  ]);
  DB.fornecedores = fornecedores || [];
  DB.insumos      = insumos || [];
  DB.fichas       = fichas || [];
  DB.itens        = itens || [];
  DB.eventos      = eventos || [];
  DB.pratos       = pratos || [];
  DB.compras      = compras || [];
  DB.movimentos   = movs || [];
  DB.desperdicio  = desperdicio || [];
  DB.perfis       = perfis || [];
}

/* ---------- cálculos centrais ---------- */
// custo dos ingredientes de uma ficha
function custoFicha(fichaId){
  return (DB.itens || [])
    .filter(i => i.ficha_id === fichaId)
    .reduce((s,i) => s + num(i.quantidade) * num(i.custo_unitario), 0);
}
// custo por porção
function custoPorcao(f){
  const rend = num(f.rendimento) || 0;
  if (!rend) return 0;
  return custoFicha(f.id) / rend;
}
const insumoPorId = id => (DB.insumos || []).find(i => i.id === id);
const fichaPorId  = id => (DB.fichas  || []).find(f => f.id === id);
const fornecedorPorId = id => (DB.fornecedores || []).find(f => f.id === id);

// quanto um evento custa em comida (pelas fichas escaladas)
function custoEvento(evId){
  const linhas = (DB.pratos || []).filter(p => p.cozinha_evento_id === evId);
  let total = 0, porcao = 0;
  linhas.forEach(p => {
    const f = p.ficha_id ? fichaPorId(p.ficha_id) : null;
    if (!f) return;
    const cp = custoPorcao(f);
    total += cp * num(p.porcoes);
    porcao += num(p.porcoes);
  });
  return { total, porcao, linhas: linhas.length };
}

// estoque baixo
function insumosBaixos(){
  return (DB.insumos || []).filter(i => num(i.estoque) <= num(i.estoque_minimo) && i.ativo !== false);
}
function valorEstoque(){
  return (DB.insumos || []).reduce((s,i) => s + num(i.estoque) * num(i.preco), 0);
}
function proximosEventos(dias){
  const limite = new Date(); limite.setDate(limite.getDate() + (dias || 7));
  const lim = limite.toISOString().slice(0,10);
  return (DB.eventos || [])
    .filter(e => e.data && e.data >= hoje() && e.data <= lim && e.status !== 'cancelado')
    .sort((a,b) => a.data.localeCompare(b.data));
}

/* ---------- modal ---------- */
function modal(html){
  $('#mbox').innerHTML = html;
  $('#mbg').classList.add('on');
}
function fecharModal(){ $('#mbg').classList.remove('on'); }
document.addEventListener('click', e => { if (e.target.id === 'mbg') fecharModal(); });

/* ---------- navegação ---------- */
let TELA = 'painel';
function ir(tela){
  TELA = tela;
  try { localStorage.setItem('luare_cozinha_tela', tela); } catch(e){}
  render();
}

/* ---------- boot ---------- */
function pintarLogos(){
  if (window.LOGO_CLARA){
    const a = $('#logoLogin'); if (a) a.src = window.LOGO_CLARA;
    const b = $('#logoTop');   if (b) b.src = window.LOGO_DOURADA;
  }
}

async function entrarNaTela(userId){
  const p = await carregarPerfil(userId);
  await carregarDados();
  $('#login').style.display = 'none';
  $('#app').classList.add('on');
  $('#quem').textContent = p.nome || 'Cozinha';
  $('#papel').textContent = PERM.admin ? 'Administradora' : (p.cargo || 'Cozinha');
  let t = 'painel';
  try { t = localStorage.getItem('luare_cozinha_tela') || 'painel'; } catch(e){}
  const permitidas = telasPermitidas().map(x => x.id);
  ir(permitidas.includes(t) ? t : permitidas[0]);
}

async function entrar(){
  const err = $('#loginErr');
  err.textContent = '';
  const u = $('#u').value.trim();
  const p = $('#p').value;
  if (!u || !p){ err.textContent = 'Preencha usuário e senha.'; return; }
  $('#loginErr').textContent = 'Entrando…';
  try{
    const conta = await loginUsuario(u, p);
    await entrarNaTela(conta.id);
  }catch(e){
    TOKEN = null;
    err.textContent = e.message || 'Não foi possível entrar.';
  }
}

async function iniciar(){
  pintarLogos();
  try{
    const conta = await retomarSessao();
    if (conta && conta.id){
      $('#loginErr').textContent = 'Retomando sessão…';
      await entrarNaTela(conta.id);
      return;
    }
  }catch(e){
    console.warn('sessão:', e.message);
    try { localStorage.removeItem(CHAVE_SESSAO); } catch(_){}
  }
  pintarLogos();
  $('#loginErr').textContent = '';
}

document.addEventListener('DOMContentLoaded', iniciar);
