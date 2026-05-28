import { createClient } from 'jsr:@supabase/supabase-js@2';

type LookupPayload = {
  email?: string;
  phoneLast4?: string;
};

type SheetLogEntry = {
  email: string;
  phoneLast4: string;
  success: boolean;
  teamNo: number | null;
  code: string | null;
  company: string | null;
  userAgent: string | null;
  note?: string;
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

function base64UrlEncode(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function formatSheetTimestamp(date: Date) {
  const koreaTime = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = koreaTime.getUTCFullYear();
  const mm = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(koreaTime.getUTCDate()).padStart(2, '0');
  const hh = String(koreaTime.getUTCHours()).padStart(2, '0');
  const mi = String(koreaTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(koreaTime.getUTCSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

async function createGoogleAccessToken() {
  const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const rawPrivateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');

  if (!serviceAccountEmail || !rawPrivateKey) {
    throw new Error('Google Sheets logging is not configured.');
  }

  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
  const pemBody = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), (char) => char.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const claim = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );
  const jwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  return body.access_token as string;
}

async function appendAccessLogToSheet(entry: SheetLogEntry) {
  const spreadsheetId = Deno.env.get('GOOGLE_ACCESS_LOG_SPREADSHEET_ID');
  const sheetName = Deno.env.get('GOOGLE_ACCESS_LOG_SHEET_NAME') || '0.5_access_logs';

  if (!spreadsheetId) {
    throw new Error('GOOGLE_ACCESS_LOG_SPREADSHEET_ID is not configured.');
  }

  const accessToken = await createGoogleAccessToken();
  const range = encodeURIComponent(`'${sheetName.replace(/'/g, "''")}'!A:I`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${accessToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        values: [[
          formatSheetTimestamp(new Date()),
          entry.email,
          entry.phoneLast4,
          entry.success,
          entry.teamNo ?? '',
          entry.code ?? '',
          entry.company ?? '',
          entry.userAgent ?? '',
          entry.note ?? ''
        ]]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Google Sheets append failed: ${response.status} ${await response.text()}`);
  }
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
  const accessLog = {
    email,
    phoneLast4,
    success: Boolean(team),
    teamNo: team?.no ?? null,
    code: team?.code ?? null,
    company: team?.company ?? null,
    userAgent: req.headers.get('user-agent')
  };

  await supabase.from('access_logs').insert({
    email,
    phone_last4: phoneLast4,
    success: accessLog.success,
    team_no: accessLog.teamNo,
    code: accessLog.code,
    company: accessLog.company,
    user_agent: accessLog.userAgent,
    ip_hash: ipHash
  });

  try {
    await appendAccessLogToSheet(accessLog);
  } catch (sheetError) {
    console.error('sheet append error', sheetError);
  }

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
