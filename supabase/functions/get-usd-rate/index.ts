const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)

    const data = await res.json()
    const rate = parseFloat(data?.USDBRL?.bid ?? '5.0')

    return new Response(JSON.stringify({ rate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error fetching USD rate:', err)
    return new Response(JSON.stringify({ rate: 5.0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
