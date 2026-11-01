// Studio API: every change made from the secret studio page goes through here.
// The caller proves itself with the key from the studio link (x-admin-key);
// only its sha256 is stored, in public.admin_keys. Writes use the service role,
// so the public site's key can read visible rows and nothing else.

import { createClient } from "npm:@supabase/supabase-js@2";

const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"))[0] as string;
const db = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "media";
const MEDIA_PREFIX = db.storage.from(BUCKET).getPublicUrl("x").data.publicUrl.slice(0, -1);
const MAX_UPLOAD = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-admin-key, apikey, authorization, x-client-info",
};

type Kind = "text" | "long" | "url" | "image" | "bool" | "uuid";
const SCHEMA: Record<string, Record<string, [Kind, number?]>> = {
  categories: {
    name: ["text", 80],
    visible: ["bool"],
  },
  treatments: {
    category_id: ["uuid"],
    name: ["text", 120],
    badge: ["text", 60],
    price: ["text", 40],
    duration: ["text", 40],
    short: ["text", 160],
    description: ["long", 2000],
    good_for: ["text", 160],
    image_url: ["image", 500],
    featured: ["bool"],
    booking_url: ["url", 500],
    visible: ["bool"],
  },
  products: {
    name: ["text", 120],
    brand: ["text", 80],
    category: ["text", 60],
    price: ["text", 40],
    description: ["long", 2000],
    image_url: ["image", 500],
    buy_url: ["url", 500],
    sold_out: ["bool"],
    visible: ["bool"],
  },
};
// the column that groups rows for ordering (new rows go to the end of their group)
const GROUP: Record<string, string | null> = { categories: null, treatments: "category_id", products: null };
const REQUIRED = ["name"];

class Bad extends Error {}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorized(key: string | null) {
  if (!key || key.length < 24 || key.length > 200) return false;
  const { data, error } = await db.from("admin_keys").select("id").eq("key_hash", await sha256(key)).maybeSingle();
  return !error && !!data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function table(name: unknown) {
  if (typeof name !== "string" || !(name in SCHEMA)) throw new Bad("Unknown list.");
  return name;
}

// keep only known columns, trimmed and checked; empty text becomes null
function clean(t: string, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [col, [kind, max]] of Object.entries(SCHEMA[t])) {
    if (!(col in row)) continue;
    let v = row[col];
    if (kind === "bool") {
      out[col] = v === true;
      continue;
    }
    if (v === null || v === undefined) v = "";
    if (typeof v !== "string") throw new Bad(`${col} must be text.`);
    v = kind === "long" ? v.replace(/\r\n/g, "\n").trim() : v.replace(/\s+/g, " ").trim();
    const s = v as string;
    if (!s) {
      out[col] = null;
      continue;
    }
    if (max && s.length > max) throw new Bad(`${col.replace("_", " ")} is too long (max ${max} characters).`);
    if (kind === "uuid" && !UUID.test(s)) throw new Bad("Pick a category from the list.");
    if (kind === "url" && !/^https?:\/\/[^\s]+$/i.test(s)) throw new Bad("Links must start with https://");
    if (kind === "image" && !/^(https:\/\/[^\s]+|assets\/img\/[\w.-]+)$/i.test(s)) throw new Bad("That photo address is not valid.");
    out[col] = s;
  }
  return out;
}

async function nextSort(t: string, group: string | null, value: unknown) {
  let q = db.from(t).select("sort").order("sort", { ascending: false }).limit(1);
  if (group) q = value ? q.eq(group, value) : q.is(group, null);
  const { data } = await q;
  return data && data.length ? (data[0].sort as number) + 1 : 0;
}

async function load() {
  const [c, t, p] = await Promise.all([
    db.from("categories").select("*").order("sort").order("created_at"),
    db.from("treatments").select("*").order("sort").order("created_at"),
    db.from("products").select("*").order("sort").order("created_at"),
  ]);
  const err = c.error || t.error || p.error;
  if (err) throw err;
  return { categories: c.data, treatments: t.data, products: p.data };
}

async function save(t: string, input: Record<string, unknown>) {
  const row = clean(t, input);
  const id = typeof input.id === "string" && UUID.test(input.id) ? input.id : null;
  const group = GROUP[t];

  if (!id) {
    for (const r of REQUIRED) if (!row[r]) throw new Bad("Give it a name first.");
    row.sort = await nextSort(t, group, group ? row[group] : null);
    const { data, error } = await db.from(t).insert(row).select().single();
    if (error) throw error;
    return data;
  }

  if ("name" in row && !row.name) throw new Bad("The name can't be empty.");
  const { data: cur } = await db.from(t).select("*").eq("id", id).single();
  if (group && group in row && cur && cur[group] !== row[group]) {
    // moved to another group: append it there
    row.sort = await nextSort(t, group, row[group]);
  }
  const { data, error } = await db.from(t).update(row).eq("id", id).select().single();
  if (error) throw error;
  if (cur && "image_url" in row && cur.image_url !== row.image_url) await dropImage(cur.image_url);
  return data;
}

async function remove(t: string, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new Bad("Nothing to delete.");
  const { data, error } = await db.from(t).delete().eq("id", id).select().maybeSingle();
  if (error) throw error;
  if (data?.image_url) await dropImage(data.image_url);
  return { id };
}

// delete an uploaded photo once no treatment or product uses it any more
// (the site's own photos in assets/img are never touched)
async function dropImage(url: unknown) {
  if (typeof url !== "string" || !url.startsWith(MEDIA_PREFIX)) return;
  const [t, p] = await Promise.all([
    db.from("treatments").select("id").eq("image_url", url).limit(1),
    db.from("products").select("id").eq("image_url", url).limit(1),
  ]);
  if (t.error || p.error || t.data.length || p.data.length) return;
  const { error } = await db.storage.from(BUCKET).remove([url.slice(MEDIA_PREFIX.length)]);
  if (error) console.error("photo cleanup", error);
}

async function reorder(t: string, ids: unknown) {
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((x) => typeof x === "string" && UUID.test(x))) {
    throw new Bad("Could not reorder.");
  }
  const results = await Promise.all(ids.map((id, i) => db.from(t).update({ sort: i }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  return { ok: true };
}

async function upload(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new Bad("No photo received.");
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Bad("Use a JPG, PNG or WebP photo.");
  if (file.size > MAX_UPLOAD) throw new Bad("That photo is too large (max 8 MB).");
  const folder = form.get("folder") === "products" ? "products" : "treatments";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw error;
  return { url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

// replace every studio key with a new one: the old link stops working
async function rotate(newKey: unknown) {
  if (typeof newKey !== "string" || !/^[\w-]{32,200}$/.test(newKey)) throw new Bad("That key is too short.");
  const hash = await sha256(newKey);
  const { error } = await db.from("admin_keys").insert({ key_hash: hash });
  if (error) throw error;
  const { error: delErr } = await db.from("admin_keys").delete().neq("key_hash", hash);
  if (delErr) throw delErr;
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  if (!(await authorized(req.headers.get("x-admin-key")))) {
    return json({ error: "This studio link is not valid any more." }, 401);
  }

  try {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      return json(await upload(await req.formData()));
    }
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "check":
        return json({ ok: true });
      case "load":
        return json(await load());
      case "save":
        return json(await save(table(body.table), body.row ?? {}));
      case "delete":
        return json(await remove(table(body.table), body.id));
      case "reorder":
        return json(await reorder(table(body.table), body.ids));
      case "rotate":
        return json(await rotate(body.newKey));
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    if (e instanceof Bad) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: "Something went wrong on the server. Try again." }, 500);
  }
});
