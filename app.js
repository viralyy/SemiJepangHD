/* =========================
   Helpers
========================= */
async function apiGet(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return ""; }
}

function isHls(url) {
  const u = (url || "").toLowerCase();
  return u.includes(".m3u8");
}

function isDirectVideo(url) {
  const u = (url || "").toLowerCase();
  return /\.(mp4|webm|ogg)(\?|#|$)/.test(u);
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   INDEX
========================= */
(async () => {
  const posterImg = document.getElementById("posterImg");
  const posterTitle = document.getElementById("posterTitle");
  const pageTitle = document.getElementById("pageTitle");
  const updated = document.getElementById("updated");
  const badge = document.getElementById("badge");
  const hint = document.getElementById("hint");

  if (!posterImg || !posterTitle || !pageTitle) return; // bukan halaman index

  const data = await apiGet("/api/stream");

  if (!data) {
    pageTitle.textContent = "No stream";
    posterTitle.textContent = "No stream";
    posterImg.src = "https://via.placeholder.com/900x1600?text=No+Stream";
    if (updated) updated.textContent = "";
    if (badge) badge.textContent = "OFF";
    if (hint) hint.textContent = "Unavailable";
    return;
  }

  pageTitle.textContent = data.title || "Stream";
  posterTitle.textContent = data.title || "Stream";
  posterImg.src = data.poster || "https://via.placeholder.com/900x1600?text=Poster";

  if (updated) {
    const t = data.updatedAt || data.createdAt;
    updated.textContent = t ? `Updated: ${fmtTime(t)}` : "";
  }
})();

/* =========================
   PLAYER (video + iframe fallback)
========================= */
(async () => {
  const video = document.getElementById("video");
  const frameWrap = document.getElementById("frameWrap");
  const frame = document.getElementById("frame");
  const pageTitle = document.getElementById("pageTitle");

  if (!video && !frame) return; // bukan halaman player

  const data = await apiGet("/api/stream");
  if (!data) {
    if (pageTitle) pageTitle.textContent = "Stream unavailable";
    if (video) video.style.display = "none";
    if (frameWrap) frameWrap.style.display = "none";
    return;
  }

  if (pageTitle) pageTitle.textContent = data.title || "Player";

  const url = data.stream || "";
  const useVideo = isHls(url) || isDirectVideo(url);

  // helper reset video state
  function resetVideo() {
    try { video.pause(); } catch {}
    try { video.removeAttribute("src"); } catch {}
    try { video.load(); } catch {}
  }

  if (useVideo) {
    if (frameWrap) frameWrap.style.display = "none";
    if (frame) frame.src = "";
    if (video) video.style.display = "block";

    if (isHls(url)) {
      // Safari/iOS native HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else if (window.Hls) {
        const hls = new Hls({ lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else {
        // fallback ke iframe kalau ga ada hls.js
        resetVideo();
        video.style.display = "none";
        if (frameWrap && frame) {
          frameWrap.style.display = "block";
          frame.src = url;
        }
      }
    } else {
      video.src = url;
    }
  } else {
    // iframe untuk URL halaman apa pun
    if (video) {
      resetVideo();
      video.style.display = "none";
    }
    if (frameWrap && frame) {
      frameWrap.style.display = "block";
      frame.src = url;
    }
  }
})();

/* =========================
   ADMIN (login + publish + history)
   Needs endpoints:
   - POST /api/auth-check
   - GET  /api/posts
   - POST /api/publish
   - POST /api/set-current
   - POST /api/delete-post
   - POST /api/clear-current
========================= */
(() => {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox) return; // bukan halaman admin

  // panel container: support beberapa kemungkinan ID
  const panelBox =
    document.getElementById("panelGrid") ||
    document.getElementById("panelBox") ||
    document.getElementById("panel");

  // login fields
  const userEl =
    document.getElementById("username") ||
    document.getElementById("adminUsername");
  const passEl =
    document.getElementById("password") ||
    document.getElementById("adminPassword");

  const rememberEl =
    document.getElementById("rememberMe") ||
    document.getElementById("remember");

  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn"); // optional
  const clearSavedBtn = document.getElementById("clearSavedBtn");

  const loginStatus = document.getElementById("loginStatus");

  // panel refs
  const publishForm = document.getElementById("publishForm");
  const panelStatus = document.getElementById("panelStatus");
  const historyEl = document.getElementById("history");
  const refreshBtn = document.getElementById("refreshBtn");
  const clearFeaturedBtn = document.getElementById("clearFeaturedBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // publish input ids (support old/new)
  const titleEl =
    document.getElementById("title");
  const posterEl =
    document.getElementById("posterUrl") ||
    document.getElementById("poster");
  const streamEl =
    document.getElementById("streamUrl") ||
    document.getElementById("stream");

  const LS_KEY = "ADMIN_AUTH";
  const SS_KEY = "ADMIN_AUTH_SESSION";

  function setStatus(el, msg, type) {
    if (!el) return;
    el.classList.remove("ok", "err", "warn");
    if (type) el.classList.add(type);
    el.textContent = msg || "";
  }

  function showPanel() {
    if (!panelBox) return;
    loginBox.classList.add("hidden");
    panelBox.classList.remove("hidden");
  }

  function showLogin() {
    if (!panelBox) return;
    panelBox.classList.add("hidden");
    loginBox.classList.remove("hidden");
  }

  function saveLocal(auth) {
    localStorage.setItem(LS_KEY, JSON.stringify(auth));
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
    catch { return null; }
  }

  function clearLocal() {
    localStorage.removeItem(LS_KEY);
  }

  function saveSession(auth) {
    sessionStorage.setItem(SS_KEY, JSON.stringify(auth));
  }

  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SS_KEY) || "null"); }
    catch { return null; }
  }

  function clearSession() {
    sessionStorage.removeItem(SS_KEY);
  }

  function getAuth() {
    return loadSession();
  }

  async function authCheck(auth) {
    const r = await apiPost("/api/auth-check", auth);
    return r.ok;
  }

  async function loadHistory() {
    if (!historyEl) return;

    historyEl.textContent = "Loading...";
    const data = await apiGet("/api/posts");
    if (!data) {
      historyEl.textContent = "Failed to load";
      return;
    }

    const { currentId, posts } = data;
    if (!posts || posts.length === 0) {
      historyEl.textContent = "No posts";
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "table";

    posts.forEach((p) => {
      const item = document.createElement("div");
      item.className = "item";

      const top = document.createElement("div");
      top.className = "itemTop";

      const left = document.createElement("div");
      const featuredTag = p.id === currentId ? " <span class='tag'>Featured</span>" : "";
      left.innerHTML = `
        <div class="itemTitle">${esc(p.title || "(no title)")}${featuredTag}</div>
        <div class="itemMeta">${fmtTime(p.createdAt)} • <code>${esc(p.id)}</code></div>
      `;

      const right = document.createElement("div");
      const s = (p.stream || "").toLowerCase();
      const type = s.includes(".m3u8") ? "HLS" : (/\.(mp4|webm|ogg)(\?|#|$)/.test(s) ? "VIDEO" : "PAGE");
      right.innerHTML = `<div class="itemMeta">${type}</div>`;

      top.appendChild(left);
      top.appendChild(right);

      const btns = document.createElement("div");
      btns.className = "itemBtns";

      const setBtn = document.createElement("button");
      setBtn.textContent = (p.id === currentId) ? "Featured" : "Set Featured";
      setBtn.disabled = (p.id === currentId);

      setBtn.onclick = async () => {
        const auth = getAuth();
        if (!auth) return setStatus(panelStatus, "Session expired", "err");

        setStatus(panelStatus, "Working...", "warn");
        const r = await apiPost("/api/set-current", { ...auth, id: p.id });
        setStatus(panelStatus, r.ok ? "Done" : `Error ${r.status}`, r.ok ? "ok" : "err");
        await loadHistory();
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "danger";

      delBtn.onclick = async () => {
        const auth = getAuth();
        if (!auth) return setStatus(panelStatus, "Session expired", "err");
        if (!confirm("Delete this post?")) return;

        setStatus(panelStatus, "Working...", "warn");
        const r = await apiPost("/api/delete-post", { ...auth, id: p.id });
        setStatus(panelStatus, r.ok ? "Done" : `Error ${r.status}`, r.ok ? "ok" : "err");
        await loadHistory();
      };

      btns.appendChild(setBtn);
      btns.appendChild(delBtn);

      item.appendChild(top);
      item.appendChild(btns);
      wrap.appendChild(item);
    });

    historyEl.innerHTML = "";
    historyEl.appendChild(wrap);
  }

  async function doLogin() {
    const username = (userEl?.value || "").trim();
    const password = (passEl?.value || "").trim();
    if (!username || !password) {
      setStatus(loginStatus, "Missing credentials", "err");
      return;
    }

    const auth = { username, password };
    saveSession(auth);

    // remember optional
    if (rememberEl && rememberEl.checked) saveLocal(auth);

    setStatus(loginStatus, "Working...", "warn");
    const ok = await authCheck(auth);
    if (!ok) {
      clearSession();
      setStatus(loginStatus, "Invalid credentials", "err");
      return;
    }

    setStatus(loginStatus, "", "");
    showPanel();
    setStatus(panelStatus, "", "");
    await loadHistory();
  }

  // init: fill remembered
  const remembered = loadLocal();
  if (remembered?.username && userEl) userEl.value = remembered.username;
  if (remembered?.password && passEl) passEl.value = remembered.password;

  // init: if session exists, go panel (history is public)
  if (getAuth()) {
    showPanel();
    loadHistory();
  }

  // login handlers
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await doLogin();
    });
  }
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      await doLogin();
    });
  }

  if (clearSavedBtn) {
    clearSavedBtn.addEventListener("click", () => {
      clearLocal();
      clearSession();
      if (userEl) userEl.value = "";
      if (passEl) passEl.value = "";
      setStatus(loginStatus, "", "");
    });
  }

  // publish
  if (publishForm) {
    publishForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const auth = getAuth();
      if (!auth) return setStatus(panelStatus, "Session expired", "err");

      const title = (titleEl?.value || "").trim();
      const poster = (posterEl?.value || "").trim();
      const stream = (streamEl?.value || "").trim();

      if (!title || !poster || !stream) {
        setStatus(panelStatus, "Missing fields", "err");
        return;
      }

      setStatus(panelStatus, "Working...", "warn");
      const r = await apiPost("/api/publish", { ...auth, title, poster, stream });
      setStatus(panelStatus, r.ok ? "Done" : `Error ${r.status}`, r.ok ? "ok" : "err");

      if (r.ok) {
        publishForm.reset();
        await loadHistory();
      }
    });
  }

  // clear featured
  if (clearFeaturedBtn) {
    clearFeaturedBtn.addEventListener("click", async () => {
      const auth = getAuth();
      if (!auth) return setStatus(panelStatus, "Session expired", "err");
      if (!confirm("Clear featured?")) return;

      setStatus(panelStatus, "Working...", "warn");
      const r = await apiPost("/api/clear-current", { ...auth });
      setStatus(panelStatus, r.ok ? "Done" : `Error ${r.status}`, r.ok ? "ok" : "err");
      await loadHistory();
    });
  }

  // refresh
  if (refreshBtn) refreshBtn.addEventListener("click", loadHistory);

  // logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      showLogin();
      setStatus(loginStatus, "", "");
    });
  }
})();
