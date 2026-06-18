const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, params } = await req.json()

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Endpoint parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

    if (!TMDB_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'TMDB API Key is not configured on Supabase server' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Determine if token is v3 or v4 (v4 is typically a JWT and much longer)
    const isV4Token = TMDB_API_KEY.length > 50
    const queryParams: string[] = params ? [params] : []

    if (!isV4Token) {
      queryParams.push(`api_key=${TMDB_API_KEY}`)
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''
    const tmdbUrl = `${TMDB_BASE_URL}${endpoint}${queryString}`

    const headers: Record<string, string> = {
      accept: 'application/json',
    }

    if (isV4Token) {
      headers['Authorization'] = `Bearer ${TMDB_API_KEY}`
    }

    const response = await fetch(tmdbUrl, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({
          error: `TMDB request failed with status ${response.status}`,
          details: errorText,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
