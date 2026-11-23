(() => {
  "use strict";
  const CFG = window.REWIND_CONFIG || {};
  const DEMO = !CFG.SCRIPT_URL;
  const $ = (s, r = document) => r.querySelector(s);
  const COLORS = ["var(--orange)", "var(--teal)", "var(--red)", "var(--green)", "var(--plum)", "var(--blue)", "var(--mustard)"];

  // Categorias do formulário "Awards" (usadas no modo demo; com o backend ligado vêm do próprio formulário).
  // "Canela de Fogo" aparece duas vezes no formulário; aqui ficou uma só até confirmar.
  const DEMO_CATS = [
    { id: "1", categoria: "Sons do Ano", descricao: "Indique os sons mais marcantes da temporada.", opcoes: [] },
    { id: "2", categoria: "Engraçado do Ano", descricao: "Indique o sujeito mais engraçado da temporada.", opcoes: [] },
    { id: "3", categoria: "Ícone do Ano", descricao: "Indique o sujeito mais icônico da temporada.", opcoes: [] },
    { id: "4", categoria: "Performático do Ano", descricao: "Indique o sujeito que maior performou durante a temporada.", opcoes: [] },
    { id: "5", categoria: "Canela de Fogo", descricao: "Indique o sujeito mais pentecostal da temporada.", opcoes: [] },
    { id: "7", categoria: "Matraca do Ano", descricao: "Indique o sujeito que mais hablou durante a temporada.", opcoes: [] },
    { id: "8", categoria: "Estiloso do Ano", descricao: "Indique o sujeito que melhor se estilizou durante a temporada.", opcoes: [] },
    { id: "9", categoria: "Quem é mais provável de ficar quando Jesus voltar?", descricao: "Indique o sujeito da temporada que mais se esforçou para ficar.", opcoes: [] },
    { id: "10", categoria: "Quem seria um Hippie?", descricao: "Indique o sujeito da temporada que seria um Hippie na década de 70.", opcoes: [] },
  ];

  const state = { cats: [], i: 0, answers: {}, nome: "", email: "" };

  /* ---------- Nav some ao rolar para baixo ---------- */
  const nav = $("#nav"); let lastY = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    nav.classList.toggle("hide", y > lastY && y > 300);
    lastY = y;
  }, { passive: true });

  /* ---------- Revelação e contadores ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      e.target.querySelectorAll("[data-tick]").forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  const observe = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));

  function countUp(el) {
    const to = +el.dataset.tick, t0 = performance.now(), dur = 1600;
    const step = (t) => {
      const k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e).toLocaleString("pt-BR");
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Relógio do fecho ---------- */

  /* ---------- Dados ---------- */
  async function loadCats() {
    if (DEMO) return DEMO_CATS;
    const res = await fetch(CFG.SCRIPT_URL + "?action=categorias", { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.erro || "Resposta inválida");
    return data.categorias;
  }

  async function sendVotes(payload) {
    if (DEMO) {
      try {
        const all = JSON.parse(localStorage.getItem("rewind-demo-votos") || "[]");
        if (all.some((v) => v.email === payload.email)) return { ok: false, erro: "Este e-mail já enviou uma resposta" };
        all.push({ ...payload, quando: new Date().toISOString() });
        localStorage.setItem("rewind-demo-votos", JSON.stringify(all));
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 700));
      return { ok: true, demo: true };
    }
    // text/plain evita o preflight CORS, que o Apps Script não responde
    const res = await fetch(CFG.SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  /* ---------- Grade de categorias ---------- */
  function renderGrid() {
    const grid = $("#cat-grid");
    grid.innerHTML = "";
    state.cats.forEach((c, n) => {
      const li = document.createElement("li");
      li.className = "cat reveal";
      li.style.setProperty("--c", COLORS[n % COLORS.length]);
      li.innerHTML = `<span class="cat-n">${String(n + 1).padStart(2, "0")}</span>
        <p class="cat-name"></p>
        <svg viewBox="${n % 2 ? "0 0 100 100" : "0 0 200 200"}"><use href="${n % 2 ? "#art-peace" : "#art-flower"}"/></svg>`;
      $(".cat-name", li).textContent = c.categoria;
      grid.appendChild(li);
    });
    document.querySelectorAll('[data-count="categorias"]').forEach((el) => (el.textContent = state.cats.length));
    observe();
  }

  /* ---------- Urna ---------- */
  const steps = { id: $("#step-id"), q: $("#step-q"), review: $("#step-review"), done: $("#step-done") };
  function show(name) {
    Object.entries(steps).forEach(([k, el]) => (el.hidden = k !== name));
  }

  

  steps.id.addEventListener("submit", (e) => {
    e.preventDefault();
    state.nome = $("#in-nome").value.trim();
    state.email = $("#in-email").value.trim().toLowerCase();
    if (!state.nome || !state.email) return;
    if (!state.cats.length) return;
    state.i = 0;
    state.editando = false;
    renderQ();
    show("q");
  });

  function renderQ() {
    const c = state.cats[state.i], total = state.cats.length;
    $("#q-count").textContent = `Categoria ${state.i + 1} de ${total}`;
    $("#q-bar-fill").style.width = ((state.i) / total) * 100 + "%";
    $("#q-title").textContent = c.categoria;
    $("#q-desc").textContent = c.descricao || "";
    $("#q-desc").hidden = !c.descricao;
    const box = $("#q-options");
    box.innerHTML = "";
    const cur = state.answers[c.id];

    if (c.opcoes && c.opcoes.length) {
      box.setAttribute("role", "radiogroup");
      c.opcoes.forEach((op, k) => {
        const lab = document.createElement("label");
        lab.className = "opt";
        lab.innerHTML = `<input type="radio" name="q" value=""><span class="opt-dot"><svg viewBox="0 0 200 200"><use href="#art-flower"/></svg></span><span class="opt-label"></span>`;
        const inp = $("input", lab);
        inp.value = op; inp.id = "op" + k;
        inp.checked = cur === op;
        $(".opt-label", lab).textContent = op;
        inp.addEventListener("change", () => { state.answers[c.id] = op; syncNext(); });
        box.appendChild(lab);
      });
    } else {
      box.removeAttribute("role");
      const ta = document.createElement("input");
      ta.type = "text"; ta.id = "q-free"; ta.className = "free-text"; ta.maxLength = 200;
      ta.placeholder = "Quem você indica?";
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && ta.value.trim()) { e.preventDefault(); next(); } });
      ta.value = cur || "";
      ta.addEventListener("input", () => { state.answers[c.id] = ta.value.trim(); syncNext(); });
      box.appendChild(ta);
    }
    $("#q-prev").disabled = false;
    $("#q-next").textContent = state.i === total - 1 ? "Revisar" : "Próxima";
    syncNext();
    steps.q.style.animation = "none"; void steps.q.offsetWidth; steps.q.style.animation = "";
  }
  function syncNext() {
    $("#q-next").disabled = !state.answers[state.cats[state.i].id];
    // "Pular" só aparece ao voltar pelo "Mudar algo": leva direto à revisão
    $("#q-skip").hidden = !state.editando;
  }

  function next() {
    if (state.i < state.cats.length - 1) { state.i++; renderQ(); }
    else { renderReview(); show("review"); }
  }
  $("#q-next").addEventListener("click", next);
  $("#q-skip").addEventListener("click", () => { renderReview(); show("review"); });
  $("#q-prev").addEventListener("click", () => {
    if (state.i === 0) show("id"); else { state.i--; renderQ(); }
  });

  function renderReview() {
    const ol = $("#review-list");
    ol.innerHTML = "";
    state.cats.forEach((c) => {
      const li = document.createElement("li");
      const a = state.answers[c.id];
      li.innerHTML = `<strong></strong>: <span></span>`;
      $("strong", li).textContent = c.categoria;
      const sp = $("span", li);
      sp.textContent = a || "sem voto";
      if (!a) sp.className = "skipped";
      ol.appendChild(li);
    });
    $("#send-msg").textContent = "";
    $("#send-msg").className = "form-msg";
  }
  $("#r-back").addEventListener("click", () => { state.editando = true; state.i = 0; renderQ(); show("q"); });

  $("#r-send").addEventListener("click", async () => {
    const votos = state.cats
      .filter((c) => state.answers[c.id])
      .map((c) => ({ id: c.id, categoria: c.categoria, resposta: state.answers[c.id] }));
    const msg = $("#send-msg"), btn = $("#r-send");
    if (!votos.length) { msg.textContent = "Indique alguém em pelo menos uma categoria."; msg.className = "form-msg err"; return; }
    btn.disabled = true; btn.textContent = "Enviando…";
    msg.className = "form-msg"; msg.textContent = "";
    try {
      const r = await sendVotes({ nome: state.nome, email: state.email, votos, origem: location.href });
      if (!r || !r.ok) throw new Error((r && r.erro) || "Falha ao registrar");
      $("#done-name").textContent = state.nome;
      show("done");
    } catch (err) {
      msg.textContent = "Não deu para enviar: " + err.message + ". Tente de novo.";
      msg.className = "form-msg err";
    } finally {
      btn.disabled = false; btn.textContent = "Enviar indicações";
    }
  });

  /* ---------- Início ---------- */
  observe();
  loadCats()
    .then((cats) => { state.cats = cats.filter((c) => c && c.categoria); renderGrid(); })
    .catch((err) => {
      const g = $("#cat-grid"), li = document.createElement("li");
      li.textContent = "Não consegui ler o formulário agora (" + err.message + "). Recarregue a página em instantes.";
      g.appendChild(li);
    })
    ;
})();
