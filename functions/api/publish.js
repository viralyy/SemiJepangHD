export async function onRequestPost(context) {
  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token || token !== context.env.ADMIN_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { title, poster, stream } = body || {};
  if (!title || !poster || !stream) {
    return new Response("Missing fields", { status: 400 });
  }

  const payload = {
    title: String(title).slice(0, 120),
    poster: String(poster),
    stream: String(stream),
    updatedAt: new Date().toISOString(),
  };

  await context.env.STREAM_KV.put("stream:current", JSON.stringify(payload));

  return new Response(JSON.stringify({ ok: true, payload }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
