/**
 * LUARE EVENTOS — Painel de Atendimento (WhatsApp)
 * Injetado no CRM: mostra as conversas, o que a IA respondeu,
 * e permite assumir a conversa (desliga o bot) a qualquer momento.
 */

(function(){
'use strict';

/* ---------- aba nova no menu ---------- */
function adicionarMenu(){
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-atend]')) return;
  const admin = window.USER && USER.role === 'admin';
  const btn = document.createElement('button');
  btn.dataset.atend = '1';
  btn.innerHTML = '<span class="ic">💬</span>Atendimento<span class="badge" id="badgeAtend" style="display:none"></span>';
  btn.onclick = () => abrirAtendimento();
  nav.insertBefore(btn, nav.querySelector('button:last-child'));
}

/* ---------- tela ---------- */
async function abrirAtendimento(){
  document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('#nav button').forEach(b=>b.classList.remove('act'));
  const meu = document.querySelector('[data-atend]');
  if (meu) meu.classList.add('act');

  let cx = document.getElementById('view-atendimento');
  if (!cx){
    cx = document.createElement('div');
    cx.id = 'view-atendimento';
    cx.className = 'view';
    document.querySelector('main').appendChild(cx);
  }
  cx.classList.add('on');
  document.getElementById('pgTitle').textContent = 'Atendimento WhatsApp';
  document.getElementById('pgActs').innerHTML =
    '<button class="btn s" onclick="window.__recarregarAtend()">↻ Atualizar</button>';

  cx.innerHTML = '<div class="card"><div class="empty">Carregando conversas…</div></div>';
  await window.__recarregarAtend();
}

window.__recarregarAtend = async function(){
  const cx = document.getElementById('view-atendimento');
  if (!cx) return;
  try{
    const conversas = await window.__sbApi('/rest/v1/conversas?select=*&order=ultima_em.desc.nullslast&limit=60');
    const pend = (conversas||[]).filter(c=>c.etapa==='quer_atendimento').length;
    const badge = document.getElementById('badgeAtend');
    if (badge){ badge.textContent = pend; badge.style.display = pend ? 'inline-block' : 'none'; }

    if (!conversas || !conversas.length){
      cx.innerHTML = '<div class="card"><div class="empty"><span class="big">💬</span>' +
        'Nenhuma conversa ainda.<br><small>Quando alguém mandar mensagem no WhatsApp, aparece aqui.</small></div></div>';
      return;
    }

    let html = '<div class="card"><h3>' + conversas.length + ' conversa(s)' +
      (pend ? ' · <span class="tag t-warn">' + pend + ' pedindo atendimento</span>' : '') + '</h3>';

    for (const c of conversas){
      const tel = c.telefone || '';
      const nome = c.nome || tel;
      const quando = c.ultima_em ? new Date(c.ultima_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      const tone = c.etapa === 'quer_atendimento' ? 't-bad' : (c.bot_ativo === false ? 't-mut' : 't-ok');
      const rotulo = c.etapa === 'quer_atendimento' ? 'quer você' : (c.bot_ativo === false ? 'você assumiu' : 'bot ativo');
      html += '<div class="item" style="align-items:flex-start">' +
        '<div class="ico">' + (c.bot_ativo === false ? '👤' : '🤖') + '</div>' +
        '<div class="m"><b>' + esc(nome) + '</b>' +
        '<span>' + esc((c.ultima_msg||'').slice(0,90)) + '</span>' +
        '<span class="sub">' + quando + ' · ' + (c.convidados ? c.convidados + ' conv. ' : '') +
        (c.buffet ? esc(c.buffet) + ' ' : '') + (c.data_desejada ? '· ' + c.data_desejada : '') + '</span></div>' +
        '<span class="tag ' + tone + '">' + rotulo + '</span>' +
        '<button class="btn s sm" onclick="window.__verConversa(\'' + c.id + '\')">Abrir</button>' +
        '</div>';
    }
    html += '</div>';
    cx.innerHTML = html;
  }catch(e){
    cx.innerHTML = '<div class="card"><div class="empty">Não consegui carregar as conversas.<br><small>' +
      esc(e.message) + '</small></div></div>';
  }
};

window.__verConversa = async function(id){
  try{
    const [conv] = await window.__sbApi('/rest/v1/conversas?id=eq.' + id + '&select=*');
    const msgs = await window.__sbApi('/rest/v1/mensagens?conversa_id=eq.' + id + '&select=*&order=criado.asc&limit=200');
    if (!conv) return;

    let corpo = '';
    for (const m of (msgs||[])){
      const dele = m.direcao === 'recebida';
      corpo += '<div style="margin:6px 0;text-align: ' + (dele?'right':'left') + '">' +
        '<div style="display:inline-block;max-width:78%;padding:8px 12px;border-radius:10px;font-size:13.5px;' +
        'background:' + (dele?'#e8ecf7':'#f4ead9') + ';color:#1c2542">' +
        esc(m.texto||'').replace(/\n/g,'<br>') + '</div>' +
        '<div style="font-size:10.5px;color:#8b93a7;margin-top:2px">' +
        (dele?'cliente':'bot') + ' · ' +
        new Date(m.criado).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) +
        '</div></div>';
    }

    modal(
      '<h3>' + esc(conv.nome || conv.telefone) + '</h3>' +
      '<div style="font-size:12.5px;color:var(--mut);margin-bottom:10px">' +
      esc(conv.telefone) + (conv.convidados ? ' · ' + conv.convidados + ' convidados' : '') +
      (conv.data_desejada ? ' · data ' + conv.data_desejada : '') + '</div>' +
      '<div style="max-height:340px;overflow-y:auto;background:#fafbf5;border-radius:10px;padding:12px;margin-bottom:12px">' +
      (corpo || '<div class="empty" style="padding:12px">Sem mensagens</div>') + '</div>' +
      '<div class="macts">' +
      '<button class="btn s" onclick="fecharModal()">Fechar</button>' +
      (conv.bot_ativo === false
        ? '<button class="btn p" onclick="window.__ligarBot(\'' + conv.id + '\')">🤖 Religar o bot</button>'
        : '<button class="btn p" onclick="window.__assumirConversa(\'' + conv.id + '\')">👤 Assumir conversa</button>') +
      '</div>'
    );
  }catch(e){ alert('Erro: ' + e.message); }
};

window.__assumirConversa = async function(id){
  await window.__sbApi('/rest/v1/conversas?id=eq.' + id, {
    method:'PATCH', body: JSON.stringify({ bot_ativo:false, etapa:'atendimento_humano' })
  });
  fecharModal(); window.__recarregarAtend();
};

window.__ligarBot = async function(id){
  await window.__sbApi('/rest/v1/conversas?id=eq.' + id, {
    method:'PATCH', body: JSON.stringify({ bot_ativo:true, etapa:'novo' })
  });
  fecharModal(); window.__recarregarAtend();
};

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- entra em ação quando o CRM estiver pronto ---------- */
// o menu é redesenhado a cada render(): garante o item depois de cada um
const _navOriginal = window.nav;
window.nav = function(){
  if (typeof _navOriginal === 'function') _navOriginal.apply(this, arguments);
  adicionarMenu();
};

// e também observa o login
let tentativas = 0;
const t = setInterval(()=>{
  tentativas++;
  const app = document.getElementById('app');
  if (app && app.classList.contains('on')){
    adicionarMenu();
    if (document.querySelector('[data-atend]')) clearInterval(t);
  }
  if (tentativas > 240) clearInterval(t);
}, 400);

// atualiza o badge de tempos em tempos
setInterval(()=>{ if (document.getElementById('view-atendimento') &&
                       document.getElementById('view-atendimento').classList.contains('on'))
                    window.__recarregarAtend(); }, 30000);

})();
