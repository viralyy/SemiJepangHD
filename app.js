// ===== Helpers =====
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

// ===== INDEX (biarin sama seperti punya lo) =====
// ... (kalau lo mau, gue bisa tempelin ulang juga)

// ===== PLAYER (biarin sama seperti punya lo) =====
// ... (kalau lo mau, gue bisa tempelin ulang juga)

// ===== ADMIN LOGIN + HISTORY =====
(() => {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox) return; // bukan halaman admin

  const panelBox = document.getElementById("panelBox");
  const passEl = document.getElementById("adminPassword");
  const loginBtn = document.getElementById("loginBtn");
  const loginStatus = document.getElementById("loginStatus");

  const publishForm = document.getElementById("publishForm");
  const panelStatus = document.getElementById("panelStatus");
  const historyEl = document.getElementById("history");
  const clearFeaturedBtn = document.getElementById("clearFeaturedBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const PASS_KEY = "ADMIN_PASS_SESSION";

  function getPass() {
    return sessionStorage.getItem(PASS_KEY) || "";
  }
  function setPass(p) {
    sessionStorage.setItem(PASS_KEY, p);
  }
  function clearPass() {
    sessionStorage.removeItem(PASS_KEY);
  }

  function showPanel() {
    loginBox.classList.add("hidden");
    panelBox.classList.remove("hidden");
  }
  function showLogin() {
    panelBox.classList.add("hidden");
    loginBox.classList.remove("hidden");
  }

  async function loadHistory() {
    historyEl.innerHTML = "Loading history...";
    const data = await apiGet("/api/posts");
    if (!data) {
      historyEl.innerHTML = "Gagal load history. Cek /api/posts";
      return;
    }

    const { currentId, posts } = data;
    if (!posts || posts.length === 0) {
      historyEl.innerHTML = "Belum ada post.";
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
      left.innerHTML = `
        <div class="itemTitle">${p.title || "(no title)"} ${p.id === currentId ? "⭐" : ""}</div>
        <div class="itemMeta">${fmtTime(p.createdAt)} • ${p.id}</div>
      `;

      const right = document.createElement("div");
      right.innerHTML = `<div class="itemMeta">${p.stream?.endsWith(".m3u8") ? "HLS" : "FILE"}</div>`;

      top.appendChild(left);
      top.appendChild(right);

      const btns = document.createElement("div");
      btns.className = "itemBtns";

      const setBtn = document.createElement("button");
      setBtn.textContent = p.id === currentId ? "Featured" : "Set Featured";
      setBtn.disabled = p.id === currentId;

      setBtn.onclick = async () => {
        panelStatus.textContent = "Setting featured...";
        const r = await apiPost("/api/set-current", { password: getPass(), id: p.id });
        panelStatus.textContent = r.ok ? "✅ Featured updated" : `❌ ${r.status}: ${r.text}`;
        await loadHistory();
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "danger";
      delBtn.onclick = async () => {
        if (!confirm("Yakin hapus post ini?")) return;
        panelStatus.textContent = "Deleting...";
        const r = await apiPost("/api/delete-post", { password: getPass(), id: p.id });
        panelStatus.textContent = r.ok ? "✅ Deleted" : `❌ ${r.status}: ${r.text}`;
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

  // Auto-login kalau masih ada session password
  if (getPass()) {
    showPanel();
    loadHistory();
  }

  loginBtn.addEventListener("click", async () => {
    const p = passEl.value.trim();
    if (!p) return;

    // “cek login” simpel: coba panggil /api/posts (ga butuh auth),
    // auth baru dites saat publish/set/delete (kalau password salah -> 401)
    setPass(p);
    loginStatus.textContent = "✅ Logged in (session)";
    showPanel();
    await loadHistory();
  });

  publishForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("title").value.trim();
    const poster = document.getElementById("poster").value.trim();
    const stream = document.getElementById("stream").value.trim();

    panelStatus.textContent = "Publishing...";
    const r = await apiPost("/api/publish", { password: getPass(), title, poster, stream });
    panelStatus.textContent = r.ok ? "✅ Published & Featured!" : `❌ ${r.status}: ${r.text}`;
    if (r.ok) {
      publishForm.reset();
      await loadHistory();
    }
  });

  clearFeaturedBtn.addEventListener("click", async () => {
    if (!confirm("Yakin clear featured? index jadi kosong.")) return;
    panelStatus.textContent = "Clearing featured...";
    const r = await apiPost("/api/clear-current", { password: getPass() });
    panelStatus.textContent = r.ok ? "✅ Featured cleared" : `❌ ${r.status}: ${r.text}`;
    await loadHistory();
  });

  logoutBtn.addEventListener("click", () => {
    clearPass();
    showLogin();
    loginStatus.textContent = "Logged out.";
  });
})();
