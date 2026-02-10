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

/* ===== PLAYER (header + multi-server + related) ===== */
(async () => {
  const video = document.getElementById("video");
  const frameWrap = document.getElementById("frameWrap");
  const frame = document.getElementById("frame");
  const titleEl = document.getElementById("title");
  const descEl = document.getElementById("description");
  const serverBar = document.getElementById("serverBar");

  const relatedGrid = document.getElementById("relatedGrid");
  const relatedMeta = document.getElementById("relatedMeta");

  const searchBtn = document.getElementById("searchBtn");
  const searchRow = document.getElementById("searchRow");
  const searchInput = document.getElementById("searchInput");
  const clearFilterBtn = document.getElementById("clearFilterBtn");

  const menuBtn = document.getElementById("menuBtn");
  const menuPanel = document.getElementById("menuPanel");
  const menuBackdrop = document.getElementById("menuBackdrop");
  const menuClose = document.getElementById("menuClose");
  const genreList = document.getElementById("genreList");

  if (!video && !frame) return; // bukan halaman player

  // ===== header interactions (same behavior as index) =====
  function openMenu() {
    menuPanel?.classList.add("open");
    menuBackdrop?.classList.add("open");
    menuPanel?.setAttribute("aria-hidden", "false");
  }
  function closeMenu() {
    menuPanel?.classList.remove("open");
    menuBackdrop?.classList.remove("open");
    menuPanel?.setAttribute("aria-hidden", "true");
  }
  menuBtn && (menuBtn.onclick = openMenu);
  menuClose && (menuClose.onclick = closeMenu);
  menuBackdrop && (menuBackdrop.onclick = closeMenu);

  searchBtn && (searchBtn.onclick = () => {
    searchRow?.classList.toggle("show");
    if (searchRow?.classList.contains("show")) setTimeout(() => searchInput?.focus(), 0);
  });

  function esc(s){
    return String(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  // ===== get current post =====
  const params = new URLSearchParams(location.search);
  const wantedId = params.get("id");

  let currentPost = null;
  let allPostsData = null;

  // Try /api/posts first (so we can play by id and also build related)
  allPostsData = await apiGet("/api/posts");
  if (allPostsData?.posts && allPostsData.posts.length) {
    if (wantedId) currentPost = allPostsData.posts.find(p => p.id === wantedId) || null;
  }

  // Fallback: featured
  if (!currentPost) {
    const featured = await apiGet("/api/stream");
    if (featured) currentPost = featured;
  }

  if (!currentPost) {
    if (titleEl) titleEl.textContent = "Stream unavailable";
    if (descEl) descEl.textContent = "";
    if (video) video.style.display = "none";
    if (frameWrap) frameWrap.style.display = "none";
    if (relatedMeta) relatedMeta.textContent = "No posts";
    return;
  }

  // Normalize servers
  const streams = Array.isArray(currentPost.streams) && currentPost.streams.length
    ? currentPost.streams
    : (currentPost.stream ? [{ label: "Server 1", url: currentPost.stream }] : []);

  const minutes = currentPost.minutes ?? currentPost.durationMinutes ?? currentPost.duration ?? null;
  const genre = currentPost.genre || "";

  if (titleEl) titleEl.textContent = currentPost.title || "Player";
  if (descEl) descEl.textContent = currentPost.description || "";

  // ===== server buttons (only show if > 1) =====
  function renderServerButtons(activeIndex){
    if (!serverBar) return;
    serverBar.innerHTML = "";
    if (streams.length <= 1) {
      serverBar.style.display = "none";
      return;
    }
    serverBar.style.display = "flex";

    streams.forEach((s, idx) => {
      const btn = document.createElement("div");
      btn.className = "serverBtn" + (idx === activeIndex ? " active" : "");
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6.5 7.5h11M6.5 12h11M6.5 16.5h11" stroke="rgba(255,255,255,.92)" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
        <span>${esc(s.label || ("Server " + (idx+1)))}</span>
      `;
      btn.onclick = () => setSource(idx);
      serverBar.appendChild(btn);
    });
  }

  // ===== media switching =====
  function resetVideo() {
    try { video.pause(); } catch {}
    try { video.removeAttribute("src"); } catch {}
    try { video.load(); } catch {}
  }

  let hlsInstance = null;

  function setSource(index){
    const s = streams[index];
    const url = (s?.url || "").trim();
    if (!url) return;

    renderServerButtons(index);

    const useVideo = isHls(url) || isDirectVideo(url);

    // clean old hls
    if (hlsInstance) { try { hlsInstance.destroy(); } catch {} }
    hlsInstance = null;

    if (useVideo) {
      if (frameWrap) frameWrap.style.display = "none";
      if (frame) frame.src = "";
      if (video) video.style.display = "block";

      if (isHls(url)) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
        } else if (window.Hls) {
          hlsInstance = new Hls({ lowLatencyMode: true });
          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(video);
        } else {
          // fallback to iframe
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
      // iframe for any page url
      if (video) {
        resetVideo();
        video.style.display = "none";
      }
      if (frameWrap && frame) {
        frameWrap.style.display = "block";
        frame.src = url;
      }
    }
  }

  // start with first server
  setSource(0);

  // ===== genres dropdown data (from /api/posts) =====
  let allPosts = Array.isArray(allPostsData?.posts) ? allPostsData.posts : [];
  if (!allPosts.length) {
    const again = await apiGet("/api/posts");
    allPosts = Array.isArray(again?.posts) ? again.posts : [];
  }

  const genreSet = new Set();
  allPosts.forEach(p => {
    const g = (p.genre || "").trim();
    if (g) genreSet.add(g);
  });
  const genres = ["All", ...Array.from(genreSet).sort((a,b)=>a.localeCompare(b))];

  function renderGenres(active = "All"){
    if (!genreList) return;
    genreList.innerHTML = "";
    genres.forEach(g => {
      const b = document.createElement("button");
      b.className = "genreBtn" + (g === active ? " active" : "");
      b.textContent = g;
      b.onclick = () => {
        closeMenu();
        // go back to index with a simple query hint
        if (g === "All") location.href = "/";
        else location.href = "/?genre=" + encodeURIComponent(g);
      };
      genreList.appendChild(b);
    });
  }
  renderGenres("All");

  // ===== search (redirect to index with q) =====
  clearFilterBtn && (clearFilterBtn.onclick = () => {
    if (searchInput) searchInput.value = "";
    location.href = "/";
  });
  searchInput && searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = (searchInput.value || "").trim();
      if (!q) location.href = "/";
      else location.href = "/?q=" + encodeURIComponent(q);
    }
  });

  // ===== related: random 10 exclude current =====
  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const currentId = currentPost.id || wantedId || null;
  const pool = allPosts.filter(p => p && p.id && p.id !== currentId);

  const picks = shuffle(pool).slice(0, 10);
  if (relatedMeta) relatedMeta.textContent = picks.length ? `Showing ${picks.length}` : "No posts";

  if (relatedGrid) {
    relatedGrid.innerHTML = "";
    picks.forEach(p => {
      const mins = p.minutes ?? p.durationMinutes ?? p.duration ?? null;
      const g = p.genre || "-";
      const d = p.description || "-";
      const a = document.createElement("a");
      a.className = "post";
      a.href = `/player.html?id=${encodeURIComponent(p.id)}`;
      a.innerHTML = `
        <div class="thumb">
          <img src="${esc(p.poster || 'https://via.placeholder.com/900x1600?text=Poster')}" alt="${esc(p.title || 'Poster')}" loading="lazy" />
          <div class="thumbOverlay">
            <div class="playPill">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M10 8.5v7l7-3.5-7-3.5Z" stroke="rgba(255,255,255,.92)" stroke-width="1.8" stroke-linejoin="round"/>
              </svg>
              <span>Play</span>
            </div>
            <div class="tTitle">${esc(p.title || "Untitled")}</div>
          </div>
        </div>

        <div class="info">
          <div class="line1">
            <span class="tagMini">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3.5c4.7 0 8.5 3.8 8.5 8.5S16.7 20.5 12 20.5 3.5 16.7 3.5 12 7.3 3.5 12 3.5Z" stroke="rgba(255,255,255,.92)" stroke-width="1.6"/>
                <path d="M12 7.6v5.2l3.2 2" stroke="rgba(255,255,255,.92)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>${mins ? esc(String(mins)) + " min" : "-"}</span>
            </span>

            <span class="tagMini">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6.5 7.5h11M6.5 12h11M6.5 16.5h11" stroke="rgba(255,255,255,.92)" stroke-width="1.7" stroke-linecap="round"/>
              </svg>
              <span>${esc(g)}</span>
            </span>
          </div>
          <div class="descClamp">${esc(d)}</div>
        </div>
      `;
      relatedGrid.appendChild(a);
    });
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
