function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export async function onRequestPost(context) {
  let body;
  try { body = await context.request.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const { username, password } = body || {};
  if (!username || !password) return unauthorized();

  if (username !== context.env.ADMIN_USERNAME) return unauthorized();
  if (password !== context.env.ADMIN_PASSWORD) return unauthorized();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
