import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { ok: false, message: 'Method not allowed.' });
  }

  const expectedSecret = Deno.env.get('ACCESS_LOG_EXPORT_SECRET');
  const providedSecret = req.headers.get('x-sync-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json(401, { ok: false, message: 'Unauthorized.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, message: 'Supabase is not configured.' });
  }

  const payload = await req.json().catch(() => ({}));
  const sinceId = Number(payload.sinceId || 0);
  const limit = Math.min(Number(payload.limit || 5000), 10000);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase
    .from('access_logs')
    .select('id, created_at, email, phone_last4, success, team_no, code, company, user_agent')
    .gt('id', sinceId)
    .order('id', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('access log export error', error);
    return json(500, { ok: false, message: 'Failed to export logs.' });
  }

  return json(200, {
    ok: true,
    rows: data || []
  });
});
