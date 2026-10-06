import postgres from "npm:postgres@3.4.4";
const TOKEN = "c239b531cd617bfb19e7f7bfe08369d770fb39664871ff25";
Deno.serve(async (req) => {
  if (req.headers.get("x-apply-token") !== TOKEN) return new Response("no", { status: 403 });
  const { name, sql } = await req.json();
  const db = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false });
  try {
    await db.begin(async (tx) => { await tx.unsafe(sql); });
    return Response.json({ ok: true, name });
  } catch (e) {
    return Response.json({ ok: false, name, error: String((e as any)?.message ?? e) }, { status: 200 });
  } finally { await db.end(); }
});
