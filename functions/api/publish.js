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

  const streamsArr = Array.isArray(streams) ? streams : [];
  const firstUrl = stream || (streamsArr[0]?.url || "");

  if (!title || !poster || !firstUrl || !genre || !minutes || !description) {
    return new Response("Missing fields", { status: 400 });
  }

  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= 0) {
    return new Response("Invalid minutes", { status: 400 });
  }

  const id = makeId();

  const cleanStreams = streamsArr
    .map((s, idx) => ({
      label: String(s?.label || `Server ${idx + 1}`).slice(0, 40),
      url: String(s?.url || "")
    }))
    .filter(s => s.url);

  const post = {
    id,
    title: String(title).slice(0, 140),
    poster: String(poster),
    // backward compatible: still store a primary stream
    stream: String(firstUrl),
    // new: multi server list
    streams: cleanStreams,
    genre: String(genre).slice(0, 40),
    minutes: mins,
    description: String(description).slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  await context.env.STREAM_KV.put(`post:${id}`, JSON.stringify(post));
  await context.env.STREAM_KV.put("stream:current", id);

  return new Response(JSON.stringify({ ok: true, post }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
