function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function makeId() {
  const iso = new Date().toISOString();
  const compact = iso.replace(/[-:.TZ]/g, "");
  const rand = Math.random().toString(16).slice(2, 8);
  return `${compact}-${rand}`;
}

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const {
    username,
    password,
    title,
    poster,
    stream,
    streams,
    genre,
    minutes,
    description
  } = body || {};

  if (!username || !password) return unauthorized();
  if (username !== context.env.ADMIN_USERNAME) return unauthorized();
  if (password !== context.env.ADMIN_PASSWORD) return unauthorized();

  const titleS = String(title || "").trim();
  const posterS = String(poster || "").trim();
  const genreS = String(genre || "").trim();
  const descS = String(description ?? "").trim();

  // streams normalize
  let streamsArr = Array.isArray(streams) ? streams : [];
  const streamS = String(stream || "").trim();

  if (!streamsArr.length && streamS) {
    streamsArr = [{ label: "Server 1", url: streamS }];
  }

  const cleanStreams = streamsArr
    .map((s, idx) => ({
      label: String(s?.label || `Server ${idx + 1}`).trim().slice(0, 40),
      url: String(s?.url || "").trim()
    }))
    .filter(s => s.url);

  const firstUrl = cleanStreams[0]?.url || streamS;

  // minutes validate (jangan pakai !minutes)
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= 0) {
    return new Response("Invalid minutes", { status: 400 });
  }

  // required fields
  if (!titleS || !posterS || !firstUrl || !genreS || !descS) {
    return new Response("Missing fields", { status: 400 });
  }

  const id = makeId();

  const post = {
    id,
    title: titleS.slice(0, 140),
    poster: posterS,
    stream: String(firstUrl),     // backward compatible
    streams: cleanStreams,        // multi server
    genre: genreS.slice(0, 40),
    minutes: mins,

    // ✅ jangan dipotong 500, biar full masuk
    // kalau lo takut kebesaran, ganti jadi slice(0, 5000) misalnya
    description: descS,

    createdAt: new Date().toISOString(),
  };

  await context.env.STREAM_KV.put(`post:${id}`, JSON.stringify(post));
  await context.env.STREAM_KV.put("stream:current", id);

  return new Response(JSON.stringify({ ok: true, post }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
