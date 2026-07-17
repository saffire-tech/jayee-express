import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Server-derived app origin — never trust client-provided URLs.
const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://jayeeexpress.com'

interface Body {
  templateName: 'store-welcome' | 'order-status-update'
  storeId?: string
  orderId?: string
  status?: string
  idempotencyKey?: string
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })
  const caller = userRes.user

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  if (!body?.templateName) return json(400, { error: 'templateName required' })

  const admin = createClient(supabaseUrl, serviceKey)

  let recipientEmail: string | undefined
  let templateData: Record<string, unknown> = {}
  let idempotencyKey = body.idempotencyKey

  if (body.templateName === 'store-welcome') {
    if (!body.storeId) return json(400, { error: 'storeId required' })
    const { data: store, error: storeErr } = await admin
      .from('stores')
      .select('id, name, user_id')
      .eq('id', body.storeId)
      .maybeSingle()
    if (storeErr || !store) return json(404, { error: 'Store not found' })
    // Only the store owner may trigger this branded email.
    if (store.user_id !== caller.id) return json(403, { error: 'Forbidden' })

    recipientEmail = caller.email ?? undefined
    if (!recipientEmail) return json(400, { error: 'No email on account' })

    templateData = {
      ownerName: (caller.user_metadata as any)?.full_name || '',
      storeName: store.name,
      dashboardUrl: `${APP_URL}/seller`,
    }
    idempotencyKey ??= `store-welcome-${store.id}`
  } else if (body.templateName === 'order-status-update') {
    if (!body.orderId || !body.status) return json(400, { error: 'orderId and status required' })
    const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled'])
    if (!allowedStatuses.has(body.status)) return json(400, { error: 'Invalid status' })

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, buyer_id, store_id, status')
      .eq('id', body.orderId)
      .maybeSingle()
    if (orderErr || !order) return json(404, { error: 'Order not found' })

    // Only the seller (store owner) of this order may notify the buyer.
    const { data: store } = await admin
      .from('stores')
      .select('id, name, user_id')
      .eq('id', order.store_id)
      .maybeSingle()
    if (!store) return json(404, { error: 'Store not found' })
    if (store.user_id !== caller.id) return json(403, { error: 'Forbidden' })

    // The actual DB status must match (prevents lying about state).
    if (order.status !== body.status) return json(409, { error: 'Status mismatch' })

    const { data: buyerRes, error: buyerErr } = await admin.auth.admin.getUserById(order.buyer_id)
    if (buyerErr || !buyerRes?.user?.email) return json(404, { error: 'Buyer email not found' })
    recipientEmail = buyerRes.user.email

    const { data: buyerProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('user_id', order.buyer_id)
      .maybeSingle()

    templateData = {
      buyerName: (buyerProfile as any)?.full_name || '',
      orderId: order.id,
      status: order.status,
      storeName: store.name,
      orderUrl: `${APP_URL}/purchases`,
    }
    idempotencyKey ??= `order-status-${order.id}-${order.status}`
  } else {
    return json(400, { error: 'Unsupported templateName' })
  }

  const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      templateName: body.templateName,
      recipientEmail,
      idempotencyKey,
      templateData,
    }),
  })

  const text = await resp.text()
  return new Response(text, {
    status: resp.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
