# 운행일지 (DriveLog)

화물차 기사와 차주를 위한 운행 장부 앱입니다.
그날 운행과 지출을 적어 두면 한 달 매출·정산과 필요한 서류까지 앱이 정리합니다.

- 서비스: https://getdrivelog.com
- 안드로이드 앱: 구글 플레이 비공개 테스트 중
- 기획·결정 기록: [drivelog-docs](https://github.com/mung2nyang/drivelog-docs)

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/mung2nyang/drivelog-docs/main/docs/store-assets/screenshots/01-home.png" width="200" alt="홈"></td>
    <td><img src="https://raw.githubusercontent.com/mung2nyang/drivelog-docs/main/docs/store-assets/screenshots/02-calendar.png" width="200" alt="달력과 운비서"></td>
    <td><img src="https://raw.githubusercontent.com/mung2nyang/drivelog-docs/main/docs/store-assets/screenshots/03-day-log.png" width="200" alt="운행 일지"></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/mung2nyang/drivelog-docs/main/docs/store-assets/screenshots/04-revenue.png" width="200" alt="매출"></td>
    <td><img src="https://raw.githubusercontent.com/mung2nyang/drivelog-docs/main/docs/store-assets/screenshots/05-documents.png" width="200" alt="일상점검표"></td>
    <td><img src="https://raw.githubusercontent.com/mung2nyang/drivelog-docs/main/docs/store-assets/screenshots/06-drivers.png" width="200" alt="기사 차량"></td>
  </tr>
</table>

## 주요 기능

| 기능 | 내용 |
|---|---|
| 운행 기록 | 날짜·상차지·하차지·운송료·수수료 기록, 자주 쓰는 거래처와 고정 노선 불러오기, 달력에서 한눈에 보기 |
| 지출·미수금 | 정비·주유·기타 비용을 차량별로 기록, 못 받은 운송료는 미수금으로 따로 관리 |
| 매출·정산 | 월간 정산 합계(부가세 제외·포함), 소속 기사 급여 계산(매출제·월급제) |
| 서류 만들기 | 운송비 내역서(PDF), 세금계산서 작성 자료(엑셀), 일상점검표(PDF), 카카오톡·문자로 바로 보내기 |
| 차주·기사 함께 쓰기 | 초대 코드로 기사 연동(기사가 직접 기록, 차주는 정산 요약 확인), 앱을 안 쓰는 기사 차량은 차주가 대신 기록 |
| AI 운비서 | "오늘 부산에서 대구 30만 원"처럼 말이나 글로 일지 채우기, 날씨 묻기, 답을 목소리로 듣기 |
| 계정 | 구글 로그인으로 여러 기기에서 이어 쓰기, 로그인 없이 비회원으로 시작(기록은 기기에만 저장), 내 기록 내려받기 |
| 알림 | 오늘 일지·연체 미수금·비회원 백업 알림(기기 예약), 문의·답변·기사 연결 알림(서버 발송) |

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 화면 | React 19, React Router 7, Vite 7 |
| 언어 | TypeScript 7 (남은 JavaScript 파일은 TypeScript로 단계적 전환 중) |
| 서버·DB | Supabase (Postgres, 인증, 행 단위 보안 RLS, Edge Functions) |
| 안드로이드 앱 | Capacitor 8 (파일 저장·공유·뒤로가기·음성 인식·읽어 주기·로컬/푸시 알림·구글 로그인) |
| 값 검증 | Valibot (기기 저장소에서 읽은 값을 실행 중에 검사) |
| 서류 | html2pdf.js (PDF), ExcelJS (엑셀) |
| AI 운비서 | Supabase Edge Functions(Deno) + xAI Grok(문장 해석·목소리), 기상청 날씨 |
| 품질 | Node 내장 시험 도구 + jsdom, oxlint, dependency-cruiser |
| 배포 | GitHub Actions → GitHub Pages(`getdrivelog.com`), 구글 플레이 |

## 설계에서 신경 쓴 점

**저장된 것과 화면이 어긋나지 않게**
- 로그인하면 서버(Supabase)가 기록의 정본입니다. 저장은 서버에 한 번 쓰고, 성공했을 때만 화면에 반영합니다.
- 저장에 실패하면 몰래 쌓아 두고 다시 보내지 않고, 바로 안내한 뒤 멈춥니다(Fail-Fast). 화면에는 보이는데 서버에는 없는 상태를 만들지 않기 위해서입니다.
- 운행 일지 저장에 실패하면 그 날짜만 기기에 표시해 두고, 알림 목록에 "M월 D일 운행일지를 저장하지 못했습니다."로 띄웁니다. 누르면 그 날짜 일지가 열립니다.
- 앱을 열 때 서버 기록을 받아 화면 상태로 맞추는 단계(조회 → 검증 → 병합 → 반영)를 나누고, 병합은 순수 함수로 분리해 시험합니다.
- 비회원 기록은 기기에만 저장되므로, 백업 파일 내려받기와 백업 알림을 둡니다.

**돈 계산이 틀리지 않게**
- 정산·부가세·기사 급여 계산은 화면과 분리된 `src/domain/`에 두고 단위 시험으로 지킵니다.

**데이터를 남이 못 보게**
- 모든 테이블에 행 단위 보안(RLS)을 켜고, 기사 초대·연동·알림 주소의 권한을 SQL 시험으로 확인합니다.
- CI에서 로컬 Supabase를 띄워 운영과 같은 구조를 만든 뒤 이 시험을 돌리고, 실패하면 배포하지 않습니다.

**코드가 엉키지 않게**
- 계층 사이 의존 방향을 정하고 CI에서 검사합니다.

```
app(앱 틀) → features(기능 화면) → data(저장·동기화) → shared(공용 부품) → domain(계산)
```

- 왼쪽은 오른쪽을 부를 수 있고, 반대 방향은 막혀 있습니다.
- 기능 화면끼리는 정해 둔 예외 말고는 서로 부르지 않습니다. 파일은 200줄 이하를 원칙으로 합니다.

## 폴더 구조

```
src/
  app/        앱 틀 — 라우팅, 세션, 시작 처리, 오류 보고
  features/   기능 화면 — home, calendar, day-log, revenue, documents, drivers, cars, clients ...
  data/       저장·동기화
    store/    앱 상태와 기기 저장소 읽기·쓰기
    sync/     서버 저장과 저장 실패 처리
    hydrate/  로그인 때 서버 기록과 기기 기록 합치기
    cloud/    Supabase 연결, 로그인 세션
  shared/     공용 화면 부품·훅·스타일
  domain/     계산과 규칙(정산, 부가세, 미수금, 기사 급여 등)
supabase/
  migrations/ DB 변경 기록
  baseline/   운영 DB 시작점
  tests/      권한 시험(SQL)
  functions/  서버 함수 — 운비서 해석·목소리·날씨, 푸시 알림
android/      Capacitor 안드로이드 프로젝트
```

## 실행 방법

Node 22가 필요합니다.

```bash
npm install
npm run dev
```

| 명령 | 하는 일 |
|---|---|
| `npm test` | 단위 시험과 화면 시험 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | 코드 검사 |
| `npm run depcheck` | 계층 의존 방향 검사 |
| `npm run build` | 배포용 빌드 |

## CI·배포

올릴 때마다 GitHub Actions가 1·2를 돌리고, `main` 브랜치일 때만 3까지 갑니다.

1. **verify** — 시험, 타입 검사, 빌드, 의존 방향 검사, 코드 검사, 서버 함수 타입 검사와 시험
2. **db-test** — 로컬 Supabase에 운영 구조를 만들고 DB 권한 시험
3. **deploy** — 1·2가 모두 통과하면 GitHub Pages(`getdrivelog.com`)에 배포

## 개발 방식

AI 코딩 도구와 함께 개발했습니다. 기획, 기능과 계산 규칙 결정, 실기기 확인, 최종 승인은 직접 하고,
코드 작성과 시험 작성은 AI가 맡았습니다.

AI가 쓴 코드는 사람 눈으로만 보지 않고 자동 검사로 막습니다. 올릴 때마다 CI가 시험, 타입 검사,
빌드, 계층 의존 방향, 코드 검사, 서버 함수 시험, DB 권한 시험을 다시 돌리고, 하나라도 실패하면
배포하지 않습니다(위 "CI·배포"). CI가 못 보는 것(고치기로 한 범위를 지켰는지, 타입 검사를 우회했는지,
시험을 지우거나 약하게 바꿨는지)은 작업마다 따로 점검합니다.

작업은 작은 단위로 나눠 진행합니다. 단위마다 무엇을·왜·어디까지 고칠지 계획서를 먼저 쓰고,
승인 뒤 코드를 고치고, 시험과 실기기 확인, CI 통과를 거쳐 반영합니다.
계획서와 도메인 규칙, 결정 기록은 [drivelog-docs](https://github.com/mung2nyang/drivelog-docs)에 있습니다.

## 만든 곳

Studio Bori · studiobori.app@gmail.com
