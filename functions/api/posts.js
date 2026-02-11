export async function onRequest(context) {
  const posts = [];

  let cursor = undefined;
  for (;;) {
    const listed = await context.env.STREAM_KV.list({
      prefix: "post:",
      cursor,
      limit: 1000,
    });

    const keys = (listed.keys || []).map(k => k.name);

    // ambil maksimal 50 paling awal (hemat)
    for (const name of keys) {
      const p = await context.env.STREAM_KV.get(name, "json");
      if (p) posts.push(p);
      if (posts.length >= 50) break;
    }

    if (posts.length >= 50) break;

    cursor = listed.cursor;
    if (!cursor) break;
  }

  posts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const currentId = await context.env.STREAM_KV.get("stream:current");

  return new Response(JSON.stringify({ currentId: currentId || null, posts }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
