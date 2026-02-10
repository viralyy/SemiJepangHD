export async function onRequest(context) {
  // list keys: post:xxxx
  const listed = await context.env.STREAM_KV.list({ prefix: "post:" });

  const keys = (listed.keys || []).map(k => k.name);
  const posts = [];

  // ambil maksimal 50 post biar gak berat
  for (const name of keys.slice(0, 50)) {
    const p = await context.env.STREAM_KV.get(name, "json");
    if (p) posts.push(p);
  }

  // sort terbaru dulu (by createdAt)
  posts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const currentId = await context.env.STREAM_KV.get("stream:current");

  return new Response(JSON.stringify({ currentId: currentId || null, posts }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
