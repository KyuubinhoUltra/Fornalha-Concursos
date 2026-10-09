(() => {
const KEY = "fornalha-concursos-v1";
const DAY = 864e5, DAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const BOX_DAYS = [0, 1, 2, 4, 8, 16];
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ---------- estado ----------
const fresh = () => ({ answers:{}, cards:{}, sessions:[], plan:{}, topics:{}, custom:{questions:[],flashcards:[]}, examDate:"" });
let S;
try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { S = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

const subjects = () => DATA.subjects;
const subj = id => subjects().find(s => s.id === id)?.name || id;
const questions = () => [...DATA.questions, ...S.custom.questions];
const cards = () => [...DATA.flashcards, ...S.custom.flashcards];
const subjOptions = (all) => (all ? '<option value="">Todas as matérias</option>' : "") +
  subjects().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");

// ---------- roteador ----------
const routes = { painel, questoes, flashcards, cronograma, foco, dados };
function route() {
  const name = (location.hash.replace("#/", "") || "painel").split("?")[0];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#/" + name));
  (routes[name] || painel)($("#app"));
}
addEventListener("hashchange", () => { stopTimer(); route(); });

// ---------- painel ----------
function painel(el) {
  const ans = Object.values(S.answers), ok = ans.filter(a => a.ok).length;
  const mins = S.sessions.reduce((t, x) => t + x.min, 0);
  const due = cards().filter(c => isDue(c.id)).length;
  let days = "";
  if (S.examDate) {
    const d = Math.ceil((new Date(S.examDate + "T00:00:00") - Date.now()) / DAY);
    days = d >= 0 ? `${d}` : "—";
  }
  const rows = subjects().map(s => {
    const qs = questions().filter(q => q.s === s.id), done = qs.filter(q => S.answers[q.id]);
    const hit = done.filter(q => S.answers[q.id].ok).length;
    const pct = done.length ? Math.round(hit / done.length * 100) : 0;
    const tdone = s.topics.filter((_, i) => S.topics[s.id + ":" + i]).length;
    return `<tr><td>${esc(s.name)}</td><td>${pct}% <span class="mut small">(${hit}/${done.length})</span></td>
      <td><div class="bar"><i style="width:${s.topics.length ? tdone / s.topics.length * 100 : 0}%"></i></div><span class="mut small">${tdone}/${s.topics.length} tópicos</span></td></tr>`;
  }).join("");
  el.innerHTML = `<h1>Painel de estudos</h1>
  <div class="grid">
    <div class="card stat"><b>${ans.length}</b><span>questões respondidas</span></div>
    <div class="card stat"><b>${ans.length ? Math.round(ok / ans.length * 100) : 0}%</b><span>de acerto</span></div>
    <div class="card stat"><b>${(mins / 60).toFixed(1)}h</b><span>horas estudadas</span></div>
    <div class="card stat"><b>${due}</b><span>flashcards para revisar</span></div>
    <div class="card stat"><b>${days || "—"}</b><span>dias para a prova</span></div>
  </div>
  <div class="card"><div class="row"><label>Data da prova: <input type="date" id="exam" value="${esc(S.examDate)}"></label></div>
  <table><tr><th>Matéria</th><th>Acertos</th><th>Edital</th></tr>${rows}</table></div>
  <p class="mut small">Conteúdo de exemplo — confira o edital oficial do CBMMA e importe o seu material na aba Dados.</p>`;
  $("#exam").onchange = e => { S.examDate = e.target.value; save(); painel(el); };
}

// ---------- questões ----------
let qState = { subject: "", queue: [], i: 0, onlyWrong: false };
function questoes(el) {
  el.innerHTML = `<h1>Banco de questões</h1>
  <div class="row"><select id="qs">${subjOptions(true)}</select>
  <label><input type="checkbox" id="qw"> só as que errei/não fiz</label>
  <button class="pri" id="qgo">Começar</button></div><div id="qbox"></div>`;
  $("#qs").value = qState.subject; $("#qw").checked = qState.onlyWrong;
  $("#qgo").onclick = () => {
    qState.subject = $("#qs").value; qState.onlyWrong = $("#qw").checked;
    qState.queue = questions().filter(q => (!qState.subject || q.s === qState.subject) &&
      (!qState.onlyWrong || !S.answers[q.id]?.ok)).sort(() => Math.random() - .5);
    qState.i = 0; showQ();
  };
}
function showQ() {
  const box = $("#qbox"), q = qState.queue[qState.i];
  if (!q) { box.innerHTML = `<div class="card">Fim da lista (ou nenhuma questão encontrada). 🎯</div>`; return; }
  const opts = q.type === "tf" ? ["Certo", "Errado"] : q.o;
  box.innerHTML = `<div class="card"><div class="mut small">${esc(subj(q.s))} · ${qState.i + 1}/${qState.queue.length}</div>
    <p>${esc(q.q)}</p>${opts.map((t, i) => `<button class="opt" data-i="${i}">${esc(t)}</button>`).join("")}
    <div id="fb"></div></div>`;
  box.querySelectorAll(".opt").forEach(b => b.onclick = () => {
    const pick = +b.dataset.i;
    const right = q.type === "tf" ? (q.a ? 0 : 1) : q.a;
    const ok = pick === right;
    S.answers[q.id] = { ok, ts: Date.now() }; save();
    box.querySelectorAll(".opt").forEach((x, i) => { x.disabled = true; if (i === right) x.classList.add("ok"); else if (i === pick) x.classList.add("bad"); });
    $("#fb").innerHTML = `<div class="expl"><b>${ok ? "✅ Correto" : "❌ Errado"}</b><br>${esc(q.e || "")}</div>
      <p><button class="pri" id="nx">Próxima</button></p>`;
    $("#nx").onclick = () => { qState.i++; showQ(); };
  });
}

// ---------- flashcards (caixas de Leitner) ----------
const isDue = id => { const c = S.cards[id]; return !c || c.due <= Date.now(); };
let fState = { queue: [], i: 0, subject: "" };
function flashcards(el) {
  el.innerHTML = `<h1>Flashcards</h1><div class="row"><select id="fs">${subjOptions(true)}</select>
  <button class="pri" id="fgo">Revisar pendentes</button></div><div id="fbox"></div>`;
  $("#fs").value = fState.subject;
  $("#fgo").onclick = () => {
    fState.subject = $("#fs").value;
    fState.queue = cards().filter(c => (!fState.subject || c.s === fState.subject) && isDue(c.id));
    fState.i = 0; showCard();
  };
}
function showCard() {
  const box = $("#fbox"), c = fState.queue[fState.i];
  if (!c) { box.innerHTML = `<div class="card">Nenhum card pendente. Volte amanhã! ✅</div>`; return; }
  box.innerHTML = `<div class="card fc" id="card"><div><div class="mut small">${esc(subj(c.s))}</div><b>${esc(c.f)}</b>
    <p class="mut small">(clique para ver a resposta)</p></div></div><div id="grade"></div>`;
  $("#card").onclick = () => {
    $("#card").innerHTML = `<div><b>${esc(c.f)}</b><p>${esc(c.b)}</p></div>`;
    $("#grade").innerHTML = `<div class="row"><button id="g0">😕 Errei</button><button class="pri" id="g1">🙂 Acertei</button></div>`;
    const grade = ok => {
      const box0 = S.cards[c.id]?.box || 0, nb = ok ? Math.min(box0 + 1, 5) : 1;
      S.cards[c.id] = { box: nb, due: Date.now() + BOX_DAYS[nb] * DAY }; save();
      fState.i++; showCard();
    };
    $("#g0").onclick = () => grade(false); $("#g1").onclick = () => grade(true);
  };
}

// ---------- cronograma ----------
function cronograma(el) {
  const rows = subjects().map(s => `<tr><td>${esc(s.name)}</td>${DAYS.map((_, d) =>
    `<td><input type="number" min="0" max="12" step="0.5" data-s="${s.id}" data-d="${d}" value="${S.plan[s.id]?.[d] || ""}"></td>`).join("")}</tr>`).join("");
  const tot = DAYS.map((_, d) => subjects().reduce((t, s) => t + (+S.plan[s.id]?.[d] || 0), 0));
  const edital = subjects().map(s => `<h2>${esc(s.name)}</h2>` + s.topics.map((t, i) =>
    `<label class="chk"><input type="checkbox" data-t="${s.id}:${i}" ${S.topics[s.id + ":" + i] ? "checked" : ""}> ${esc(t)}</label>`).join("")).join("");
  el.innerHTML = `<h1>Cronograma</h1><div class="card" style="overflow-x:auto"><p class="mut small">Horas planejadas por matéria e dia.</p>
  <table><tr><th>Matéria</th>${DAYS.map(d => `<th>${d}</th>`).join("")}</tr>${rows}
  <tr><th>Total</th>${tot.map(t => `<th>${t}h</th>`).join("")}</tr></table></div>
  <div class="card"><b>Checklist do edital</b>${edital}</div>`;
  el.querySelectorAll("input[data-s]").forEach(i => i.onchange = () => {
    (S.plan[i.dataset.s] ||= {})[i.dataset.d] = +i.value || 0; save(); cronograma(el);
  });
  el.querySelectorAll("input[data-t]").forEach(i => i.onchange = () => { S.topics[i.dataset.t] = i.checked; save(); });
}

// ---------- foco (pomodoro + estatísticas) ----------
let timer = null;
function stopTimer() { clearInterval(timer); timer = null; }
function foco(el) {
  const week = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - k));
    const m = S.sessions.filter(x => x.ts >= +d && x.ts < +d + DAY).reduce((t, x) => t + x.min, 0);
    return { l: d.toLocaleDateString("pt-BR", { weekday: "short" }), m };
  });
  const max = Math.max(60, ...week.map(w => w.m));
  const bySub = subjects().map(s => ({ n: s.name, m: S.sessions.filter(x => x.s === s.id).reduce((t, x) => t + x.min, 0) })).filter(x => x.m);
  el.innerHTML = `<h1>Modo foco</h1><div class="card">
    <div class="row"><select id="ts">${subjOptions(false)}</select>
    <label>Foco <input type="number" id="tf" value="25" min="1" max="120" style="width:70px"> min</label></div>
    <div class="timer" id="tt">25:00</div>
    <div class="row" style="justify-content:center"><button class="pri" id="tgo">Iniciar</button><button id="tst">Parar</button></div></div>
  <div class="card"><b>Últimos 7 dias (minutos)</b>${week.map(w =>
    `<div class="row" style="margin:6px 0"><span style="width:50px">${esc(w.l)}</span><div class="bar" style="flex:1"><i style="width:${w.m / max * 100}%"></i></div><span class="small mut" style="width:50px">${w.m}</span></div>`).join("")}</div>
  <div class="card"><b>Por matéria</b>${bySub.length ? bySub.map(x => `<div>${esc(x.n)}: ${(x.m / 60).toFixed(1)}h</div>`).join("") : '<p class="mut">Nenhuma sessão registrada.</p>'}</div>`;
  const show = sec => { $("#tt").textContent = String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0"); };
  $("#tf").oninput = () => { if (!timer) show((+$("#tf").value || 25) * 60); };
  $("#tgo").onclick = () => {
    if (timer) return;
    const min = Math.max(1, +$("#tf").value || 25), s = $("#ts").value, end = Date.now() + min * 60000;
    timer = setInterval(() => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000)); show(left);
      if (!left) { stopTimer(); S.sessions.push({ ts: Date.now(), min, s }); save(); try { navigator.vibrate?.(300); } catch {} alert("Sessão concluída! 🔥"); foco(el); }
    }, 500);
  };
  $("#tst").onclick = () => { stopTimer(); show((+$("#tf").value || 25) * 60); };
}

