function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const { password, id } = body || {};
  if (!password || password !== context.env.ADMIN_PASSWORD) return unauthorized();
  if (!id) return new Response("Missing id", { status: 400 });

  const post = await context.env.STREAM_KV.get(`post:${id}`, "json");
  if (!post) return new Response("Post not found", { status: 404 });

  await context.env.STREAM_KV.put("stream:current", id);

  return new Response(JSON.stringify({ ok: true, currentId: id }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
