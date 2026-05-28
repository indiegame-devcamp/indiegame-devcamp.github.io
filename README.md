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
