export async function onRequest(context) {
  const data = await context.env.STREAM_KV.get("stream:current", "json");

  return new Response(JSON.stringify(data || null), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
