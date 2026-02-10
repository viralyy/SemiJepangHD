function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function makeId() {
  const iso = new Date().toISOString(); // 2026-02-11T...
  const compact = iso.replace(/[-:.TZ]/g, ""); // biar rapih
  const rand = Math.random().toString(16).slice(2, 8);
  return `${compact}-${rand}`;
}

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const { password, title, poster, stream } = body || {};
  if (!password || password !== context.env.ADMIN_PASSWORD) return unauthorized();
  if (!title || !poster || !stream) return new Response("Missing fields", { status: 400 });

  const id = makeId();
  const post = {
    id,
    title: String(title).slice(0, 120),
    poster: String(poster),
    stream: String(stream),
    createdAt: new Date().toISOString(),
  };

  await context.env.STREAM_KV.put(`post:${id}`, JSON.stringify(post));
  await context.env.STREAM_KV.put("stream:current", id); // set featured

  return new Response(JSON.stringify({ ok: true, post }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
