// Lightweight no-JS HTML pages for keypad/feature phones.
// Serves: /lite, /lite/stores, /lite/store/:slug, /lite/product/:id
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (n: unknown) => {
  const v = Number(n);
  if (!isFinite(v)) return '';
  return '₵' + v.toFixed(2);
};

function layout(title: string, body: string, opts: { canonical?: string; description?: string } = {}) {
  const desc = opts.description ?? 'Jayee Express lite version for basic phones.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Jayee Express Lite</title>
<meta name="description" content="${esc(desc)}">
${opts.canonical ? `<link rel="canonical" href="${esc(opts.canonical)}">` : ''}
<style>
*{box-sizing:border-box}
body{margin:0;padding:12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111;background:#fff;line-height:1.4}
header{border-bottom:2px solid #f97316;padding-bottom:8px;margin-bottom:12px}
header h1{margin:0;font-size:20px;color:#f97316}
header a{color:#f97316;text-decoration:none;margin-right:10px;font-size:14px}
nav.crumbs{font-size:13px;margin-bottom:10px;color:#555}
nav.crumbs a{color:#f97316;text-decoration:none}
h2{font-size:17px;margin:14px 0 6px}
h3{font-size:15px;margin:10px 0 4px}
ul.list{list-style:none;padding:0;margin:0}
ul.list li{border-bottom:1px solid #eee;padding:8px 0}
ul.list a{color:#111;text-decoration:none;display:block}
ul.list .meta{color:#666;font-size:13px;margin-top:2px}
img.thumb{max-width:120px;height:auto;display:block;margin-bottom:6px;border:1px solid #eee}
img.hero{max-width:100%;height:auto;display:block;margin:6px 0;border:1px solid #eee}
.price{color:#f97316;font-weight:bold}
.badge{display:inline-block;background:#f97316;color:#fff;padding:1px 6px;font-size:11px;border-radius:3px;margin-left:4px}
footer{margin-top:20px;padding-top:10px;border-top:1px solid #eee;font-size:12px;color:#666}
footer a{color:#f97316}
form.search{margin-bottom:10px}
form.search input[type=text]{width:70%;padding:6px;font-size:15px;border:1px solid #ccc}
form.search input[type=submit]{padding:6px 10px;font-size:15px;background:#f97316;color:#fff;border:0}
.pager{margin-top:10px}
.pager a{color:#f97316;text-decoration:none;margin-right:10px}
.desc{white-space:pre-wrap}
</style>
</head>
<body>
<header>
<h1><a href="/lite/" style="color:#f97316;text-decoration:none">Jayee Express</a></h1>
<div><a href="/lite/">Home</a> <a href="/lite/stores">Stores</a> <a href="/lite/products">Products</a></div>
</header>
${body}
<footer>
Lite version for basic phones. <a href="/">Open full app</a><br>
Contact: <a href="mailto:support@jayeeexpress.com">support@jayeeexpress.com</a>
</footer>
</body>
</html>`;
}

function html(body: string, status = 200, opts?: { canonical?: string; description?: string; title?: string }) {
  return new Response(layout(opts?.title ?? 'Lite', body, opts), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}

async function home() {
  const body = `
<h2>Welcome</h2>
<p>Browse stores and products from Tamale and Wa on any phone.</p>
<form class="search" action="/lite/products" method="get">
  <input type="text" name="q" placeholder="Search products" maxlength="60">
  <input type="submit" value="Search">
</form>
<ul class="list">
<li><a href="/lite/stores"><strong>Browse Stores</strong><div class="meta">Verified shops in Tamale &amp; Wa</div></a></li>
<li><a href="/lite/products"><strong>Browse Products</strong><div class="meta">Latest items and services</div></a></li>
</ul>`;
  return html(body, 200, { title: 'Home', description: 'Jayee Express lite version for basic phones.' });
}

async function stores(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get('p') || '1', 10) || 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const city = url.searchParams.get('city') || '';
  let q = supabase
    .from('stores')
    .select('id, slug, name, description, location, city, is_verified')
    .eq('is_verified', true)
    .neq('is_suspended', true)
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1);
  if (city) q = q.eq('city', city);
  const { data, error } = await q;
  if (error) return html(`<p>Error loading stores.</p>`, 500, { title: 'Stores' });
  const items = (data ?? []).map((s: any) => `
<li><a href="/lite/store/${esc(s.slug || s.id)}">
<strong>${esc(s.name)}</strong>${s.is_verified ? '<span class="badge">Verified</span>' : ''}
<div class="meta">${esc([s.city, s.location].filter(Boolean).join(' • '))}</div>
${s.description ? `<div class="meta">${esc(String(s.description).slice(0, 120))}</div>` : ''}
</a></li>`).join('');
  const body = `
<nav class="crumbs"><a href="/lite/">Home</a> › Stores</nav>
<h2>Stores${city ? ` in ${esc(city)}` : ''}</h2>
<p><a href="/lite/stores?city=Tamale">Tamale</a> · <a href="/lite/stores?city=Wa">Wa</a>${city ? ' · <a href="/lite/stores">All</a>' : ''}</p>
<ul class="list">${items || '<li>No stores found.</li>'}</ul>
<div class="pager">
${page > 1 ? `<a href="?p=${page - 1}${city ? `&city=${encodeURIComponent(city)}` : ''}">« Prev</a>` : ''}
${(data?.length ?? 0) === pageSize ? `<a href="?p=${page + 1}${city ? `&city=${encodeURIComponent(city)}` : ''}">Next »</a>` : ''}
</div>`;
  return html(body, 200, { title: 'Stores' });
}

async function storeDetail(slugOrId: string) {
  // Try slug first, fall back to id
  let { data: store } = await supabase
    .from('stores')
    .select('id, slug, name, description, location, city, is_verified, is_suspended, logo_url, cover_url')
    .eq('slug', slugOrId)
    .maybeSingle();
  if (!store) {
    const r = await supabase
      .from('stores')
      .select('id, slug, name, description, location, city, is_verified, is_suspended, logo_url, cover_url')
      .eq('id', slugOrId)
      .maybeSingle();
    store = r.data ?? null;
  }
  if (!store || !store.is_verified || store.is_suspended) {
    return html(`<p>Store not found.</p><p><a href="/lite/stores">Back to stores</a></p>`, 404, { title: 'Not found' });
  }
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, image_url, category, is_service, stock')
    .eq('store_id', store.id)
    .neq('is_active', false)
    .order('created_at', { ascending: false })
    .limit(30);
  const items = (products ?? []).map((p: any) => `
<li><a href="/lite/product/${esc(p.id)}">
<strong>${esc(p.name)}</strong>
<div class="meta"><span class="price">${money(p.price)}</span>${p.is_service ? ' • Service' : ''}${!p.is_service && p.stock === 0 ? ' • Out of stock' : ''}</div>
</a></li>`).join('');
  const body = `
<nav class="crumbs"><a href="/lite/">Home</a> › <a href="/lite/stores">Stores</a> › ${esc(store.name)}</nav>
${store.logo_url ? `<img class="thumb" src="${esc(store.logo_url)}" alt="${esc(store.name)} logo">` : ''}
<h2>${esc(store.name)}${store.is_verified ? '<span class="badge">Verified</span>' : ''}</h2>
<p class="meta">${esc([store.city, store.location].filter(Boolean).join(' • '))}</p>
${store.description ? `<p class="desc">${esc(store.description)}</p>` : ''}
<h3>Products</h3>
<ul class="list">${items || '<li>No products yet.</li>'}</ul>`;
  return html(body, 200, { title: store.name, description: store.description ?? undefined });
}

async function products(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get('p') || '1', 10) || 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  const category = (url.searchParams.get('category') || '').trim();
  let query = supabase
    .from('products')
    .select('id, name, price, image_url, category, is_service, stock, store:stores!inner(name, slug, is_verified, is_suspended, city)')
    .neq('is_active', false)
    .eq('store.is_verified', true)
    .neq('store.is_suspended', true)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (q) query = query.ilike('name', `%${q}%`);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return html(`<p>Error loading products.</p>`, 500, { title: 'Products' });
  const items = (data ?? []).map((p: any) => {
    const s = Array.isArray(p.store) ? p.store[0] : p.store;
    return `
<li><a href="/lite/product/${esc(p.id)}">
<strong>${esc(p.name)}</strong>
<div class="meta"><span class="price">${money(p.price)}</span>${p.category ? ` • ${esc(p.category)}` : ''}${p.is_service ? ' • Service' : ''}</div>
${s ? `<div class="meta">${esc(s.name)}${s.city ? ` — ${esc(s.city)}` : ''}</div>` : ''}
</a></li>`;
  }).join('');
  const body = `
<nav class="crumbs"><a href="/lite/">Home</a> › Products</nav>
<h2>Products${q ? ` — “${esc(q)}”` : ''}${category ? ` (${esc(category)})` : ''}</h2>
<form class="search" action="/lite/products" method="get">
  <input type="text" name="q" value="${esc(q)}" placeholder="Search products" maxlength="60">
  <input type="submit" value="Search">
</form>
<ul class="list">${items || '<li>No products found.</li>'}</ul>
<div class="pager">
${page > 1 ? `<a href="?p=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}">« Prev</a>` : ''}
${(data?.length ?? 0) === pageSize ? `<a href="?p=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}">Next »</a>` : ''}
</div>`;
  return html(body, 200, { title: 'Products' });
}

async function productDetail(id: string) {
  const { data: product } = await supabase
    .from('products')
    .select('id, name, description, price, image_url, category, is_service, stock, is_active, store:stores(id, slug, name, description, location, city, is_verified, is_suspended)')
    .eq('id', id)
    .maybeSingle();
  if (!product || product.is_active === false) {
    return html(`<p>Product not found.</p><p><a href="/lite/products">Back to products</a></p>`, 404, { title: 'Not found' });
  }
  const store: any = Array.isArray((product as any).store) ? (product as any).store[0] : (product as any).store;
  if (store && (!store.is_verified || store.is_suspended)) {
    return html(`<p>Product unavailable.</p>`, 404, { title: 'Not found' });
  }
  const body = `
<nav class="crumbs"><a href="/lite/">Home</a> › <a href="/lite/products">Products</a> › ${esc(product.name)}</nav>
${product.image_url ? `<img class="hero" src="${esc(product.image_url)}" alt="${esc(product.name)}">` : ''}
<h2>${esc(product.name)}</h2>
<p><span class="price" style="font-size:18px">${money(product.price)}</span>
${product.is_service ? ' <span class="badge">Service</span>' : ''}
${!product.is_service ? ` • Stock: ${Number(product.stock ?? 0)}` : ''}</p>
${product.category ? `<p class="meta">Category: ${esc(product.category)}</p>` : ''}
${product.description ? `<p class="desc">${esc(product.description)}</p>` : ''}
${store ? `
<h3>Sold by</h3>
<ul class="list"><li><a href="/lite/store/${esc(store.slug || store.id)}">
<strong>${esc(store.name)}</strong>
<div class="meta">${esc([store.city, store.location].filter(Boolean).join(' • '))}</div>
</a></li></ul>` : ''}
<p style="margin-top:14px;padding:8px;background:#fff7ed;border:1px solid #fed7aa">
To place an order, open the full app on a smartphone:<br>
<a href="/">jayeeexpress.com</a>
</p>`;
  return html(body, 200, { title: product.name, description: product.description ?? undefined });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  // Path may arrive as /functions/v1/lite/... or /lite/... (via rewrite)
  let path = url.pathname.replace(/^\/functions\/v1\/lite/, '').replace(/^\/lite/, '');
  if (!path || path === '/') return home();
  path = path.replace(/\/+$/, '');

  try {
    if (path === '/stores') return await stores(url);
    if (path === '/products') return await products(url);
    const storeMatch = path.match(/^\/store\/([^\/]+)$/);
    if (storeMatch) return await storeDetail(decodeURIComponent(storeMatch[1]));
    const productMatch = path.match(/^\/product\/([^\/]+)$/);
    if (productMatch) return await productDetail(decodeURIComponent(productMatch[1]));
    return html(`<p>Page not found.</p><p><a href="/lite/">Home</a></p>`, 404, { title: 'Not found' });
  } catch (e) {
    console.error('lite error', e);
    return html(`<p>Something went wrong.</p>`, 500, { title: 'Error' });
  }
});
