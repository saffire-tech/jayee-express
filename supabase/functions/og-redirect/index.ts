import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Social media crawler user agents
const crawlerPatterns = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'WhatsApp',
  'TelegramBot',
  'LinkedInBot',
  'Slackbot',
  'Discordbot',
  'Pinterest',
  'Googlebot',
];

function isCrawler(userAgent: string): boolean {
  if (!userAgent) return false;
  return crawlerPatterns.some(pattern => 
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
}

function generateOGHtml(
  title: string,
  description: string,
  imageUrl: string,
  url: string,
  type: 'product' | 'store' | 'service'
): string {
  const siteName = 'Shodel';
  const safeTitle = title.replace(/"/g, '&quot;');
  const safeDescription = description.replace(/"/g, '&quot;');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} | ${siteName}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${type === 'product' ? 'product' : 'website'}">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="${siteName}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${url}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- WhatsApp -->
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Redirect for regular users -->
  <script>window.location.href = "${url}";</script>
  <noscript>
    <meta http-equiv="refresh" content="0; url=${url}">
  </noscript>
</head>
<body>
  <p>Redirecting to <a href="${url}">${safeTitle}</a>...</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected path: /og-redirect?type=product&id=xxx or /og-redirect?type=store&id=xxx or /og-redirect?type=service&id=xxx
    const type = url.searchParams.get('type') as 'product' | 'store' | 'service' | null;
    const id = url.searchParams.get('id');
    const origin = url.searchParams.get('origin') || 'https://uniplug.lovable.app';
    
    if (!type || !id) {
      return new Response('Missing type or id parameter', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const userAgent = req.headers.get('user-agent') || '';
    // For services, redirect to the store page since services don't have their own page
    let targetUrl: string;
    if (type === 'service') {
      targetUrl = origin; // Will be updated with store URL after fetching data
    } else {
      targetUrl = `${origin}/${type === 'product' ? 'product' : 'store'}/${id}`;
    }
    
    // For non-crawlers, just redirect immediately
    if (!isCrawler(userAgent)) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': targetUrl,
        },
      });
    }

    // For crawlers, fetch data and return OG meta tags
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let title = 'Shodel';
    let description = 'Community Marketplace';
    let imageUrl = 'https://uniplug.app/og-image.png';

    if (type === 'product') {
      const { data: product, error } = await supabase
        .from('products')
        .select('name, description, image_url, price, store_id')
        .eq('id', id)
        .single();

      if (error || !product) {
        console.error('Product not found:', error);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': targetUrl },
        });
      }

      // Fetch store name separately
      let storeName = 'Shodel';
      if (product.store_id) {
        const { data: store } = await supabase
          .from('stores')
          .select('name')
          .eq('id', product.store_id)
          .single();
        if (store) storeName = store.name;
      }

      title = product.name;
      description = product.description 
        ? `${product.description.substring(0, 150)}${product.description.length > 150 ? '...' : ''}`
        : `GH₵${product.price} - Available at ${storeName}`;
      imageUrl = product.image_url || imageUrl;

    } else if (type === 'store') {
      const { data: store, error } = await supabase
        .from('stores')
        .select('name, description, logo_url, cover_url, location')
        .eq('id', id)
        .single();

      if (error || !store) {
        console.error('Store not found:', error);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': targetUrl },
        });
      }

      title = store.name;
      description = store.description 
        ? `${store.description.substring(0, 150)}${store.description.length > 150 ? '...' : ''}`
        : `Shop at ${store.name}${store.location ? ` - ${store.location}` : ''} on Shodel`;
      // Prefer cover image for stores, fall back to logo
      imageUrl = store.cover_url || store.logo_url || imageUrl;
    } else if (type === 'service') {
      const { data: service, error } = await supabase
        .from('store_web_services')
        .select('name, description, image_url, url, store_id')
        .eq('id', id)
        .single();

      if (error || !service) {
        console.error('Service not found:', error);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': origin },
        });
      }

      // Fetch store info for the redirect URL and fallback image
      let storeName = 'UniPlug';
      let storeImageUrl = '';
      if (service.store_id) {
        const { data: store } = await supabase
          .from('stores')
          .select('name, logo_url, cover_url')
          .eq('id', service.store_id)
          .single();
        if (store) {
          storeName = store.name;
          storeImageUrl = store.cover_url || store.logo_url || '';
          targetUrl = `${origin}/store/${service.store_id}`;
        }
      }

      title = service.name;
      description = service.description 
        ? `${service.description.substring(0, 150)}${service.description.length > 150 ? '...' : ''}`
        : `${service.name} - Available at ${storeName} on UniPlug`;
      // Use service image, fall back to store image, then default
      imageUrl = service.image_url || storeImageUrl || imageUrl;
    }

    const html = generateOGHtml(title, description, imageUrl, targetUrl, type);
    
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });

  } catch (error) {
    console.error('Error in og-redirect:', error);
    return new Response('Internal Server Error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
