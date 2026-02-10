function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const { password } = body || {};
  if (!password || password !== context.env.ADMIN_PASSWORD) return unauthorized();

  await context.env.STREAM_KV.delete("stream:current");

  return new Response(JSON.stringify({ ok: true, cleared: true }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
