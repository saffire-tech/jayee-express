import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // Data client: use service role key to bypass RLS for recommendation data fetching
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify the caller's JWT when a real user session is present. Anonymous publishable
    // tokens do not include a user `sub`, so they should fall back instead of returning 401.
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
      if (claimsData?.claims?.sub) {
        userId = claimsData.claims.sub as string;
        console.log('User authenticated:', userId);
      } else if (claimsErr) {
        console.warn('JWT verification skipped; using public recommendations:', claimsErr.message);
      }
    }

    // Fetch user's purchase history
    const { data: orders } = userId ? await supabase
      .from('orders')
      .select(`
        id,
        order_items(
          product_id,
          products(id, name, category, price)
        )
      `)
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .limit(10) : { data: [] };

    // Fetch user's recent searches
    const { data: searches } = userId ? await supabase
      .from('user_searches')
      .select('search_query, category, campus')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20) : { data: [] };

    // Fetch all active products
    const { data: allProducts } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        category,
        price,
        image_url,
        store:stores(name, campus)
      `)
      .eq('is_active', true)
      .limit(100);

    if (!allProducts || allProducts.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract purchased categories and product names
    const purchasedProducts: string[] = [];
    const purchasedCategories: string[] = [];
    
    orders?.forEach(order => {
      order.order_items?.forEach((item: any) => {
        if (item.products) {
          purchasedProducts.push(item.products.name);
          if (item.products.category) {
            purchasedCategories.push(item.products.category);
          }
        }
      });
    });

    // Extract search patterns
    const searchQueries = searches?.map(s => s.search_query) || [];
    const searchCategories = searches?.filter(s => s.category).map(s => s.category) || [];
    const searchCampuses = searches?.filter(s => s.campus).map(s => s.campus) || [];

    // Build user profile for AI
    const userProfile = {
      purchasedProducts: [...new Set(purchasedProducts)].slice(0, 10),
      purchasedCategories: [...new Set(purchasedCategories)],
      recentSearches: [...new Set(searchQueries)].slice(0, 10),
      interestedCategories: [...new Set([...purchasedCategories, ...searchCategories])],
      preferredCampuses: [...new Set(searchCampuses)],
    };

    // Prepare product catalog for AI
    const productCatalog = allProducts.map(p => {
      const storeData = p.store as unknown;
      const store = Array.isArray(storeData) ? storeData[0] : storeData;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        campus: (store as { campus?: string | null })?.campus,
      };
    });

    // Call AI to get personalized recommendations
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a product recommendation engine for a community marketplace. 
            Analyze the user's behavior and recommend products they would likely be interested in.
            Return ONLY a JSON array of product IDs (maximum 8 products).
            Consider: purchase history, search patterns, category preferences, and area preferences.
            Prioritize products from categories the user has shown interest in.
            If user has no history, recommend popular/diverse products.`
          },
          {
            role: 'user',
            content: `User Profile: ${JSON.stringify(userProfile)}
            
            Available Products: ${JSON.stringify(productCatalog)}
            
            Based on this user's behavior, return a JSON array of recommended product IDs.
            Format: ["id1", "id2", "id3", ...]`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      // Fallback: return random products
      const shuffled = allProducts.sort(() => 0.5 - Math.random());
      return new Response(JSON.stringify({ 
        recommendations: shuffled.slice(0, 8) 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '[]';
    
    // Parse recommended product IDs
    let recommendedIds: string[] = [];
    try {
      // Extract JSON array from response
      const jsonMatch = aiContent.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        recommendedIds = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    // Get full product details for recommended IDs
    let recommendations = allProducts.filter(p => recommendedIds.includes(p.id));
    
    // If AI returned no valid recommendations, fallback to category-based
    if (recommendations.length === 0) {
      const userCategories = userProfile.interestedCategories;
      if (userCategories.length > 0) {
        recommendations = allProducts
          .filter(p => userCategories.includes(p.category))
          .slice(0, 8);
      } else {
        recommendations = allProducts.sort(() => 0.5 - Math.random()).slice(0, 8);
      }
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-recommendations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