// ---------- dados ----------
function dados(el) {
  el.innerHTML = `<h1>Dados</h1>
  <div class="card"><b>Backup do progresso</b><div class="row">
    <button id="ex">Exportar</button><label>Importar <input type="file" id="im" accept=".json"></label>
    <button id="rs">Zerar tudo</button></div></div>
  <div class="card"><b>Adicionar meu material</b>
  <p class="mut small">Cole JSON no formato: <code>{"questions":[{"id":"x1","s":"dc","type":"mc","q":"...","o":["a","b","c","d"],"a":0,"e":"explicação"}],"flashcards":[{"id":"y1","s":"dc","f":"frente","b":"verso"}]}</code>
  Matérias válidas: ${subjects().map(s => s.id).join(", ")}. Use <code>type:"tf"</code> com <code>a:true/false</code> para certo/errado.</p>
  <textarea id="cj"></textarea><div class="row"><button class="pri" id="ca">Adicionar</button><span id="cm" class="mut small"></span></div></div>`;
  $("#ex").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }));
    a.download = "fornalha-backup.json"; a.click();
  };
  $("#im").onchange = async e => {
    try { S = Object.assign(fresh(), JSON.parse(await e.target.files[0].text())); save(); alert("Importado."); route(); } catch { alert("Arquivo inválido."); }
  };
  $("#rs").onclick = () => { if (confirm("Apagar todo o progresso e material importado?")) { S = fresh(); save(); route(); } };
  $("#ca").onclick = () => {
    try {
      const j = JSON.parse($("#cj").value), ids = new Set(subjects().map(s => s.id));
      const qs = (j.questions || []).filter(q => q.id && ids.has(q.s) && q.q && (q.type === "tf" ? typeof q.a === "boolean" : Array.isArray(q.o) && Number.isInteger(q.a)));
      const fs = (j.flashcards || []).filter(f => f.id && ids.has(f.s) && f.f && f.b);
      const known = new Set([...questions(), ...cards()].map(x => x.id));
      const nq = qs.filter(q => !known.has(q.id)), nf = fs.filter(f => !known.has(f.id));
      S.custom.questions.push(...nq); S.custom.flashcards.push(...nf); save();
      $("#cm").textContent = `${nq.length} questões e ${nf.length} flashcards adicionados (ignorados: ${qs.length + fs.length - nq.length - nf.length}).`;
    } catch { $("#cm").textContent = "JSON inválido."; }
  };
}

route();
})();
