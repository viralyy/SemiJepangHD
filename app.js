// ===== Helpers =====
async function fetchStream() {
  const res = await fetch("/api/stream", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return ""; }
}

// ===== INDEX =====
(async () => {
  const posterImg = document.getElementById("posterImg");
  const posterTitle = document.getElementById("posterTitle");
  const pageTitle = document.getElementById("pageTitle");
  const updated = document.getElementById("updated");
  const hint = document.getElementById("hint");
  const badge = document.getElementById("badge");

  if (!posterImg || !posterTitle || !pageTitle) return;

  const data = await fetchStream();

  if (!data) {
    pageTitle.textContent = "Belum ada stream";
    posterTitle.textContent = "Belum ada stream";
    posterImg.src = "https://via.placeholder.com/900x1600?text=No+Stream";
    updated.textContent = "";
    if (badge) badge.textContent = "OFF";
    if (hint) hint.textContent = "Belum ada live";
    return;
  }

  pageTitle.textContent = data.title;
  posterTitle.textContent = data.title;
  posterImg.src = data.poster;
  updated.textContent = data.updatedAt ? `Updated: ${fmtTime(data.updatedAt)}` : "";
})();

// ===== PLAYER =====
(async () => {
  const video = document.getElementById("video");
  const pageTitle = document.getElementById("pageTitle");
  if (!video) return;

  const data = await fetchStream();
  if (!data) {
    if (pageTitle) pageTitle.textContent = "Stream belum tersedia";
    return;
  }

  if (pageTitle) pageTitle.textContent = data.title;

  const url = data.stream;

  if (url.endsWith(".m3u8")) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url; // Safari/iOS
    } else if (window.Hls) {
      const hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      alert("Browser tidak support HLS.");
    }
  } else {
    video.src = url; // mp4 dll
  }
})();

// ===== ADMIN =====
(() => {
  const form = document.getElementById("adminForm");
  if (!form) return;

  const tokenEl = document.getElementById("token");
  const status = document.getElementById("status");
  const deleteBtn = document.getElementById("deleteBtn");

  // optional: ingat token di device admin
  const saved = localStorage.getItem("ADMIN_TOKEN_LOCAL");
  if (saved && tokenEl) tokenEl.value = saved;

  if (tokenEl) {
    tokenEl.addEventListener("change", () => {
      localStorage.setItem("ADMIN_TOKEN_LOCAL", tokenEl.value.trim());
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = tokenEl.value.trim();
    const title = document.getElementById("title").value.trim();
    const poster = document.getElementById("poster").value.trim();
    const stream = document.getElementById("stream").value.trim();

    status.textContent = "Publishing...";

    const res = await fetch("/api/publish", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ title, poster, stream }),
    });

    const text = await res.text();
    status.textContent = res.ok ? "✅ Published! cek index /" : `❌ ${res.status}: ${text}`;
  });

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const token = tokenEl.value.trim();
      if (!confirm("Yakin mau hapus postingan?")) return;

      status.textContent = "Deleting...";

      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "authorization": `Bearer ${token}` },
      });

      const text = await res.text();
      status.textContent = res.ok ? "✅ Deleted! index jadi kosong." : `❌ ${res.status}: ${text}`;
    });
  }
})();
