async function fetchStream() {
  const res = await fetch("/api/stream", { cache: "no-store" });
  return res.ok ? res.json() : null;
}

function fmtTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return ""; }
}

/* ===== INDEX ===== */
(async () => {
  const posterImg = document.getElementById("posterImg");
  const posterTitle = document.getElementById("posterTitle");
  const pageTitle = document.getElementById("pageTitle");
  const updated = document.getElementById("updated");

  if (posterImg && posterTitle && pageTitle) {
    const data = await fetchStream();
    if (!data) {
      pageTitle.textContent = "Belum ada stream";
      posterTitle.textContent = "Belum ada stream";
      posterImg.src = "https://via.placeholder.com/900x1600?text=No+Stream";
      updated.textContent = "";
      return;
    }
    pageTitle.textContent = data.title;
    posterTitle.textContent = data.title;
    posterImg.src = data.poster;
    updated.textContent = data.updatedAt ? `Updated: ${fmtTime(data.updatedAt)}` : "";
  }
})();

/* ===== PLAYER ===== */
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
      video.src = url; // Safari/iOS native HLS
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

/* ===== ADMIN ===== */
(() => {
  const form = document.getElementById("adminForm");
  if (!form) return;

  const status = document.getElementById("status");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = document.getElementById("token").value.trim();
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
    status.textContent = res.ok ? "✅ Published! buka index.html" : `❌ ${res.status}: ${text}`;
  });
})();
