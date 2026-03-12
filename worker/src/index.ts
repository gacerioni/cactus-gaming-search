/**
 * Cloudflare Worker - Edge Proxy para Cactus Gaming Backend
 * 
 * Funcionalidades:
 * - CORS handling
 * - Proxy para backend AWS
 * - Rate limiting (futuro)
 * - Edge caching (futuro)
 */

interface Env {
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'cactus-worker',
        timestamp: new Date().toISOString(),
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders(),
        },
      });
    }

    // Proxy API requests to backend
    if (url.pathname.startsWith('/api/')) {
      return proxyToBackend(request, env);
    }

    // 404 for other routes
    return new Response(JSON.stringify({
      error: 'Not Found',
      path: url.pathname,
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(),
      },
    });
  },
};

/**
 * Proxy request to backend AWS
 */
async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const backendUrl = `${env.BACKEND_URL}${url.pathname}${url.search}`;

    // Forward request to backend
    const backendResponse = await fetch(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });

    // Clone response and add CORS headers
    const response = new Response(backendResponse.body, backendResponse);
    
    // Add CORS headers
    const corsHeaders = getCORSHeaders();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error: any) {
    console.error('Proxy error:', error);
    
    return new Response(JSON.stringify({
      error: 'Backend Error',
      message: error.message,
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...getCORSHeaders(),
      },
    });
  }
}

/**
 * Handle CORS preflight
 */
function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(),
  });
}

/**
 * Get CORS headers
 */
function getCORSHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

