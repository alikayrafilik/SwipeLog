const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedEndpointPatterns = [
  /^\/discover\/movie$/,
  /^\/movie\/now_playing$/,
  /^\/movie\/top_rated$/,
  /^\/movie\/upcoming$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/recommendations$/,
  /^\/movie\/\d+\/watch\/providers$/,
  /^\/search\/movie$/,
  /^\/trending\/movie\/(day|week)$/,
]

const isAllowedEndpoint = (endpoint: unknown): endpoint is string =>
  typeof endpoint === 'string' &&
  endpoint.startsWith('/') &&
  !endpoint.includes('..') &&
  allowedEndpointPatterns.some((pattern) => pattern.test(endpoint))

const allowedQueryParams = new Set([
  'append_to_response',
  'include_adult',
  'include_video',
  'language',
  'page',
  'query',
  'region',
  'sort_by',
  'vote_count.gte',
  'with_genres',
])

const blockedQueryParams = new Set(['api_key'])

const createJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const verifyAuthenticatedUser = async (req: Request) => {
  const authorization = req.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) {
    return createJsonResponse({ error: 'Authentication is required' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    return createJsonResponse({ error: 'Supabase auth environment is not configured' }, 500)
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    return createJsonResponse({ error: 'Authentication is required' }, 401)
  }

  const user = await response.json()
  if (!user?.id) {
    return createJsonResponse({ error: 'Authentication is required' }, 401)
  }

  return null
}

const normalizeParams = (params: unknown): { value: string; response?: Response } => {
  if (params === undefined || params === null || params === '') return { value: '' }
  if (typeof params !== 'string') {
    return { value: '', response: createJsonResponse({ error: 'Params must be a query string' }, 400) }
  }

  const searchParams = new URLSearchParams(params)
  for (const key of searchParams.keys()) {
    if (blockedQueryParams.has(key) || !allowedQueryParams.has(key)) {
      return {
        value: '',
        response: createJsonResponse({ error: `Query parameter is not allowed: ${key}` }, 403),
      }
    }
  }

  return { value: searchParams.toString() }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return createJsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authError = await verifyAuthenticatedUser(req)
    if (authError) return authError

    const { endpoint, params } = await req.json()

    if (!isAllowedEndpoint(endpoint)) {
      return createJsonResponse({ error: 'Endpoint is not allowed' }, 403)
    }

    const normalizedParams = normalizeParams(params)
    if (normalizedParams.response) return normalizedParams.response

    const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY')
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

    if (!TMDB_API_KEY) {
      return createJsonResponse({ error: 'TMDB API Key is not configured on Supabase server' }, 500)
    }

    // Determine if token is v3 or v4 (v4 is typically a JWT and much longer)
    const isV4Token = TMDB_API_KEY.length > 50
    const queryParams: string[] = normalizedParams.value ? [normalizedParams.value] : []

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
      return createJsonResponse(
        {
          error: `TMDB request failed with status ${response.status}`,
          details: errorText,
        },
        response.status
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return createJsonResponse({ error: error.message }, 500)
  }
})
