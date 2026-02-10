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

  // kalau yang dihapus adalah featured, kosongkan featured juga
  const currentId = await context.env.STREAM_KV.get("stream:current");
  if (currentId === id) {
    await context.env.STREAM_KV.delete("stream:current");
  }

  await context.env.STREAM_KV.delete(`post:${id}`);

  return new Response(JSON.stringify({ ok: true, deletedId: id }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
