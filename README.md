# DevCampLog Lookup

GitHub Pages용 DevCampLog 팀별 폴더 조회 프론트엔드입니다.

## 구조

- `index.html`: 조회 화면
- `assets/styles.css`: 기존 Apps Script 웹앱과 동일한 화면 스타일
- `assets/app.js`: Supabase Edge Function 호출 로직
- `config.js`: 운영 API 엔드포인트 설정

## API 응답 형식

프론트엔드는 `POST` 요청으로 아래 값을 전송합니다.

```json
{
  "email": "representative@example.com",
  "phoneLast4": "1234"
}
```

성공 응답은 기존 Apps Script와 같은 형태를 기대합니다.

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

## GitHub Pages

Repository Settings -> Pages에서 `Deploy from a branch`, `main`, `/ (root)`로 설정하면 됩니다.
