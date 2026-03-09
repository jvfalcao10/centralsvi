const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Cache rate for 1 hour to avoid hitting rate limits
let cachedRate: number | null = null
let cacheTime = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const now = Date.now()
    if (cachedRate !== null && now - cacheTime < CACHE_TTL) {
      return new Response(JSON.stringify({ rate: cachedRate }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Try open.er-api.com (free, no key needed, generous limits)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)

    const data = await res.json()
    const rate = data?.rates?.BRL as number | undefined
    if (!rate || typeof rate !== 'number') throw new Error('Invalid rate response')

    cachedRate = rate
    cacheTime = now

    return new Response(JSON.stringify({ rate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error fetching USD rate:', err)
    // Return cached value if available, otherwise default
    const fallback = cachedRate ?? 5.8
    return new Response(JSON.stringify({ rate: fallback }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

