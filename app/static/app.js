const $ = s => document.querySelector(s);
const user = () => new URLSearchParams(location.search).get('user') || $('#userSel').value;
function initUser(){ const u=new URLSearchParams(location.search).get('user'); if(u) $('#userSel').value=u; }
initUser();
$('#userSel').onchange = e => { const p=new URLSearchParams(location.search); p.set('user',e.target.value); location.search=p.toString(); };

document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); $('#tab-'+b.dataset.tab).classList.add('active');
});

async function api(path, opts){ const r=await fetch(path,opts); return r.json(); }

async function loadCircle(){
  const c = await api('/api/circle');
  $('#personLine').textContent = `${c.person.photo} ${c.person.name}, ${c.person.age} · ${c.person.conditions} · ${c.person.contacts} · ${c.facts_count} facts`;
  $('#botStatus').textContent = c.bot_connected ? '📡 Telegram bot connected' : '📴 Telegram not configured (set TELEGRAM_BOT_TOKEN to enable)';
  $('#inviteBtn').onclick = ()=>{ navigator.clipboard?.writeText(c.invite); alert('Invite link (A2):\n'+c.invite); };
}

function cardHTML(d){
  const cls = d.tier==='warning'?'warn':d.tier==='routine'?'rout':'nice';
  return `<div class="card ${cls}" data-id="${d.id}">
    <span class="pill">${d.tier} · target ${d.target}</span>
    <span class="pill">${d.category}</span>
    <span class="pill">recall ${d.retrievability}</span>
    <div><b>Q:</b> ${d.question}</div>
    <div class="row"><button onclick="tryAns(${d.id})">🤔 I tried — reveal answer</button></div>
    <div class="ans" id="ans-${d.id}">💡 ${d.answer}<br/><small>source: ${d.source}</small>
      <div class="rate">
        <button onclick="rate(${d.id},1)">Again</button>
        <button onclick="rate(${d.id},2)">Hard</button>
        <button onclick="rate(${d.id},3)">Good</button>
        <button onclick="rate(${d.id},4)">Easy</button>
      </div></div></div>`;
}
window.tryAns = id => document.getElementById('ans-'+id).classList.add('show');
window.rate = async (id,r) => {
  const res = await api('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fact_id:id,user:user(),rating:r})});
  alert(`Saved (${r}). Next due in ~${res.next_due_days} day(s).`); loadBrief(); loadCoverage();
};

async function loadBrief(){
  const b = await api('/api/brief?user='+user());
  const el = $('#briefList');
  if(!b.due.length && !b.changed.length){ el.innerHTML = `<div class="card"><b>All clear ✅</b> — nothing due. Known: ${b.known} facts.</div>`; return; }
  el.innerHTML = `<div class="card"><b>${b.due.length} due · ${b.changed.length} changed since last brief</b> · known: ${b.known}</div>`
    + b.changed.map(d=>`<div class="card warn"><span class="pill">🆕 changed</span><b>${d.question}</b><br/><small>${d.answer}</small></div>`).join('')
    + b.due.map(cardHTML).join('');
}
$('#refreshBrief').onclick = loadBrief;
$('#markSeen').onclick = async ()=>{ await api('/api/brief/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:user()})}); alert('Brief marked seen. Change flags cleared.'); loadBrief(); };
$('#remindBtn').onclick = async ()=>{
  const chat = prompt('Telegram chat id (or leave blank for localhost preview):','');
  const r = await api('/api/remind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:user(),chat_id:chat||undefined})});
  alert(r.message + '\n\nTelegram: ' + JSON.stringify(r.telegram) + '\n' + r.hint);
};

async function loadFacts(){
  const q = $('#search').value || '';
  const {facts} = await api('/api/facts?q='+encodeURIComponent(q));
  $('#factList').innerHTML = facts.map(f=>`<div class="card"><b>#${f.id} [${f.tier}/${f.category}]</b> ${f.text}<br/><small>source: ${f.source} ${f.is_changed?'· 🆕 changed':''}</small>
    <div class="row"><button onclick="editFact(${f.id})">✏️ edit (flags change B7)</button></div></div>`).join('');
}
$('#search').oninput = loadFacts;
window.editFact = async id => {
  const t = prompt('Edit fact text:'); if(!t) return;
  await api('/api/facts/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})});
  loadFacts(); loadChanges();
};

async function loadCoverage(){
  const c = await api('/api/coverage');
  $('#coverage').innerHTML = `<table><tr><th>Warning sign</th><th>Priya</th><th>Marcus</th><th>Dev</th><th>Covered?</th></tr>` +
    c.grid.map(g=>`<tr><td>${g.question}</td>${['priya','marcus','dev'].map(u=>{const v=g.per_user[u];return `<td class="${v.reliable?'ok':'bad'}">${v.reliable?'✅':'❌'} ${v.retr}</td>`}).join('')}<td>${g.covered?'✅':'⚠️ nobody reliable'}</td></tr>`).join('') + `</table>`
    + (c.alerts.length?`<div class="card warn"><b>⚠️ D2 FAKE alert:</b> ${c.alerts.length} warning sign(s) with no reliable caregiver — e.g. “${c.alerts[0].question}”. Primary would be pinged.</div>`:`<div class="card"><b>All warnings covered ✅</b></div>`)
    + `<div class="card"><b>E3 FAKE:</b> Ruth missed the weight rule twice → caregiver targets raised (demo seed event).</div>`;
}

async function loadChanges(){
  const {events} = await api('/api/changes');
  $('#changes').innerHTML = events.map(e=>`<div class="card"><small>${e.created_at?.slice(0,16)} · ${e.kind}</small><br/>${e.text}</div>`).join('');
}

$('#addFact').onclick = async ()=>{
  const body = {text:$('#fText').value, category:$('#fCat').value, tier:$('#fTier').value, source:$('#fSource').value||user()};
  const r = await api('/api/facts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(r.ok){ alert('Fact added ✅'); $('#fText').value=''; loadFacts(); loadBrief(); } else alert(r.error);
};
$('#uploadBtn').onclick = async ()=>{
  const r = await api('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('#upText').value})});
  $('#drafts').innerHTML = r.drafts.map((d,i)=>`<div class="card">${d}<br/><button onclick="approveDraft(${i})">Approve</button></div>`).join('') || '<p class="muted">No drafts found.</p>';
  window._drafts = r.drafts;
};
window.approveDraft = async i => {
  await api('/api/facts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:window._drafts[i],source:'discharge upload'})});
  alert('Approved ✅'); loadFacts();
};

loadCircle(); loadBrief(); loadFacts(); loadCoverage(); loadChanges();
