function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const {
    username,
    password,
    id,

    title,
    poster,
    stream,
    streams,
    genre,
    minutes,
    description,
  } = body || {};

  if (!username || !password) return unauthorized();
  if (username !== context.env.ADMIN_USERNAME) return unauthorized();
  if (password !== context.env.ADMIN_PASSWORD) return unauthorized();

  const postId = String(id || "").trim();
  if (!postId) return new Response("Missing id", { status: 400 });

  const key = `post:${postId}`;
  const existing = await context.env.STREAM_KV.get(key, "json");
  if (!existing) return new Response("Post not found", { status: 404 });

  // ===== normalize input (allow partial update) =====
  const titleS = title === undefined ? existing.title : String(title || "").trim();
  const posterS = poster === undefined ? existing.poster : String(poster || "").trim();
  const genreS = genre === undefined ? (existing.genre || "") : String(genre || "").trim();

  // minutes: if undefined -> keep; else validate
  let mins = existing.minutes ?? null;
  if (minutes !== undefined) {
    mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) {
      return new Response("Invalid minutes", { status: 400 });
    }
  }

  // description: if undefined -> keep
  const descS = description === undefined ? (existing.description || "") : String(description ?? "").trim();

  // streams normalize:
  // - if streams provided -> use it
  // - else if stream provided -> set as single
  // - else keep existing streams/stream
  let newStreams = null;

  if (streams !== undefined) {
    const arr = Array.isArray(streams) ? streams : [];
    newStreams = arr
      .map((s, idx) => ({
        label: String(s?.label || `Server ${idx + 1}`).trim().slice(0, 40),
        url: String(s?.url || "").trim(),
      }))
      .filter(s => s.url);
  } else if (stream !== undefined) {
    const url = String(stream || "").trim();
    newStreams = url ? [{ label: "Server 1", url }] : [];
  }

  // fallback streams: keep existing
  const finalStreams = newStreams !== null
    ? newStreams
    : (Array.isArray(existing.streams) ? existing.streams : []);

  const firstUrl = finalStreams[0]?.url || (existing.stream || "");

  // required fields sanity (after merge)
  if (!titleS || !posterS || !genreS || !mins || !descS) {
    return new Response("Missing fields", { status: 400 });
  }
  // stream/url boleh kosong kalau lu mau, tapi biasanya harus ada
  if (!firstUrl) {
    return new Response("Missing stream", { status: 400 });
  }

  const updated = {
    ...existing,
    title: String(titleS).slice(0, 140),
    poster: String(posterS),
    genre: String(genreS).slice(0, 40),
    minutes: mins,
    description: String(descS), // jangan dipotong biar full
    streams: finalStreams,
    stream: String(firstUrl), // keep backward compat
    updatedAt: new Date().toISOString(),
  };

  await context.env.STREAM_KV.put(key, JSON.stringify(updated));

  return new Response(JSON.stringify({ ok: true, post: updated }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
