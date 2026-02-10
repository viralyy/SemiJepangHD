export async function onRequest(context) {
  const currentId = await context.env.STREAM_KV.get("stream:current");
  if (!currentId) {
    return new Response(JSON.stringify(null), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const post = await context.env.STREAM_KV.get(`post:${currentId}`, "json");
  return new Response(JSON.stringify(post || null), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
