# DevCampLog Lookup

인디게임 데브캠프 팀별 DevCampLog 폴더 조회 페이지입니다.

## 구성

- `index.html`: 조회 화면
- `assets/styles.css`: 화면 스타일
- `assets/app.js`: 조회 API 호출 로직
- `config.js`: 운영 API endpoint 설정
- `supabase/migrations`: Supabase DB 스키마
- `supabase/functions/devcamp-log-lookup`: Supabase Edge Function

## 운영 URL

- GitHub Pages: https://indiegame-devcamp.github.io/
- Supabase Edge Function: https://qcqdccmymeazusjhrsxp.supabase.co/functions/v1/devcamp-log-lookup

## API 요청

```json
{
  "email": "representative@example.com",
  "phoneLast4": "1234"
}
```

## API 응답

```json
{
  "ok": true,
  "taskNo": "T202600717",
  "projectName": "Project name",
  "teamName": "Team name",
  "folderUrl": "https://drive.google.com/...",
  "message": "조회가 완료되었습니다."
}
```

## 보안 구조

프론트엔드는 Supabase 테이블에 직접 접근하지 않습니다. GitHub Pages는 Edge Function만 호출하고, Edge Function이 대표자 이메일과 휴대폰 번호 뒤 4자리를 검증한 뒤 일치하는 팀의 폴더 링크만 반환합니다.

`teams`, `access_logs` 테이블은 RLS가 켜져 있으며 service role 전용 정책과 권한으로 운영합니다.

## Google Sheets 로그 연동

조회 요청은 Supabase `access_logs` 테이블에 먼저 기록되고, 같은 Edge Function 실행 안에서 Google Sheets `0.5_access_logs`에도 즉시 append됩니다.

Supabase Edge Function secrets에 아래 값을 설정해야 합니다.

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google Cloud 서비스 계정 이메일
- `GOOGLE_PRIVATE_KEY`: 서비스 계정 JSON의 `private_key` 값
- `GOOGLE_ACCESS_LOG_SPREADSHEET_ID`: `1zqtiqL7pyMVeSLMXQ68oHqjUNdRUBGdul40Mw-qCV3w`
- `GOOGLE_ACCESS_LOG_SHEET_NAME`: `0.5_access_logs`

서비스 계정 이메일은 대상 Google Sheet에 편집자로 공유되어 있어야 합니다.
