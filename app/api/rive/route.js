import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Serves the character .riv files (ms_i.riv, mr_q.riv) from a PRIVATE Supabase bucket.
// Use /api/rive?c=ms_i or /api/rive?c=mr_q.
// If the file is not in the bucket (or Supabase env vars are missing) it falls back to
// ./rive-local/<file> on the server, which is handy for local dev. rive-local/ is not public.
// The secret key stays on the server (never NEXT_PUBLIC_), the bucket stays private.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = process.env.RIVE_BUCKET || 'rive-assets';
const FILES = { ms_i: 'ms_i.riv', mr_q: 'mr_q.riv' };

function rivResponse(buf) {
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readLocal(file) {
  try {
    return await readFile(path.join(process.cwd(), 'rive-local', file));
  } catch {
    return null;
  }
}

export async function GET(request) {
  const h = request.headers;

  // Block opening the URL directly in the address bar / as a download link.
  const dest = h.get('sec-fetch-dest');
  const site = h.get('sec-fetch-site');
  if (dest === 'document' || dest === 'iframe' || dest === 'embed') {
    return new Response('Forbidden', { status: 403 });
  }
  // Block other websites hot-linking the file.
  if (site && site !== 'same-origin' && site !== 'same-site') {
    return new Response('Forbidden', { status: 403 });
  }
  const origin = h.get('origin') || h.get('referer');
  if (origin) {
    try {
      if (new URL(origin).host !== h.get('host')) {
        return new Response('Forbidden', { status: 403 });
      }
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const id = new URL(request.url).searchParams.get('c') || 'ms_i';
  const FILE = FILES[id];
  if (!FILE) {
    return new Response('Unknown character', { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.storage.from(BUCKET).download(FILE);
    if (!error && data) {
      return rivResponse(await data.arrayBuffer());
    }
  }

  const local = await readLocal(FILE);
  if (local) return rivResponse(local);

  return new Response(
    url && key ? 'Not found' : 'Server is missing SUPABASE_URL or SUPABASE_SECRET_KEY',
    { status: url && key ? 404 : 500 }
  );
}
