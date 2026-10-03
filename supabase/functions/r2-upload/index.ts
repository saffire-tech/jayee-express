import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const FOLDERS = new Set(["products", "stores"]);
const MAX_BYTES = 6 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in required" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Sign in required" }, 401);

    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "");
    if (!(file instanceof File)) return json({ error: "No file provided" }, 400);
    if (!FOLDERS.has(folder)) return json({ error: "Invalid folder" }, 400);
    const ext = EXT[file.type];
    if (!ext) return json({ error: "Only JPG, PNG, WEBP, GIF or AVIF images are allowed" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "Image too large" }, 400);

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const bucket = Deno.env.get("R2_BUCKET");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const publicUrl = (Deno.env.get("R2_PUBLIC_URL") ?? "").replace(/\/+$/, "");
    if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
      return json({ error: "Image storage is not configured" }, 500);
    }

    const key = `${folder}/${userData.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const res = await r2.fetch(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`, {
      method: "PUT",
      body: await file.arrayBuffer(),
      headers: { "Content-Type": file.type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) {
      const details = await res.text();
      console.error(`R2 upload failed [${res.status}]: ${details}`);
      return json({ error: "Upload failed", status: res.status, details }, 502);
    }
    return json({ key, url: `${publicUrl}/${key}` });
  } catch (e) {
    console.error("r2-upload error", e);
    return json({ error: e instanceof Error ? e.message : "Upload failed" }, 500);
  }
});
