import { createClient } from 'jsr:@supabase/supabase-js@2';

type LookupPayload = {
  email?: string;
  phoneLast4?: string;
};

const allowedOrigins = new Set([
  'https://indiegame-devcamp.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.has(origin)
    ? origin
    : 'https://indiegame-devcamp.github.io';

  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin'
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(req)
  });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeLast4(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json(req, 405, { ok: false, message: '지원하지 않는 요청입니다.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(req, 500, {
      ok: false,
      message: '조회 API 설정이 완료되지 않았습니다.'
    });
  }

  let payload: LookupPayload;
  try {
    payload = await req.json();
  } catch (_error) {
    return json(req, 400, { ok: false, message: '요청 형식이 올바르지 않습니다.' });
  }

  const email = normalizeEmail(payload.email);
  const phoneLast4 = normalizeLast4(payload.phoneLast4);

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^[0-9]{4}$/.test(phoneLast4)) {
    return json(req, 400, {
      ok: false,
      message: '이메일과 휴대폰 번호 뒤 4자리를 모두 입력해주세요.'
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: team, error } = await supabase
    .from('teams')
    .select('no, code, project_name, company, folder_url')
    .eq('rep_email', email)
    .eq('phone_last4', phoneLast4)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('lookup error', error);
    return json(req, 500, { ok: false, message: '조회 중 오류가 발생했습니다.' });
  }

  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const ipHash = forwardedFor ? await sha256(forwardedFor.split(',')[0].trim()) : null;

  await supabase.from('access_logs').insert({
    email,
    phone_last4: phoneLast4,
    success: Boolean(team),
    team_no: team?.no ?? null,
    code: team?.code ?? null,
    company: team?.company ?? null,
    user_agent: req.headers.get('user-agent'),
    ip_hash: ipHash
  });

  if (!team) {
    return json(req, 200, {
      ok: false,
      message: '일치하는 정보가 없습니다. 이메일과 휴대폰 번호를 다시 확인해주세요.'
    });
  }

  return json(req, 200, {
    ok: true,
    no: team.no,
    taskNo: team.code,
    projectName: team.project_name,
    teamName: team.company,
    folderName: team.company,
    folderUrl: team.folder_url,
    message: '조회가 완료되었습니다.'
  });
});
