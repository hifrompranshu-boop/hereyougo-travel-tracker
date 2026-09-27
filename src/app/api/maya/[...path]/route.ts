import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function mayaBackendBase(): string {
  const raw =
    process.env.MAYA_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_MAYA_BACKEND_URL?.trim() ||
    "";
  return raw.replace(/\/+$/, "");
}

/** Same-origin only — browser should hit hereyougo.me /api/maya, not the tunnel. */
function corsHeaders(req: NextRequest): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  });
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host === req.nextUrl.host) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
      }
    } catch {
      /* ignore invalid Origin */
    }
  }
  return headers;
}

async function proxy(
  req: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  const base = mayaBackendBase();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "MAYA_BACKEND_URL is not configured" },
      { status: 503, headers: corsHeaders(req) }
    );
  }

  const path = pathSegments.join("/");
  const target = `${base}/${path}${req.nextUrl.search}`;

  const headers: HeadersInit = {
    Accept: req.headers.get("Accept") || "application/json",
  };
  const contentType = req.headers.get("Content-Type");
  if (contentType) headers["Content-Type"] = contentType;

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "follow",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();
    const out = new Headers(corsHeaders(req));
    const ct = upstream.headers.get("Content-Type");
    if (ct) out.set("Content-Type", ct);
    return new NextResponse(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Maya backend unreachable" },
      { status: 502, headers: corsHeaders(req) }
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
