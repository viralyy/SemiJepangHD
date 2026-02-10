export async function onRequestPost(context) {
  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token || token !== context.env.ADMIN_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  await context.env.STREAM_KV.delete("stream:current");

  return new Response(JSON.stringify({ ok: true, deleted: true }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
