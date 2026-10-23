# day-of-music 리팩토링 조사 보고서

**한 줄 요약**: 소스(src/)는 typecheck·lint가 통과하고 any/TODO가 0인 건강한 상태지만, 테스트가 0개이고 (1) 앱 셸 `day-of-music-app.tsx`·`use-journal.tsx`·`profile-page.tsx`·`add-flow.tsx`·`/api/music/album/route.ts` 다섯 곳에 책임이 집중되어 있으며, (2) iTunes fetch·Supabase 보일러플레이트·localStorage 스토어·날짜 산술·테마 라벨·공유 모달 셸 같은 "이미 단일 출처 모듈이 있는데 주변이 따라오지 않은" 중복이 많고, (3) 5개 언어 i18n이 lib·프로필·공유 영역에 미완으로 남아 있고, (4) 5,707줄 단일 CSS가 append-only로 누적된 상태이며, (5) 2차 조사에서 드러난 공백으로 공용 Modal에 포커스 생명주기가 없고(키보드 Tab이 스크림 뒤로 누출), Tailwind 자동 스캔이 mobile/의 NativeWind 유틸리티를 웹 CSS에 섞어 로컬·Docker 빌드 산출물이 다르고, React Compiler 채택 여부가 수동 메모이제이션 후보 4개의 전제로 미결 상태다. 106개 후보 중 impact 4(검증값)는 5개(C01·C68·C45·C83·C22), 대부분은 S~M 규모의 추출·통합·속성 추가이며 근거 있는 대규모 재작성은 없다.

- **조사일**: 2026-10-23 (2차 반영 2026-10-24)
- **기준 커밋**: main `29ef0ad` (브랜치 `refactor/261023-refactoring`)
- **조사 방법**: 13개 영역/관점 독립 조사(187개 후보) → 병합(89개 클러스터, 3개 탈락) → 파일 친화도별 13묶음, 묶음당 리뷰어 1명이 후보마다 반박(refute)/회귀위험(risk)/가치(value) 3관점을 독립 판정(3 중 2 이상 통과 시 채택). 1차 결과 84개 채택, 5개 탈락, 미검증 0개. **2차(비평가 지적 공백 3영역 — React Compiler 채택 결정, 접근성, 번들/Tailwind)**: 24개 후보(G01~G24)를 같은 3관점으로 검증 → 22개 채택, 2개 탈락(G09·G10). 합계 106개 채택, 7개 탈락. 2차에서 1차 보고서 자체의 오류 9건도 정정(§9).
- **표기 규칙**: 표와 상세의 impact/effort/risk는 리뷰어가 검증한 값(verified). 원 보고 값과 다른 경우 상세에서 언급. `value ✗` 표시는 가치 관점에서 1표를 잃었지만 2/3으로 통과한 후보 — 리팩토링보다 기능/제품 결정에 가까워 **후순위 또는 백로그 이관 권장**. ID 접두 `C`는 1차, `G`는 2차(gap) 후보.
- **기준선**: `npm run typecheck`·`npm run lint` 통과, 테스트 0, eslint-disable 5곳(exhaustive-deps 1 + no-img-element 4), any 0, TODO 0. localhost:3000은 Docker 컨테이너(변경 확인 시 재빌드 필요). **번들 크기는 미측정**(@next/bundle-analyzer 미설치, `.next/` 청크는 8/30 빌드라 HEAD보다 오래됨) — perf 카테고리(C44·C51·C82·G01)와 Tailwind 실측(G20·G21)은 0차에서 `next build` 1회로 기준표를 만든 뒤 우선순위를 확정한다.

---

## 1. 한눈에 보기

impact(검증값) 높고 effort 낮은 순. 같은 등급 안에서는 risk 낮은 순 → 독립 보고 소스 수(reportedBy) 많은 순. 1차 84개 + 2차 22개(G) = 106개. impact 4 행은 정확히 5개(C01·C68·C45·C83·C22).

| ID | 제목 | 영역 | impact | effort | risk | reportedBy | 신뢰도 |
|---|---|---|---|---|---|---|---|
| C01 | Tweaks 스토어를 lib/tweaks.ts로 추출(makeJsonStore 재사용, share-links 키 복제·순환 회피 제거) | state | 4 | S | low | 6 | 0.90 |
| C68 | MESSAGES 키 타입화(MessageKey) + 중복 엔트리·복수형 정리 | type-safety | 4 | S | low | 2 | 0.90 |
| C45 | 날짜 산술 단일화(monthGrid·7일 배열·월 경계·isSameMonth·todayKey) → data.ts | duplication | 4 | M | low | 5 | 0.85 |
| C83 | 테스트 0개 — vitest 도입, lib 순수 함수부터 | hygiene | 4 | M | low | 1 | 0.90 |
| C22 | 앨범 메타데이터 풀 이중화 제거(query cache vs 모듈 전역 customAlbums/guestAlbums) | duplication | 4 | M | med | 1 | 0.80 |
| C14 | lib/데이터 계층의 토스트 제거·i18n(use-journal·auth-provider·save-card·callback) | i18n | 3 | S | low | 6 | 0.85 |
| C20 | Supabase 호출 보일러플레이트 통일(runQuery·withTimeout 범위·상수명) | error-handling | 3 | S | low | 5 | 0.85 |
| C21 | 테이블별 repository 모듈(shared_cards를 share-links로, JournalRow.theme, best_of toRow) | data-layer | 3 | S | low | 5 | 0.80 |
| C46 | 보드 DnD 프로토콜 공용화(album-dnd.ts + MonthCell) | duplication | 3 | S | low | 4 | 0.80 |
| C32 | 뮤테이션·인증 실패 피드백 통일(AuthResult·remove/best_of onError 토스트) | error-handling | 3 | S | low | 3 | 0.85 |
| C08 | 폰트 로딩 두 방식(ensureFonts vs `<link precedence>`) → root layout 한 곳 | duplication | 3 | S | low | 2 | 0.90 |
| C79 | use-journal 순수 reducer(applyUpsert/Remove/Swap/restoreSlots) 추출 | god-component | 3 | S | low | 2 | 0.80 |
| C84 | CI 부재 + Prettier '설치만' 상태 결정 | hygiene | 3 | S | low | 1 | 0.90 |
| C72 | 오버레이 Esc 리스너 4개 → 레이어 스택 훅(useEscapeLayer) | duplication | 3 | S | med | 2 | 0.80 |
| C04 | openAlbum 모달 상태를 캐시 복사본 대신 openSlot(date) 파생으로 | state | 3 | S | med | 1 | 0.75 |
| C39 | /api/music/album GET(230줄) 선택 루프·재현지화 순수 함수 추출 | god-component | 3 | S | med | 1 | 0.75 |
| C38 | iTunes 프록시 공통화(itunesFetch·ITunesRow·MusicSearchResult 단일화·타임아웃) | duplication | 3 | M | low | 7 | 0.85 |
| C03 | DayOfMusicApp 책임 분해(useBoardNav, 죽은 date 분기, account/onAdd 중복) | god-component | 3 | M | low | 5 | 0.80 |
| C15 | profile-page 계정 액션·공유 링크 관리자 i18n 이관 + ko-KR 고정 날짜 | i18n | 3 | M | low | 5 | 0.90 |
| C30 | profile-page 공유 링크 관리자 분리 + TanStack Query 전환 | god-component | 3 | M | low | 5 | 0.85 |
| C57 | 세 share-card 모달 셸·페이로드 빌더 공용화 | duplication | 3 | M | low | 3 | 0.85 |
| C71 | 5,707줄 단일 CSS 분할 + ≤760 미디어 블록 7개 병합 | structure | 3 | M | low | 2 | 0.85 |
| C40 | add-flow.tsx 검색 로직 useMusicSearch 훅 + ManualEntryForm 분리 | god-component | 3 | M | low | 1 | 0.80 |
| C48 | 요일·월 라벨 i18n 이중화 해소(WeekPicker legacy/loc, Best-of 모달 DOW 하드코딩) | i18n | 3 | M | med | 4 | 0.85 |
| C63 | useBestOf 안정화(get/set useCallback, 챔피언 저장 경로 단일화, 이전 effect 1회) | state | 3 | M | med | 4 | 0.80 |
| C02 | DayOfMusicApp 오버레이 상태 10개 useState → 단일 union | state | 3 | M | med | 2 | 0.85 |
| C50 | DayDetail(548줄) 분해 — useAlbumEnrichment 훅 + InfoDraft 단일 상태 | god-component | 3 | M | med | 2 | 0.75 |
| C24 | Album 타입에서 저널 오버레이 분리 — AlbumMeta + JournalAlbum 별칭 | type-safety | 3 | M | med | 1 | 0.75 |
| G11 | 공용 Modal에 포커스 생명주기(진입·Tab 트랩·오프너 복원) 추가 — 수동 복원 3벌 제거 | 접근성/structure | 3 | M | med | 1 | 0.75 |
| C19 | 미사용 의존성 제거(zustand·radix-slot·cva) + cn/Tailwind 정책 명시 | hygiene | 2 | S | low | 5 | 0.95 |
| C66 | 활성 테마 객체·라벨·사용자 핸들 파생 9곳 → themes.ts 헬퍼 | duplication | 2 | S | low | 5 | 0.85 |
| C07 | 테마 적용 effect → 선언형 style, data-grid 토큰화, 죽은 토큰 제거 | hygiene | 2 | S | low | 4 | 0.85 |
| C53 | 기간 통계 3곳 복제 → periodSummary, StatsPoster 푸터 재사용 | duplication | 2 | S | low | 4 | 0.85 |
| C10 | privacy/terms 크롬 복제·비대칭 → LegalShell | structure | 2 | S | low | 3 | 0.85 |
| C11 | 메타데이터 정리(title.template, 공유 페이지 generateMetadata 공용화) | hygiene | 2 | S | low | 3 | 0.85 |
| C16 | 공용 위젯·셸 경계 소형 문자열 i18n(dom-select, theme-tabs, auth-form, cta) | i18n | 2 | S | low | 3 | 0.85 |
| C23 | localStorage 접근 local-store.ts 통일 — Store export + useStore 훅 | duplication | 2 | S | low | 3 | 0.85 |
| C25 | data.ts 빈 카탈로그(ALBUMS) 경로·미사용 export 제거 | dead-code | 2 | S | low | 3 | 0.85 |
| C36 | 비밀번호 규칙 체크리스트 UI 중복 제거 + password.ts 미사용 label | duplication | 2 | S | low | 3 | 0.95 |
| C47 | Best-of 진입 버튼 주/월 복제 → BestOfButton | duplication | 2 | S | low | 3 | 0.85 |
| C52 | MonthlyView 주석 처리 피처 섹션·CSS 삭제, 'use client' 추가 | dead-code | 2 | S | low | 3 | 0.90 |
| C62 | best-of.ts 순수 브래킷 모듈 분리 + 죽은 export·weekKey 정리 | structure | 2 | S | low | 3 | 0.85 |
| C76 | 죽은 CSS 클래스 14개 + Chip/Accordion + CSS 없는 TSX 클래스 + size=medium | dead-code | 2 | S | low | 3 | 0.90 |
| C09 | 브랜드 블록 6곳 복제 → auth-form i18n 수정(아톰은 선택) | duplication | 2 | S | low | 2 | 0.85 |
| C12 | `<html lang>` 동기화를 Providers 레벨 HtmlLangSync로 | i18n | 2 | S | low | 2 | 0.85 |
| C26 | useJournal 죽은 표면(getByDate/persisted/반환값)·v1 분기 정리 | dead-code | 2 | S | low | 2 | 0.90 |
| C28 | 복구 effect fetchAlbumDetail country 미전달·tracksCountry 미설정 수정 | data-layer | 2 | S | low | 2 | 0.85 |
| C31 | 유휴 자동 로그아웃(fetch 몽키패치)을 useIdleSignOut 훅으로 | structure | 2 | S | low | 2 | 0.90 |
| C35 | user_metadata 접근 타입화(UserMetadata·Partial patch) | type-safety | 2 | S | low | 2 | 0.70 |
| C42 | Album 빌더 응집(buildManualAlbum을 lib으로, 커버 팔레트 분리) | duplication | 2 | S | low | 2 | 0.80 |
| C54 | share-links ↔ share-artwork 순환 import 해소 → share-payload.ts | structure | 2 | S | low | 2 | 0.85 |
| C58 | share zod enum을 CoverStyle/AestheticKey/TypeKey 튜플에서 파생 | type-safety | 2 | S | low | 2 | 0.85 |
| C61 | supabase/migrations 정리(0007 중복·순서·README '0001만') | data-layer | 2 | S | low | 2 | 0.85 |
| C69 | i18n 코어 분리(i18n-core.ts, 'use client' 훅 모듈과 분리) | structure | 2 | S | low | 2 | 0.85 |
| C75 | 타이포 블록 동일 복제 병합·.dom-week-hd 개명 | css | 2 | S | low | 2 | 0.80 |
| C87 | 저장소 부속물·죽은 설정·문서(design_handoff, APP_URL, remotePatterns, README) | hygiene | 2 | S | low | 2 | 0.90 |
| C27 | 슬롯 병합식 5곳 → mergeEntry 순수 함수 | state | 2 | S | low | 1 | 0.80 |
| C44 | formatDisplayDate Intl 포매터 캐시(search-view 키 입력 비용) | perf | 2 | S | low | 1 | 0.75 |
| C49 | week-picker.tsx 세 컴포넌트 파일 분리 | structure | 2 | S | low | 1 | 0.80 |
| C59 | 공유 링크 생성/복사 try 분리(orphan 행 방지) | error-handling | 2 | S | low | 1 | 0.80 |
| C64 | 토너먼트 라운드 진행(pick)을 순수 advance 함수로 | structure | 2 | S | low | 1 | 0.85 |
| C73 | Modal width prop + .dom-modal-panel 공용 클래스 | api | 2 | S | low | 1 | 0.80 |
| C77 | 입력용 별점 2벌 → RatingInput 아톰 | duplication | 2 | S | low | 1 | 0.85 |
| C78 | lib → components 역방향 의존(auth-provider 이동 + lint 규칙) | structure | 2 | S | low | 1 | 0.90 |
| C80 | JournalProvider를 /week 레이아웃으로 내리기 | structure | 2 | S | low | 1 | 0.85 |
| C81 | album jsonb·localStorage 블롭 읽기 경계에서 normalizeAlbum | type-safety | 2 | S | low | 1 | 0.75 |
| C82 | 여러 날짜 기록 시 배열 upsert 1회 | perf | 2 | S | low | 1 | 0.80 |
| C85 | tsconfig 강화(noUnusedLocals/Parameters, allowJs:false) | type-safety | 2 | S | low | 1 | 0.90 |
| C86 | mobile/(Expo) 고아 디렉터리 결정(CSS 번들에도 영향 — G20) | dead-code | 2 | S | low | 1 | 0.90 |
| G07 | useBestOf `set`이 useMutation 결과 객체 전체에 의존 → `const { mutate } = upsert` 패턴 | state | 2 | S | low | 1 | 0.85 |
| G15 | Stars 아톰이 값과 무관하게 ★×5를 텍스트로 노출 → role=img + aria-label | 접근성 | 2 | S | low | 1 | 0.85 |
| G20 | Tailwind 스캔 범위를 src/로 한정(mobile/·SQL·README 유틸리티 유입 차단, 로컬·Docker 빌드 일치) | hygiene | 2 | S | low | 1 | 0.85 |
| G02 | React Compiler bail-out 5곳 구문 치환(`as string` 키·try/finally·IIFE throw) | structure | 2 | S | low | 1 | 0.80 |
| G13 | DomSelect 트리거 ARIA 정정(button에 aria-activedescendant → select-only combobox) | 접근성/api | 2 | S | low | 1 | 0.80 |
| G16 | 토글/선택 버튼 4곳에 aria-pressed/aria-checked 추가 | 접근성 | 2 | S | low | 1 | 0.80 |
| G22 | `.dom-stage`에 --font-display/--font-mono 기본값 — Tailwind `@theme inline` 방출에 묵시 의존 끊기 | css | 2 | S | low | 1 | 0.80 |
| G03 | best-of-modal exhaustive-deps 억제(저장소 유일) 제거 — 정직한 deps | state | 2 | S | low | 1 | 0.75 |
| C56 | 폰트 임베딩 이후 남은 Georgia CSS 워크어라운드 | css | 2 | S | med | 1 | 0.75 |
| G01 | reactCompiler: true 채택 결정 — 권장은 보류(annotation 실험은 jank 실측 시) — value ✗ | perf | 2 | S | med | 1 | 0.70 |
| C05 | 탭(screen) 상태를 URL(?screen=)과 동기화 — value ✗ | structure | 2 | M | med | 1 | 0.80 |
| G12 | Modal 밖 dialog 셸 3곳(WeekPicker·PosterFit 줌·TweaksPanel) 포커스 정책 통일 | 접근성/structure | 2 | M | med | 1 | 0.70 |
| C13 | 브레이크포인트 760·포스터 폭 1100·미사용 헬퍼 상수 단일화 | hygiene | 1 | S | low | 7 | 0.90 |
| C06 | ScreenId·SCREENS·Account 타입 단일화 | structure | 1 | S | low | 2 | 0.90 |
| C43 | i18n t()를 가리는 람다 매개변수 5곳 rename | hygiene | 1 | S | low | 2 | 0.95 |
| C51 | cover.tsx 캡션 스타일 11회 반복·StyleArgs.bg 미사용 — value ✗ | perf | 1 | S | low | 2 | 0.75 |
| C65 | 주/월 Best-of 상태 훅·래퍼 모달 중복 — value ✗ | duplication | 1 | S | low | 2 | 0.75 |
| C17 | app 루트 error.tsx / not-found.tsx — value ✗ | error-handling | 1 | S | low | 1 | 0.80 |
| C33 | OAuth 프로바이더 registry — value ✗ | structure | 1 | S | low | 1 | 0.85 |
| C34 | 게스트/로그인 상태 파생 useAuth 통합 — value ✗ | state | 1 | S | low | 1 | 0.80 |
| C37 | /api/account DELETE 라우트 정리(에러 노출·로그 부재·주석) | api | 1 | S | low | 1 | 0.85 |
| C41 | 호출자 없는 type=artist\|track 검색 경로 — value ✗ | dead-code | 1 | S | low | 1 | 0.80 |
| C60 | save-card.ts 빈 catch에 console.warn — value ✗ | structure | 1 | S | low | 1 | 0.80 |
| C70 | theme.ts → appearance.ts rename | structure | 1 | S | low | 1 | 0.85 |
| C89 | 커버 이미지 선택 핸들러 중복 → readArtworkFromInput — value ✗ | duplication | 1 | S | low | 1 | 0.85 |
| G04 | C03 재정의 — account 객체·onAdd 클로저는 지역 상수 2개로, useMemo/useCallback 추가 금지 | duplication | 1 | S | low | 1 | 0.90 |
| G06 | C51 재정의 — memo(Cover)는 불필요(컴파일러는 값 기준 캐시, memo는 albumsByDate 새 객체로 무효) | perf | 1 | S | low | 1 | 0.85 |
| G19 | IconButton에 aria-label을 타입으로 필수화 | type-safety | 1 | S | low | 1 | 0.85 |
| G14 | Modal 접근 가능한 이름 `labelledBy` 옵션 — 보이는 h2와 이중화 해소 | 접근성/api | 1 | S | low | 1 | 0.80 |
| G17 | DayDetail 탭에 tablist/tab/tabpanel·aria-selected | 접근성 | 1 | S | low | 1 | 0.80 |
| G18 | 팝오버 트리거 ARIA 상태 통일(Tweaks·More aria-expanded/controls) | 접근성 | 1 | S | low | 1 | 0.80 |
| G24 | globals.css `@theme inline` 죽은 토큰 2개 + theme.ts --font-sans 쓰기 제거 | dead-code | 1 | S | low | 1 | 0.80 |
| G05 | C44 재정의 — i18n useMemo는 양쪽 모두 보존, 할 일 없음(useMemo 제거 금지) — value ✗ | state | 1 | S | low | 1 | 0.75 |
| G21 | Tailwind utilities 레이어 존치 결정(의도 유틸리티는 layout.tsx 5개뿐) — value ✗ | hygiene | 1 | S | low | 1 | 0.75 |
| G23 | 폼 컨트롤 리셋 3중(preflight/globals.css/dom-reset) — globals.css 블록만 삭제 — value ✗ | css | 1 | S | low | 1 | 0.75 |
| G08 | React Compiler bail-out 드라이런 리포트 스크립트(G01 채택 시만) — value ✗ | hygiene | 1 | S | low | 1 | 0.70 |
| C18 | AuthProvider signOut 내비게이션 책임 분리 — value ✗ | structure | 1 | S | med | 1 | 0.85 |

---

## 2. 추천 실행 순서

테스트가 없으므로 모든 묶음은 `npm run typecheck && npm run lint`를 기본 게이트로 하고, 0차에서 CI·vitest를 먼저 깔아 이후 묶음의 순수 함수 추출이 바로 테스트 대상이 되게 한다. 같은 파일을 건드리는 후보는 같은 묶음 안에서 연속 PR로 배치했다(아래 `→`는 선후 관계). 2차 후보(G)는 (a) 결정 항목(G01·G21) → 0차, (b) 속성 추가뿐인 접근성 항목 → 1차 새 묶음, (c) Modal 포커스 생명주기(G11·G12) → 3차 C72 뒤, (d) globals.css 정리(G20·G22·G24) → 0~1차로 배치했다. 1차 보고서에서 C01이 파일 친화도만으로 3차에 밀려 있던 것과 C23이 C01의 tweaks 작업을 중복 배정하던 모순을 바로잡았다(§9).

### 0차 — 안전망 + 측정 + 결정 (S, 1~2일)
**C84(CI) → C85(tsconfig 1단계) → C83(vitest + today/album-stats/password/share-links encode·decode/withTimeout 테스트)**, 그리고 C19·C87·C86·C61(의존성·문서·설정·마이그레이션 안내) + **G20(globals.css `source("../")` 한 줄)**.
추가 두 가지: (1) **`next build` 1회로 클라이언트 JS/CSS 크기 기준표**를 만든다 — perf 후보(C44·C51·C82)와 G01의 +83KB/+40KB gzip, 부수 발견 #24(i18n-iso-countries 34KB), 추가 조사(이미지 lazy·PWA)의 우선순위가 전부 미측정 상태라 여기서 근거를 붙인다(현재 `.next` 청크는 8/30 빌드). (2) **G01(React Compiler) 결정** — 권장은 보류: React Profiler로 WeeklyGrid DnD·MonthlyView·Cover jank가 실측될 때 `compilationMode: 'annotation'` + 'use memo'로 좁게 실험. 채택한다면 G02 전부·G08 스크립트·AGENTS.md 한 줄(G10 caveat)을 같은 PR에 넣어야 AuthProvider·WeeklyGrid·useBestOf·ShareActions·WeekPoster가 미컴파일로 남지 않는다. 어느 쪽이든 G04~G07은 유효(컴파일러 유무 분기만 다름).
이유: 이후 모든 PR의 회귀 검증 수단이 typecheck/lint/수동뿐이므로 CI와 러너를 먼저 둔다. C85 1단계는 현재 0건이라 비용 0. prettier 채택 여부는 여기서 결정하되 **전체 포맷 커밋은 4차 뒤 마지막에** (열린 브랜치 충돌·blame 오염). C19/C87/C86/C61은 참조 0건 삭제·문구 수정이라 코드와 독립이며 README 현행화는 C19·C61·C86 결정 뒤 한 번에 쓴다. G20은 globals.css 1행이라 C19의 'preflight 전용' 정책 주석과 같은 커밋 — C19에서 '유틸리티 안 씀'으로 결정되면 G21(b) 분기(utilities 미포함 import + html/body 규칙)와 G23 순으로, 아니면 G21·G23은 닫는다. C86(mobile/ 삭제)은 CSS 번들의 NativeWind 유틸리티 49개도 함께 걷어내므로 G20과 어느 순서든 겹침 없음. 검증: CI green, `npm test` 통과, Docker 빌드, 새 빌드 CSS 청크에 `tracking-\[6px\]`·`bg-white\/10` 부재 + layout.tsx:52-53 유틸리티 5개 유지.

### 1차 — 안전한 정리 (S/low, 죽은 코드·타입·i18n 치환·접근성 속성)
- **독립 고가치 선행**: **C01(tweaks.ts, impact 4/S/low, reportedBy 6)** — 오버레이 작업(C02·C04·C72)과 독립이고 share-links의 키 복제·순환 회피 주석을 없애므로 3차에서 여기로 당긴다. C23에서 tweaks 부분은 뺀다(C01이 담당).
- **타입·사전**: C68(MessageKey) → C16·C14(use-journal/callback/save-card 부분)·C15(profile-page i18n, G14 labelledBy 연결 포함) → C43(6곳). G19(IconButton aria-label 필수 타입, 호출처 변경 0)도 여기. C68을 먼저 하면 이후 키 추가 PR이 즉시 검증된다. C15는 C30과 같은 파일이므로 C30 전에 끝내거나 같은 PR.
- **죽은 코드**: C25(빈 카탈로그) → C40의 삭제 부분과 겹치므로 add-flow는 C40에서 함께; C26(useJournal 죽은 표면); C52(MonthlyView 주석 블록+CSS); C76(죽은 CSS/Chip/Accordion + 교차검증 스크립트); C36; C13; C06; C70(C07·C08과 같은 PR).
- **경계·위생**: C78(auth-provider → lib + no-restricted-imports) → C54(share-payload 분리) → C58(enum 파생); C11; C09(auth-form t() 치환만); C12(HtmlLangSync); C37; C47; C53; C66; C77(G16의 별점 radiogroup 스펙 포함); C42. **globals.css 한 PR: G22(.dom-stage 폰트 기본값 2줄) → G24(죽은 토큰 2개 + theme.ts:210)** — 순서 고정(역순이면 auth/legal 4페이지 mono 글꼴이 깨짐). G02 중 컴파일러와 무관한 두 곳(weekly-grid.tsx:143·share-posters.tsx:77 `{ "--cols": n } as CSSProperties`)도 여기.
- **접근성 속성(새 묶음, 전부 마크업 속성 추가·S/low)**: G15(Stars role=img + aria-label 기본값) · G16(add-flow.tsx:432·:272 aria-pressed 한 줄씩) · G13(DomSelect combobox 정정, 소비처 5곳 전파) · G18(TopBar tweaksOpen/moreOpen + aria-expanded/controls — C02 union이 들어가면 한 값으로 대체되므로 C02 뒤에 해도 됨) · G17(DayDetail 탭 ARIA — C50과 같은 파일이라 C50 PR에 실어도 됨) · G14(Modal labelledBy — C15와 함께면 비용 0). 검증: VoiceOver로 ↑/↓·별점·탭 읽기, 키보드 Tab 순서.
이유: 전부 typecheck가 잡아주는 이동·삭제·치환·속성 추가이며 동작 변화가 0에 가깝다. 검증: typecheck/lint + 해당 화면 5개 언어 전환 육안 확인 + 스크린리더 1회.

### 2차 — 구조 개선 (lib·데이터 계층, S~M/low~med)
- **저널 영속성 (use-journal.tsx 연속 PR)**: C27(mergeEntry) → C79(순수 reducer, 첫 테스트) → C22(메타 풀 통일) → C23(useStore 훅; C22 후 entries 스토어만) → C28(복구 country) → C81(normalizeAlbum) → C82(배열 upsert) → C24(AlbumMeta/JournalAlbum 별칭만). 이 순서면 각 PR의 diff가 앞 PR 위에 작게 얹힌다.
- **Supabase 계층**: C20(runQuery) → C21(shared_cards를 share-links로, theme non-null, toRow) → C32(onError 토스트·AuthResult) → C35(UserMetadata 타입) → C31(useIdleSignOut) → C69(i18n-core) → C14의 auth-provider 부분 → C30(공유 링크 관리자 분리 + useQuery) → C59(생성/복사 try 분리).
- **iTunes·검색**: C38(타입 PR → fetch 래퍼 PR) → C39(선택 루프·재현지화 추출) → C40(useMusicSearch + ManualEntryForm) → C44(Intl 캐시) → C41(시그니처만 맞추거나 보류).
- **Best-of**: C62(bracket 모듈) → C64(advance) → **G07(`const { mutate } = upsert` + 마이그레이션 IIFE → `migrateLegacyBestOf` 모듈 함수 = G02 best-of 부분 = C63(3)의 가드 작업)** → C63(1)(2)(get/set useCallback·저장 경로 단일화) → **G03(best-of-modal.tsx:114 deps `[state, bestOf, storeKey]`, :113 억제 삭제 — 저장소 유일 react-hooks 억제 제거)** → C65(findSavedChampion 헬퍼만). G03은 G07 선행이 필수는 아니지만(persistedRef가 중복 쓰기를 막음) 같은 파일 연속 PR이 자연스럽다.
- **날짜·보드**: C45(data.ts 날짜 함수, node 스크립트로 구식·신식 diff) → C49(week-picker 파일 분리) → C57(빌더 lib 이동 + 월 달력 공유) → C46(album-dnd + MonthCell) → C48 1단계(Best-of 모달 라벨·요일 테이블).
이유: 이 묶음의 가치 대부분이 "순수 함수로 뽑아 테스트 대상으로 만들기"이며 0차 러너가 전제. 검증: vitest(순수 함수) + Docker에서 게스트/로그인/미설정 3모드 수동 매트릭스(추가·수정·이동·삭제·enrich·새로고침), /api/music 라우트 전후 JSON diff(KR/US/JP 샘플 id).

### 3차 — 앱 셸·오버레이 분해 (day-of-music-app.tsx·modal.tsx 연속 PR, M/med)
C08·C07·C70(폰트/테마 effect 정리, theme.ts 한 번에) → C03 1단계(죽은 date 분기·Omit 타입·**G04: account/openAddFor 지역 상수 2개(useMemo/useCallback 추가 금지)**·Link) → C02+C04(overlay union + openSlot 파생, 한 PR) → C72(useEscapeLayer; C02의 Esc 축소와 함께) → **G11 1단계(Modal 포커스 진입·복원 ~15줄, more-sheet·week-picker 수동 복원 삭제, focusUnlessPhone → data-autofocus alias) → G11 2단계(Tab 트랩 + role/aria-modal을 패널로; 중첩 모달 stopPropagation, PosterFit 줌 열림 중 트랩 off)** → **G12(WeekPicker aria-modal 제거·PosterFit 줌 진입/복원·TweaksPanel 진입/복원 — G11 안정 후 별도 PR)** → C03 2단계(useBoardNav) → C50(useAlbumEnrichment + InfoDraft, + G17 탭 ARIA) → C73(Modal width prop) → C80(JournalProvider를 week/layout으로). C05·C06·C17·C18·C33·C34는 여기서 결정만 하고 기능 백로그로. (C01은 1차로 이동.)
이유: 26커밋으로 가장 자주 바뀌는 파일이라 PR을 잘게 쪼개고 순서를 고정해야 충돌이 없다. C02·C04·C72는 서로 얽혀 함께 해야 비용이 가장 낮고, G11은 C72와 같은 modal.tsx를 건드리므로 그 직후에 둔다. 검증: 오버레이 7종 열기/Esc/닫기 수동 점검(중첩 확인 모달 Esc 포함), 데스크톱 키보드 Tab이 스크림 뒤로 안 빠지는지, handleReplace 체인·DayDetail key 재마운트(app:582)에서 복원→재진입 순서, iOS Safari 시트에서 키보드가 뜨지 않는지, tweaks 변경→새로고침 유지, 공유 링크 payload.theme 확인, /s/[token] 로그인 상태에서 journal_entries 요청 없음.

### 4차 — CSS·시각 (M, 스크린샷 검증)
C71(섹션 분할 → phone.css 병합·죽은 선언 6건 삭제) → C75(동일 블록 병합·.dom-week-hd 개명) → C73 CSS 부분 → C56(Georgia 규칙, 디자인 확인 후 별도 커밋) → C48 2단계(WeekPicker 단일 렌더, 디자인 확인 후) → C51(caption 헬퍼·bg 제거만, **memo(Cover) 금지 — G06**) → (C19에서 '유틸리티 안 씀'으로 결정된 경우에만) G21(b)·G23. 마지막에 prettier 전체 포맷 커밋 + .git-blame-ignore-revs.
이유: 캐스케이드 변경은 typecheck가 못 잡고 검증이 폭별(375/667/760/1100/데스크톱) 스크린샷뿐이므로 코드 리팩토링이 다 끝난 뒤 한 번에 몰아 리뷰한다. @layer 재구성은 하지 않는다. preflight는 어떤 결정에서도 유지한다(G21·G23·C74 전제).

---

## 3. 후보 상세

형식: **문제** → **제안**(더 작은 대안이 있으면 그것을 우선) → **영향 범위** → **검증** → **주의점**(리뷰 caveats 요약).

### C01 — Tweaks 스토어를 lib/tweaks.ts로 추출 (impact 4 / S / low / reportedBy 6)
- **문제**: 앱 셸이 localStorage 외부 스토어를 손으로 구현(`src/components/day-of-music/day-of-music-app.tsx:70` TWEAKS_KEY 리터럴, `:91-138` loadTweaks/getTweaksSnapshot/subscribeTweaks/writeTweaks)하는데 `src/lib/day-of-music/local-store.ts:39-69,103-123`의 makeStore/makeJsonStore가 같은 기능이다. `src/lib/day-of-music/share-links.ts:217-230`은 순환 import를 피하려 `"dom.tweaks.v1"` 키를 문자열로 재복제하고, Tweaks 타입은 UI 컴포넌트(`tweaks-panel.tsx:17-24`)에서 export된다. 선례: `themes.ts:33` makeJsonStore.
- **제안**: `src/lib/day-of-music/tweaks.ts`에 Tweaks 타입·DEFAULT_TWEAKS·TWEAKS_KEY·normalizeTweaks·tweaksStore(makeJsonStore + normalize)·useTweaks()를 두고 앱 셸·tweaks-panel·share-links(readShareTheme → store 읽기)가 import. 카드 모달은 useTweaks()로 theme을 받아 payload 빌더에 인자로 전달.
- **영향 범위**: 앱 셸 1곳, tweaks-panel(타입), readShareTheme 호출처 3곳(share-card.tsx:91, month-share-card.tsx:87, share-links.ts:202).
- **검증**: typecheck + tweaks 변경→새로고침 유지, 공유 링크 payload.theme 확인.
- **주의점**: lib/tweaks.ts에 `"use client"`를 넣지 말 것(share-links가 서버 페이지 src/app/s/**에서 import됨; local-store.ts 패턴). makeJsonStore에 normalize 인자를 추가해 `:97-103`의 '활성 키만 복사' 동작 유지. readShareTheme가 store 기반이 되면 저장값 없을 때 DEFAULT_TWEAKS를 반환하게 되는 변화 인지. share-card/month-share-card useMemo deps에 theme 추가(exhaustive-deps).

### C02 — 오버레이 상태 10개 useState → 단일 discriminated-union (impact 3 / M / med / 2)
- **문제**: `day-of-music-app.tsx:197-209` useState 10개, `:214-224` closeAll setter 9개, `:313-339` Esc effect flag 8개·deps 14개. `modal.tsx:77-83` Modal이 자체 Esc 리스너를 가져 앱 레벨 Esc는 이중 처리. `:602-604` addDate fallback은 도달 불가(setShowAdd(true) 3곳 모두 직전에 setAddDate 호출).
- **제안(작은 대안 우선)**: (a) 앱 레벨 Esc를 showTweaks 전용으로 축소, (b) `overlayOpen = Boolean(openAlbum) || showAdd || …` 한 변수로 게이트, (c) 죽은 addDate fallback 삭제 — deps 14→6. union(`type Overlay = null | {kind:'detail', date} | {kind:'add', date, replaceTarget} | …`)은 C04와 함께 진행할 때만.
- **영향 범위**: 앱 셸 내부, handleSave(:430-457)가 replaceTarget을 overlay에서 읽도록.
- **검증**: 오버레이 7종 열기/Esc/닫기 수동, 확인 모달 열린 채 Esc.
- **주의점**: TweaksPanel은 Modal 기반이 아니라 앱 Esc를 완전히 제거하면 안 됨. ←/→ 내비 가드는 `overlay !== null || showTweaks` 유지. handleMove는 swap 후 overlay를 반드시 null로(C04 참고). addDate fallback 제거는 원래 도달 불가였음을 커밋 메시지에.

### C03 — DayOfMusicApp 책임 분해 (impact 3 / M / low / 5)
- **문제**: `day-of-music-app.tsx:140-152,253-310` 주/월 내비게이션 순수 로직, `:341-457` 핸들러 7개, `:495,640` account 객체 리터럴 2회, `:538-541,557-560` onAdd 람다 2회. `:358-368` handleUpdate의 patch.date 분기는 `day-detail.tsx:31` 'Never carries date' 계약상 도달 불가. `weekly-grid.tsx:24-46` vs `monthly-view.tsx:38-58` 콜백 8개 타입 두 벌. `:504,507` raw `<a href="/signup">`.
- **제안(작은 대안 우선)**: 1차 S — 죽은 date 분기 삭제 + `onUpdate` 타입 `Omit<Partial<Album>,'date'>` + `const account = …` 1회 + `const openAddFor = (date) => …` 1개(**G04: useMemo/useCallback을 붙이지 말 것** — TopBar·MoreSheet·WeeklyGrid·MonthlyView 모두 memo 컴포넌트가 아니라 효과 0, 컴파일러 채택 시에도 자동 캐시) + `<a>`→Link. 2차 M — `useBoardNav(today, weekSplit)` 추출. 핸들러 묶음(use-journal-actions) 추출은 보류.
- **영향 범위**: 앱 셸, day-detail props 타입, 두 보드 props(공용 BoardCallbacks 선택).
- **검증**: typecheck + 주/월 이동·split 모드 세그먼트 이동 수동.
- **주의점**: use-journal-actions 추출은 C02/C04 뒤 재검토(지금은 setter 주입이 6개 이상). `:349-354` 'legacy' 주석도 함께 삭제. useBoardNav는 deps `[tweaks.weekSplit, today]` 유지. BoardCallbacks 공용화 시 두 파일의 JSDoc 차이 보존.

### C04 — openAlbum을 openSlot(date) 파생으로 (impact 3 / S / med / 1)
- **문제**: `day-of-music-app.tsx:197` `useState<Album|null>` 복사본이라 `:365,:374` handleUpdate/handleEnrich가 캐시와 복사본 두 곳에 패치. `day-detail.tsx:86,104-108`은 album prop과 albumsByDate를 혼용. 외부 변경(다른 기기 삭제, onError 롤백 `use-journal.tsx:380-383`)이 모달에 반영되지 않음. 선례: `profile-stats.tsx:36-38` id 저장.
- **제안**: `openSlot: string|null`만 상태로, `openAlbum = albumsByDate[openSlot]` 파생. setOpenAlbum 패치 제거. C02 union의 `{kind:'detail', date}`로 통합.
- **영향 범위**: 앱 셸, day-detail(단일 출처).
- **검증**: 별점/노트/정보수정/이동/삭제/교체 + 검색에서 열기 수동.
- **주의점**: handleMove(:394-419)·handleRemove(:379-386)에서 openSlot을 명시적으로 null — swap 시 같은 date에 다른 앨범이 들어옴. 낙관 갱신이 onMutate(비동기)라 별점 클릭 직후 1틱 지연(noteDirty 깜빡임 확인). 로그인/로그아웃으로 queryKey 바뀌면 모달 닫힘(허용). C02와 함께 수행.

### C05 — 탭(screen) 상태를 URL과 동기화 (impact 2 / M / med / 1) — value ✗
- **문제**: `day-of-music-app.tsx:45,186` ScreenId useState, `:530-571` 조건부 렌더, `src/app/week/page.tsx:15-24` 단일 페이지. 새로고침·뒤로가기·딥링크 불가. Next 16 `04-linking-and-navigating.md:343-362`에서 pushState가 라우터와 통합됨 확인.
- **제안(작은 대안)**: 리팩토링이 아니라 기능 항목으로 이관. 진행한다면 useSearchParams 파생 + pushState 래퍼(setScreen 대체)만, route 분리 없음.
- **영향 범위**: /week로 보내는 7곳(auth-form.tsx:94,113,215 / auth/callback/page.tsx:23,57 / home-landing.tsx:143 / shared-card-cta.tsx:21)의 기본값 week.
- **검증**: 새로고침·뒤로가기·딥링크 수동.
- **주의점**: 뒤로가기를 원하면 pushState, 아니면 replaceState — 명시적으로 결정. screen은 URL 단일 출처(SCREENS 검증, 미지값→'week'), useState 제거. /week는 force-dynamic이라 Suspense 제약 없음. 2단계 route segment 분리는 L 작업 — 착수 금지.

### C06 — ScreenId·SCREENS·Account 단일 모듈 (impact 1 / S / low / 2)
- **문제**: `day-of-music-app.tsx:45` ScreenId, `top-bar.tsx:8,15-21,23` import type·SCREENS·Account 로컬 타입, `bottom-tabs.tsx:17-27` type import + ICONS, `more-sheet.tsx:20` Account inline 재선언. 'import type'이라 런타임 순환은 없음.
- **제안(작은 대안)**: 새 파일 없이 top-bar.tsx에서 `SCREENS as const` + `export type ScreenId` + `export type Account`, 나머지 3파일이 top-bar에서 import.
- **영향 범위**: 4파일 타입·상수.
- **검증**: typecheck.
- **주의점**: ICONS는 bottom-tabs에 남길 것(lucide 의존 끌어들이지 않음). `as const` 쓰면 `{ id: ScreenId; key: string }[]` 어노테이션 제거. more-sheet inline 타입도 교체.

### C07 — 테마 적용 effect → 선언형 style, 죽은 토큰 정리 (impact 2 / S / low / 4)
- **문제**: `day-of-music-app.tsx:242-244` applyTheme effect, `:486` data-grid 손계산(theme.ts:44,63,82,101 gridShow와 동일), `shared-card-view.tsx:21-27`은 같은 themeStyleVars를 inline style로 서버 렌더. `theme.ts:26,33,52,71,90` description, `:21` stickerLabel, `:210` --font-sans 소비처 0. `day-of-music.css:4-19` 기본 토큰 복제, `:865` accent 폴백 불일치, `:447-460` #a3342a 4회.
- **제안(작은 대안)**: 두 셸(day-of-music-app, home-landing)에서 applyTheme/rootRef 삭제 → `<div className="dom-stage" style={useMemo(() => themeStyleVars(a,t),[a,t])}>`; data-grid = `AESTHETICS[tweaks.aesthetic].tokens.gridShow ? "1":"0"`; theme.ts에서 description·stickerLabel·--font-sans 제거. CSS 기본 블록·하드코딩 색·신규 토큰은 손대지 않음.
- **영향 범위**: 호출자 2곳. PosterFit(poster-fit.tsx:61)이 closest('.dom-stage')에 포털하므로 inline style이면 만족.
- **검증**: typecheck/lint, 4 aesthetic × 4 typography 전환+새로고침, /s/<token>, PosterFit 확대, 모달 색.
- **주의점**: 카테고리는 perf가 아니라 hygiene — inline 전환이 dark 플래시를 없애지 못함(서버 스냅샷이 editorial). CSS `.dom-stage` 기본 블록(css:4-19)은 유지(auth-form, callback, privacy, terms, 모달 의존). 부수 발견: `.dom-legal-root`(css:4281-4284)가 var(--font-mono)를 쓰지만 legal 페이지는 applyTheme를 안 거쳐 미정의일 수 있음 — 브라우저 확인.

### C08 — 폰트 로딩 두 방식 → root layout 한 곳 (impact 3 / S / low / 2)
- **문제**: `theme.ts:167-189` ensureFonts가 head에 link를 명령형 주입(`day-of-music-app.tsx:232-234`, `home-landing.tsx:77-80` 호출), `shared-card-view.tsx:28-35`는 React 19 hoisted `<link precedence>`. auth-form, auth/callback, privacy, terms는 어느 쪽도 호출하지 않아 `--font-body` Spectral(css:5)이 Georgia로 폴백.
- **제안**: `src/app/layout.tsx` `<head>`에 preconnect×2 + stylesheet link. ensureFonts·effect 2개·shared-card-view link 3개 삭제. googleFontsHref는 save-card.ts:9,110용으로 유지.
- **영향 범위**: theme.ts, 앱 셸, home-landing, shared-card-view, layout.
- **검증**: 각 라우트 직접 진입 시 Network에 fonts.googleapis.com 1회, save-card 폰트 임베드 정상.
- **주의점**: `<html>`에 `<head>`를 명시해 넣을 것(precedence는 body 안 hoist용). shared-card-view 주석도 함께 삭제. next/font 전환은 별도 과제.

### C09 — 브랜드 블록 6곳 복제 (impact 2 / S / low / 2)
- **문제**: `top-bar.tsx:48-52`/`home-landing.tsx:86-90`만 t("brand.tagline"), `auth-form.tsx:101-105`/`shared-card-view.tsx:49-53`/`privacy:18-26`/`terms:18-26`은 "하루의 음악" 하드코딩. `messages.ts:22` en은 빈 문자열. 다만 shared-card-view·privacy·terms는 서버 컴포넌트라 의도된 선택에 가깝고, 진짜 불일치는 클라이언트인 auth-form 1곳.
- **제안(작은 대안)**: auth-form.tsx:104를 `t("brand.tagline")` 조건부 렌더로, home-landing.tsx:89의 빈 span 제거. 아톰화는 7번째 사용처가 생길 때.
- **영향 범위**: auth-form, home-landing.
- **검증**: 두 화면 5개 언어 육안.
- **주의점**: 아톰을 만든다면 훅 없이(서버 컴포넌트 호환), className(dom-brand/dom-signin-brand)·href를 prop으로, 빈 tagline이면 span 미렌더(top-bar:51 동작 기본).

### C10 — privacy/terms 크롬 복제·비대칭 (impact 2 / S / low / 3)
- **문제**: `src/app/privacy/page.tsx:11,15-42,425-427` vs `terms/page.tsx:11,15-37,325-328` EFFECTIVE_DATE·래퍼·헤더·제목·푸터 복제. privacy만 `:27-32` nav(이용약관 링크)가 있고 terms `:27-29`는 홈만. css:4281-4470은 요소 선택자 기반이라 본문 분리에 무관. MDX는 @next/mdx 미설치.
- **제안(작은 대안)**: `LegalShell({ title, eyebrow, effectiveDate, nav, footer, children })` 서버 컴포넌트 하나(src/components/day-of-music/legal-shell.tsx). route group·MDX 없음.
- **영향 범위**: 두 page.tsx.
- **검증**: /privacy, /terms 시각 비교.
- **주의점**: MDX 제외(의존성·Turbopack 설정 대비 이득 없음). 헤더 nav 대칭화(terms 헤더에 개인정보 링크). EFFECTIVE_DATE는 prop으로 분리 가능하게.

### C11 — 메타데이터 정리 (impact 2 / S / low / 3)
- **문제**: `layout.tsx:8`, `week/page.tsx:12`, signin:6, signup:6, privacy:7, terms:7, `s/page.tsx:44,48`, `s/[token]/page.tsx:56,60` ' — Day of Music' 수작업 접미사. `s/page.tsx:38-57` vs `s/[token]/page.tsx:49-69` generateMetadata 본문 동일(Props 타입은 searchParams vs params로 다름 — 원 보고 오류). force-dynamic은 [token]에서 의도 주석(:18)이 있어 유지.
- **제안(작은 대안)**: layout에 `title:{default:'Day of Music', template:'%s — Day of Music'}` + 6개 page 접미사 삭제 + share-links.ts(또는 share-payload)에 `sharedCardMetadata(payload|null)` 헬퍼 1개. PageProps·force-dynamic·inline style 변경 없음.
- **영향 범위**: 7 라우트.
- **검증**: typecheck + 각 라우트 `<title>` 확인.
- **주의점**: PageProps 헬퍼는 next-env.d.ts가 gitignore(`.gitignore:45` — 1차 보고서의 ':44'는 오기, 44행은 `*.tsbuildinfo`)이고 typecheck가 tsc --noEmit뿐이라 fresh clone에서 깨질 수 있음 — 도입 금지. sharedCardMetadata는 null 분기('Shared card' + noindex)를 품고 'use client' 파일에 두지 말 것.

### C12 — `<html lang>` 동기화를 Providers 레벨로 (impact 2 / S / low / 2)
- **문제**: `layout.tsx:52` `lang="en"` 고정, 갱신은 `day-of-music-app.tsx:249-251`뿐. `home-landing.tsx:75`/`auth-form.tsx:52`는 다국어를 렌더하면서 lang 미갱신. useT 체인(i18n.ts:93-98 → profile.ts:143-158) 44곳 재실행 비용 주장은 근거 없음(O(1)).
- **제안(작은 대안)**: providers.tsx의 AuthProvider 안에 `<HtmlLangSync />`(useLanguage().locale + useEffect로 documentElement.lang) 한 컴포넌트 추가, 앱 셸 effect 삭제. Context 재구성 생략.
- **영향 범위**: providers.tsx, day-of-music-app.tsx.
- **검증**: 언어 전환 후 `/`와 `/signin`에서 document.documentElement.lang.
- **주의점**: AuthProvider 내부에 위치(useProfile→useAuth). Provider 밖 폴백을 조건부 훅으로 만들지 말 것. 성능 개선 기대 금지.

### C13 — 브레이크포인트 760·포스터 폭 1100·미사용 헬퍼 단일화 (impact 1 / S / low / 7)
- **문제**: `phone.ts:8` PHONE_QUERY와 별개로 `providers.tsx:19` MOBILE_QUERY, `poster-fit.tsx:40` FIT_BELOW=760 재정의. 1100은 poster-fit.tsx:36, save-card.ts:15, shared-card-view.tsx:58, css:2213. `phone.ts:19` prefersReducedMotion 호출 0, `use-swipe-nav.ts:41` PHONE_QUERY re-export 미사용. modal/use-swipe-nav의 matchMedia는 상수를 import해 쓰므로 드리프트 위험 없음(과장). CSS 520/440/720/680은 컴포넌트별 의도 분기.
- **제안(작은 대안)**: phone.ts에 `PHONE_BREAKPOINT = 760` 추가·PHONE_QUERY 파생, providers MOBILE_QUERY·poster-fit FIT_BELOW 교체, prefersReducedMotion·re-export 삭제. 1100은 'use client' 없는 순수 상수 모듈(POSTER_WIDTH)로 JS 3곳만. useMediaQuery 훅·CSS 병합 제외.
- **영향 범위**: 5파일.
- **검증**: typecheck.
- **주의점**: CSS 브레이크포인트 병합 금지. useToastPosition은 change 리스너가 필요하니 isPhoneViewport() 단발로 바꾸지 말 것. shared-card-view는 서버 컴포넌트라 save-card.ts(sonner·html-to-image import)에서 상수를 export하면 안 됨.

### C14 — lib/데이터 계층의 토스트 제거·i18n (impact 3 / S / low / 6)
- **문제**: `use-journal.tsx:20,256-264,381` 한국어 토스트, `auth-provider.tsx:159,229` 한국어, `save-card.ts:7,195-197` 영어, `auth/callback/page.tsx:36,53` 토스트 + `:69-71` JSX 본문 한국어 고정. 셸은 `day-of-music-app.tsx:383,401` t() 사용.
- **제안(작은 대안)**: JournalProvider(providers.tsx:54-55에서 AuthProvider 안에 렌더되므로 useT 가능)와 AuthCallbackPage는 `const t = useT()`로 치환(journal.loadFailed/saveFailed/auth.callback.* 키). save-card.ts는 toast 제거 + `Promise<boolean>` 반환, 4개 호출자(share-card:110, month-share-card:96, stats-share-card:60, best-of-modal:162)가 t('share.imageSaved'|'share.imageFailed'). auth-provider 두 토스트는 C69 뒤 user_metadata 기반 순수 translate.
- **영향 범위**: 5파일 + messages.ts 키 추가.
- **검증**: 이미지 저장, 네트워크 차단 후 저널 로드 실패, 오프라인 로그아웃.
- **주의점**: auth-provider는 i18n.ts('use client'+useProfile)를 import하면 i18n→profile→auth-provider→i18n 순환 — C69 선행. `use-journal.tsx:381` onError는 `optimistic !== false` 가드가 있어 moveSlot 경로는 앱 쪽 toast.moveFailed 담당 — 키 중복 주의. save-card의 finally stage 제거(:198-200) 유지.

### C15 — profile-page i18n 이관 + ko-KR 고정 날짜 (impact 3 / M / low / 5)
- **문제**: `profile-page.tsx:211,244,251,259-264,274,282,289` 영어, `:167,181,308-312,349-350,360,420,437,460-493,500-604` 한국어(약 35개 문자열), `:391` ko-KR 고정. `messages.ts:6-9` 주석이 '점진 이관 예정'. `messages.ts:601` auth.oneMoment, `:133` profile.cancel이 이미 있음.
- **제안**: profile.pw.*/profile.delete.*/profile.sharedLinks.* 키 추가 후 t() 치환, `formatDateTime(locale)`을 i18n에 추가. 단계 분할 가능(계정 액션 ~12키 → 공유 링크 ~23키).
- **영향 범위**: profile-page.tsx, messages.ts(약 35키 × 5언어), i18n.ts.
- **검증**: typecheck + 프로필 5개 언어 육안.
- **주의점**: `i18n.ts:116` dtf 캐시 키가 year/weekday/month/day만 해싱 — hour/minute 포함시키지 않으면 formatDateTime이 날짜 포맷터를 재사용. SHARED_CARD_KIND_LABEL은 `profile.sharedLinks.kind.${kind}` 템플릿 키(C68과 연계). 기존 키 재사용(auth.oneMoment, profile.cancel). C30과 같은 파일 — 같은 PR 또는 선후 고정.

### C16 — 공용 위젯·셸 경계 소형 문자열 i18n (impact 2 / S / low / 3)
- **문제**: `dom-select.tsx:55,57,209,224` 덮어쓸 수 없는 영어, `theme-tabs.tsx:24` label="Theme"(aria만 t), `auth-form.tsx:112-113` 미설정 안내 + `:104` 태그라인, `shared-card-cta.tsx:22`. privacy/terms는 서버 컴포넌트+한국어 전용 문서라 제외.
- **제안(작은 대안)**: dom-select에 placeholder/searchPlaceholder/emptyLabel/searchAriaLabel prop + useT 기본값(select.* 4키), theme-tabs `label={t('tweaks.theme')}`, shared-card-cta share.makeYourOwn, auth-form auth.notConfigured + brand.tagline.
- **영향 범위**: 4파일 + messages.ts.
- **검증**: typecheck + 셀렉트 열어 placeholder/빈 결과.
- **주의점**: 훅은 무조건 호출 — `const t = useT(); placeholder ?? t('select.placeholder')`. 법적 페이지 제외.

### C17 — app 루트 error.tsx / not-found.tsx (impact 1 / S / low / 1) — value ✗
- **문제**: `s/page.tsx:61`, `s/[token]/page.tsx:74` notFound() 호출하지만 src/app 아래 error/not-found/global-error 없음. auth-provider.tsx:324/use-journal.tsx:682 throw는 개발용 가드라 근거 약함.
- **제안(작은 대안)**: 리팩토링 범위에서 제외, '공유 링크 만료 UX' 기능 과제로 `src/app/s/not-found.tsx` 하나만.
- **검증**: /s/invalidtoken 진입.
- **주의점**: error.tsx는 Next 16 시그니처 `{ error, unstable_retry }`(error.md:27-43), 'use client' 필수. 서버 컴포넌트라 i18n 없음(영어+한국어 병기 결정). BrandMark만 재사용.

### C18 — AuthProvider signOut 내비게이션 책임 분리 (impact 1 / S / med / 1) — value ✗
- **문제**: `auth-provider.tsx:160-165` finally가 무조건 router.replace("/signin"), `:227-231` 유휴 타이머도 같은 signOut, `:275-276` deleteAccount는 supabase.auth.signOut() 직접 호출(withTimeout 없음 → Safari Web Lock 무한 대기 구멍). 호출처 4곳(home-landing:97, 앱 셸 TopBar/MoreSheet, 유휴).
- **제안(작은 대안)**: provider 내부에 withTimeout으로 감싼 `clearSession()` 헬퍼를 두고 signOut/deleteAccount가 공유; signOut은 현행 이동 유지하거나 `signOut({ redirectTo })` 옵션만.
- **검증**: 로그아웃 3경로 + 유휴 + 탈퇴 수동.
- **주의점**: 유휴 로그아웃이 provider 내부라 이동을 호출처로 옮겨도 useRouter가 안 사라짐. /week에서 이동 없이 로그아웃하면 셸 로컬 상태가 남음. home-landing 동작 변경은 의도적 결정으로 기록.

### C19 — 미사용 의존성 제거 + cn/Tailwind 정책 (impact 2 / S / low / 5)
- **문제**: `package.json:14,17,29`(@radix-ui/react-slot, class-variance-authority, zustand) src import 0건(zustand는 mobile/만, 자체 package.json). `src/lib/utils.ts:1-6` cn()은 `dom-select.tsx:13,43-44` 비-Tailwind 클래스 결합뿐. 의도된 Tailwind 유틸리티는 `layout.tsx:52-53`의 두 className(유틸리티 5개)뿐이지만, **정정(G20·G21)**: 빌드 CSS에는 자동 스캔으로 85개 유틸리티가 들어가 있고(mobile/ NativeWind 49개, 주석·style 객체의 우연 토큰 24개 등) — '2개뿐'은 소스 기준이지 산출물 기준이 아니다. `globals.css:1` preflight 의존. `README.md:14` 'Zustand for editor state' 낡음.
- **제안**: npm uninstall 3개(+ cn→clsx면 tailwind-merge도); globals.css에 'preflight 전용' 정책 주석 + **G20의 `source("../")` 한 줄을 같은 커밋에**; 유틸리티를 계속 쓸지 여기서 결정(안 쓰면 G21(b)·G23, 쓰면 G20으로 끝); README Stack 갱신.
- **영향 범위**: package.json/lock, utils.ts, dom-select, README.
- **검증**: typecheck/lint/build.
- **주의점**: package-lock.json 함께 커밋(Dockerfile:11, Dockerfile.dev:13 npm ci). mobile/lib/utils.ts는 별도 패키지. `@import "tailwindcss"` 유지. README.md:3의 '주간 캘린더 이미지 생성기' 설명은 C87과 한 커밋에.

### C20 — Supabase 호출 보일러플레이트 통일 (impact 3 / S / low / 5)
- **문제**: `client.ts:3-6` 주석은 '모든 호출에 상한'이나 withTimeout 적용은 6곳(auth-provider:76,151 / use-journal:141,341,395 / best-of:194). 미적용: best-of.ts:227-237,279-282, share-links.ts:279-282, profile-page.tsx:323-326,428-433,475-479, auth-provider.tsx:101,114,123,134,253,264,275,284, callback:46. AUTH_CALL_TIMEOUT_MS가 DB 호출에 쓰임. abortSignal은 supabase-js가 fetch 전에 `await getAccessToken()`(index.mjs:329-330)이라 Web Lock 정체를 못 끊음(가치 제한적). '늦은 성공이 캐시와 어긋남'은 onSettled invalidate로 수렴(과장).
- **제안(작은 대안)**: client.ts에 `runQuery(label, builder)`(withTimeout + error→throw) 하나만 추가하고 `.from()` 10곳에 적용. AUTH_CALL_TIMEOUT_MS는 SUPABASE_CALL_TIMEOUT_MS로 이름만. auth 호출·abortSignal 손대지 않음.
- **영향 범위**: use-journal, best-of, share-links, profile-page.
- **검증**: typecheck/lint + Docker 수동.
- **주의점**: profile-page.tsx:435-441,481-485는 error 객체를 분기 조건으로 쓰므로 throw 헬퍼로 바꾸면 try/catch 필요. exchangeCodeForSession 타임아웃은 callback:48-55 성공 토스트와 혼동 — 제외. signInWithOAuth는 리다이렉트로 끝나 제외. moveSlot(use-journal:539-559)은 upsertAsync reject 타이밍 의존 — 헬퍼가 reject 의미를 바꾸면 안 됨.

### C21 — 테이블별 repository 모듈 + Row 타입 정리 (impact 3 / S / low / 5)
- **문제**: `.from()` 10곳이 네 파일에 흩어지고 `profile-page.tsx:324,429,476` 3곳은 UI가 직접 쿼리. `use-journal.tsx:58` `theme: string|null`은 `0004_themes.sql:11` not null과 어긋나 `:158` 폴백이 죽은 분기(album nullable은 0002로 정당). `client.ts:51` createClient에 Database 제네릭 없음. best_of 행 매핑 3곳(best-of.ts:183-189,227-236,268-274). Supabase CLI는 미설치라 `gen types` 재현 불가, 생성 타입의 Json이 Album optional 필드와 충돌.
- **제안(작은 대안)**: (1) JournalRow.theme→string, 158행 폴백 삭제; (2) profile-page의 shared_cards 3쿼리·SharedCardRow·MAX_SHARED_CARDS를 insert가 있는 share-links.ts로 옮겨 countSharedCards/listSharedCards/deleteSharedCard 노출; (3) best-of.ts에 `toRow(userId,key,result)` 하나로 두 upsert 통합. Database 타입은 필요시 3테이블 수기.
- **영향 범위**: use-journal, best-of, share-links, profile-page.
- **검증**: typecheck + 프로필 공유 링크 목록/삭제, Best-of 저장.
- **주의점**: MAX_SHARED_CARDS(200)는 `0007_abuse_limits.sql:205`와 짝 — 주석으로 연결. C20 runQuery 위에서 진행.

### C22 — 앨범 메타데이터 풀 이중화 제거 (impact 4 / M / med / 1)
- **문제**: `use-journal.tsx:186-218` 모듈 전역 customAlbumsCache/guestAlbums, `:279-284` poolById가 dbAlbums 위에 storeAlbums를 덮어씀(다른 기기 최신 blob을 이 기기의 오래된 localStorage 사본이 가리는 stale-shadow), `:363-373` onMutate가 이미 cache.albums에 같은 객체를 넣는데 `:443-444,458-460,578-579`에서 upsertCustomAlbum 이중 쓰기(48KiB data URL 전체 배열 write-through, manual-artwork.ts:12). 단 게스트 enrichSlot(:579)·recovery(:655)는 guestAlbums로만 렌더되고, 미설정 모드는 fetchJournal(:133)이 readCustomAlbums를 읽음 — '소비자는 백필뿐'은 과장.
- **제안**: 메타 풀을 query cache의 albums로 통일, 게스트 enrichSlot/recovery는 setQueryData, custom-albums 키는 백필용 1회 읽기(useRef)로 축소해 리스너·useSyncExternalStore 제거. **작은 대안(S)**: `upsertCustomAlbum(album, !guest)` 4곳(:443,:458,:578,:655)을 `!configured`로 바꿔 signed-in write-through만 끄기.
- **영향 범위**: 호출자는 day-of-music-app.tsx 1곳(:162,:361-373,:434)이지만 내부 모드 3개·백필·recovery effect.
- **검증**: 게스트 enrich(같은 앨범 다른 날도 갱신), signed-in 추가→새로고침, 미설정 모드 추가→새로고침, album=null 레거시 행 백필.
- **주의점**: 미설정 모드는 `!configured`일 때 write-through 유지(writeLocalEntries처럼). 백필 성공 후 키를 지우지 말 것. C27 뒤, C23 앞에 수행.

### C23 — localStorage 접근 local-store.ts 통일 + useStore 훅 (impact 2 / S / low / 3)
- **문제**: `local-store.ts:29-34` Store 타입 비공개, use-journal.tsx:88-126(entries)·:167-218(customAlbums) 재구현, auth-provider.tsx:175-188 readStored/writeStored. useSyncExternalStore 3줄 삼중항 7곳(profile.ts:144-158 ×3, themes.ts:42-46,62-66, best-of.ts:213, day-of-music-app.tsx:473-477). **반박**: auth idle 타임스탬프는 `:225-226`에서 다른 탭 값을 보기 위해 매번 재독 — 캐시형 Store로 바꾸면 크로스탭 keep-alive가 깨짐.
- **제안(작은 대안)**: `export type Store<T>` + `useStore(store)` 훅만 추가해 7곳 치환. tweaks 스토어의 makeJsonStore 전환은 **C01이 담당하므로 여기서 제외**(1차 보고서는 같은 변경을 C01과 C23 두 묶음에 중복 배정했음 — 정정). makeJsonStore에 `normalize(raw: unknown) => T` 인자를 추가하는 부분만 C01과 공유. use-journal/auth는 건드리지 않음.
- **영향 범위**: local-store, profile, themes, best-of(앱 셸은 C01).
- **검증**: typecheck + 새로고침 후 프로필/테마/배너 상태 유지.
- **주의점**: auth idle 제외. makeJsonStore에 `normalize(raw: unknown) => T` 인자 추가. C22 먼저 하면 customAlbums 치환 불필요.

### C24 — Album 타입에서 저널 오버레이 분리 (impact 3 / M / med / 1)
- **문제**: `data.ts:27-58` Album에 date/note/rating 필수, `journal.ts:5-12` JournalEntry 동일 필드. 메타만 만드는 생성자 5곳(music-search.ts:116-133/136-154/160-181, add-flow.tsx:116-132, home-landing.tsx:51-63)이 date:""/rating:0 자리표시자. `use-journal.tsx:328-336` upsert row가 컬럼과 blob에 이중 저장, `:297,307-313` 읽기는 blob 값 무시. 합성 타입 세 철자(use-journal:84-86 JournalAlbum, share-links:168 `Album & {theme?}`, :193 `Album & {theme}`).
- **제안(작은 대안)**: `AlbumMeta = Omit<Album,'date'|'note'|'rating'>`·`JournalAlbum = AlbumMeta & JournalEntry`를 journal.ts로 export하고, 5개 생성자 반환 타입과 share-links 두 ad-hoc 교차 타입만 교체(M). 소비자 컴포넌트 props 정리·upsert 경로 변경 보류.
- **영향 범위**: Album importer 21파일 중 생성자·share-links. strict typecheck가 누락을 전부 잡음.
- **검증**: typecheck + 추가/공유 경로 수동.
- **주의점**: 1단계는 별칭 추가만, 생성자 좁히기는 별 PR. Cover 등 메타만 쓰는 props를 AlbumMeta로 바꿀 때 Stars(best-of-modal.tsx:266)와 섞이지 않게. upsert blob에서 date/rating/note를 빼지 말 것(과거 행 일관성).

### C25 — data.ts 빈 카탈로그 경로·미사용 export 제거 (impact 2 / S / low / 3)
- **문제**: `data.ts:62` ALBUMS=[], `:65-67` ALBUMS_BY_DATE·`:84-87` GENRES import 0건. `add-flow.tsx:48` CATALOG_IDS(빈 Set), `:150-155` catalogResults(항상 []), `:196-201` 빈 배열 필터·병합. 헤더 주석(add-flow:1-3, music-search:3, journal.ts:3,21)·README.md:69 '정적 카탈로그' 낡음. **반박**: DOW_KO(week-picker.tsx:143-147, best-of-modal.tsx:253-254)는 의도된 EN/KO 병기 디자인 — useDateNames 치환은 UI 변경.
- **제안(작은 대안)**: ALBUMS/ALBUMS_BY_DATE/GENRES, add-flow 카탈로그 경로 삭제 + 주석 4곳·README 갱신만. data.ts 분리·DOW_KO 치환 제외.
- **영향 범위**: data.ts, add-flow, journal.ts, README.
- **검증**: typecheck(동작 변화 0).
- **주의점**: DOW_KO·share-posters.tsx:127 MONTH_DOW_KO는 i18n 정책 이슈로 분리(C48). README.md:69는 C22 결과에 맞춰 재작성.

### C26 — useJournal 죽은 표면·journal.ts 잔존물 (impact 2 / S / low / 2)
- **문제**: `use-journal.tsx:68/:666` getByDate 소비자 0, `:81/:672` persisted 외부 소비자 0, mutationFn 반환 `{persisted}`(:326/:347, :394/:406)를 onSettled(:386, :429)가 버림. `journal.ts:15` JournalPatch는 v1 맵 분기(:104-112) 전용, `:17` 키 'v1'에 v2 배열 형식.
- **제안(작은 대안)**: getByDate·persisted를 context에서 제거, mutationFn `Promise<void>`, JournalPatch·v1 맵 분기 삭제. 저장 키와 JournalEntry 위치는 그대로.
- **영향 범위**: use-journal, journal.ts.
- **검증**: typecheck + 미설정 모드 새로고침.
- **주의점**: JOURNAL_STORAGE_KEY는 바꾸지 말 것(바꾸면 미설정 모드 기록 고아) — 주석으로 'v1 키에 v2 형식' 명시. JournalResponse.persisted 내부 분기(:354/:372/:412/:420)는 남겨도 됨. C22와 같은 파일 — 순서 고정.

### C27 — 슬롯 병합식 5곳 → mergeEntry (impact 2 / S / low / 1)
- **문제**: `{...meta, date, rating, note}` 병합식이 use-journal.tsx:297, :307-313, :499, :611, :647-652 5곳. updateSlot/enrichSlot(:452-454,:572-575)은 렌더 memo, moveSlot(:488-500)은 slotAt 캐시 즉시 조회 — 이중 경로이나 `:488-489` 주석이 의도를 설명하고 실제 UI 흐름에서 같은 틱 충돌은 없음(버그 아님).
- **제안(작은 대안)**: `mergeEntry(meta, entry)` 순수 함수만 추출해 5곳 치환, 조회 경로는 유지.
- **영향 범위**: use-journal 내부.
- **검증**: 평점/메모 수정, enrich, 이동/스왑 수동.
- **주의점**: readSlot을 도입하면 `:498` poolById→cache.albums 폴백 유지(C22 전). allAlbums(:307-313)는 theme 필드가 붙으므로 호출부 spread. C22·C24보다 먼저.

### C28 — 복구 effect country 미전달·tracksCountry 미설정 (impact 2 / S / low / 2)
- **문제**: `use-journal.tsx:645` `fetchAlbumDetail(e.albumId)`가 country 없이 호출 → `route.ts:22-25` 기본 US, `:81` 스토어 순서 [US,KR,JP,GB]로 US 제목 저장. `music-search.ts:136-154` albumFromDetail이 tracksCountry/tracksVersion을 안 채워 `day-detail.tsx:134-136` staleTracks가 참 → 재조회·upsert 1회 더(이중 fetch + 일시적 US 제목). 행당 invalidate(610,656 → 386-388,429-431). 두 effect(595-615 vs 625-659)는 소스·조건이 달라 '같은 골격'은 과장; 세 호출 방식도 각자 캐시 요구가 달라 통일 필요성 낮음.
- **제안(작은 대안)**: use-journal.tsx만 — JournalProvider에서 `const country = useCountry()`, 645를 `fetchAlbumDetail(e.albumId, { country })`, 647-652에서 detail.tracks.length>0이면 `tracksCountry: country, tracksVersion: TRACKLIST_VERSION`. add-flow/day-detail·두 effect 그대로.
- **영향 범위**: 복구 경로(album blob null + localStorage 없음) 한정.
- **검증**: unconfigured 모드에서 journal 항목만 남기고 custom-albums 지워 복구 재현.
- **주의점**: recoveredRef(한 id 1회) 가드 유지. 빈 tracks면 tracksCountry 채우지 말 것. optimistic:false로 invalidate를 줄이지 말 것(캐시 갱신·실패 토스트까지 꺼짐 352,381).

### C30 — profile-page 공유 링크 관리자 분리 + TanStack Query (impact 3 / M / low / 5)
- **문제**: 컴포넌트 6개(ProfilePage:37, AccountActions:136, SharedLinksSummaryCard:314, SharedLinksModal:400, SettingsForm:619, ThemeManager:685) 한 파일. `:316-334` total useState+setTimeout(0) effect, `:409-453` useState 6개 + loadCards + setTimeout(0)(set-state-in-effect 우회), total을 `:445-446/:489-490` setTotal + onTotalChange(:380)로 이중 동기화. `:457-458` URL 조립 ≡ share-links.ts:283, `:455-464` clipboard+toast ≡ share-actions.tsx:50-51(단 후자는 i18n).
- **제안(작은 대안)**: SharedLinksSummaryCard+SharedLinksModal(:299-617)만 shared-links-manager.tsx로 떼고 `useSharedCards(userId)`/`useDeleteSharedCard` 전환; `shareUrlForToken(token)`·copyLink 헬퍼를 share-links.ts에. SettingsForm/ThemeManager/AccountActions는 그대로.
- **영향 범위**: 외부 export는 ProfilePage 하나(day-of-music-app.tsx:33). RLS(0006:24-34)는 auth.uid()=user_id라 권한 변화 없음.
- **검증**: 프로필 목록·삭제·카운트, share-actions에서 링크 생성 직후 프로필 카운트.
- **주의점**: providers.tsx 기본 staleTime 60_000 → 쿼리에 staleTime:0 또는 createSharedCardLink 성공 시 `["sharedCards", userId]` invalidate. withTimeout 적용(Safari isPending 고착 방지). MAX_SHARED_CARDS 주석 연결. 한국어 하드코딩은 C15. total은 count 쿼리 하나로만.

### C31 — 유휴 자동 로그아웃을 useIdleSignOut 훅으로 (impact 2 / S / low / 2)
- **문제**: `auth-provider.tsx:49-59` 상수, `:168-246` effect(~90줄), `:206-221` window.fetch 교체, `:175-188` localStorage 미러, `:236-239` visibilitychange. **반박**: 'signOut 아이덴티티로 effect 재실행'은 틀림 — Next 16 useRouter는 싱글턴(app-router.js:434)이라 signOut 안정. 추출 근거는 가독성뿐.
- **제안(작은 대안)**: 1단계만 — `src/lib/day-of-music/use-idle-sign-out.ts`로 effect 본문 그대로 이동, provider에서 `useIdleSignOut(signedIn, signOut)` 한 줄. global.fetch 전환은 하지 않음.
- **영향 범위**: auth-provider.
- **검증**: typecheck + 유휴 타임아웃 수동.
- **주의점**: 2단계(createClient global.fetch 집계)는 /api/music/* 호출(music-search.ts:29,51)이 활동에서 빠져 로그아웃 타이밍이 바뀜 — 보류. onIdle은 useRef로 보관. 토스트(:229 한국어)는 호출처 쪽에. 커밋 메시지에 버그 수정으로 적지 말 것.

### C32 — 뮤테이션·인증 실패 피드백 통일 (impact 3 / S / low / 3)
- **문제**: `auth-provider.tsx:123-127,134-138` signInWithOAuth 반환값 폐기, `:280-287` updateUserMetadata error 삼킴 → `profile.ts:167`/`themes.ts:51` `void updateUserMetadata`라 SettingsForm(672)/ThemeManager(764)가 실패를 모름. `use-journal.tsx:425-427` remove.onError 롤백만, `best-of.ts:244-246` 동일. `day-of-music-app.tsx:379-386` handleRemove 무조건 성공 토스트. Google/Kakao 함수(118-138)는 provider 문자열만 다름.
- **제안(작은 대안)**: MutationCache 없이 — remove.onError·bestOf upsert.onError에 toast.error; updateUserMetadata·`signInWithOAuth(provider)`를 `Promise<AuthResult>`로; profile/themes save가 Promise 반환, SettingsForm/ThemeManager가 error면 toast.error.
- **영향 범위**: auth-provider, profile.ts, themes.ts, use-journal, best-of, profile-page, auth-form.
- **검증**: 네트워크 차단 후 테마/프로필 저장·삭제.
- **주의점**: MutationCache 전역 onError는 use-journal:381 토스트와 중복, moveSlot optimistic:false 레그와 겹침 — 쓰려면 meta opt-out 필요. auth-form.tsx:178,187 onClick은 `() => signInWithOAuth('google')` 래핑. handleRemove는 게스트/미설정에선 즉시 성공이 맞으므로 토스트 제거보다 onError 추가. best-of.ts:285 `{bestOf:null}`은 try/catch 안.

### C33 — OAuth 프로바이더 registry (impact 1 / S / low / 1) — value ✗
- **문제**: auth-provider.tsx:118-138 함수 2개, auth-form.tsx:175-192 버튼 2개, profile-page.tsx:32-35,77-81 라벨·아이콘, brand-icons.tsx:5,16, messages.ts auth.google/kakao — 추가 시 5곳. 프로바이더 2개뿐, 세 번째 계획 근거 없음.
- **제안(작은 대안)**: C32의 `signInWithOAuth(provider: "google"|"kakao")` 통합까지만. 버튼·라벨·아이콘 현행 유지.
- **주의점**: profile-page.tsx:46-51 providers는 identities의 자유 문자열 — fallback(라벨=p, 아이콘=null) 유지. AuthContextValue(:36-37)·auth-form.tsx:43-44 구조분해 함께 변경.

### C34 — 게스트/로그인 상태 파생 useAuth 통합 (impact 1 / S / low / 1) — value ✗
- **문제**: `configured && user`/`!loading` 조합이 12곳(auth-provider:171, home-landing:92,146,152, profile-page:42, 앱 셸:461,495,640, share-actions:35,36,39,71, shared-card-cta:17, use-journal:233,248, best-of:212, themes:48, profile:160). 실제 깜빡임은 home-landing만(loading 초기값 configured=true라 SSR에 '로그인/가입' 링크). profile-page는 이론적.
- **제안(작은 대안)**: home-landing.tsx:92(및 :146/:152)를 `loading ? null : configured && user ? … : …`로만 수정. 원한다면 useAuth에 `signedIn: boolean` 하나만 추가해 4곳 치환 — status enum 불필요.
- **주의점**: loading 중 액션 영역을 비우면 게스트 방문자 첫 페인트에서 링크가 사라지는 반대 깜빡임 — 스켈레톤 또는 '로그인 사용자만 숨김' 결정 필요. themes/profile은 loading 분기에서 로컬값 반환 유지. use-journal.tsx:248 enabled 조건 보존.

### C35 — user_metadata 접근 타입화 (impact 2 / S / low / 2)
- **문제**: profile.ts:161-166 캐스트 3개, themes.ts:49-50 `raw as Theme[]`, best-of.ts:258 `as BestOfMap`, auth-provider.tsx:44 `Record<string, unknown>`. useProfile(136-182)과 useThemes(36-58)는 구조가 달라 useSyncedPref 공통 훅은 과잉.
- **제안(작은 대안)**: user-metadata.ts에 `UserMetadata` 타입(+선택적 zod `readUserMetadata(user)`)과 `updateUserMetadata(patch: Partial<UserMetadata>)`만. useSyncedPref 없음.
- **영향 범위**: profile, themes, best-of, auth-provider.
- **검증**: typecheck + 로그인/게스트 전환.
- **주의점**: zod는 passthrough(legacy bestOf 키 보존 — best-of.ts:256-294 마이그레이션). bestOf는 null 허용(best-of.ts:285). themes.ts:50 빈 배열→DEFAULT_THEMES 폴백 유지.

### C36 — 비밀번호 체크리스트 UI 중복 + 미사용 label (impact 2 / S / low / 3)
- **문제**: `auth-form.tsx:140-165`와 `profile-page.tsx:219-242` `<ul className="dom-pw-rules">` 24줄 동일(id만 다름). `password.ts:6,9-11` label 읽는 곳 0(UI는 `t(\`pw.${rule.id}\`)`). auth-form.tsx:64-65/72 passwordIssues 2회 계산(:72는 disabled 우회 방어 의도).
- **제안**: `PasswordRules({password, id})` 컴포넌트('use client'), label 제거, signupInvalid 재사용(분기 유지).
- **영향 범위**: 두 폼, password.ts.
- **검증**: typecheck + 회원가입·비밀번호 변경 폼 체크 토글.
- **주의점**: id prop 필수(aria-describedby dom-pw-rules/dom-change-pw-rules). password.ts:1-4 주석을 '라벨은 messages.ts pw.* 키'로 갱신. mobile/은 password.ts 미사용.

### C37 — /api/account DELETE 라우트 정리 (impact 1 / S / low / 1)
- **문제**: `route.ts:32-39` anon 클라이언트로 getUser만 호출, `:45-48` admin 별도 생성(GoTrueClient.d.ts:1493 `getUser(jwt?)`로 admin 하나로 가능). `:50` deleteError.message가 500 본문 → profile-page.tsx:176-179 토스트로 노출. console.error 없음. `:6-7` cascade 주석에 0009 best_of·0007 private.shared_card_creation_events 누락.
- **제안(작은 대안)**: console.error + 고정 문구 500 + cascade 주석 갱신. 클라이언트 통합은 선택.
- **검증**: Docker에서 테스트 전용 계정으로 삭제(파괴적).
- **주의점**: 고정 문구로 바꾸면 토스트가 서버 상세를 잃으므로 console.error에 deleteError 전체.

### C38 — iTunes 프록시 공통화 (impact 3 / M / low / 7)
- **문제**: fetch(revalidate 3600)+try/catch 블록 5곳(search/route.ts:119-129,143-167, album/route.ts:90-98,133-145, itunes-lookup.ts:57-64). iTunes 행 타입 3벌(search:35-47, album:28-43, itunes-lookup:19-27). MusicSearchResult가 search/route.ts:49-58과 music-search.ts:10-19에 동일(route export는 import 0). 스토어 목록(search:108, album:81)·country zod(search:23-26, album:22-25)·400 응답(search:92-100, album:59-67)·year/600x600 치환 복제. 어떤 fetch에도 signal 없음. searchMusic은 throw(music-search.ts:30), fetchAlbumDetail은 null(:50-57) → add-flow.tsx:179 retry:1 죽은 옵션, TrackPanel(543-551,579)이 실패와 트랙 0개를 같은 문구.
- **제안(작은 대안, 두 PR)**: (1) 타입 전용 — MusicSearchResult를 music-types.ts로, 세 행 타입을 itunes-lookup.ts의 ITunesRow 하나로(런타임 무변경). (2) `itunesFetch(endpoint, params, { timeoutMs })` 추가해 5곳 교체 + storefrontsFor(country)/yearOf/hiResArtwork 공유, countryParam·badRequest는 api/music/_shared.ts. fetchAlbumDetail throw 통일은 하지 않고 add-flow.tsx:179 retry:1만 삭제.
- **영향 범위**: 라우트 2개 + itunes-lookup + music-search + music-types.
- **검증**: typecheck/lint + KR/US/JP 샘플 id로 `/api/music/search?q=…&country=KR`, `/api/music/album?id=…&country=KR` 전후 JSON diff(1시간 캐시라 결정적).
- **주의점**: 래퍼가 lang을 강제하지 말 것 — localizeAlbumTitles(search:150)·lookupByIds(itunes-lookup:42)는 일부러 lang 없이 호출. fetchAlbumDetail null 의미 유지(use-journal.tsx:645는 catch 없는 `void ….then()`). AbortSignal.timeout 도입 시 dev 서버에서 revalidate 캐시 히트 확인(fetch.md:88-96은 signal을 메모이제이션 opt-out으로만 설명, Route Handler는 메모이제이션 대상 아님). 타임아웃은 스토어당 6~8초(검색은 5스토어 순차+localize). ITunesRow는 album 쪽 kind/trackCensoredName/discNumber/trackNumber 포함(optional). Docker 컨테이너가 최신 소스인지 확인.

### C39 — /api/music/album GET 분해 (impact 3 / S / med / 1)
- **문제**: `album/route.ts:53-283` GET ~230줄, lookupIn(83-99)·buildTrackItems(101-116)·findAlbumWithTracks(126-161) 클로저 중첩, let 7개(167-179). lookupIn/buildTrackItems는 클로저 캡처 없음(기계적 리프팅). search/route.ts:110-186도 같은 패턴.
- **제안(작은 대안)**: 클로저 캡처 없는 lookupIn·buildTrackItems·normalize를 모듈 스코프로(C38에 포함), 180-204 선택 루프만 `resolveCollection(storefronts, collectionId)` → `{ preferred, preferredStore, chosen, trackItems, trackStore }`, 236-255 재현지화만 `relocalizeTracks(preferredStore, collection, trackItems)`. 나머지는 GET에 유지.
- **영향 범위**: album/route.ts.
- **검증**: (a) KR에만 트랙 있는 앨범, (b) KR엔 앨범만·US에 트랙, (c) 곡 없는 컬렉션(alt 경로) 3종 id로 전후 JSON diff — id는 손으로 확보.
- **주의점**: C38 뒤에. resolveCollection은 preferredStore와 trackStore를 반드시 함께 반환(237의 `trackStore !== preferredStore`와 221의 alt 경로 `trackStore = undefined`가 KR 재현지화 스위치). '최대 15회 순차 I/O'(120-124) 동작 유지. search/route.ts는 같은 PR에 묶지 말 것.

### C40 — add-flow.tsx 검색 로직 훅 추출 (impact 3 / M / low / 1)
- **문제**: useState 16개(71-84, 97-105, 145-148), useQuery 3개(162,172,183), staleTime 3회(166,178,187), 상수 본문(142-144), step number(71), JSX 236-525 ~290줄. 추가로 CATALOG_IDS(48)·catalogResults(150-155)·197 필터·199-201 dedupe는 ALBUMS=[]라 죽은 코드, 헤더 주석(1-3) 낡음.
- **제안(작은 대안)**: (1) 카탈로그 병합 코드 삭제, (2) COMPACT_COUNT/ALL_LIMIT/PAGE/MUSIC_STALE_TIME 모듈 스코프, (3) search·urlAlbum·expanded 쿼리와 allResults/results/searching/urlNotFound/canSeeAll을 `useMusicSearch(query, country)`로, (4) 수동 등록 폼(338-399 + state 5개)만 ManualEntryForm으로. 날짜/별점 단계는 그대로. `type Step = 1|2|3`, 헤더 주석 갱신.
- **영향 범위**: add-flow 단일 사용처 모달.
- **검증**: Docker에서 검색→See all→무한 스크롤→트랙 펼치기→링크 붙여넣기→수동 등록→날짜 다중 선택→저장.
- **주의점**: useMusicSearch는 query 변경 시 showAll/visibleCount/expandedId 리셋(257-263)을 내부에서. `ref={focusUnlessPhone}`(254, 373) 유지. queryKey 문자열 변경 금지. DayStep/RateStep 분리는 생략(props 꿰기만 늘어남). buildManualAlbum(116-133)은 picked 변환 시점(502)에 값 전달로.

### C41 — 호출자 없는 type=artist|track 검색 경로 (impact 1 / S / low / 1) — value ✗
- **문제**: `music-search.ts:21-24` searchMusic opts에 type 없음, add-flow.tsx:164가 유일 호출자, mobile/도 미사용. search/route.ts:21,66-69,177,183-185와 itunes-lookup.ts:113-133,141-183(~100줄)이 앱 내부에서 도달 불가. 단 어제 커밋 379bfab에서 의도적으로 추가·정교화된 경로.
- **제안(작은 대안)**: 지우거나 UI를 만들지 말고, 작성자 확인 전까지 search/route.ts 헤더 주석에 '클라이언트는 아직 type=album만 사용' 한 줄, 또는 searchMusic opts에 `type?: "album"|"artist"|"track"`을 추가해 시그니처만 라우트와 맞춤.
- **주의점**: 제거 시 zod enum을 album만 남기면 외부 ?type=track 호출이 400으로 바뀜. 379bfab 의도 확인 선행.

### C42 — Album 빌더 응집 + music-search.ts 책임 분리 (impact 2 / S / low / 2)
- **문제**: albumFromSearchResult(116-133)/albumFromDetail(136-154)/albumFromTrack(160-181)/buildManualAlbum(add-flow.tsx:116-133) 4곳이 기본 필드(date:"", titleKo:"", note:"", rating:0, tracks:[]) 반복. music-search.ts:83-113 커버 팔레트가 검색 파일에 섞임. **반박**: home-landing.tsx:51-64 HERO_COVERS는 장식 타일(17-19 주석), share-posters.tsx:21-23 toAlbum은 sanitize 역변환 — 빌더 아님. kind/genre 차이는 동작 차이 없음, format "Manual" vs "Digital"은 의도.
- **제안(작은 대안)**: makeAlbum 없이 (1) coverFromSeed·STYLES·PALETTES·hashSeed를 cover-seed.ts로, (2) buildManualAlbum을 `albumFromManual({ id, title, artist, genre, artworkUrl })` 순수 함수로 다른 세 빌더 옆에. HERO_COVERS/toAlbum 그대로.
- **영향 범위**: 호출자 add-flow.tsx(194,198,562), use-journal.tsx:648.
- **검증**: typecheck + 검색/링크/트랙/수동 4경로 저장 앨범 필드 비교.
- **주의점**: Album은 Supabase blob·localStorage에 그대로 저장 — 기본값 실수가 새 행부터 조용히 달라짐. manualId 생성(add-flow:104-106)은 컴포넌트에. albumFromDetail 반환 필드 순서/이름 유지(use-journal:648 스프레드).

### C43 — t() 섀도잉 6곳 rename (impact 1 / S / low / 2)
- **문제**: add-flow.tsx:540 `const t = useT()` 아래 :558 `.map((t) =>` → :570-571 `t.name`, :579 다시 번역 함수. search-view.tsx:21/31, theme-tabs.tsx:11/15, profile-page.tsx:41/120, :695/704, **profile-stats.tsx:78 `themeRecaps.find((t) => t.id …)`(1차 목록에서 누락된 6번째)**. eslint no-shadow 미설정.
- **제안(작은 대안)**: 매개변수를 track/theme/lane/recap으로 rename만. no-shadow 규칙은 lint 노이즈 없을 때만.
- **검증**: typecheck.
- **주의점**: 규칙 추가 시 `no-shadow: off` + `@typescript-eslint/no-shadow: warn` 쌍.

### C44 — formatDisplayDate Intl 포매터 캐시 (impact 2 / S / low / 1)
- **문제**: `search-view.tsx:22-23` query 매 렌더 파생, `:36-57` useMemo가 키 입력마다 전 앨범에 9필드 join + formatDisplayDate(:47). `data.ts:128-144` formatDisplayDate는 호출마다 localeForCountry(111-118) `new Intl.Locale().maximize()` + `new Intl.DateTimeFormat`(139). 핵심 비용은 Intl 생성자. 측정치 없음.
- **제안(작은 대안)**: search-view 그대로, data.ts formatDisplayDate에 `${locale}:${style}` 키 Intl.DateTimeFormat 캐시 + country→locale 캐시. 19개 호출처 전부 이득, 출력 동일. **G05**: i18n.ts의 useT/useDateNames useMemo(:95-98,:162-171)와 dtfCache(:114-123)는 손대지 않음 — React Compiler 채택 여부와 무관하게 보존(컴파일러가 preserve-manual-memoization으로 그대로 유지, 미채택이면 제거 시 회귀). useLanguage.setLanguage/useProfile.save의 불안정성은 deps에 넣는 소비자가 없어 작업 없음.
- **검증**: typecheck + 적용 전후 Chrome Performance 키 입력 1회(0차 측정 기준표에 포함).
- **주의점**: 캐시 키에 style("long"|"short")과 locale 둘 다. localeForCountry try/catch(잘못된 country→en-US) 유지. 모듈 레벨 Map은 (국가×2)로 유계라 SSR 안전.

### C45 — 날짜 산술 단일화 (impact 4 / M / low / 5)
- **문제**: 월 그리드 공식 `Math.ceil((lastOfMonth.diff(dayjs(calStart),"day")+1)/7)`이 week-picker.tsx:50-53, monthly-view.tsx:80-84, month-share-card.tsx:55-58 3회. 7일 배열 `Array.from({length:7},…addDays)` day-of-music-app.tsx:255-258, add-flow.tsx:231-234, best-of.ts:159. 같은 달 판정 app:268-273 ≈ best-of.ts:100-105, weekly-grid:110-111 ≡ share-card:61-62, monthly-view:86-89·month-share-card:70-73(dayjs), best-of.ts:420(native). 월 경계 native(app:146-147,301,308 / best-of:132,137,155)·dayjs endOf(monthly-view:80, month-share-card:55, week-picker:51,299)·래퍼 혼재. 오늘 비교 weekly-grid:160-161·monthly-view:261-262는 셀마다 `fmtDate(d) === fmtDate(today)`, week-picker:102·day-detail:94·best-of:357은 todayKey. `data.ts:96-97` '호출부가 dayjs에 의존하지 않도록' 선언에도 week-picker:10, month-share-card:10, monthly-view:4가 dayjs 직접 import.
- **제안**: data.ts(또는 dates.ts)에 monthGrid/weekDays/monthStart/monthEnd/addMonths/isSameMonth/segmentDays/isFutureDay 추가, 세 컴포넌트 dayjs import 제거, 보드는 `todayKey` prop 1회. 순수 함수라 첫 단위 테스트 대상.
- **영향 범위**: 9파일(가장 자주 바뀌는 파일들: app 26, weekly-grid 17, monthly-view 14, share-card 14, add-flow 13, month-share-card 12커밋).
- **검증**: node 스크립트로 2024~2027 전 월에 대해 구식·신식 결과 diff + vitest + 주/월/피커/포스터 수동.
- **주의점**: numWeeks는 기존 dayjs 식을 그대로 감쌀 것(native 재구현 금지, DST). best-of.ts segmentDays/monthWeekSegments는 Supabase best_of.key·localStorage dom.bestof.v1 키의 입력 — app monthDays를 segmentDays로 대체하는 방향(기존 함수 유지)으로만, 출력 불변 확인. `d > today` → `key > todayKey`는 동치. week-picker DayPicker는 cursor를 dayjs state로 들어(263,299,339-342,441) 1차에서는 monthly-view·month-share-card만 제거하고 week-picker는 후속.

### C46 — 보드 DnD 프로토콜 공용화 (impact 3 / S / low / 4)
- **문제**: `JSON.stringify({ id, from })`+effectAllowed가 weekly-grid.tsx:394-400과 monthly-view.tsx:279-289, 파싱·onMove+try/catch가 weekly-grid:348-364와 monthly-view:304-319 동일. relatedTarget 가드는 weekly-grid:365-369에만(monthly-view:299-303은 자식으로 커서 이동 시 하이라이트 깜빡임 — 실제 드리프트). 월간은 dragOverDate가 본체(64)에 있어 42셀+Cover 전체 리렌더. **반박**: 스와이프 배선 4줄(weekly:70-77, monthly:72-77)은 정상적인 훅 사용, IGNORE_WITHIN(use-swipe-nav.ts:64-67)은 주석으로 의도 설명.
- **제안(작은 대안)**: lib/album-dnd.ts에 setAlbumDragData/readAlbumDragData/useAlbumDropTarget(relatedTarget 가드 포함)만, 월간은 MonthCell로 분리해 주간 DayCell과 같은 훅. 스와이프 배선·IGNORE_WITHIN은 손대지 않음.
- **영향 범위**: 두 보드.
- **검증**: 데스크톱 커버 위 드래그 시 월간 하이라이트 깜빡임 없음, iOS Safari 롱프레스 드래그 후 스와이프 정상.
- **주의점**: use-swipe-nav.ts:171-173,191-192가 보드 루트에서 dragstart/dragend capture — draggable 속성·setData 위치 유지. MonthCell 분리 시 `key={i}`(monthly-view:269, use-swipe-nav.ts:21-24 포커스 사유) 유지, draggable={Boolean(album)}·disabled 그대로.

### C47 — Best-of 진입 버튼 → BestOfButton (impact 2 / S / low / 3)
- **문제**: weekly-grid.tsx:201-215와 monthly-view.tsx:141-155 버튼 마크업 동일, sonner import(weekly:7, monthly:6)가 toast(bestOfHint) 용도뿐. **반박**: 힌트 사다리는 주(85-92, bow.*·day)와 월(106-115, bom.*·date·n, pending 상태)이 달라 bestOfHintKey 순수 매핑은 안 나옴. 주간은 이미 BoardActions(197-219)로 추출됨.
- **제안(작은 대안)**: `BestOfButton({status, hint, blocked, label, onOpen})` 하나만(atoms.tsx 또는 best-of-button.tsx), 힌트 계산은 각 보드에.
- **검증**: 두 보드 locked/pending 클릭 토스트, done 트로피.
- **주의점**: aria-label `${label} — ${hint}` 유지, hint 없으면 undefined. blocked는 호출부가 결정(월 locked||pending, 주 locked). CSS `.dom-btn[data-bestof=…]`(css:429-443)는 속성 셀렉터라 영향 없음.

### C48 — 요일·월 라벨 i18n 이중화 해소 (impact 3 / M / med / 4)
- **문제**: week-picker.tsx:14-15 DOW_KO/MONTHS_LONG, :28 DOW_LABELS, :79-81, :126-130 월 제목 이중 렌더, :141-149 요일 이중, :191-192 Today 이중; css:4822 `.dom-wp-loc{display:none}`(데스크톱), :4832-4836, :5117-5122 ≤760 교체 → 데스크톱 WeekPicker는 언어 설정 무시. best-of-modal.tsx:15,253-254 ContenderCard, :297 ChampionPoster; best-of-week-modal.tsx:43,56 `Week ${weekNum}` 영어; best-of-month-modal.tsx:32,42; share-card.tsx:55,72,88; share-posters.tsx:126-127; data.ts:80-81. Mon-first 요일 배열 2벌 + Sun-first 1벌. 공유 포스터/페이로드 영어는 의도된 스냅샷 정책(share-posters.tsx:1-5, profile-stats.tsx:64-66).
- **제안(작은 대안, 2단계)**: 1단계(S/low) — ContenderCard/ChampionPoster → `useDateNames().weekdayShort`, best-of-*-modal periodLabel → `names.monthLong(...)` + `t('week.weekN')`, week-picker.tsx:28 DOW_LABELS를 data.ts DOW_MON_FIRST로. 2단계(디자인 확인 후) — WeekPicker legacy/loc 이중 렌더 제거 + CSS 정리. 공유 페이로드/포스터는 영어 유지.
- **영향 범위**: week-picker, best-of 모달 3개, data.ts, CSS.
- **검증**: 5개 언어 × 데스크톱/폰 WeekPicker, Best-of 모달, 기존 공유 링크.
- **주의점**: share-links.ts:98 `dow: z.string().max(3)` — 페이로드 dow/title 손대지 말 것(로케일 라벨 'lun.'은 4자). share-posters는 훅-프리 서버 모듈. shareFileName 인자(best-of-week-modal:60, month-modal:46)는 영어 monthLabel 유지. data.ts DOW는 monthly-view.tsx:234 비활성 섹션 참조 — 삭제 아닌 DOW_MON_FIRST 추가.

### C49 — week-picker.tsx 세 컴포넌트 분리 (impact 2 / S / low / 1)
- **문제**: week-picker.tsx(455줄)에 useCapturedEscape(33-44)·useMonthWeeks(47-59)·WeekPicker(61-197)·SwapConfirm(202-229)·DayPicker(239-455). `day-detail.tsx:24`가 "week-picker"에서 DayPicker/SwapConfirm import. 헤더(117-138 vs 357-376)·요일행(140-150 vs 379-385)은 구조는 같지만 legacy/loc 이중 span·aria 차이로 동일 마크업은 아님.
- **제안(작은 대안)**: 공유 컴포넌트 없이 mini-calendar.tsx(useCapturedEscape·useMonthWeeks) / week-picker.tsx / day-picker.tsx(DayPicker+SwapConfirm)로 순수 분리, day-detail.tsx:24 import 경로 변경.
- **영향 범위**: importer weekly-grid.tsx:22, day-detail.tsx:24.
- **검증**: 데스크톱 주간 점프 팝오버, 폰 DayPicker 키보드 이동/Esc/스왑.
- **주의점**: 헤더·요일행 공용 컴포넌트는 C48 이후. DOW_LABELS·legacy/loc span은 week-picker.tsx에. useMonthWeeks는 C45 후 data.ts monthGrid를 감싸는 얇은 useMemo가 되므로 순서 조정.

### C50 — DayDetail(548줄) 분해 (impact 3 / M / med / 2)
- **문제**: requestMove(day-detail.tsx:103-109)와 DayPicker.pick(week-picker.tsx:309-314)에 '자기 날짜/미래/스왑 확인' 규칙 2벌, nativeSwap(80)·pendingSwap(week-picker:264) 두 상태. info 편집 useState 5개(65-71), 수동 dirty(114-119)·reset(193-200)·save 후 재동기화(186-189). enrich effect deps 10개(160). 두 이동 경로는 week-picker.tsx:199-201 주석대로 SwapConfirm을 공유하도록 의도된 설계이고 포커스 복귀 대상(focusDay vs nativeDateRef)이 달라 통합은 위험.
- **제안(작은 대안)**: `useAlbumEnrichment(album, country, onEnrich)` 훅 추출 + InfoDraft 단일 상태(+ draftFromAlbum) 두 가지만. 이동 규칙 2벌·두 스왑 상태는 그대로.
- **영향 범위**: day-detail 내부.
- **검증**: 폰(≤760) DayPicker 키보드 이동·Esc·스왑, 데스크톱 date input 스왑/취소, Info 탭 수정→취소/저장, iTunes 앨범 첫 열기 트랙 로드.
- **주의점**: useMoveRequest 통합 보류 — 규칙만 공유하려면 `classifyMove(to, {fromDate, todayKey, albumsByDate}) → 'noop'|'move'|'swap'` 순수 함수. enrich 훅은 effect 본문 그대로·deps 유지(cancelled 플래그, onEnrich는 app:371-377 useCallback). InfoDraft는 saveInfo(175-191)의 trim/`Unknown artist`/연도 파싱/artworkUrl undefined 드롭 보존, infoArt 비동기 set은 함수형 업데이트. DayDetail은 app:582 `key={id:date}` 리마운트.

### C51 — cover.tsx 캡션 스타일 반복·StyleArgs.bg (impact 1 / S / low / 2) — value ✗
- **문제**: `style={{` 33개, `fontFamily: MONO` 캡션 블록 11개(cover.tsx:152,193,206,258,300,345,396,423,449,495,509), StyleArgs.bg(27) 미사용(inner div 79가 직접 사용), memo 없음. 성능 주장은 미측정(동시 렌더 ≤31개), C46이 월간 전체 리렌더를 없애면 memo 명분 약화. CSS 증거 '.dom-cover 전부'는 부정확(1140, 1459, 2114, 2986, 3788에도 규칙). 3커밋, 4개월 미변경.
- **제안(작은 대안)**: cover.tsx 안에서 `caption(color, overrides?)` 헬퍼 + 정적 객체 호이스팅 + StyleArgs.bg 제거·`style: CoverStyle` 타입. 파일 분리·memo·CSS 이관 없음. **G06**: `memo(Cover)`는 어느 경우에도 하지 말 것 — use-journal.tsx:297 albumsByDate가 재계산마다 새 album 객체를 만들어 참조 비교 memo는 거의 매번 깨지고, 컴파일러 채택 시에는 Cover가 accent/artist/artworkUrl/bg/fg/style/title 7개 값 기준으로 캐시되어 memo가 불필요하다.
- **주의점**: 2단계 CSS 이관은 57-71 Safari 컨테이너 쿼리 우회·html-to-image 캡처·/s 페이지를 수동 재검증해야 하므로 보류. cover.tsx는 의도적으로 'use client' 없음(서버 /s 렌더) — 훅 금지. 미채택 상태에서 굳이 memo를 원하면 C27 mergeEntry 위에서 album identity 안정화가 선행 조건.

### C52 — MonthlyView 주석 처리 피처 섹션·CSS 삭제, 'use client' (impact 2 / S / low / 3)
- **문제**: monthly-view.tsx:9-16 주석 import 4개, 91-94 주석 변수, 188-242 'PICK OF THE MONTH' JSX 55줄 주석. 'use client' 부재(1-3)로 형제(weekly-grid.tsx:3)와 불일치. CSS 1349-1490(.dom-month-feature*, .dom-feature*)·3732-3745·3784-3793이 죽은 규칙. 비활성화 시점 cd3e019(260617). 증거의 '3732-3791'은 과대 — 3750-3783은 살아 있는 폰 규칙.
- **제안**: 주석 블록·CSS 삭제(커밋 메시지에 복원 해시 cd3e019), 'use client' 추가.
- **검증**: typecheck/lint + 월간 화면 육안.
- **주의점**: CSS 삭제 범위는 1349-1490, 3732-3745, 3784-3793만. `Cover` import(24)는 살아 있는 셀(345)이 씀. 'use client'는 monthly-view 한 파일에 한정 — cover/share-posters/shared-card-view/atoms/modal은 서버 /s용이라 추가 금지.

### C53 — 기간 통계 3곳 복제 + 자릿수·StatsPoster 푸터 (impact 2 / S / low / 4)
- **문제**: `new Set(map(normalizeGenre).filter(Boolean)).size` + `reduce/length .toFixed(1) : "—"`가 monthly-view.tsx:98-102, month-share-card.tsx:74-79, share-card.tsx:80-83. getAlbumStats(album-stats.ts:31) toFixed(2). StatsPoster 상단 타일 2자리(share-posters.tsx:233) vs 푸터 1자리(295). PosterFooter(50-61) 있는데 289-297 인라인. 자릿수 차이는 My Logs 리캡(profile-stats.tsx:105)·주/월 포스터 푸터를 각각 미러링한 결과라 의도 가능.
- **제안(작은 대안)**: album-stats.ts에 `periodSummary(albums)` → `{ count, genres, avg: string }` 추가해 3곳 교체 + StatsPoster 푸터를 PosterFooter로. 자릿수 통일 없음.
- **검증**: 주/월 공유 모달·월간 헤더 숫자 전후 동일.
- **주의점**: payload 필드명(share-links.ts:104-108,123-127)과 1:1 — 스키마 건드리지 말 것. toFixed 통일은 My Logs·OG 설명(share-links.ts:236)이 바뀌는 사용자 가시 변경 — 별도 결정. avg는 `stats.total ? avgRatingNum.toFixed(1) : "—"` 그대로.

### C54 — share-links ↔ share-artwork 순환 import → share-payload.ts (impact 2 / S / low / 2)
- **문제**: share-links.ts:16-21이 share-artwork에서 값 import, share-artwork.ts:11이 share-links에서 isShareableArtwork 값 import(12행은 type-only). 함수 본문 안에서만 사용해 현재 동작은 하나 eslint import/no-cycle 없음. 서버 페이지 s/page.tsx:11-16, s/[token]/page.tsx:11-15는 스키마·디코더만 쓰는데 share-links.ts:22 getSupabaseBrowserClient + canvas 코드까지 번들.
- **제안**: share-payload.ts에 스키마·타입·isShareableArtwork·decodeGuestShareParam·shareDescription 등 순수 코드 이동; share-links는 링크 생성만; share-artwork·서버 페이지는 share-payload만 import. **작은 대안**: isShareableArtwork + dataImageUrl을 share-artwork.ts로 옮기고 share-links가 재export해 순환만 끊기.
- **영향 범위**: share-links 소비자 10곳(named import라 re-export 호환 가능).
- **검증**: typecheck/lint + /s/<token>, /s?d=… 수동.
- **주의점**: readShareTheme(share-links.ts:220-230, localStorage)은 브라우저 전용 — share-links에 남길 것. MAX_DATA_ARTWORK(51)·dataImageUrl(37)은 share-artwork STORED_PAYLOAD_BUDGET과 연결 주석 유지. share-links.ts:14-15 Album/AlbumStats는 type import 유지(값이면 dayjs가 서버 번들로). import/no-cycle 규칙 추가 고려.

### C56 — 폰트 임베딩 이후 남은 Georgia CSS 워크어라운드 (impact 2 / S / med / 1)
- **문제**: save-card.ts:17-32 주석은 폰트를 data URL로 임베딩해 드리프트를 고쳤다고 하고 184에서 fontEmbedCSS를 넘기는데, css:2957-2961(월 포스터 → Georgia), 3002-3007(주 포스터), 3054-3057(.dom-share-title → 'Spectral' 강제)이 무조건 규칙으로 남아 theme.ts:118-151 네 타이포 쌍이 포스터·/s 공개 페이지(shared-card-view.tsx:21-24 적용되나 무효화)에 반영되지 않음. 3050-3053 주석 'export 전용'은 틀림.
- **제안**: Georgia/Spectral font-family 규칙 제거(44px 헤더 3012-3019·nowrap 3084-3086은 유지), 임베딩 실패 경로(save-card.ts:169-173 catch, 114)만 클론에 `data-font-fallback` 속성으로 조건부 적용.
- **검증**: 타이포 4 × 카드 3(주/월/통계) PNG + /s 페이지 + Safari 1회 + 폰트 fetch 차단 폴백 경로.
- **주의점**: 사용자 가시 포스터 타이포 변경 — 리팩토링 PR에 섞지 말고 별도 커밋·디자인 확인. 3054-3057의 font-variant-numeric: lining-nums는 남길 것. data-font-fallback은 stage/clone 생성(157-163) 이후·toPng 이전에 넣어야 두 번째 pass(189-190)까지 적용.

### C57 — 세 share-card 모달 셸·페이로드 빌더 공용화 (impact 3 / M / low / 3)
- **문제**: share-card.tsx:46,108-120 / month-share-card.tsx:40,94-106 / stats-share-card.tsx:42,58-70이 cardRef→handleSaveImage→Modal+PosterFit+Poster+ShareActions로 동일(label·className·Poster·filenameParts만 다름). stats 빌더만 lib(share-links.ts:187-215), 주/월은 컴포넌트 useMemo(share-card:60-106, month-share-card:53-92). 추가 복제: 테마 이름/이모지(share-card:49-53 ≡ month-share-card:43-47), 월 달력·통계(month-share-card:54-58,70-79 ≡ monthly-view:80-84,86-102). git log: share-card와 month-share-card 최근 8커밋이 완전히 동일(lockstep).
- **제안(작은 대안)**: 12줄 모달 셸은 그대로, buildWeekSharePayload/buildMonthSharePayload와 shareThemeLabel(themes, activeTheme)만 lib으로, 월 달력 그리드 계산을 data.ts로 올려 monthly-view와 공유(S). 셸 추출(SharePosterModal)은 선택.
- **영향 범위**: 호출자 day-of-music-app.tsx:608,616, profile-stats.tsx:180,192.
- **검증**: typecheck + 세 모달 열기·이미지 저장·링크 복사.
- **주의점**: 빌더 안 readShareTheme() 호출(useMemo 밖 읽힘, share-card:91, month-share-card:87) 동작 유지(C01 후 useTweaks). 월 달력 공유 시 minmax(120px vs 140px) 차이는 유지. Modal className('dom-share'/'dom-share dom-share-month')은 css:2852 이하와 묶임. C54와 함께면 빌더 목적지는 share-payload.ts.

### C58 — share zod enum을 TS 튜플에서 파생 (impact 2 / S / low / 2)
- **문제**: share-links.ts:27 커버 스타일 8개 ≡ data.ts:10-18 CoverStyle ≡ music-search.ts:86 STYLES; share-links.ts:79-80 ≡ theme.ts:5-6. 테마 키가 늘면 readShareTheme safeParse 실패 → editorial 조용한 폴백. 커버는 sanitizeAlbum(168-185)이 CoverSpec을 대입하므로 typecheck가 먼저 실패('404'는 캐스트 우회 시만). share-links.ts:288-306 Stream 구조적 타입·save-card.ts:177 document.fonts 캐스트는 lib.dom.d.ts(8152/8157/9598/12211)로 불필요. share-actions.tsx:47-49 as Extract는 런타임 가드로 대체 가능. share-artwork.ts:37-50 as T는 제네릭 보존용(정당).
- **제안(작은 대안)**: enum 파생(COVER_STYLES, AESTHETIC_KEYS, TYPE_KEYS 튜플 → z.enum)과 document.fonts 캐스트 삭제. share-actions는 `if (payload.kind !== 'week') return` 가드. mapAlbums as T는 그대로.
- **검증**: typecheck(enum 값 집합 불변).
- **주의점**: share-links가 data.ts/theme.ts 값을 import하면 /s 서버 번들에 dayjs가 따라옴 — C54 분리 후 share-payload가 튜플만 import. CompressionStream typeof 가드와 '1'/'0' 폴백(308-327) 유지(iOS <16.4). music-search.ts:86 STYLES도 같은 튜플 참조.

### C59 — 공유 링크 생성/복사 try 분리 (impact 2 / S / low / 1)
- **문제**: share-links.ts:279-282가 insert 에러를 `new Error(error.message)`로 감싸 PostgrestError code/details를 버림. share-actions.tsx:41-58이 createSharedCardLink + clipboard.writeText를 한 try로 묶어 어떤 실패든 '만들지 못했어요' — insert 성공 후 clipboard 거부(iOS Safari, await 뒤)면 행은 생겼는데 실패로 보이고 재시도마다 행·레이트 이벤트(0007:213-233, 10/h) 소모. 한도(205-210)·레이트(225-233) 예외는 둘 다 P0001이라 code만으로 구분 불가.
- **제안(작은 대안)**: 두 try로 분리하고 복사 실패 시 성공 토스트 + URL 노출(또는 'share.toastCopyFailed' 1키). code별 세분화는 보류.
- **검증**: Safari에서 클립보드 실패 재현.
- **주의점**: 분류를 넣는다면 message 포함 여부('rate limit' 먼저)로, 또는 마이그레이션으로 errcode/hint 부여. createSharedCardLink에 withTimeout 미적용 — 함께 다루면 Safari 행 걸림 설명. 복사 실패 시 URL을 화면에 보여주는 폴백이 있어야 중복 행 방지.

### C60 — save-card.ts 응집도 (impact 1 / S / low / 1) — value ✗
- **문제**: save-card.ts 224줄 중 34-135(~100줄)가 Google Fonts CSS 파싱·인라인 서브시스템, 196-197 `catch {}` → toast로 원인 소실, 169-173 catch도 조용히 skipFonts. 소비자가 하나뿐이라 font-embed.ts 분리는 파일 수만 늘림.
- **제안(작은 대안)**: 파일 분리 없이 save-card.ts:171,196 빈 catch에 `console.warn('[save-card] …', err)`만. 토스트 이동은 C14.
- **주의점**: 호출자 4곳(share-card, month-share-card, stats-share-card, best-of-modal.tsx:160-163) 토스트 이동은 C14와 한 PR. fontCssCache/fontFileCache(34-35) 모듈 상태는 분리해도 동작 같음.

### C61 — supabase/migrations 정리 (impact 2 / S / low / 2)
- **문제**: 0007_abuse_limits.sql과 0007_shared_card_expiration.sql 번호 중복. 0007_abuse:25-36 add constraint, :88/:148/:242 create trigger, :159 create table, :174 create index에 if not exists 가드 없음(0007_exp:8,20·0009:16은 있음). 0008:20-23 'stands alone'이라 하지만 :49-50에서 0007_abuse의 private.shared_card_creation_events를 삭제해 실제로는 의존. 0009:52-54는 0001 set_updated_at() 의존. README.md:36-40·.env.example:4는 '0001만' 안내 → 신규 환경에 get_shared_card RPC·best_of 없음. supabase/에 config.toml 없음(CLI 미사용) — 'CLI 전환 시 충돌'은 가정.
- **제안(작은 대안)**: 파일은 그대로 두고 supabase/migrations/README.md에 '0001→…→0007_abuse_limits→0007_shared_card_expiration→0008(pg_cron 필요)→0009 순서로 전부 실행'과 각 파일 전제를 적고, README.md:36-40·.env.example:4의 '0001만'을 '폴더 전체 순서대로'로. 번호 중복은 다음부터 0010.
- **검증**: 문서 변경(DB 영향 없음).
- **주의점**: 리네임 시 0008:3,21,45·0009:52·api/account/route.ts:7·docker-compose.yml:7 주석도 함께. 이미 적용된 0001~0009에 멱등 가드 소급 추가 금지. 0008 pg_cron 활성화 단계 안내.

### C62 — best-of.ts 순수 브래킷 모듈 분리 + 죽은 export (impact 2 / S / low / 3)
- **문제**: best-of.ts 433줄·export 22개, 17행 "use client"·19-20 React/TanStack import가 45-169행 순수 브래킷·달력 함수와 묶임. weekKey(126-128) 호출 0(startOfWeek 기준이라 split 모드 실제 키와 어긋나는 오도성 코드). 주간 키 규약 fmtDate(labelDate)가 best-of-week-modal.tsx:54, best-of.ts:161, :349 세 곳. 파일 밖 미사용 export 9개(BestOfPeriod 34, BestOfResult 35, BestOfMap 43, nextPow2 50, segmentDays 100, weekKey 126, monthLastDay 136, monthWeekSegments 151, BestOfMonthStatus 369).
- **제안(작은 대안)**: 4분할 대신 2파일 — 45-169행(브래킷·contender·period key)을 `best-of-bracket.ts`("use client" 없음)로, 영속화·훅은 best-of.ts에. weekKey 삭제, `weekPeriodKey(labelDate)` 신설 후 3곳 치환, 파일 밖 미사용 함수 export 정리. import 5곳 직접 수정, barrel 없음.
- **영향 범위**: importer 5개(weekly-grid, monthly-view, best-of-modal, best-of-week-modal, best-of-month-modal), 모두 'use client'.
- **검증**: typecheck.
- **주의점**: nextPow2·segmentDays·monthLastDay·monthWeekSegments는 C83 테스트 대상이므로 순수 모듈에서는 export 유지. 타입 4개는 시그니처에 쓰여 export 유지(실질 죽은 export는 함수 4개 + weekKey). 훅 파일에는 "use client" 유지.

### C63 — useBestOf 안정화 (impact 3 / M / med / 4)
- **문제**: best-of.ts:296-306이 매 렌더 새 get/set 반환 → best-of-modal.tsx:105-114 effect deps `[state.phase]` + 113행 exhaustive-deps disable(저장소 유일). 챔피언 저장 경로 2개(effect 104-114 N=1 자동, pick 인라인 136-146 persistedRef), redo(156)가 ref 복원. useMutation(223-248)·이전 effect(254-294)가 인스턴스마다(WeeklyGrid:67, MonthlyView:62, BestOfMonthModal:30, BestOfModal:80 → 동시 3개) — 중복 upsert는 onConflict 멱등이라 데이터 손상 없음.
- **제안(작은 대안)**: Provider 없이 (1) get/set을 useCallback으로 안정화(로그인 `[remote]`, 게스트 `[local]` 분기 밖에서 두 콜백 생성) — **단 G07: `set`은 `upsert`(useMutation 결과 객체, 렌더마다 새 객체) 전체가 아니라 `const { mutate } = upsert;`의 `mutate`만 캡처해야 안정화됨**(use-journal.tsx:434-438 선례; 컴파일러도 `upsert.mutate(...)` 메서드 호출을 객체 전체 의존으로 취급해 자동 안정화 불가), BestOfModal effect deps를 `[state, storeKey, bestOf]`로 쓰고 disable 삭제(**G03**); (2) pick 결승 분기는 `saved:false` setState만, effect 하나가 저장 후 `saved:true`(persistedRef 삭제); (3) 이전 effect의 async IIFE(best-of.ts:276-293)를 `async function migrateLegacyBestOf(...)` 모듈 함수로 추출(**G02**: `:282 throw`가 컴파일러 bail-out 원인) + 모듈 스코프 `Set<userId>` 1회 가드(실패 시 삭제해 재시도 유지).
- **영향 범위**: best-of.ts, best-of-modal.tsx.
- **검증**: 게스트/로그인 × N=1/N>1 × redo 수동, Network 탭 upsert 횟수.
- **주의점**: Strict Mode dev 2회 effect로 upsert 중복 가능하나 멱등. effect 통합 시 결승 직후 `saved:false→true` 렌더 1회 추가. weekly-grid 버튼 상태(useBestOfWeekStatus)는 query cache 공유라 낙관 갱신 유지 확인.

### C64 — 토너먼트 라운드 진행(pick) 순수 함수화 (impact 2 / S / low / 1)
- **문제**: best-of-modal.tsx:33-40 Tourney 타입, 122-152 pick(라운드 전진·부전승·챔피언 판정·pairWinners), 168-173 roundName이 컴포넌트 안. 순수 브래킷 수학은 best-of.ts:45-88에 따로 — 반쪽 분리.
- **제안**: bracket 모듈에 `createTourney/advance(tour, winner): {kind:'next', tour}|{kind:'champion', champion}`/entrants + Tourney 타입, pick은 setState만. roundName은 순수 쪽이 `'final'|'semifinal'|'round'` 단계만 반환하고 컴포넌트가 t 키 매핑.
- **영향 범위**: BestOfModal 하나.
- **검증**: typecheck(판별 유니온) + 7일·5~6주 토너먼트 수동, vitest.
- **주의점**: C62 뒤 또는 같은 PR. C63 먼저 하면 pick은 setState 한 줄. State.tour 형태 바뀌면 play JSX(208-223) 접근도 수정.

### C65 — 주/월 Best-of 상태 훅·래퍼 모달 중복 (impact 1 / S / low / 2) — value ✗
- **문제**: best-of.ts:339-342와 398-401이 같은 4개 훅 호출, '저장 우승자가 아직 contender인가' 검사 350·414·424·best-of-modal.tsx:91-92 4곳, lastDay 비교 357·427. 두 래퍼(best-of-week-modal.tsx:33-60, best-of-month-modal.tsx:27-46)가 useT·useThemes·useActiveTheme·`themes.find(...)?.name ?? "Daily"`·shareFileName 반복, 주는 contenders 직접(38-41)·월은 훅(30). 월의 'pending'(430)·세그먼트 순회는 실제로 다른 부분이고, 월 필드를 훅이 결정하는 것은 의도(best-of-month-modal.tsx:3-4). 절약 코드가 작고 네 추상(useBestOfEnv·resolveSavedChampion·periodStatus·PERIODS)은 과잉.
- **제안(작은 대안)**: (1) `findSavedChampion(saved, contenders)` 순수 헬퍼 하나로 4곳 치환, (2) useBestOfWeekStatus 반환에 contenders 추가해 주 래퍼가 월과 대칭. 나머지 없음.
- **주의점**: bow/bom title·champion 키 통합 금지(슬롯 다름). `themes.find(...)?.name ?? "Daily"`는 C66. BestOfStatus 타입(318)이 weekly-grid.tsx:184로 노출 — pending을 주에 끼워 넣지 말 것.

### C66 — 활성 테마 객체·라벨·핸들 파생 9곳 → themes.ts 헬퍼 (impact 2 / S / low / 5)
- **문제**: `themes.find(...) ?? themes[0]` + `?? "Daily"`/`?? "🎧"`: share-card.tsx:51-53, month-share-card.tsx:45-47, best-of-modal.tsx:83-84. resolveActiveTheme + `?.name ?? "Daily"`: best-of-week-modal.tsx:45-46, best-of-month-modal.tsx:34-35. `emoji ? "e n" : n` 포맷: theme-tabs.tsx:15-18, search-view.tsx:28-34, share-card:90, month-share-card:86. `username.trim() || DEFAULT_USERNAME` 5곳(share-card:89, month-share-card:85, best-of-modal:85, stats-share-card:49, profile-page:640). themes.ts:50·54에서 useThemes가 빈 배열을 안 돌려주므로 "Daily"/"🎧" 폴백은 도달 불가(DEFAULT_THEMES 리터럴 재작성). profile-stats.tsx:58-59 ♪는 '사용자 테마 이모지 비었을 때' 다른 규칙.
- **제안(작은 대안)**: themes.ts에 `findTheme(themes, id)`(폴백 `themes[0] ?? DEFAULT_THEMES[0]`)·`themeLabel(theme)`·`useActiveThemeObject()` 세 개, profile.ts에 `displayHandle(name)` 하나. profile-stats ♪ 제외한 8곳 치환.
- **검증**: typecheck + 세 모달 열어 라벨·파일명·포스터 텍스트 동일.
- **주의점**: themeLabel은 `emoji ? "e n" : n` 의미 유지(공유 payload 바이트 동일). best-of-modal.tsx:84의 " Daily"(앞 공백) 미세 차이는 통일 시 바뀌는 게 올바름. best-of.ts:348·403 resolveActiveTheme도 바꿀 수 있지만 use-journal.tsx:240 useMemo는 건드리지 말 것. 포맷 변경 금지(공개 링크 표기).

### C68 — MESSAGES 키 타입화(MessageKey) (impact 4 / S / low / 2)
- **문제**: messages.ts:13 `Record<string, Record<Locale,string>>`라 키 오타가 컴파일을 통과하고 i18n.ts:64-65가 키 문자열을 그대로 반환. i18n.ts:52-55 interpolate, :59-67 translate(key: string), :93 useT; top-bar.tsx:15 SCREENS key: string; profile-stats.tsx:70-73,142 복수형 삼항. 로케일 동일값 키 bow.vs(:190), bow.progress(:201), toast.loggedDateDesc(:719). bow.button/title/champion(:165-166,202)·bom.*(:240-242)는 슬롯이 다르므로 '중복'은 일부 과장.
- **제안(작은 대안)**: messages.ts에 `satisfies Record<string, Record<Locale,string>>` + `export type MessageKey = keyof typeof MESSAGES`, translate/useT/SCREENS(top-bar, bottom-tabs) 키 타입 좁히기, PasswordRule.id 리터럴화. 동일값 키 통합·tn()·check-messages 스크립트 생략.
- **영향 범위**: messages.ts, i18n.ts, top-bar, bottom-tabs, password.ts, auth-form(`auth.${mode}.*`는 Mode 유니온).
- **검증**: typecheck.
- **주의점**: password.ts:6 PasswordRule.id를 `"length"|"letter"|"number"`로. 통합 대상은 profile.cancel↔action.cancel, tweaks.close↔modal.close처럼 의미까지 같은 쌍만. C15/C16/C14 키 추가 PR보다 먼저(이후 PR 즉시 검증). satisfies 후 translate의 `MESSAGES[key]`는 `key: MessageKey`로.

### C69 — i18n 코어 분리 (impact 2 / S / low / 2)
- **문제**: i18n.ts:11 'use client', :15 useProfile import라 translate/monthLong 등 비컴포넌트 export를 서버 모듈에서 호출 불가(Next 16 server-and-client-components.md:174-176). messages.ts:11·profile.ts:18은 `import type`이라 런타임 역의존·순환 없음(타입 수준). LOCALES(i18n.ts:25)/INTL_TAG(:105)/COUNTRY_NAME_LANG(profile.ts:91) 3표 — zh가 'zh-Hans'/'zh'로 달라 통합해도 두 필드 남음. data.ts:110 localeForCountry는 export 안 된 내부 함수(가독성 문제). 현재 서버에서 사전을 쓰는 곳은 없음.
- **제안(작은 대안)**: i18n-core.ts(디렉티브 없음)에 Locale/LanguagePref/DEFAULT_LOCALE/LOCALES/localeForCountry/translate/날짜 이름 함수/dtf 캐시만 옮기고 i18n.ts는 훅 + re-export. data.ts:110은 intlTagForCountry로 rename. LOCALE_META 통합·localeDisplayName 생략.
- **영향 범위**: 44개 훅 호출 지점 무변경(re-export).
- **검증**: typecheck + next build.
- **주의점**: i18n-core에 'use client' 모듈을 import하지 말 것(messages.ts는 디렉티브 없음 — OK). 구체적 가치는 C14 auth-provider 토스트가 순수 translate를 쓸 수 있게 되는 것 — C14와 같은 PR 권장.

### C70 — theme.ts → appearance.ts rename (impact 1 / S / low / 1)
- **문제**: theme.ts:1-5(비주얼 토큰) vs themes.ts:1-4,13(저널 레인)이 단수/복수만 다름. tweaks-panel.tsx:69·theme-tabs.tsx:25가 같은 키 tweaks.theme(messages.ts:57; 증거의 :75는 오류). 사용자 대면 용어 theme=레인(messages.ts:140,539-540)이므로 잘못 이름 붙은 쪽은 theme.ts.
- **제안(작은 대안)**: `git mv theme.ts appearance.ts` + import 5곳(shared-card-view, tweaks-panel, day-of-music-app, home-landing, save-card.ts) + 헤더 주석 정정(:1-3 '.dom-root'→실제 .dom-stage). i18n 키·theme-tabs 라벨 변경 없음.
- **검증**: typecheck. localStorage 키(dom.tweaks.v1 등)는 무관.
- **주의점**: lane.label 키 분리 금지(messages.ts:140 레인 카피와 일관성). C07·C08과 같은 PR에 묶어 theme.ts를 두 번 건드리지 않게.

### C71 — 5,707줄 단일 CSS 분할 + ≤760 블록 병합 (impact 3 / M / low / 2)
- **문제**: ≤760 블록 7개(css:318, 3750, 3986, 4259, 4864, 5369, 5667). 순서 의존 주석 4860-4862 'Appended last on purpose', 5025-5026 'Exact (0,5,0)/(0,4,0) copies … win by order', 5361-5364, 스트림 마커 5355/5659/5707. 죽은 규칙(뒤 블록이 덮어씀): .dom-month-hd 3763→5147, .dom-stat-num 3835→4026, .dom-week 4010→5045, .dom-theme-select 319/4020→5018, .dom-month 4017→5144, .dom-search/.dom-profile 4013→5241. 섹션 30개(+마커 3). @layer dom-reset(36-65)만 레이어 사용. 57커밋, 10월만 7커밋.
- **제안(작은 대안)**: @layer 없이 (1) 섹션 헤더 경계대로 src/styles/dom/*.css로 기계 분할하고 layout.tsx 한 곳에서 원래 순서로 import, (2) ≤760 블록 7개를 phone.css 하나로 합치며 죽은 선언 6건 삭제.
- **영향 범위**: CSS, layout.tsx:3.
- **검증**: 폭별(375/667/760/1100/데스크톱) 스크린샷 비교, 공유 포스터(3034-3049) 폰 폭에서 데스크톱 레이아웃 유지.
- **주의점**: layout.tsx 한 파일에서만 import(11-css.md 'contain CSS imports to a single entry file'; cssChunking이 순서 재배치 가능 → 필요시 experimental.cssChunking:'strict'). turbopack @import 지원(turbopack.md:98), postcss @tailwindcss/postcss가 인라인. 부분 덮어쓰기(3763 rows만 vs 5147 gap/align까지)는 병합된 최종 선언으로. @layer 도입 시 3991 sonner 보정·4445-4447 !important는 레이어 밖, 3034-3049 특이성 트릭은 같은 레이어 — 하지 않음. prettier 포맷 diff는 분리.

### C72 — 오버레이 Esc 리스너 4개 → 레이어 스택 훅 (impact 3 / S / med / 2)
- **문제**: modal.tsx:77-83(window 버블), day-of-music-app.tsx:312-327(window 버블 → closeAll), week-picker.tsx:30-44 useCapturedEscape(캡처+stopPropagation, 97/287), poster-fit.tsx:100-112(캡처+stopPropagation) — 서로를 이기려는 우회. outside-pointerdown 2벌(dom-select.tsx:81-90, tweaks-panel.tsx:43-53), 포커스 복원 2벌(week-picker:90-94, more-sheet:31-35). 스크림 2벌(.dom-scrim 2220-2235, .dom-wp-backdrop 5094-5099; tweaks는 의도적 무스크림 — '3벌'은 과장), 시트 표면 3벌(5387-5405, 5100-5113, 5586-5605). **실제 결함**: share-card.tsx:114 Modal 안 share-actions.tsx:85 Modal 중첩 — 확인창에서 Esc 누르면 바깥 공유 모달까지 닫히고 busy 가드 우회. dom-select.tsx:128 Esc는 stopPropagation 없어 TweaksPanel 안 드롭다운 Esc가 app:325 closeAll로 패널까지 닫음.
- **제안(작은 대안)**: Esc만 통합 — lib/hooks.ts에 모듈 스택 기반 `useEscapeLayer(onEscape, enabled=true)`(마지막 등록=최상위만 수신)를 modal.tsx·week-picker(useCapturedEscape 대체)·poster-fit·tweaks-panel이 쓰고 app.tsx Esc→closeAll 분기 제거. outside-click·CSS 통합 보류. **포커스 복원 2벌(more-sheet·week-picker)은 Esc와 별개의 생명주기(진입·트랩·복원)라 여기서 다루지 않고 G11로 분리** — 1차 보고서는 2벌을 적시하고도 Modal 자체에 포커스 관리가 없다는 점을 문제로 세우지 않았다(정정).
- **영향 범위**: Modal 10곳, useCapturedEscape 2곳, poster-fit, app, tweaks-panel.
- **검증**: 중첩 확인창 Esc(재현 테스트), DayDetail 안 DayPicker Esc, 포스터 zoom Esc, TweaksPanel 안 DomSelect Esc, 폰 시트 드래그 dismiss.
- **주의점**: 등록은 useEffect에서(마운트 순서 보장), PosterFit zoom은 expanded일 때만 등록(조건부 지원). app.tsx Esc 제거 시 TweaksPanel(Modal 아님)도 같은 훅으로. ←/→ 주간 이동 가드(316-324) 유지. modal.tsx 드래그 dismiss(116-181)·focusUnlessPhone(45-52) 건드리지 말 것. week-picker:30-32·poster-fit:104-106 설명 주석 삭제.

### C73 — Modal width prop + .dom-modal-panel (impact 2 / S / low / 1)
- **문제**: modal.tsx:57-69 Modal은 투명 래퍼만(.dom-modal 2253-2259). 패널 표면(background var(--panel)+border+padding) 7곳: .dom-detail 2289-2308, .dom-addflow 2545-2562, .dom-public-link-modal 3185-3193, .dom-danger-modal 3341-3348, .dom-share-manager 3369-3380, .dom-bow-inner 4534-4538, .dom-sheet-body 4841-4849. --dom-modal-w만 바꾸는 래퍼 4개(3182-3184, 3338-3340, 3366-3368, 4531-4533). 폰 시트 블록 5457-5474가 패널 6종 열거. 공유 모달 3종은 '패널 없음'이 의도(5531-5559).
- **제안(작은 대안)**: DOM 변경 없이 Modal에 `width?: number` prop(.dom-modal 요소에 `style={{'--dom-modal-w': …}}`)으로 래퍼 4개 삭제 + 공용 .dom-modal-panel 클래스(배경·테두리, ≤760에서 border:0·flex:none)를 기존 패널 요소 6곳 className에 나란히 추가; 각 블록에서 background/border만 삭제.
- **영향 범위**: 호출처 share-actions.tsx:85-92, profile-page.tsx:250-256,499-506, best-of-modal.tsx:176, more-sheet.tsx:61-66.
- **검증**: 10개 호출처 × 데스크톱/폰.
- **주의점**: 공유 모달(.dom-share)에 적용 금지. 5466-5471 padding은 자체 padding 있는 .dom-detail/.dom-addflow 제외 4종에만. --dom-modal-w는 .dom-scrim(2213) 기본값·.dom-detail(2293)이 읽으므로 inline은 .dom-modal에. more-sheet dom-sheet/dom-more-sheet(CSS 없음)는 C76과 함께.

### C75 — 타이포 동일 블록 병합·.dom-week-hd 개명 (impact 2 / S / low / 2)
- **문제**: 바이트 동일 블록 .dom-eyebrow 708-714 = .dom-signin-eyebrow 3246-3252 = .dom-bow-kicker 4547-4553, .dom-settings-label 1690-1696 = .dom-stat-label 1785-1791. 'eyebrow 28회'는 tracking 0.06~0.2em 6종 가족 — 토큰화는 디자인 값 통일 결정. 차용: share-actions.tsx:93(dom-settings-label), more-sheet.tsx:67·96(dom-tweak-section), privacy:37·terms:34·auth/callback:69·home-landing.tsx:119(dom-signin-eyebrow). profile-page.tsx:661은 prop이라 차용 아님. 5245-5255·3955-3970은 search-view:90·profile-page:55·profile-stats:83이 .dom-week-hd를 쓰기 때문에 생긴 부모 스코프 보정.
- **제안(작은 대안)**: (1) .dom-signin-eyebrow·.dom-bow-kicker 삭제 → .dom-eyebrow 통일(5곳 교체), .dom-stat-label↔.dom-settings-label 통일; (2) .dom-week-hd/.dom-week-title → .dom-page-hd/.dom-page-title(TSX 4곳 + CSS 691·3960-3977·5245-5255); (3) .dom-tweak-section → 중립 이름. 토큰 도입 없음.
- **검증**: 해당 화면 육안(computed style 동일).
- **주의점**: legal 페이지 .dom-legal-root(4281-4286)는 --font-mono를 직접 읽어 결과 동일. .dom-week-hd 개명 시 3955-3970 주석·.dom-week-hd-board 한정자·5245-5255 스코프 규칙 필요성 재확인. 공유 포스터는 .dom-share-eyebrow(3072) 별도라 내보내기 무관.

### C76 — 죽은 CSS 14개 + Chip/Accordion + CSS 없는 TSX 클래스 + size=medium (impact 2 / S / low / 3)
- **문제**: CSS에만 있고 src TSX에 없는 클래스 14개: dom-day-dowKo(1108), dom-nav-ko(178, 3673, 3904), dom-placeholder(2184-2206), dom-search-filters(2076-2083), dom-search-result-context(2141-2148), dom-search-result-day(2152-2158), dom-share-grid/-cell/-cell-title/-cell-artist(3110-3135; design_handoff screens.jsx:768-773에만), dom-theme-modal(3823-3825), dom-tweak-select/-radios/-radio(3610-3636). atoms.tsx:77-91 Chip·accordion.tsx(81줄) import 0. CSS 규칙 없는 TSX 클래스 9개(dom-sheet·dom-more-sheet more-sheet.tsx:64, dom-share-card-stats share-posters.tsx:221, dom-fives-info 279, dom-store-country-field profile-page.tsx:660, dom-addflow-result-info, dom-cover-inner, dom-week-title-break, dom-share-month). DomSelectField size="medium"(profile-page.tsx:668, dom-select.tsx:40)은 CSS가 large만(242, 296-311).
- **제안**: 블록·컴포넌트 삭제, 앵커 전용 클래스는 주석 표기, size medium prop 제거(현재 default와 동일 렌더); CSS↔TSX 교차검증 스크립트를 lint 옆에(git grep/node fs 기반).
- **검증**: typecheck/lint(design_handoff는 day-of-music.css를 import하지 않음, 유일 importer layout.tsx:3).
- **주의점**: 3904-3907·1107-1111은 셀렉터 목록이라 .dom-nav-ko/.dom-day-dowKo만 제거. dom-share-month·dom-share-card-stats 같은 식별 앵커는 삭제 대신 주석. 스크립트 필터: --dom-modal-w 변수, dom-sheet-up 키프레임, data-dom-tweaks-trigger, id dom-change-pw-rules 제외.

### C77 — 입력용 별점 2벌 → RatingInput (impact 2 / S / low / 1)
- **문제**: atoms.tsx:93-121 Stars(읽기 전용, inline 색), day-detail.tsx:293-305(.dom-rate-row/.dom-star, data-on, aria.rateStars), add-flow.tsx:465-470(.dom-rating-input 2536-2544, inline 색, aria.starsN). messages.ts:301-302에 두 키가 다른 문구('Rate {n} stars' vs '{n} stars').
- **제안(작은 대안)**: Stars는 그대로, `RatingInput({value,onChange,size})`만 atoms.tsx에 추가해 두 곳 교체, .dom-rating-input 블록과 aria.starsN 삭제.
- **검증**: typecheck + 두 입력 별점 동작.
- **주의점**: 커밋 정책은 부모에(day-detail 즉시 commitRating→onUpdate, add-flow 로컬 state). 버튼 `type="button"` 명시. Stars 색 CSS화는 선택(share-posters:235, best-of-modal:266·315, search-view:126, profile-stats:107 → 포스터 PNG 비교 필요).

### C78 — lib → components 역방향 의존 (impact 2 / S / low / 1)
- **문제**: lib→components import가 정확히 4곳, 모두 auth-provider: use-journal.tsx:36, profile.ts:16, best-of.ts:22, themes.ts:10. auth-provider.tsx는 20-25에서 lib/supabase/client만 import하고 JSX는 319 한 줄(컨텍스트/훅 모듈). importer 총 11개.
- **제안**: `git mv`로 src/lib/day-of-music/auth-provider.tsx 이동(11 import 갱신), eslint.config.mjs에 `{ files: ["src/lib/**"], rules: { "no-restricted-imports": ["error", { patterns: ["@/components/*"] }] } }`.
- **검증**: typecheck/lint.
- **주의점**: 이동과 import 치환을 한 커밋에. 규칙은 src/lib/** 범위·@/components 패턴만. 재export shim 비추천. 메모리/문서의 경로 갱신.

### C79 — use-journal 순수 reducer 추출 (impact 3 / S / low / 2)
- **문제**: use-journal.tsx에 localStorage I/O(88-126, 167-184), 모듈 전역 스토어(191-218), moveChainTail(220-222), 쿼리·뮤테이션(244-432), moveSlot 체인(484-568), 복구 effect 2개(589-659). 낙관 업데이트·스왑·롤백(363-373, 414-421, 505-521, 527-532)은 순수 배열 변환. **반박**: 480-483 주석이 'compiler lint rejects a ref … mutated from a callback handed out via context'라 밝히고 react-hooks/refs: error가 켜져 있어 'moveChainTail을 useRef로'는 막힌 경로. 'Provider 재진입 불가'는 481-482가 앱당 1개를 전제.
- **제안(작은 대안)**: `src/lib/day-of-music/journal-cache.ts`에 applyUpsert/applyRemove/applySwap/restoreSlots 순수 함수 4개와 슬롯 키 술어만 추출해 363-373, 414-421, 505-521, 527-532가 호출. 전역 스토어·moveChainTail·Supabase I/O 분리는 하지 않음.
- **검증**: vitest(첫 단위 테스트) + DnD 스왑·'다른 날로 이동'·삭제 수동.
- **주의점**: applySwap은 505-521(두 슬롯 제거 후 재추가, b 없으면 a만), restoreSlots는 527-532(touched 슬롯만 복원) 의미 그대로. (date, theme) 슬롯 키 규칙(364, 414-416) 공유 술어. JournalResponse는 파일 내부 타입.

### C80 — JournalProvider를 /week 레이아웃으로 (impact 2 / S / low / 1)
- **문제**: layout.tsx:51-54 → providers.tsx:54-55 JournalProvider가 전 라우트. use-journal.tsx:244-249 `enabled: !configured || Boolean(user)`라 로그인 사용자는 /s/[token]·/·/signin에서도 journal_entries 전체 select(141-148) + 백필·복구 effect(596/626) + 로드 실패 토스트(256-264). useJournal 소비자는 전부 DayOfMusicApp(/week) 트리.
- **제안**: `src/app/week/layout.tsx`(서버 컴포넌트)에서 JournalProvider('use client')를 import해 children을 감쌈. AuthProvider·QueryClientProvider·Toaster·ServiceWorkerRegister는 루트에.
- **검증**: /s/[token] 로그인 상태로 열어 Network에 journal_entries 요청 없음, /week DnD·추가 정상.
- **주의점**: /week 이탈 시 backfilledRef/recoveredRef 리셋(마운트당 1회, 무해). 게스트 in-memory 저널(['journal','anon'])은 /week→/→/week 이동 시 gcTime(5분) 뒤 소실 — 수용 또는 journal 쿼리에 gcTime: Infinity. usePathname으로 enabled 끄는 대안은 역방향 결합이라 비추천. Docker 재빌드 필요할 수 있음.

### C81 — album jsonb·localStorage 블롭 읽기 경계 검증 (impact 2 / S / low / 1)
- **문제**: use-journal.tsx:151 `data as JournalRow[]`, 162 Boolean 필터만, 171 `JSON.parse(raw) as Album[]`. share-links.ts:58-74는 공유 payload만 검증. day-detail.tsx:92,133 `album.tracks.length`는 tracks 누락 시 throw. 단 Album 작성 경로 전부(music-search.ts ~130-160, add-flow.tsx:131)가 tracks를 채우고 RLS로 외부 쓰기는 본인 한정 — 알려진 버그가 아닌 방어적 하드닝.
- **제안(작은 대안)**: zod 없이 data.ts에 `normalizeAlbum(raw: unknown): Album | null` 한 함수를 두고 fetchJournal(162)과 readCustomAlbums(171)에서 호출해 누락 필드만 기본값으로.
- **검증**: typecheck + 로드 정상.
- **주의점**: 스키마를 쓴다면 반드시 loose/passthrough(tracksCountry, tracksVersion, releaseDate, kind, albumTitle, artworkUrl strip 금지 — day-detail.tsx:131-160 재조회 루프). 실패 행은 제외하지 말고 수리(tracks: [], note: '', rating: 0, cover: coverFromSeed(id)) — 제외하면 use-journal.tsx:296 `if (!meta) continue`로 보드에서 사라짐. sharedAlbumSchema 제약을 느슨하게 만들지 말 것.

### C82 — 여러 날짜 기록 시 배열 upsert 1회 (impact 2 / S / low / 1)
- **문제**: day-of-music-app.tsx:433-441 handleSave가 날짜마다 logAlbum→upsertMutate, upsert.onSettled(use-journal.tsx:386-388)가 매번 invalidateQueries, fetchJournal(141-148)이 album jsonb 포함 전체 select. enrich(579)·백필(610-614)·복구(656)도 같은 경로. TanStack invalidate는 cancelRefetch 기본 true라 완료되는 재조회는 N보다 적지만 요청은 N번.
- **제안(작은 대안)**: logAlbum을 `logAlbum(album, { dates: string[], rating, note })`로 바꿔 배열 upsert 1회(onConflict 동일)만. invalidate 정책·enrich/백필/복구 경로 그대로.
- **검증**: 다중 날짜 기록 후 Network upsert 1회, 롤백 토스트.
- **주의점**: onMutate 슬롯 교체 필터(364)와 writeLocalEntries(375)를 dates 배열 기준으로. moveSlot(540-550)은 단일 행 upsertAsync·optimistic:false 계약 유지. add-flow dates는 Set 기반(77,511)이라 ON CONFLICT 중복 행 오류 없음. isMutating 기반 invalidate 게이트는 비추천(moveSlot 레그·백필 자기 종료 589-594가 재조회 의존). 배열 실패 시 전체 롤백이므로 토스트 문구 '전체 실패'.

### C83 — 테스트 0개 — vitest 도입 (impact 4 / M / low / 1)
- **문제**: package.json:5-12 test 스크립트 없음, *.test.* 0건. Next 16 `02-guides/testing/vitest.md:33-103` 수동 설정 확인. 바로 테스트 가능한 순수 함수: today.ts:25-45 todayInZone(now 주입), album-stats.ts:16-37, password.ts:15-17, share-links.ts:168-185 sanitizeAlbum·:310-343 encode/decodeGuestShareParam(CompressionStream은 Node 18+), client.ts:18-35 withTimeout. share-links는 share-artwork·supabase/client를 import하지만 모듈 레벨 부작용 없음(fitArtwork 경로만 불가).
- **제안**: vitest + vite-tsconfig-paths, environment node 기본; 1차 위 함수군, 2차 C62 bracket/C69 i18n-core/C79 journal-cache reducer.
- **검증**: `npm test` + CI(C84).
- **주의점**: vitest.config.mts에 environment 'node', jsdom/@testing-library 설치 금지(1차 컴포넌트 테스트 없음). tsconfig include `**/*.ts`라 테스트 파일에서 `import { describe, it, expect } from "vitest"` 명시. todayInZone은 now 고정 + 잘못된 zone('') 폴백 케이스. C84와 묶어 CI에 `npm test` 단계.

### C84 — CI 부재 + Prettier 결정 (impact 3 / S / low / 1)
- **문제**: .github 없음, package.json:9-11 lint/typecheck/format만, Dockerfile:27 npm run build가 유일 게이트. .prettierrc/.prettierignore 없음, `npx prettier --check src` 48 files, `--check .` 58 files. 실측: printWidth 100이면 52 files(80이 현 코드에 더 가까움). 저장소는 GitHub PR 흐름(#38, #39).
- **제안**: ci.yml(npm ci→typecheck→lint→build, 이후 test); prettier는 채택(.prettierrc printWidth 80 + .prettierignore + 1회 포맷 커밋 + .git-blame-ignore-revs + CI check) 또는 제거(devDep·스크립트 삭제) 중 명시적 결정.
- **검증**: CI green.
- **주의점**: 전체 포맷 커밋은 모든 열린 브랜치 머지 뒤 마지막에. actions/setup-node npm cache + .next/cache. Supabase 키 없이 빌드 가능(Dockerfile:20-21 빈 ARG, client.ts:39-43) — 컴파일 검증임을 README에. mobile/·design_handoff/는 tsconfig/eslint 밖이라 자동 제외.

### C85 — tsconfig 강화 (impact 2 / S / low / 1)
- **문제**: tsconfig.json:5 allowJs(src에 .js 없음), :7 strict 외 검사 없음. 실측 `--noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch` 0건, `--noUncheckedIndexedAccess` 36건(save-card 6, best-of 6, best-of-modal 5, music-search 4, week-picker/modal 3, 기타 9 — 14건은 components), `--exactOptionalPropertyTypes` 7건.
- **제안(작은 대안)**: 1단계만 — noUnusedLocals/noUnusedParameters/noFallthroughCasesInSwitch 추가 + `"allowJs": false` 명시. 2단계(noUncheckedIndexedAccess 36건)는 C83 테스트가 best-of/music-search에 들어간 뒤 한 PR.
- **검증**: typecheck.
- **주의점**: allowJs는 삭제하지 말 것 — Next 16 writeConfigurationDefaults.js:110-111,250-253이 키 부재 시 true로 다시 써 넣음. 디렉터리별 단계 적용은 tsconfig 구조상 불가. noUnusedParameters 후 의도적 미사용 인자는 `_` 접두 규약을 AGENTS.md에 한 줄. exactOptionalPropertyTypes는 zod infer와 충돌 — 제외.

### C86 — mobile/(Expo) 고아 디렉터리 (impact 2 / S / low / 1)
- **문제**: `git log -- mobile` 9aac998(2026-05-29) 단일 커밋. mobile/README.md:7-8,96-97이 가리키는 src/types/music.ts·src/store/use-music-board-store.ts는 같은 커밋에서 삭제됨. mobile/lib/store.ts:3-16 MusicEntry는 Album/journal_entries와 무관, :24-116 데모 데이터. mobile/lib/supabase.ts import 0. mobile/eas.json:27 개인 Apple ID. README.md:4-6 '같은 데이터 모델' 주장. tsconfig.json:33·eslint.config.mjs:15·.dockerignore:11·.gitignore:5 제외 항목. mobile/README.md:105-106 Drizzle 언급(웹에 없음).
- **제안**: git tag로 보존 후 삭제하고 설정 4곳·README·0001_journal_entries.sql:4 주석 정리. 재개 계획이면 README 현행화 + appleId를 환경변수(EXPO_APPLE_ID)로.
- **검증**: 웹 빌드·typecheck·lint(mobile/은 tsconfig/eslint에서 제외라 컴파일에는 영향 없음). **정정(G20)**: '웹 빌드에 영향 없음'은 틀렸다 — Tailwind v4 자동 소스 탐지가 mobile/을 스캔해 NativeWind 클래스 49개(`tracking-[6px]`, `text-4xl`, `bg-white/10`, `py-5` 등)가 빌드 CSS 청크(`.next/static/chunks/11~yhc~9._3gj.css` utilities 레이어)에 실제로 들어가 있으므로, 삭제는 CSS 번들에 (긍정적) 영향을 준다. 삭제 후 새 빌드에서 해당 클래스가 사라지는지 확인.
- **주의점**: 삭제 전 소유자에게 Expo 앱 재개 계획 확인(제품 결정). 유지하기로 하면 G20의 `source("../")`로 스캔에서 빼는 것이 필수. 설정·README·SQL 주석은 같은 커밋에서(SQL은 파일만, 재적용 불필요). appleId는 이미 git 이력에 있어 보안 조치가 아닌 위생 조치.

### C87 — 저장소 부속물·죽은 설정·문서 (impact 2 / S / low / 2)
- **문제**: design_handoff_day_of_music/ 3,787줄은 eslint.config.mjs:17-18·.dockerignore:12·css:2 출처 주석에서만 언급. NEXT_PUBLIC_APP_URL src grep 0건인데 Dockerfile:19,22·docker-compose.yml:22·.env.example:1. next.config.ts:27-42 images.remotePatterns는 next/image 미사용(atoms.tsx:68,72 주석만) + i.scdn.co(Spotify) 잔존. public/{file,globe,next,vercel,window}.svg 참조 0. no-img-element 인라인 disable 4곳(atoms.tsx:72, add-flow.tsx:352, day-detail.tsx:410, cover.tsx:37). README.md 964ca73 이후 미갱신(:3 '캘린더 이미지', :14 Zustand, :34 .env.local). manifest.ts:7·layout.tsx:9 description 낡음. .codegraph/.gitignore 추적.
- **제안(작은 대안, 두 커밋)**: (1) 죽은 설정·자산 삭제 — APP_URL 3곳, images 블록, SVG 5개, .codegraph ignore; (2) 문서 현행화 — README/manifest/layout description. design_handoff(tag 후 삭제, 토큰 표만 docs/로)와 no-img-element 전역 off는 소유자 결정 후 별도.
- **검증**: typecheck/lint/build, compose 변수 경고 없음.
- **주의점**: design_handoff 삭제 시 css:2 출처 주석을 tag 이름으로(design_handoff도 Tailwind 스캔에 잡혀 `.blur .italic .rounded .shadow`를 만들고 있었다 — G20). no-img-element 전역 off 시 설정에 사유('외부 CORS 아트워크·정적 로고라 next/image 무가치') 주석. README 현행화는 C19·C61·C86 결정 뒤 한 번에. **sw.js·manifest.ts는 여기서 주석·description 문제로만 다뤘고 서비스워커의 캐시 정책(모든 내비게이션 응답 저장, `public/sw.js:94-108`)은 읽지 않았다 — §8 추가 조사(PWA) 참조.**

### C89 — 커버 이미지 선택 핸들러 중복 (impact 1 / S / low / 1) — value ✗
- **문제**: add-flow.tsx:108-113 handlePickImage와 day-detail.tsx:203-208 handlePickArt는 setter만 다른 6줄. 마크업은 '한 글자도 다르지 않다'가 과장 — add-flow 350-358(label 중첩 input, .dom-addflow-manual-cover 가운데 정렬)와 day-detail 400-433(hidden input + useId + htmlFor label 2개, .dom-cover-edit 왼쪽 정렬, 주석 2461-2462가 의도 설명).
- **제안(작은 대안)**: manual-artwork.ts에 `readArtworkFromInput(e: ChangeEvent<HTMLInputElement>)` 하나를 추가해 두 핸들러를 한 줄로. CoverPicker 컴포넌트는 만들지 않음.
- **주의점**: `e.target.value = ""` 재선택 허용 동작을 헬퍼에 유지. focusUnlessPhone(add-flow:373)·useId(day-detail:113) 배선 그대로.

### 2차 후보 (G) — React Compiler 결정 / 접근성 / 번들·Tailwind

모든 수치·줄번호는 리뷰어가 스크래치패드 드라이런(babel-plugin-react-compiler 1.0.0, @tailwindcss/oxide Scanner 4.3.0)으로 재현한 것. 빌드 시간·번들 바이트만 후보 측 실측(리뷰에서 재측정하지 않음)이라 0차 기준표로 대체한다.

### G01 — reactCompiler: true 채택 결정 (impact 2 / S / med / 1) — value ✗
- **문제**: `next.config.ts:3-43`에 `reactCompiler` 키 없음, `package.json:31-41` devDependencies에 babel-plugin-react-compiler 없음(node_modules에도 부재). Next 16은 stable·opt-in(`version-16.md:410-412`), 빌드 시간 증가 경고(`:451`); SWC가 JSX/훅 파일만 선별(`reactCompiler.md:8-14`); 플러그인 미설치 시 E78(`get-babel-loader-config.js:29-37`), isServer면 미적용(`:40-42`, `get-config.js:99-106`); 옵션은 boolean | {compilationMode, panicThreshold}뿐(`config-schema.js:672-686`); React 19.2.4에 `./compiler-runtime` export 존재(`react/package.json:38-41`). 후보 측 실측: 컴파일 3.0s→5.0s, 전체 9.2s→11.0s, 클라이언트 JS 1,762,928→1,846,302B(+4.7%), gzip 520,787→561,239B(+7.8%), 메모 블록 1→121, 서버 청크 0. 드라이런 93개 함수 컴파일 / bail-out 6(Todo 5 + Suppression 1) / 파이프라인 에러 0. 린트 react-hooks 16규칙 경고 0이라 Rules of React 위반 가능성은 낮음.
- **제안(작은 대안 우선)**: **지금은 채택하지 않는다.** React Profiler로 WeeklyGrid DnD·MonthlyView·Cover 렌더 jank가 확인될 때 `reactCompiler: { compilationMode: 'annotation' }` + 핫 컴포넌트(WeeklyGrid·MonthlyView·DayCell·Cover·AddFlow)에만 `'use memo'`로 실험한 뒤 전면 채택을 결정. 채택 시: `npm i -D babel-plugin-react-compiler@1.0.0` + `reactCompiler: true`, 같은 PR에 G02 전부(bail-out 5곳), G08 리포트 스크립트, AGENTS.md에 '새 useMemo/useCallback은 컴파일러가 못 다루는 경우(useMutation 결과 객체 메서드 캡처 등)에만' 한 줄(G10 caveat). 기존 useMemo 34·useCallback 35는 preserve-manual-memoization이 보존하므로 일괄 제거 금지.
- **영향 범위**: 클라이언트 번들의 'use client' 파일 전부. terms/privacy 같은 RSC 페이지는 무관.
- **검증**: 0차 빌드 크기 기준표 전후, Docker dev(bind-mount+폴링, Babel 경유)에서 `next dev` 첫 /week 컴파일 시간, 폰 스와이프(useSwipeNav)·DnD(weekly-grid/monthly-view)·포스터 저장(html-to-image)·Safari 로그아웃·Best-of 1회씩.
- **주의점**: 보류하면 G02의 auth-provider/share-actions 부분·G03의 '컴파일러 커버리지' 사유·G08은 전제가 사라지고, G04·G05·G06·G07은 '컴파일러 없음' 분기로 그대로 유효. 측정된 렌더 문제가 없는 상태에서 gzip +7.8%·컴파일 +60%는 확정 비용 — value 관점에서 1표 상실. G10(탈락)의 `queryKey useMemo 2곳 제거`는 채택 여부와 무관하게 금지(best-of.ts:215는 :294 effect deps, use-journal.tsx:228은 :1087 moveSlot useCallback deps).

### G02 — 컴파일러 bail-out 5곳 구문 치환 (impact 2 / S / low / 1)
- **문제**: 컴파일러는 미지원 구문이 하나라도 있으면 컴포넌트/훅 전체를 조용히 건너뛰고(기본 panicThreshold 'none') 린트 `react-hooks/unsupported-syntax`는 'Todo' 범주를 잡지 않는다(린트 경고 0 + 드라이런 bail-out 5로 실증). `auth-provider.tsx:150-160` signOut try/catch/finally → AuthProvider(:61) 전체 미컴파일(useAuth만); `share-actions.tsx:43-58` 동일 → 파일 내 컴파일 함수 0; `best-of.ts:276-293` useEffect 안 async IIFE의 `:282 throw` → useBestOf(:206) 미컴파일(WeekStatus/MonthStatus만); `weekly-grid.tsx:143` `style={{ ["--cols" as string]: days.length }}` → 'Expected Identifier, got TSAsExpression key' → WeeklyGrid(:17) 미컴파일(BoardActions/WeekHeader/DayCell만); `share-posters.tsx:77` 동일 → WeekPoster(:63). 변형 실험: `.finally()` 체인 컴파일 OK, IIFE→모듈 함수 OK(useBestOf 47슬롯), `{ "--cols": n } as CSSProperties` OK; try/finally(catch 없음)도 bail-out — 'finally 제거'가 핵심.
- **제안(작은 대안 우선)**: 컴파일러와 무관하게 가치 있는 세 곳만 먼저 — `weekly-grid.tsx:143`·`share-posters.tsx:77`을 `const colsVar = { "--cols": n } as CSSProperties`로(`as string` 계산 키 제거, 타입 정직성), `best-of.ts:276-293` IIFE를 `async function migrateLegacyBestOf(...)` 모듈 함수로(C63(3)·G07과 동일 작업). auth-provider signOut의 `withTimeout(...).then(...).catch(...).finally(() => { setSession(null); router.replace('/signin') })` 변환과 share-actions의 `setBusy(true); createLink().then(copy).catch(toast).finally(() => setBusy(false))`는 **G01 채택이 확정될 때만**.
- **영향 범위**: 5파일, 동작 변화 없는 기계적 변경.
- **검증**: 채택 시 드라이런 bail-out 0. signOut 변환 시 Safari에서 서버 무응답에도 세션 초기화·/signin 이동 수동 확인.
- **주의점**: signOut(:140-166)은 `:143-149` 주석대로 Safari Web Lock 때문에 finally가 반드시 실행돼야 함 — Promise 체인에서도 `.finally` 유지. G01 미채택 시 auth-provider/share-actions는 Safari 민감 코드의 순수 churn이라 그대로 둔다. 변경 빈도: auth-provider 8커밋(마지막 Safari 타임아웃 수정), weekly-grid 17커밋.

### G03 — best-of-modal exhaustive-deps 억제 제거 (impact 2 / S / low / 1)
- **문제**: `best-of-modal.tsx:104-114` persistedRef + useEffect, `:113` `eslint-disable-next-line react-hooks/exhaustive-deps`(저장소 eslint-disable 5곳 중 유일한 react-hooks 억제), deps `[state.phase]`; `:138-144` pick()에서도 bestOf.set 직접 호출(저장 경로 2개). 드라이런 'Suppression' bail-out으로 BestOfModal(:48) 미컴파일(ContenderCard@251·ChampionPoster@281만). `best-of.ts:296-306` get/set 매 렌더 새 클로저. **반박**: '억제가 필요한 이유는 set이 새 함수라서'는 과장 — persistedRef(:106)가 이미 재실행을 막고 있어 정직한 deps로도 추가 쓰기가 없다.
- **제안(작은 대안)**: `:114` deps를 `[state, bestOf, storeKey]`로 바꾸고 `:113` 억제 주석 삭제(persistedRef 가드 유지). 저장 경로 2개 통합은 C63(2).
- **영향 범위**: best-of-modal.tsx 한 곳.
- **검증**: N=1 주(자동 챔피언)·N≥2 토너먼트·redo 각 1회.
- **주의점**: 정직한 deps면 매 렌더 effect가 돌지만 `state.phase !== 'champion' || state.saved || persistedRef.current` 가드로 즉시 반환. redo()(:154-158)가 persistedRef를 false로 되돌리고 phase를 options로 바꾸는 흐름 그대로. StrictMode 이중 실행도 ref가 막음. G07 선행은 필수 아님. N=1 자동 챔피언을 이벤트 경로로 옮기려면 마운트 시 호출할 이벤트가 없어 결국 effect가 필요 — '정직한 deps' 쪽이 더 작다.

### G04 — C03 재정의: account·onAdd 중복은 지역 상수 2개로 (impact 1 / S / low / 1)
- **문제**: `day-of-music-app.tsx:495`(TopBar)·`:640`(MoreSheet) `account={configured && user ? { email: user.email ?? "", onSignOut: signOut } : null}` 동일식 2회, `:538-541`·`:557-560` onAdd 람다 2벌. 컴파일 출력(day-of-music-app.tsx.compiled.js:604-613)에서 account는 `$[76] !== configured || $[77] !== signOut || $[78] !== user` 가드로 두 곳 각각 캐시, onAdd는 WeeklyGrid/MonthlyView 엘리먼트 블록과 함께 캐시(DayOfMusicApp 187슬롯, pruned 0). TopBar·MoreSheet·WeeklyGrid·MonthlyView 모두 memo가 아니므로 useMemo/useCallback은 채택·미채택 어느 쪽에서도 효과 0.
- **제안**: `const account = configured && user ? {...} : null` 1회, `const openAddFor = (date: string) => { setAddDate(date); setShowAdd(true); }` 1개. useMemo/useCallback 추가하지 않음. C03 1단계 안에서 처리.
- **검증**: typecheck.
- **주의점**: 이 파일은 26커밋으로 가장 자주 바뀌어 중복 표현 드리프트 가능성이 실제로 있음 — 가독성 외 이득은 없지만 비용 0.

### G05 — C44 재정의: i18n 훅 메모는 할 일 없음 (impact 1 / S / low / 1) — value ✗
- **문제**: `i18n.ts:84-89` useLanguage가 매 렌더 새 객체 + `setLanguage: (next) => save({ language: next })`, `:95-98`·`:162-171` useT/useDateNames useMemo([locale]), `:114-123` 모듈 수준 dtfCache. `profile.ts:167`·`:175-179` save 클로저 2분기 매 렌더 생성. 컴파일 출력: useLanguage `if ($[3] !== save) t1 = next => save({language: next})`, useProfile `if ($[4] !== updateUserMetadata) …`, 게스트 분기 `save: _temp` 호이스팅; useT/useDateNames useMemo는 그대로 보존(pruned 0). **반박**: setLanguage/save 불안정을 관측하는 소비자가 없다 — `more-sheet.tsx:54·:88`, `language-switch.tsx:27`은 핸들러 안 호출, `profile-page.tsx:113`은 `onSave={save}` prop 전달뿐이고 deps에 넣지 않는다. useT는 locale 메모라 '소비자 40곳 재생성 체인'은 발생하지 않는다.
- **제안(작은 대안)**: 아무것도 하지 않는다. dtfCache는 이미 충분. C44는 data.ts formatDisplayDate 캐시만(이미 그렇게 축소됨).
- **주의점**: C44에 useT/useDateNames의 useMemo 제거 항목이 있다면 그것만 막으면 된다(컴파일러가 보존하므로 제거해도 이득 0, 미채택이면 회귀).

### G06 — C51 재정의: memo(Cover) 불필요 (impact 1 / S / low / 1)
- **문제**: `cover.tsx:30-33` Cover에 memo 없음(저장소 `memo(` 0건), `:55-72`·`:76-86` 인라인 style 33개, `:116` 모듈 수준 abs. 컴파일 출력: Cover 본문이 `accent/artist/artworkUrl/bg/fg/style/title` 7개 값 가드로 캐시, 스타일 8개 전부 컴파일(21+15+18+21+23+16+30+23+20 슬롯), `(w) => w[0]`은 `_temp` 호이스팅, pruned 0. 반면 `memo(Cover)`는 album 참조 비교인데 `use-journal.tsx:291-300` albumsByDate가 `:297`에서 `{ ...meta, date, rating, note }`로 재계산마다 새 객체 → memo는 거의 매번 깨짐. StyleArgs.bg(`:79`)는 Cover 내부만 사용(각 스타일 컴포넌트는 구조분해에서 받지 않음 — '미사용 전달' 맞음). 임포터 8곳 중 share-posters/monthly-view는 지시어 없음(클라이언트 번들에서만 컴파일).
- **제안**: C51에서 memo·인라인 객체 재생성 항목 삭제, 가독성 항목(caption 헬퍼·bg 제거·CoverStyle 타입)만 남김. 미채택 상태에서 memo(Cover)를 하려면 use-journal의 album identity 안정화(C27 위)가 반드시 선행.
- **주의점**: 이 분석은 역설적으로 G01의 가장 강한 근거(그리드 셀 7+31개에서 반복 렌더되는 순수 컴포넌트를 값 기준으로 캐시) — 채택 여부는 0차 측정 후. cover.tsx는 3커밋으로 안정적이라 가독성 정리 긴급도 낮음.

### G07 — useBestOf `set`의 upsert 객체 전체 의존 끊기 (impact 2 / S / low / 1)
- **문제**: `best-of.ts:296-306` signedIn 분기 `set: (key, result) => upsert.mutate({ key, result })`, 게스트 분기 `store.set({ ...local, ... })` 매 렌더 새 클로저; `:223-248` upsert = useMutation(...) 결과 객체는 TanStack v5에서 렌더마다 새 객체. bail-out을 치운 변형을 컴파일하면 `if ($[40] !== upsert) { t13 = (key_4, result_1) => upsert.mutate({...}) }` — 컴파일러가 메서드 호출을 객체 전체 의존으로 취급해 set은 여전히 렌더마다 새 함수(get은 `remote` 가드라 안정). `use-journal.tsx:434-438` `const { mutate: upsertMutate, mutateAsync: upsertAsync } = upsert;` 안정 식별자 선례(주석 434-436).
- **제안(작은 대안)**: (1) `const { mutate } = upsert;` 후 set 클로저가 `mutate`만 캡처, (2) 마이그레이션 IIFE → `migrateLegacyBestOf` 모듈 함수(`migrated.current = false` 롤백 콜백 정확히 전달). useMemo([remote, local, mutate]) 래핑은 생략 — get/set을 deps에 넣는 소비자는 best-of-modal 하나뿐.
- **영향 범위**: best-of.ts.
- **검증**: 로그인 상태에서 토너먼트 1회 저장·새로고침 후 복원.
- **주의점**: 게스트 분기의 set은 `local` 스냅샷을 캡처하므로 local이 바뀔 때마다 새 함수여야 한다 — '완전 안정'이 목표가 아님. 컴파일러 유무와 무관하게 유효하며 저장소가 이미 use-journal에서 같은 패턴을 쓰고 있어 일관성 가치도 있음. C63(1)과 한 PR.

### G08 — bail-out 드라이런 리포트 스크립트 (impact 1 / S / low / 1) — value ✗
- **문제**: `config-schema.js:672-686` reactCompiler 옵션에 logger 없음(zod object는 unknown 키를 조용히 버림); 컴파일러 빌드 로그에 bail-out 표시 없음('Compiled successfully in 5.0s'); 린트 16개 react-hooks 규칙 경고 0인데 드라이런은 Todo 5 + Suppression 1; `package.json:5-12` scripts에 lint/typecheck/format만, CI 없음.
- **제안(작은 대안)**: G01 채택 전까지 저장소에 넣지 않는다. 채택 시 `@babel/core` + `@babel/preset-typescript` + plugin(logger 옵션)으로 `src/**`를 훑어 compiled/bail-out/prunedMemoValues를 출력하는 `scripts/react-compiler-report.mjs` + `npm run compiler:report` 한 줄 + AGENTS.md에 '훅/컴포넌트 수정 PR은 bail-out 0 확인' + CI(C84) 조건. 스크래치패드에서 같은 구성으로 30초 안에 결과 확인됨.
- **주의점**: CI가 없으면 수동 npm 스크립트는 금방 잊혀 썩는다 — C84 선행. bail-out 결과는 '오늘과 동일(미메모)'이라 회귀 성격은 성능 이득 누락에 그침.

### G11 — 공용 Modal 포커스 생명주기(진입·Tab 트랩·오프너 복원) (impact 3 / M / med / 1)
- **문제**: `modal.tsx:77-83` Modal의 유일한 effect는 window keydown Escape; `:184-196` role="dialog" aria-modal="true"가 스크림(onClick=onClose)에, tabIndex={-1}는 자식 .dom-modal에, focus() 호출 없음; `:38-52` focusUnlessPhone은 호출자가 입력 ref에 달아야 하는 opt-in 콜백 ref이고 실제 사용은 `add-flow.tsx:254·:373` 2/10. 포커스 진입 코드 없는 8개 호출처: day-detail.tsx:218, best-of-modal.tsx:176, share-card.tsx:114, month-share-card.tsx:100, stats-share-card.tsx:64, share-actions.tsx:85, profile-page.tsx:250·:499 — 열려도 포커스가 스크림 뒤 오프너에 남음. Tab 트랩·배경 inert 없음(`inert`는 `day-of-music.css:4815` 주석 1건) — aria-modal은 AT 트리만 가리므로 **키보드 Tab이 그대로 뒤 그리드로 누출**(실제 접근성 결함). 닫힐 때 오프너 복원 없음 → `more-sheet.tsx:31-35`와 `week-picker.tsx:90-94`가 `document.activeElement` 저장/`prev?.focus()` 동일 코드를 각자 보유, `day-detail.tsx:96-99` closePicker는 moveTriggerRef로 수동 복원(인라인 DayPicker라 '3벌째'는 다소 넓게 잡음). 네이티브 `<dialog>.showModal()`은 `poster-fit.tsx:153-176` 줌 뷰가 .dom-stage 포털 + z-index 사다리(`css:5366-5368`)라 top layer에 가려지고, `.dom-root inert`는 profile-page 모달 2개가 `<main>` 안(`app:571`)에서 마운트돼 함께 inert되므로 둘 다 drop-in 불가. 폰 시트 제약(`modal.tsx:38-44` 주석: 키보드가 푸터를 가리므로 입력 대신 시트 자체에 포커스, `css:5406-5410` `.dom-modal:focus{outline:none}`)은 훅 내부 초기 포커스 분기로 보존 가능.
- **제안(작은 대안 우선, 2단계)**: **1단계** — Modal에 진입(PHONE_QUERY면 패널, 아니면 `[data-autofocus]` → 패널) + 복원(`prev?.isConnected && prev.focus()`)만 약 15줄로 넣고 more-sheet.tsx:31-35·week-picker.tsx:90-94 삭제; 호출자는 `ref={focusUnlessPhone}` 대신 `data-autofocus`(과도기엔 focusUnlessPhone을 그 속성의 얇은 alias로). **2단계** — 줌 뷰·중첩 모달 규칙을 정한 뒤 패널 keydown에서 Tab/Shift+Tab을 tabbable 목록 양끝에서 wrap(약 20줄, 라이브러리 불필요), role/aria-modal을 스크림이 아닌 패널(.dom-modal)로 옮기고 스크림은 role="presentation". 훅 이름 `useDialogFocus(panelRef, { initial, trap, restore })`, modal.tsx 안에서 Modal이 자체 소비.
- **영향 범위**: Modal 호출처 10곳(9개 모듈 import, 최근 모바일 시트 작업 3커밋), more-sheet, week-picker, day-detail.
- **검증**: handleReplace 체인(DayDetail 언마운트 cleanup → AddFlow mount effect 순서)과 DayDetail key 재마운트(`app:582`)에서 복원→재진입이 같은 커밋에 일어나는지, 폰 시트에서 키보드가 뜨지 않는지, 데스크톱 Tab이 스크림 뒤로 안 빠지는지, iOS Safari 시트. 테스트 없어 전부 수동.
- **주의점**: 중첩 모달(share-card → share-actions 확인 Modal이 DOM 중첩)에서 안쪽 트랩이 keydown을 stopPropagation해야 바깥 트랩이 포커스를 뺏지 않음. PosterFit 줌 뷰는 패널 밖 포털이라 패널 경계 트랩이 줌 뷰의 ✕(`poster-fit.tsx:166-173`)로 가는 포커스를 되돌려 버림 — 줌 열림 동안 트랩을 끄거나 줌 뷰에 자체 진입/트랩(G12). cleanup 복원은 반드시 `isConnected` 가드(DayDetail key 재마운트에서 prev가 언마운트된 노드일 수 있음). role/aria-modal을 패널로 옮기면 `use-swipe-nav.ts:67`의 `[role="dialog"]` 무시 셀렉터가 패널에 걸림 — 스크림은 .dom-root 밖이라 실질 영향 없지만 확인. C72(Esc 스택)와 같은 modal.tsx — C72 뒤 연속 PR.

### G12 — Modal 밖 dialog 셸 3곳의 포커스 정책 통일 (impact 2 / M / med / 1)
- **문제**: `week-picker.tsx:107-116` role="dialog" aria-modal="true" tabIndex={-1}인데 `:85-94` 주석('데스크톱은 타이틀 ▾에 포커스 유지') + `if (isPhoneViewport()) wpRef.current?.focus()` — 포커스 진입은 폰만, 데스크톱은 오프너(`weekly-grid.tsx:249-255`)에 둠 → AT에는 '모달·바깥 inert'라 하면서 포커스는 바깥에 있는 모순. 오프너 2개(`:249-255`, `:288-295`)는 aria-haspopup="dialog"+aria-expanded라 비모달 팝오버 패턴에 이미 맞음. `poster-fit.tsx:140-151` `{!expanded && poster}` / `{fit && !expanded && <button className="dom-poster-zoom">}` — 줌 열림과 동시에 오프너 언마운트, `:153-176` createPortal로 aria-modal 다이얼로그 렌더하면서 focus() 호출·복원 없음 → 키보드로 줌을 열면 activeElement가 body로 떨어짐. `tweaks-panel.tsx:43-59` role="dialog"(aria-modal 없음, 비모달 팝오버로는 맞음) outside-pointerdown 닫기만, 진입/복원 없음, Esc는 `day-of-music-app.tsx:313-339` closeAll 의존.
- **제안(작은 대안)**: 공용 훅 없이 — `week-picker.tsx:112` `aria-modal` 삭제(1속성, 비모달로 결정해 데스크톱 의도 보존); `poster-fit.tsx` 줌 뷰 컨테이너에 tabIndex={-1} + 마운트 시 focus() + `expanded`가 false로 바뀐 뒤의 effect에서 재마운트된 `.dom-poster-zoom`을 querySelector로 되찾아 포커스(~10줄); `tweaks-panel.tsx` 마운트 시 패널 focus()·언마운트 시 트리거 복원(~8줄, `open`이 false면 null 반환이라 마운트/언마운트 반복 → effect 기반이 자연스러움). G11 훅이 안정되면 `{ trap: false }` 옵션으로 세 곳이 소비.
- **영향 범위**: 3파일. 이미 보고된 C49(week-picker 분리)와 직교.
- **검증**: 세 곳 키보드로 열기/닫기 후 activeElement 위치.
- **주의점**: WeekPicker를 '모든 폭에서 포커스 진입'으로 바꾸면 데스크톱 UA 포커스 링 회피 의도를 깨므로 aria-modal 제거가 안전한 쪽. PosterFit 복원은 언마운트 cleanup이 아니라 expanded=false 뒤 effect에서(닫힘과 재마운트가 같은 커밋이라 그 시점엔 존재, layout 전후 순서 확인). G11과 같은 PR에 넣지 말고 G11 안정 뒤 소비자로.

### G13 — DomSelect 트리거 ARIA 정정(select-only combobox) (impact 2 / S / low / 1)
- **문제**: `dom-select.tsx:176-187` 트리거 `<button ref={triggerRef} aria-haspopup="listbox" aria-expanded={open} aria-activedescendant={open && !searchable && active >= 0 ? optionId(active) : undefined}>` — ARIA 1.2에서 aria-activedescendant는 application/combobox/composite/group/textbox(및 파생)에만 허용되고 button에는 적용되지 않으므로 non-searchable ↑/↓(`:164-171`, 포커스는 트리거에 머묾) 시 스크린리더가 강조 옵션을 읽지 못함. `:71` listId는 `:200-209` searchable 입력에서만 aria-controls로 참조, `:221` `<ul role="listbox" id={listId}>`. searchable 모드에서 입력 `role="combobox" aria-expanded="true"` + 트리거 aria-expanded 동시 → '펼쳐진 것' 두 개. 헤더(`:1-2`) 'ARIA listbox (combobox pattern)' 표방. 소비처 5(language-switch.tsx:23, theme-tabs.tsx:23, tweaks-panel.tsx:68·76, profile-page.tsx:657).
- **제안**: non-searchable 트리거에 `role="combobox" aria-controls={open ? listId : undefined} aria-haspopup="listbox" aria-expanded aria-activedescendant`(APG 'Select-Only Combobox'); searchable 트리거는 평범한 `button`에 `aria-expanded`만(aria-activedescendant 제거, 입력이 유일한 combobox). `const triggerAria = searchable ? {...} : {...}` 스프레드. CSS는 `.dom-select-trigger` 클래스 기준(`css:506-541`)이라 무영향. onMouseDown preventDefault/commit-on-click 주석 동작 그대로.
- **영향 범위**: dom-select.tsx 한 곳 → 5개 셀렉트 전파. 3커밋으로 안정적.
- **검증**: VoiceOver로 ↑/↓ 시 옵션 읽기.
- **주의점**: 패널이 닫혀 있으면 listId가 DOM에 없다 — aria-controls는 조건부. 영어 기본 문자열(placeholder/'No matches'/`:209` 'Search …')은 C16.

### G14 — Modal 접근 가능한 이름 `labelledBy` 옵션 (impact 1 / S / low / 1)
- **문제**: `modal.tsx:62-69` props는 label(string)뿐, `:189` `aria-label={label}`. 보이는 h2와 이중화·드리프트: `profile-page.tsx:251` "Delete account confirmation" vs `:258-260` h2 '회원 탈퇴 · Delete account'; `:500` "공유 링크 관리" vs `:510` h2 동일 문자열 2회; `share-actions.tsx:86` t("share.confirmModalLabel") vs `:94` h2 t("share.confirmTitle")(`messages.ts:678·:680` 두 키); `best-of-modal.tsx:176` label={title} vs `:179` kicker {title}. 현재 라벨들이 틀린 이름은 아니라 심각도는 낮음.
- **제안(작은 대안)**: `labelledBy?: string`만 추가(있으면 aria-labelledby, 없으면 aria-label), h2가 있는 4곳만 `useId()`로 연결. 유니온 props(둘 중 하나 필수)는 호출처 변경이 많아 생략. 'share.confirmModalLabel' 같은 라벨 전용 키 삭제 가능.
- **영향 범위**: modal.tsx + 4 호출처. 제목 없는 share 카드 3곳·add-flow·day-detail·more-sheet는 label 유지.
- **검증**: typecheck(누락 잡힘) + VoiceOver 다이얼로그 이름.
- **주의점**: best-of-modal의 보이는 제목은 `:180` h2(themeLabel · periodLabel)이고 `:179` kicker가 title — labelledBy 대상을 결정. C15(profile-page i18n 이관)와 함께면 비용 거의 0.

### G15 — Stars 아톰 role=img + 라벨 (impact 2 / S / low / 1)
- **문제**: `atoms.tsx:93-121` Stars가 `Array.from({ length: 5 })`로 '★' span 5개를 항상 렌더하고 `:109-113` color만 바꿈(`on ? … : 'var(--lineSoft)'`), aria 속성 없음 → 스크린리더는 값이 0이든 5든 '★★★★★'. 소비처 5(search-view.tsx:126 저널 결과, profile-stats.tsx:107 평균, best-of-modal.tsx:266·:315 컨텐더/챔피언, share-posters.tsx:235 통계 포스터). `atoms.tsx:1-6` 'use client' 없음(RSC/포스터에서 렌더), `share-posters.tsx:1-5` '훅 없음·프로바이더 없음' → Stars 안에서 useT 불가. `messages.ts:302` `aria.starsN` 키 존재.
- **제안(작은 대안)**: label prop 없이 루트 span을 `role="img" aria-label={`${value} / 5`}`로, 글리프 span들은 `aria-hidden`(변경 3줄, 호출처 0줄). 번역 라벨이 필요해지면 `label?: string` prop을 추가해 훅 있는 4곳이 `t("aria.starsN", { n: value })` 전달.
- **영향 범위**: atoms.tsx → 5 소비처. 시각·레이아웃 변화 없음.
- **검증**: /s 페이지(RSC)·html-to-image 래스터 영향 없음 확인, VoiceOver 값 읽기.
- **주의점**: share-posters에서는 t()를 쓸 수 없으므로 기본값(`${value} / 5`)이 필수. C77(RatingInput, 입력)과 직교 — 읽기 전용 표시의 의미론.

### G16 — 토글/선택 버튼 ARIA 상태 (impact 2 / S / low / 1)
- **문제**: `add-flow.tsx:465-471` 별점 버튼(aria-label '{n} stars'만, 현재 값은 인라인 color, type="button"도 없음), `day-detail.tsx:293-306` `.dom-star` `data-on`만, `add-flow.tsx:429-437` 날짜 다중선택 `data-active`만(접근 가능한 이름은 '5 Mon'뿐), `:270-286` 결과 선택 `data-active` + 시각 전용 ✓. 저장소 내 선례: `week-picker.tsx:405-409` DayPicker `aria-pressed={key === selectedDate}` + 로빙 tabIndex, `more-sheet.tsx:68-94` 언어 그룹 `role="radiogroup"` + `aria-checked` + 로빙 tabIndex.
- **제안(작은 대안)**: `add-flow.tsx:432`·`:272`에 `aria-pressed={selected}` 한 줄씩 먼저(CSS는 data-active 유지). 별점 2곳의 `role="radiogroup" aria-label` + 각 별 `role="radio" aria-checked={i<=value}` 로빙 tabIndex(MoreSheet onGroupKeyDown 재사용)는 C77 RatingInput 아톰 병합에서 그 아톰의 ARIA 스펙으로.
- **영향 범위**: add-flow, day-detail(C77 경유).
- **검증**: VoiceOver 선택 상태 읽기, 별점 radiogroup 전환 시 Tab/←/→ 동작.
- **주의점**: 별점을 radiogroup+로빙 tabIndex로 바꾸면 ←/→ 키 동작이 생기고 Tab 정지점이 5→1로 줄어 키보드 동작이 바뀜 — '속성 추가만'이 아니므로 C77과 함께. 결과 선택(`:270-286`)은 단일 선택이라 listbox/aria-selected가 더 정확하지만 토글 버튼 의미로 aria-pressed도 허용.

### G17 — DayDetail 탭 tablist/tab/tabpanel (impact 1 / S / low / 1)
- **문제**: `day-detail.tsx:245-264` `.dom-tabs` div 안에 `<button className="dom-tab" data-active>` 3개를 map 렌더(role·aria-selected·aria-controls·type="button" 없음), 탭 패널 3개(`:266-289`, `:291-389`, `:391-509`)는 조건부 렌더만으로 role/id 없음 → AT에는 '버튼 3개'와 내용의 관계가 없고 활성 탭도 알 수 없음(data-active는 `css:2386-2405` 스타일 전용). useId는 `:6`, `:83-85`에서 이미 사용.
- **제안(작은 대안)**: `<div role="tablist" aria-label>` + 각 버튼 `type="button" role="tab" id aria-selected={tab===k} aria-controls` + 활성 패널 래퍼 `role="tabpanel" id aria-labelledby`. ←/→ 로빙은 생략(탭 3개는 Tab 키로 충분).
- **영향 범위**: day-detail.tsx(13커밋, 자주 손대는 파일).
- **검증**: VoiceOver 탭 읽기.
- **주의점**: tracklist 패널은 `:267-288`에서 `<ol>`/`<div className="dom-addflow-empty">` 두 분기 — 둘 다에 role/id를 달거나 래퍼 하나. 로빙을 넣는다면 탭 클릭 핸들러가 호출하는 setPickerOpen(null)/setNativeSwap(null) 리셋도 같이. C50(DayDetail 분해)이 탭을 컴포넌트로 뽑는 지점에서 함께 넣기 좋음.

### G18 — 팝오버 트리거 ARIA 상태 통일 (impact 1 / S / low / 1)
- **문제**: 주 점프 트리거 2개(`weekly-grid.tsx:249-255`, `:288-295`)는 aria-haspopup="dialog"+aria-expanded, Day Detail 이동 트리거(`day-detail.tsx:337-349`)는 aria-expanded+aria-controls인데, Tweaks 트리거 2개(`top-bar.tsx:68` 데스크톱 `<Button variant="ghost" data-dom-tweaks-trigger>`, `:89-95` 폰 IconButton)는 aria 상태 없음, More(`:96-102`)는 aria-haspopup만(aria-expanded 없음). TopBar는 showTweaks/showMore를 받지 않아(`day-of-music-app.tsx:490-497`) 상태를 표현할 수도 없음. `tweaks-panel.tsx:59` 패널에 id 없음(aria-controls 대상 부재).
- **제안**: TopBar props `tweaksOpen: boolean; moreOpen: boolean` 추가(앱은 이미 상태 보유), Tweaks 트리거 2개에 `aria-expanded={tweaksOpen} aria-controls={tweaksOpen ? "dom-tweaks-panel" : undefined}`, More에 `aria-expanded={moreOpen}`; TweaksPanel 루트에 `id="dom-tweaks-panel"`(또는 useId를 앱에서 내려줌). C02 union이 들어가면 `openOverlay === 'tweaks'` 한 값으로 대체.
- **영향 범위**: top-bar, day-of-music-app, tweaks-panel.
- **검증**: VoiceOver 펼침 상태.
- **주의점**: TweaksPanel은 닫히면 null 반환이라 aria-controls 대상 id가 DOM에 없을 수 있음 — 조건부. 데스크톱 Button·폰 IconButton 둘 다 같은 aria-controls(둘 중 하나만 display) — 허용되지만 주석. G12의 TweaksPanel 포커스 정리와 짝.

### G19 — IconButton aria-label 필수 타입 (impact 1 / S / low / 1)
- **문제**: `atoms.tsx:45-64` IconButton은 `Omit<ComponentProps<"button">, "children">`를 받고 내용은 `<Icon aria-hidden="true" />`뿐 — aria-label 누락 시 이름 없는 버튼. 호출처 14곳(week-picker 4, weekly-grid 2, profile-page 3, day-of-music-app 1, monthly-view 2, top-bar 2 — 후보의 13은 소소한 오차)은 현재 모두 전달하고 있어 결함은 아니지만 불변식이 리뷰에만 의존.
- **제안(작은 대안)**: `Omit<ComponentProps<"button">, "children" | "aria-label"> & { icon: LucideIcon; iconSize?: number; "aria-label": string }` — `aria-labelledby` 유니온은 사용처가 없어 불필요. 호출처 변경 0.
- **검증**: `npm run typecheck`.
- **주의점**: `Omit`에 "aria-label"을 넣고 다시 더하는 형태로 써야 `...props` 스프레드와 맞음. atoms.tsx는 5커밋으로 안정적.

### G20 — Tailwind 스캔 범위를 src/로 한정 (impact 2 / S / low / 1)
- **문제**: `src/app/globals.css:1`은 `@import "tailwindcss";`만(source()·@source 없음). `@tailwindcss/postcss dist/index.js:10` — base 미지정 시 `process.cwd()` 기준 `pattern:"**/*"` 스캔(.gitignore·바이너리·lock만 제외) + 스캔한 모든 파일을 PostCSS dependency로 등록. 실측(oxide Scanner 4.3.0, base=루트): files 137 / candidates 5,131 / utilities 85; base=src: 77 / 29 → **56개가 src/ 밖에서 유입** — mobile/ 49(`mobile/app/index.tsx:20` `tracking-[6px] text-white/50`, `:23` `text-4xl`, `components/music-card.tsx:34,54` `bg-white/10 px-3 py-1`, `app/edit/[id].tsx:83,177` NativeWind), design_handoff 4(`README.md:72` italic, `:267` rounded, `ios-frame.jsx:46` blur, `tweaks-panel.jsx:56` shadow → `.blur .italic .rounded .shadow` — C87의 '영향 없음' 전제가 틀림), supabase SQL 3(`0007_shared_card_expiration.sql:7,26` `table` → `.table{display:table}`, contents, grow), `README.md:39` table, `docker-compose.dev.yml:11-13` 주석의 container/shadow. 빌드 청크 `.next/static/chunks/11~yhc~9._3gj.css` utilities 레이어 6,294B/85,775B에 `.tracking-\[6px\]`·`.text-4xl`·`.bg-white\/10`·`.py-5` 실재, src/ grep 0건. `.dockerignore:12-13`이 mobile·design_handoff를 제외하므로 Docker 빌드는 33 유틸리티 vs 로컬 85 → **CSS 내용·청크 해시가 다름**(localhost:3000은 Docker). 제외 규칙이 `.gitignore:5,:18,:45`에 묶여 루트에 docs/·scripts/가 생기면 자동 스캔. `tailwindcss/dist/lib.js`에 `@source not`·`source(none)` 지원 문자열 확인(4.3.0). Next 문서 인용(`local-development.md:146-168`)은 v3 content 설정 맥락이라 근거로는 약함. 스캔 15ms vs 5ms — 성능이 아닌 위생·재현성 문제.
- **제안(작은 대안)**: globals.css:1을 `@import "tailwindcss" source("../");` 한 줄(= 자동 탐지 base를 src/로 한정, 77파일/29 유틸리티; `source(none)` + `@source "../"` 두 줄과 동일). C86 결정 전 최소만 원하면 `@source not "../../mobile";`(37)로도 되지만 SQL·README·compose의 table/contents/grow/container가 남으므로 src 한정이 낫다.
- **영향 범위**: globals.css 1행(초기 커밋 이후 1커밋, 충돌 없음).
- **검증**: 새로 `npm run build` 후 CSS 청크에 `tracking-\[6px\]`·`bg-white\/10` 없음, `layout.tsx:52-53`의 유틸리티 5개(h-full antialiased flex min-h-full flex-col) 유지, 로컬·Docker 빌드 CSS 동일.
- **주의점**: `@source` 경로는 CSS 파일 기준(src/app/globals.css → "../" = src/). 현재 .next 청크는 8/30 빌드 — 전후 비교는 새 빌드로. Docker dev는 bind-mount 전체 스캔이 src/로 줄어 부작용 없음. G21에서 유틸리티를 끄기로 하면 불필요.

### G21 — Tailwind utilities 레이어 존치 결정 (impact 1 / S / low / 1) — value ✗
- **문제**: src/에서 dom-* 아닌 className 리터럴은 `src/app/layout.tsx:52` `<html className="h-full antialiased">`·`:53` `<body className="flex min-h-full flex-col">` 두 줄뿐(`className={…}` 10곳은 전부 `atoms.tsx:15-27` buttonClass()의 dom-btn*). src만 스캔해도 29개 유틸리티 중 24개는 주석·style 객체의 우연 토큰(`cover.tsx:138` `textTransform: "lowercase"`→`.lowercase`, `atoms.tsx:103` `display: "inline-flex"`, `home-landing.tsx:30` `style: "ring"`→`.ring` + @property 폴리필, `save-card.ts:203` 주석 collapse, `modal.tsx:9` sticky, `poster-fit.tsx:56` backdrop-filter). 실측(minified): 루트 utilities 6,860B / @layer properties 1,331B / @supports 1,198B; src-only 2,647 / 1,284 / 1,151; 의도 5개만 181 / 0 / 151. `.dom-stage`(`css:25`) `-webkit-font-smoothing: antialiased`가 layout의 antialiased와 중복. `node_modules/tailwindcss/`에 preflight.css·theme.css·utilities.css 개별 존재. 앱이 dom- 접두만 쓰므로 `.hidden`·`.table`·`.container`·`.fixed` 같은 우연 전역 클래스의 실제 충돌은 없음.
- **제안(작은 대안)**: **G20만 적용하고 이 항목은 닫는다.** C19 Tailwind 정책이 '유틸리티 안 씀'으로 결정될 때만: globals.css에 `html{height:100%;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale} body{display:flex;flex-direction:column;min-height:100%}` + layout.tsx:52-53 className 제거 + `@import "tailwindcss"`를 `@import "tailwindcss/theme" layer(theme); @import "tailwindcss/preflight" layer(base);`로 축소(utilities 미포함이면 스캐너가 돌지 않음). html/body 1:1 치환이라 시각 검증 쉬움.
- **주의점**: 이것은 리팩토링이 아니라 C19 결정에 붙이는 실측 메모 — 어느 쪽이든 절감 ~3KB·주석 토큰 24개 수준. 유틸리티를 끄더라도 **preflight는 반드시 남길 것**(G23·C74의 dom-reset 중복 제거가 그 전제). G22·G23·G24가 이 결정에 끌려감. cn()(clsx+tailwind-merge)은 문자열이라 무관.

### G22 — `.dom-stage` 폰트 기본값 부재(Tailwind `@theme inline` 방출에 묵시 의존) (impact 2 / S / low / 1)
- **문제**: `src/styles/day-of-music.css:4-19` `.dom-stage`는 색 토큰 11개 + `--font-body: "Spectral", Georgia, serif`(`:5`)만 두고 `:6-8` 주석 'applyTheme를 안 거치는 페이지(auth 카드, 모달)도 모든 색 변수를 해석하도록' — `--font-mono`·`--font-display` 기본값은 없음. `var(--font-mono)` 110회·`var(--font-display)` 77회·폴백 `var(--font-mono,` 0회(예: `:144` .dom-brand-ko, `:233` .dom-select-field-label, `:3247` .dom-signin-eyebrow, `:3283` .dom-signin-msg, `:4284` .dom-legal-root). `--font-display:` 정의는 `:4282-4283` .dom-legal-root뿐(그마저 `--font-mono` 의존). `--font-mono`의 유일한 CSS 정의는 `globals.css:12-17` `@theme inline { … --font-mono: var(--font-app-mono); }`(`:9` SFMono/Consolas 스택)이고, 이것이 빌드 CSS `:root`에 방출되는 이유는 Tailwind 기본 테마의 `--default-mono-font-family: var(--font-mono)`가 참조하기 때문(같은 블록의 `--color-background/--color-foreground`는 참조가 없어 미방출 — 빌드 청크 @layer theme에서 확인) → **방출 여부가 Tailwind 내부 사정에 달린 숨은 결합**. applyTheme 호출처는 `day-of-music-app.tsx:243`·`home-landing.tsx:79` 2곳뿐이라 `auth-form.tsx:98`, `auth/callback/page.tsx:66`, `terms/page.tsx:15`, `privacy/page.tsx:15`의 `.dom-stage`에서는 `--font-mono`가 테마의 JetBrains Mono(`theme.ts:123`)가 아니라 SFMono로, `--font-display`는 미정의→Spectral 상속. `theme.ts:209-210` `vars["--font-mono"] = t.mono; vars["--font-sans"] = t.sans`. `shared-card-view.tsx:27`은 themeStyleVars inline이라 제외. G20/G21/G24에서 `@import "tailwindcss"` 구성이나 `@theme inline`을 바꾸면 이 110곳이 조용히 깨질 수 있음.
- **제안(작은 대안)**: `.dom-stage`에 `--font-display: "Spectral", Georgia, serif; --font-mono: "JetBrains Mono", ui-monospace, monospace;` 두 줄만 `--font-body` 옆에 추가(값은 `theme.ts` TYPE_PAIRS.editorial `:121-124`와 동일, 출처를 주석으로 — 단일 출처 생성은 과잉). globals.css 정리는 G24에서.
- **영향 범위**: day-of-music.css(57커밋, 가장 자주 바뀌는 파일 — 기본값이 한 블록에 모이는 것이 유지보수에 실질적).
- **검증**: auth/legal 4페이지 스크린샷 비교. 이 페이지들은 ensureFonts()를 호출하지 않아 JetBrains Mono가 로드되지 않으므로 실제 렌더는 ui-monospace(= SF Mono)로 사실상 동일 — 폰트가 캐시된 경우에만 차이가 보임(Google Fonts 미로드 상태를 기준으로).
- **주의점**: **순서 고정** — (1) `.dom-stage`에 두 변수 추가 → (2) globals.css `@theme inline`의 `--font-mono` 제거(G24). 역순이면 4페이지의 mono 글꼴이 깨짐. C07 주의점의 부수 발견(.dom-legal-root `var(--font-mono)` 미정의 가능)이 이것으로 해소. C08(폰트 로딩 root layout 통합)이 들어가면 4페이지도 JetBrains Mono가 실제 로드된다.

### G23 — 폼 컨트롤 리셋 3중(preflight / globals.css / dom-reset) (impact 1 / S / low / 1) — value ✗
- **문제**: `@import "tailwindcss"`로 preflight가 `@layer base`에 들어오며(빌드 청크 base 레이어 3,589B에서 확인) `node_modules/tailwindcss/preflight.css:238-250` `button, input, select, optgroup, textarea, ::file-selector-button { font: inherit; … letter-spacing: inherit; color: inherit; border-radius: 0; background-color: transparent; opacity: 1 }`, `*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}`. 그런데 `globals.css:27-33` `button, a, input, select, textarea { font: inherit }` 재선언, `:35-37` `button { cursor: pointer }`(v4 preflight에 pointer 없음 — 유일한 실질 추가, cursor는 preflight `:379` 주석뿐). `day-of-music.css:36-40` `@layer dom-reset { .dom-root * { box-sizing: border-box; min-width: 0 } }`, `:45-53` `.dom-root button:not(.dom-btn):not(.dom-modal-close) { font: inherit; color: inherit; cursor: pointer; background: transparent; border: 0; padding: 0; text-align: left }`, `:54-57` `.dom-root input, .dom-root textarea { font: inherit; color: inherit }`(preflight와 완전 동일). 세 겹 중 값을 더하는 것은 cursor·min-width:0·border:0·padding:0·text-align:left·ol/ul 리셋뿐. 레이어 순서(base < dom-reset < 비레이어)상 값이 같아 중복 제거 결과 동일. 부수 관찰: dom-reset의 `:not(.dom-btn):not(.dom-modal-close)` 제외는 preflight가 이미 모든 버튼의 UA 기본을 벗기므로 '버튼 기본 유지' 의도가 성립하지 않음(C74 메모와 일치).
- **제안(작은 대안)**: `globals.css:27-33` 블록만 삭제(확실한 중복; `a`는 UA 기본이 inherit), `:35-37` `button{cursor:pointer}` 유지, dom-reset은 그대로. **단독 PR 금지** — C76 죽은 선언 정리 또는 C74 메모에 흡수.
- **주의점**: G21에서 preflight 유지 결정이 선행돼야 한다(preflight를 빼면 이 중복이 오히려 필요한 리셋이 됨). 5,707줄에서 10여 줄 동치 선언 제거는 측정 가능한 유지보수 가치가 없어 value 1표 상실.

### G24 — globals.css `@theme inline` 죽은 토큰 2개 + 폰트 스택 3겹 (impact 1 / S / low / 1)
- **문제**: `globals.css:12-17` `@theme inline { --color-background: var(--background); --color-foreground: var(--foreground); --font-sans: var(--font-app-sans); --font-mono: var(--font-app-mono); }` — `bg-background`/`text-foreground` 유틸리티는 src 어디에도 없고(grep 0) 빌드 청크 @layer theme에도 미방출(방출된 theme 변수: --font-sans --font-app-sans --font-mono --font-app-mono --color-white --spacing --text-* --font-weight-* --tracking-widest --radius-* --default-*); 두 값은 body(`:19-25`)가 `var(--background)`/`var(--foreground)`로 직접 씀 → Tailwind 토큰화는 완전히 죽은 선언. `--font-sans: var(--font-app-sans)`(`:6-9`, 한국어 폴백 없음)는 preflight `html { font-family: var(--default-font-family …) }`에만 영향(청크 `html,:host{… font-family:var(--default-font-family,…)}` + `--default-font-family:var(--font-app-sans)`), 바로 아래 body(`:19-25`)가 한국어 폴백 포함 다른 스택으로 덮고, 다시 `.dom-stage`(`css:4-5,22`)가 `--font-body`로 덮음 — html 레벨 스택은 어디서도 보이지 않음. `theme.ts:210` `vars["--font-sans"] = t.sans`는 CSS 소비처 0(C07의 죽은 토큰 목록과 동일 항목).
- **제안(작은 대안)**: `globals.css:13-14`(--color-background/--color-foreground)와 `theme.ts:210`(--font-sans) 세 줄 삭제; `--background`/`--foreground`는 `:root`에 그대로, body가 직접 사용. `--font-sans`/`--font-mono` 매핑 정리는 G22 적용 뒤(한국어 폴백 포함 body 스택을 `--font-app-sans` 한 곳에 모아 html/body가 같은 스택을 보게 할지는 선택).
- **영향 범위**: globals.css, theme.ts(C07과 같은 PR).
- **검증**: typecheck + `/`·`/signin` 폰트 육안(--font-sans 매핑을 지우면 html 스택이 Tailwind 기본 ui-sans-serif로 바뀌지만 body가 즉시 덮어 보이지 않음).
- **주의점**: `--font-mono` 제거는 G22 적용 뒤에만. themeStyleVars(`theme.ts:194-214`)는 `shared-card-view.tsx:21-27` /s 페이지 inline style에도 쓰이므로 `--font-sans` 키 제거가 렌더에 영향 없는지(소비처 0이라 없음) 한 번 확인. '토큰을 Tailwind에 매핑하는 관행이 있다'는 오해를 없애 globals.css 의도를 분명히 하는 작은 정리.

---

## 4. 보류/탈락 후보 (7개 — 1차 5 + 2차 2)

| ID | 제목 | 탈락 사유 |
|---|---|---|
| G09 | 부분 메모 컴포넌트 3곳(DayDetail·MonthlyView·JournalProvider)의 pruned 메모 블록 원인 확인 | 수치는 정확히 재현됨(DayDetail 184슬롯 pruned 1블록/23값, MonthlyView 118슬롯 4/12, JournalProvider 114슬롯 4/4, 나머지 90개 함수 0; monthly-view.tsx:1-26 'use client' 없음)이나 'pruned'는 컴파일러가 그 값의 메모를 포기했다는 뜻이고 그 값은 오늘과 똑같이 매 렌더 재계산될 뿐 — 결함이 아니라 '이득이 덜 생기는 지점'이며 후보 스스로 원인을 모른다고 적음. G01 채택이 전제이고 채택해도 '현상 유지'라 측정 가능한 이득 없음. 기존 분해 후보(C50·C52·C79)의 완료 조건에 'pruned 0'을 넣으면 분해 작업이 컴파일러 사정에 끌려가 과잉 제약. G01 채택 후 DayDetail/MonthlyView에서 실제 jank가 관측될 때만 플레이그라운드로 확인. (votesKeep 1/3) |
| G10 | 수동 메모 69곳(useMemo 34·useCallback 35) 처리 정책 — 일괄 제거 금지·신규 추가 중단·queryKey useMemo 2곳 즉시 제거 | 집계는 대략 맞고(grep useMemo 37·useCallback 39 언급, memo() 0) 일괄 제거 금지 원칙도 옳지만, 핵심 실행 항목 'queryKey useMemo 2곳(best-of.ts:215, use-journal.tsx:228) 즉시 제거 가능'이 틀림 — best-of.ts:215 queryKey는 :294 useEffect deps에, use-journal.tsx:228 queryKey는 :1087 moveSlot useCallback deps에 들어가므로 useMemo를 빼면 매 렌더 새 배열이 되어 이펙트/콜백이 매 렌더 재생성(use-journal 쪽은 컨텍스트 value까지 연쇄). '트리비얼'이 아니라 deps 안정성 때문에 존재 — **제거 금지**. 나머지는 정책 메모라 코드 문제가 아니며 G01 채택 시 AGENTS.md 한 줄('새 useMemo/useCallback은 컴파일러가 못 다루는 경우에만')로 충분 — G01 주의점에 반영. (votesKeep 1/3) |
| C29 | 세 영속 모드(signed-in/guest/unconfigured)를 전략 객체로 분리 | 흩어진 모드 술어는 사실이나 세 표현은 의도된 차이(mutationFn 상위집합 vs `!configured` write-through vs 백필 signed-in 한정). L 규모로 테스트 없이 onMutate 동기 write-through 순서·withTimeout·moveSlot 체인을 갈아끼우는 회귀 면이 너무 넓고, 호출자 1개를 위한 3구현 인터페이스는 과잉. unconfigured는 'bare local dev' 전용. 대안: 모드 값을 하나로 계산하되 mutationFn의 `!supabase \|\| !userId` 의미 보존, app:461 isGuest(authLoading 포함)는 그대로. |
| C55 | 포스터 마크업이 보드·profile-stats를 손으로 복제 → 공용 컴포넌트 | '드리프트' 대부분이 의도된 분기(포스터는 훅 없이 스냅샷 기본 언어 렌더, 서버 /s 페이지). 진짜 무의도 드리프트는 헤더 별점(share-posters.tsx:90-93 vs weekly-grid.tsx:383-387) 1건. 보드 셀은 button+DnD+data-today, 포스터는 div로 구조가 다르고 CSS 오버라이드(2963-3049)는 클래스 공유의 결과라 컴포넌트 공유로 해결 안 됨. L/최고 회귀 면. 대안: 별점 1건 결정, dom-day-meta 잎(share-posters:102-112 ≈ weekly-grid:407-417)만 추출하거나 상호 참조 주석. |
| C67 | Optimistic mutation onMutate/onError/onSettled 삼중주 3회 → optimisticUpdate 헬퍼 | 공통분모는 '이전 값 저장/복원' 4줄뿐. journal 두 개는 optimistic===false 게이트·`!configured` write-through·onSettled 게이트·토스트가 있고 bestOf는 없음. 옵션 달린 헬퍼는 절약량(~40줄)만큼 길어지고 moveSlot 계약(use-journal.tsx:465-483)을 가림. 대안: use-journal 안에서 snapshot()/restore(prev)만, `if (ctx?.previous)` 조건 유지. |
| C74 | @layer dom-reset 스코프를 .dom-root → .dom-stage로 넓혀 모달 자체 리셋 13곳 제거 | 원인 서술이 틀림 — globals.css:1 Tailwind v4 preflight가 문서 전체에 margin/padding/border/button 리셋을 이미 적용하므로 자체 리셋 선언은 스코프와 무관한 중복. dom-reset이 추가로 주는 것은 text-align:left·min-width:0뿐, 스코프 확대 효과는 4078 보정 1건. 죽은 선언 삭제는 C76에 흡수. 수행 시 레이어 주석(30-35)에 preflight 의존 명시. |
| C88 | Docker·env 설정 중복(dev env 2중, .dockerignore 비대칭, Node 미고정, Supabase 접근 3방식) | env 중복(Dockerfile.dev:18-21 ≡ docker-compose.dev.yml:33-36)·Node 22 vs 로컬 20·.dockerignore 비대칭은 사실이나 저변경 파일. '3방식'은 과장 — route.ts의 createClient 2개는 권한이 다른 의도된 분리, page.tsx REST fetch는 서버 번들에 supabase-js 미포함 선택. src/lib/env.ts(zod)는 NEXT_PUBLIC_* 리터럴 인라인 제약·Supabase 선택 사항과 충돌해 위험. 대안: engines/.nvmrc 한 줄 + compose.dev env 블록 삭제만. |

---

## 5. 미검증 후보

없음.

---

## 6. 부수 발견 (버그 의심 — 리팩토링과 별개로 고칠 것)

중복 제거·병합 후 1차 31건 + 2차(접근성·번들) 6건. 관련 후보가 있으면 괄호로 표기.

**접근성·번들 결함(2차 조사, 해당 G 후보가 곧 수정안)**
- **모달 키보드 Tab 누출·포커스 미진입** — `modal.tsx:184-196` aria-modal은 AT 트리만 가리고 Tab 트랩·inert가 없어(`css:4815` 주석뿐) 데스크톱에서 모달이 열린 채 Tab이 스크림 뒤 그리드로 빠지고, 8개 호출처에서는 열려도 포커스가 오프너에 남는다. (G11)
- **PosterFit 줌을 키보드로 열면 포커스가 body로 떨어지고 닫아도 복원 없음** — `poster-fit.tsx:140-151` 오프너 언마운트 + `:153-176` 포털 다이얼로그에 focus() 없음. (G12)
- **WeekPicker aria-modal 모순** — `week-picker.tsx:107-116` aria-modal="true"인데 데스크톱 포커스는 바깥 오프너(`:85-94`). (G12)
- **Stars가 항상 5점으로 읽힘** — `atoms.tsx:93-121` 값과 무관하게 '★★★★★' 텍스트, aria 없음(소비처 5). (G15)
- **DomSelect non-searchable ↑/↓ 시 스크린리더가 옵션을 못 읽음** — `dom-select.tsx:176-187` button에 aria-activedescendant(ARIA 1.2 불허). (G13)
- **로컬 `next build`와 Docker 빌드의 CSS 청크가 다름** — Tailwind 자동 스캔이 mobile/(.dockerignore:12-13 제외)의 NativeWind 클래스 49개를 로컬 빌드에만 넣어 utilities 85 vs 33, 청크 해시 상이. 빌드 CSS에 `.tracking-\[6px\]`·`.text-4xl`·`.bg-white\/10`이 실제로 존재(src grep 0). (G20)
- **auth/legal 4페이지의 `--font-mono`가 테마 값이 아니라 Tailwind `@theme inline`의 SFMono 스택** — `.dom-stage`에 폰트 기본값이 없어 `auth-form.tsx:98`·`auth/callback/page.tsx:66`·`terms/page.tsx:15`·`privacy/page.tsx:15`에서 `var(--font-mono)` 110곳이 Tailwind 기본 테마의 `--default-mono-font-family` 참조 덕에 '우연히' 해석된다. (G22)

**사용자 가시 결함**
1. **중첩 모달 Esc 이중 처리** — `share-actions.tsx:84-91` 공개 링크 확인 Modal은 `if (!busy)` 가드가 있지만 `modal.tsx:77-83` window 리스너가 Modal마다 붙고 `day-of-music-app.tsx:325` closeAll도 반응해 확인창에서 Esc를 누르면 부모 공유 모달 전체가 닫힘(링크 생성 진행 중인 채 UI만 사라짐). `dom-select.tsx:128` Esc도 stopPropagation 없어 TweaksPanel 안 드롭다운 Esc가 패널까지 닫음. (C72)
2. **공유 링크 생성 성공 + 클립보드 실패 → orphan 행** — `share-actions.tsx:44-51` await 뒤 clipboard.writeText가 iOS Safari에서 NotAllowedError로 거부될 수 있어 DB 행·레이트 이벤트(0007:232-233)는 소비됐는데 '만들지 못했어요'가 떠 재시도마다 행 추가. 실기기 확인 필요. (C59)
3. **공유 링크 관리자가 만료 링크를 활성처럼 표시** — `profile-page.tsx:301-306, 428-433`이 expires_at을 읽지 않음. get_shared_card RPC는 만료 토큰을 숨기고(0007_exp:33-35) 0008은 30일 뒤 삭제하므로 만료 후 30일간 '열기/복사'가 404. messages.ts:690 '90일 후 만료' 약속에도 UI에 만료일 없음.
4. **복구 경로가 US 스토어로 조회** — `use-journal.tsx:645` fetchAlbumDetail에 country 미전달 → route.ts:22-25 기본 US로 KR 사용자의 레거시 행이 영어 제목으로 복구·저장되고, albumFromDetail이 tracksCountry/tracksVersion을 안 채워 day-detail에서 한 번 더 조회·upsert(앨범당 요청 2회·upsert 2회). (C28)
5. **회원탈퇴 후 행(hang) 가능성** — `auth-provider.tsx:275` `await supabase.auth.signOut()` withTimeout 없음. Safari Web Lock 상황(143-149 주석)에서 계정은 서버에서 삭제됐는데 profile-page.tsx:175-182 handleDelete가 router.replace에 도달 못 하고 'Deleting…' 영구. (C18 대안·C20)
6. **withTimeout 미적용 경로의 영구 pending** — best-of.ts:227(upsert)·279(마이그레이션), share-links.ts:279(insert; share-actions의 `busy`가 영구 true로 '링크 만들기' 버튼 사망), profile-page.tsx:323/428/475, auth-provider.tsx:264(deleteAccount getSession), callback:46. (C20)
7. **삭제 실패 시 성공 토스트만** — `day-of-music-app.tsx:379-386` handleRemove가 결과와 무관하게 '삭제했어요', `use-journal.tsx:425-427` remove.onError는 롤백만 → 항목이 설명 없이 되살아남. (C32)
8. **signInWithGoogle/Kakao가 `{ error }` 폐기** — `auth-provider.tsx:123-126,134-137` 공급자 미설정·네트워크 오류 시 버튼 무반응. (C32)
9. **월간 DnD 하이라이트 깜빡임** — `monthly-view.tsx:299-303` onDragLeave에 relatedTarget 가드 없음(주간 `weekly-grid.tsx:365-369`에서 고친 버그가 월간에 미전파). (C46)
10. **세션 복원 중 깜빡임** — `home-landing.tsx:92`가 loading을 보지 않아 새로고침 직후 로그인 사용자에게 '로그인/회원가입' 링크가 잠깐 보임(app:461, shared-card-cta:17은 고려). (C34 대안)
11. **가짜 트랙 재생 시간** — `day-detail.tsx:44-50, 274` trackTime(i, seed)가 인덱스 기반 결정적 가짜 값(2:00~5:20)을 실제 길이처럼 표시. duration 제공 여부 확인 후 실제 값으로 바꾸거나 표시 제거.
12. **Best-of 자정 롤오버 기대 불일치** — `day-of-music-app.tsx:61-66`은 today를 모듈 레벨 캐시('열린 탭은 자정에 롤오버하지 않음')인데 `best-of.ts:354-357` 주석은 'the day unlocks at midnight' — 실제로는 리로드 전까지 잠금 안 풀림. 둘 중 하나는 틀림.
13. **주간 포스터 빈 셀의 외로운 ★** — `share-posters.tsx:90-93` WeekPoster는 `{album?.rating}`을 가드 없이 렌더(MonthPoster 166-171은 `rating > 0`일 때만) → 빈 날/0점에 '★'·'★ 0' 노출 가능(css:1085-1101에 숨김 규칙 없음). `album &&`로 감쌀 것.
14. **add-flow 수동 모드 picked 잔존** — 수동 입력→Continue(:502)→Back→"검색으로 돌아가기"(:343) 뒤에도 picked가 수동 앨범으로 남아 체크 없이 Continue(:496) 활성. 수동 모드 이탈 시 picked 초기화.
15. **OAuth 전용 계정 비밀번호 설정 모순** — `auth-provider.tsx:251-252` 주석은 'OAuth-only 계정은 이 호출로 비밀번호를 처음 설정'이라 하나 `profile-page.tsx:50-51` canChangePassword가 identities에 'email' 없으면 버튼을 숨겨 경로를 막음.
16. **언어 'auto'로 되돌릴 UI 없음** — `language-switch.tsx:12-15`/`more-sheet.tsx:75`에 "auto" 선택지가 없어 한 번 명시 선택(i18n.ts:87)하면 '스토어 국가 따라가기'(profile.ts:32 LanguagePref "auto")로 복귀 불가.

**i18n 누락(C14·C15·C16·C48에 포함되지 않은 것)**
17. 카드 모달 aria-label 'SHARE WEEK'/'SHARE MONTH'/'SHARE CARD'(share-card.tsx:114, month-share-card.tsx:100, stats-share-card.tsx:64), profile-page.tsx:251 "Delete account confirmation", :500 "공유 링크 관리", monthly-view.tsx:204 "★ pick of the month · 이달의 픽"(주석 블록). `dom-select.tsx:209` `Search ${ariaLabel}` 영어 접두 + 번역 라벨 혼합. `profile-stats.tsx:195` `across ${themeLaneLabel} · ${days} days` 영어 고정(messages.ts:532 stats.acrossLanes 키 존재 — 화면 모달에도 쓰이는지 확인). `share-posters.tsx:109,189` 'from 〈…〉' 영어(포스터는 훅 불가 → payload에 라벨 실어야 함).

**데이터·성능**
18. **useBestOf 이전 effect 인스턴스별 중복** — `best-of.ts:254-294` migrated ref가 인스턴스마다라 2~3개 동시 마운트 시 같은 커밋에 중복 upsert + `updateUserMetadata({bestOf:null})` 중복. 멱등이라 손상 없음. (C63)
19. **useBestOf 로딩 상태 부재** — `best-of.ts:206-209, 296-301` query.data 도착 전 `{}`를 읽게 해 버튼이 'todo'로 보이고 그 창에서 모달 마운트 시 useState 초기화(best-of-modal.tsx:89-100)가 '저장 결과 없음'을 스냅샷해 이미 치른 주를 다시 치름(드묾).
20. **method 의미 불일치** — 참가자 1명 자동 챔피언이 `method: "sequential"`로 저장(best-of-modal.tsx:110; State는 null로 구분 :97). DB check(0009:23)가 'bye'를 표현 못 해 생긴 타협.
21. **게스트 set 스냅샷** — `best-of.ts:305` 렌더 시점 `local`을 spread — 한 렌더에서 set 2회면 앞 결과 유실(현재 호출자 모두 1회).
22. **렌더 중 `new Date()`** — `profile-stats.tsx:40-46`(today 스토어 우회, 현재는 클라이언트 전용 전환이라 잠복), `home-landing.tsx:157` getFullYear(연도 경계 1회 SSR/CSR 불일치, 영향 미미).
23. **add-flow urlAlbum.isError 불가** — `add-flow.tsx:172-180,211` fetchAlbumDetail(music-search.ts:50-57)이 모든 실패를 null로 삼켜 isError 절대 true 아님·retry:1 무동작·urlNotFound가 '없는 앨범'과 '네트워크 실패'를 구분 못 함. (C38)
24. **i18n-iso-countries 5개 카탈로그 전부 번들** — `profile.ts:10-14,22-26` 모듈 스코프 import·registerLocale(≈34KB raw) → 프로필을 열지 않는 사용자도 포함. 동적 import 전환 가능.

**주석·설정 노후(코드 영향 없음)**
25. **파비콘 이중 선언·스테일 주석** — `public/sw.js:1-2` 'favicon.ico removed in favour of app/icon.png'이나 src/app/favicon.ico 존재·app/icon.png 없음. `layout.tsx:19-21` 'app/icon 파일 컨벤션이 아니라 명시 선언'이라 하나 app/favicon.ico 규약(app-icons.md:30-33)으로 `<link rel="icon">` 추가 emit → icon link 두 종류. 하나 지우고 주석 정정. **1차 조사는 sw.js를 이 주석(:1-2)만 인용하고 캐시 정책 본문(`sw.js:94-108` 동일 출처 모든 `navigate` 응답을 조건 없이 Cache Storage에 저장)은 읽지 않았다 — /s/<token> 스냅샷·/auth/callback?code= 응답이 만료 후에도 CACHE_NAME 범프 전까지 뷰어 브라우저에 남는 문제는 §8 추가 조사(PWA)로.**
26. `profile.ts:107` '(see useCountries in profile-page)' — profile-page에 useCountries 없음(636-639 useMemo). `api/account/route.ts:6-7` cascade 목록에 best_of·shared_card_creation_events 누락. (C37)
27. `auth-provider.tsx:286` updateUserMetadata가 setSession으로 수동 패치 + onAuthStateChange(USER_UPDATED)도 재set — 이중 갱신(무해). (C32)
28. `auth-provider.tsx:33,294` AuthContextValue.accessToken dead 필드(deleteAccount는 :264에서 getSession 재호출). `use-journal.tsx:81,672` persisted 외부 소비자 없음. (C26)
29. `search/route.ts:66-69` mapResult album 분기의 `?? r.trackId ?? r.artistId` 폴백은 379bfab 이전 잔재(entity=album에서 도달 안 함). `album/route.ts:48-51` collectionIdFromParam은 `itrack-<coll>-<track>`을 조용히 앨범 id로 해석(호출자 3곳이 접두 확인해 실제 문제 없음). `MusicSearchResult.trackCount`(music-search.ts:18)·`AlbumDetail.trackCount`(music-types.ts:25) 미사용.
30. `messages.ts:6-9` 범위 주석('header, Tweaks panel, Profile만')이 29개 네임스페이스 현실과 불일치; 메모리 i18n-system.md의 "Only header / Tweaks / Profile are migrated so far"도 낡음. 메모리 best-of-tournament.md는 'Week only', 'user_metadata.bestOf 저장', 'weekKey 보관' 등 테이블 이전·월간 구현 이전 상태 — 리팩토링 시 함께 갱신.
31. `0007_abuse_limits.sql:159,174` if not exists 없음(재실행 시 첫 문장 실패). `eslint.config.mjs:12`·`.gitignore:45` `.next-verify/` 출처 불명. `mobile/eas.json:27` 개인 Apple ID. get_shared_card RPC가 created_at을 반환(0006:38-47)하나 클라이언트는 payload만 읽음(s/[token]/page.tsx:41-42). `day-of-music.css:4967-4969` `.dom-root:has(.dom-input:focus) .dom-tabbar{display:none}`은 모달 안 입력에 닿지 않음(스크림이 탭바를 덮어 현재는 비가시). madge --circular는 `@/` alias 미해석으로 share-links↔share-artwork 순환을 못 잡음(CI에 넣으려면 tsconfig 경로 전달). 커밋 4bbc167은 제목이 브랜치 태그뿐.

---

## 7. 영역별 현황 메모

- **app-shell**: 서버는 날짜/메타만 주고 클라이언트 셸이 전부 담당. `day-of-music-app.tsx`(653줄)가 오버레이 10개 useState·내비·핸들러 7개·Tweaks 스토어를 모두 들고 있고(C01·C02·C03·C04), 탭 상태가 URL에 없으며(C05), 테마·폰트·브랜드·lang 같은 셸 공통 관심사가 페이지마다 다른 방식(C07·C08·C09·C12). privacy/terms 크롬 복제, error/not-found 부재, 미사용 의존성 3개.
- **journal-persistence**: `use-journal.tsx`(684줄)가 Supabase/localStorage I/O·전역 스토어·파생·콜백·복구 effect를 한 파일에. TanStack 캐시 단일 출처 설계는 일관되고 데이터 손실 급 버그는 없음. 앨범 메타 풀 이중(C22), 세 영속 모드 분기 반복, Album 타입이 메타+오버레이 혼합(C24), JournalRow 수기 타입(C21), makeJsonStore 미사용(C23), data.ts 빈 카탈로그 잔재(C25).
- **auth-profile**: `profile-page.tsx` 775줄에 계정 액션·설정 폼·테마 편집기·공유 링크 모달(유일한 컴포넌트 내 직접 쿼리) 동거(C30). auth-provider는 인증 + 90줄 유휴 로그아웃(C31), 메서드별 에러 계약·타임아웃 제각각(C20·C32). user_metadata as 캐스트 3모듈(C35), 게스트/로그인 판정 8곳 재계산, i18n 미완 50곳+(C15). /api/account는 토큰 해석은 올바르나 에러 노출·로그 부재(C37).
- **add-flow-search**: 10/23 KR 현지화 수정 3연속으로 서버 라우트 구조 부채 급증. album GET 230줄 단일 함수(C39), iTunes fetch 5곳·행 타입 3벌·MusicSearchResult 이중(C38), fetchAlbumDetail 3곳 정책 상이(C28), add-flow 16 useState·빈 카탈로그 병합·호출자 없는 artist/track 경로(C40·C41). 검증은 라우트 JSON 전후 비교.
- **calendar-views**: 코드 품질·주석 높고 큰 설계 결함 없음. 같은 날짜 계산·셀 행위·통계·Best-of 버튼이 주/월/공유/피커에 복제(C45·C46·C47·C53), 날짜 산술 3스타일 혼재, i18n(useDateNames)과 EN/KO 하드코딩 상수 공존으로 WeekPicker 이중 DOM(C48). week-picker 3컴포넌트·day-detail 다책임(C49·C50), cover.tsx 캡션 11회(C51).
- **share-export**: 설계 의도 분명(zod 스냅샷 payload, 훅 없는 포스터가 모달·PNG·/s 공용). share-links↔share-artwork 순환·서버 번들 오염(C54), 세 모달 셸·빌더 비대칭(C57), Georgia 워크어라운드 잔존(C56), zod enum 분리(C58), 에러 뭉개짐(C59), 1100/760 매직넘버(C13). 포스터 마크업 공용화(C55)만 탈락.
- **best-of**: 5파일 922줄, 브래킷 수학은 순수. best-of.ts에 네 관심사 혼재·죽은 export 9개(C62), pick/저장이 컴포넌트 안 두 경로 + 유일 exhaustive-deps disable(C63·C64), 주/월 상태 훅·래퍼 중복(C65), 이전 코드 인스턴스별 실행. Year 확장은 상태 사다리 resolver + 기간 설정 테이블화면 설정 한 줄.
- **i18n-theme**: 5개 로케일 완비·플레이스홀더 불일치 0·사용 키 244개 전부 정의. MESSAGES가 Record<string>(C68), i18n.ts 'use client'+useProfile 체인(C69), theme/themes 이름 충돌(C70), Tweaks 수제 스토어(C01), 죽은 테마 토큰(C07), profile-page·dom-select·save-card·auth-provider·공유 aria 미이관(C14·C15·C16). tweaks-panel은 프로덕션 코드 맞음.
- **ui-primitives-css**: 프리미티브는 얇고 잘 쓰임. CSS 5,707줄·폰 블록 7개가 '소스 순서로 이긴다'에 의존(C71), 타이포 패턴 토큰 없이 복제·클래스 차용(C75), 죽은 CSS 14개·Chip/Accordion(C76), 오버레이 닫기 분산 + 중첩 Esc 버그(C72), Modal 패널 표면 7벌(C73), 별점 3벌(C77).
- **duplication**: 단일 출처 모듈(local-store, music-types, album-stats, password, modal)이 이미 있는데 주변이 따라오지 않음. iTunes 5중(C38), Supabase 보일러플레이트 절반 적용(C20), localStorage 3회 재구현(C23), 날짜 산술(C45), 공유/Best-of 모달 테마 라벨·핸들·통계·셸(C53·C57·C66). CSS ≤760 7블록·모노 아이레이블 8곳.
- **architecture**: lib/components 2계층 유지, 서버 렌더 모듈은 훅 없이 격리됨. lib 4파일이 auth-provider 역의존(C78), 셸 갓 컴포넌트, best-of/profile/use-journal 순수·훅·IO 혼재(C62·C79). 'use client'는 38개 중 29개(monthly-view만 불일치, C52). 서버 컴포넌트 확대의 근본 장애는 i18n이 클라이언트 상태 의존(쿠키 locale 필요 — 후보 제외). 죽은 코드: 카탈로그 잔재, Accordion/Chip, accessToken/getByDate/persisted, 주석 55줄, 의존성 3개.
- **data-async**: Supabase 접근 10곳(UI 직접 3곳). react-query는 저널·Best-of·검색만, 공유 링크 목록은 수제 페칭(C30). withTimeout 6/14곳, abortSignal 미사용(C20). 에러 피드백: upsert만 토스트, delete·best_of·metadata 조용(C32), 토스트가 lib에 하드코딩(C14). 라우트는 zod·revalidate 사용하나 iTunes 5곳 복붙·타임아웃 없음(C38). album jsonb·localStorage 블롭 무검증(C81).
- **hygiene**: src는 깨끗하나 저장소 바깥은 5개월 전 프로토타입 시점에 멈춤. mobile/ 고아(C86), design_handoff 3,787줄(C87), migrations 0007 중복·README '0001만'(C61), 죽은 설정·자산·README/manifest(C87), 테스트·CI·Node 고정 없음·prettier 미포맷 48/75(C83·C84), noUnusedLocals/Parameters 즉시 가능(C85).

**2차 조사 영역(비평가 지적 공백)**
- **react-compiler(결정 전제)**: Next 16에서 stable·opt-in이며 현재 미채택(설정·플러그인 없음). 드라이런으로 'use client' 파일 93개 함수가 컴파일되고 bail-out 6건(try/finally 2, `as string` 계산 키 2, IIFE throw 1, exhaustive-deps 억제 1)이 AuthProvider·ShareActions·WeeklyGrid·WeekPoster·useBestOf·BestOfModal을 통째로 비껴간다 — 린트로는 보이지 않음(G02·G03·G08). 수동 메모 후보 4개의 결론은 채택 여부와 거의 무관하게 수렴: account/onAdd는 상수 2개(G04), i18n 훅 메모는 할 일 없음(G05), memo(Cover)는 불필요(G06), useBestOf set은 `const { mutate } = upsert`로만 안정화(G07). 번들 +40KB gzip·컴파일 +60%는 확정 비용이고 측정된 렌더 문제가 없어 **권장은 보류**(G01), annotation 모드로 좁게 실험 가능. queryKey useMemo 2곳은 deps 안정성 때문에 존재 — 제거 금지(G10 탈락 사유).
- **접근성(1차 13개 관점 어디에도 없던 영역)**: 공용 Modal에 포커스 생명주기(진입·Tab 트랩·복원)가 전혀 없어 10개 호출처가 각자 때우거나 방치하고 수동 복원이 3벌(G11); Modal 밖 dialog 3곳(WeekPicker·PosterFit 줌·TweaksPanel)은 서로 다른 불완전한 정책(G12). 네이티브 `<dialog>`·루트 inert는 PosterFit 포털·profile-page 모달 위치 때문에 drop-in 불가. 그 외는 속성 추가로 끝나는 S/low 항목들 — DomSelect combobox(G13), Modal labelledBy(G14), Stars role=img(G15), 토글 aria-pressed(G16), DayDetail 탭(G17), 팝오버 트리거(G18), IconButton 타입(G19). 저장소 안에 이미 참조 패턴(DayPicker aria-pressed+로빙, MoreSheet radiogroup)이 있어 통일 비용이 낮다.
- **bundle-tailwind**: `@import "tailwindcss"` 한 줄이 루트 전체를 스캔해 mobile/·design_handoff·SQL·README·compose의 토큰을 utilities로 만들고(루트 85 vs src 29 vs 의도 5), 로컬·Docker 빌드 CSS가 달라진다(G20 — `source("../")` 한 줄). 의도된 유틸리티는 layout.tsx 5개뿐이라 utilities 레이어 존치는 C19 정책 결정 사항(G21). `.dom-stage` 폰트 기본값이 없어 110곳의 `var(--font-mono)`가 Tailwind `@theme inline` 방출에 묵시 의존(G22 — 두 줄 추가, G24 전에). 폼 리셋 3중(G23)과 `@theme inline` 죽은 토큰(G24)은 작은 정리. preflight는 어떤 결정에서도 유지.

---

## 8. 추가 조사 필요 (이번 2차에서 다루지 못함)

세 항목 모두 리팩토링 후보로 확정하지 않고 조사 과제로 기록한다. 증거 줄번호는 1차·2차 조사자가 읽은 범위이며 각 항목의 '리팩토링 후보' 서술은 아직 리뷰어 3관점 검증을 거치지 않았다.

- **PWA — 서비스워커의 내비게이션 캐시 범위** (보고서는 `sw.js:1-2` 주석만 인용, 캐시 정책 자체는 미조사). 관련: `public/sw.js:7-13,60-62,94-108`, `src/components/service-worker-register.tsx:11-36`, `src/app/week/page.tsx:9`, `src/app/s/[token]/page.tsx:1-5,18-19`, `supabase/migrations/0007_shared_card_expiration.sql:27-37`, `src/app/manifest.ts:16-31`, `src/app/layout.tsx:22-31`. sw.js는 동일 출처의 모든 `navigate` 응답을 조건 없이 Cache Storage에 저장한다(`:100-101`). 따라서 토큰이 곧 비밀인 `/s/<token>` 스냅샷 HTML이 뷰어 브라우저에 만료·삭제(0007_exp가 RPC에서 숨기고 0008이 purge) 이후에도 CACHE_NAME 범프 전까지 남고, `/auth/callback?code=` 응답도 캐시된다; force-dynamic인 `/week` HTML(요청별 today)도 오프라인 폴백으로 재사용된다. 또 아이콘 경로 목록이 sw.js·manifest.ts·layout.tsx 세 곳에 복제돼 있다. 리팩토링 후보는 (1) networkFirstPage를 앱 셸 경로 allowlist(또는 `/s/`,`/auth/`,`/api/` denylist)로 좁히기, (2) 아이콘 목록 단일 출처. 개발 모드는 SW를 해제하므로(`service-worker-register.tsx:11-31`) Docker dev에서 검증 불가 — prod 이미지로 확인 필요. SW는 c8729e0/b4c72ff 이후 미수정. **impact 2 / S / risk med**(CACHE_NAME 범프·프로드 검증 필요).
- **이미지 로딩 — 보드/검색의 아트워크 `<img>`에 lazy·decoding·크기 변형 없음** (C87은 no-img-element/remotePatterns만 다룸). 관련: `src/components/day-of-music/cover.tsx:36-46`, `src/app/api/music/search/route.ts:80-81`(600x600bb 고정), `src/components/day-of-music/monthly-view.tsx:256-345`(최대 31셀 eager), `weekly-grid.tsx:388-404`, `add-flow.tsx:278`(56px)·`:452`(88px), `search-view.tsx:116`, `src/lib/day-of-music/save-card.ts:1-35`. Cover는 어떤 표시 크기(56px 결과 행~161px 주간 셀)에서도 라우트가 치환한 600x600 변형을 eager로 받고 `loading`/`decoding` 속성이 없다. 월간 보기는 최대 31개를 동시에 요청한다. 반면 포스터/PNG 내보내기 경로(save-card, crossOrigin)는 반드시 eager+CORS여야 하므로 보드·검색 컨텍스트에만 `loading="lazy"`와 `artworkVariant(url, px)` 헬퍼(100x100bb→N×Nbb 템플릿 치환은 이미 `search/route.ts:81` 패턴)를 적용하는 식으로 범위를 좁혀야 한다. 보고서의 perf 항목(C44·C51·C82)은 모두 미측정이라 **월간 보기 Network 실측 1회(0차 기준표)가 선행 조건**. **impact 2 / S / risk low**(포스터 경로 제외 시).
- **API 남용 면 — 인증·출처 검사 없는 iTunes 프록시의 요청당 팬아웃** (C38은 중복·타임아웃만 다룸). 관련: `src/app/api/music/search/route.ts:4-5,22,107-108,138-168,189-196`, `src/app/api/music/album/route.ts:81,120-124`, `src/lib/day-of-music/itunes-lookup.ts:43-68,84-92`, `supabase/migrations/0007_abuse_limits.sql:1-14`. `/api/music/search`는 요청 1건당 최대 5개 스토어 순차 검색 + localize 1~2회(앨범 재현지화는 lookup 2회)로 업스트림 호출이 최대 7회이고 `limit`은 200까지 허용되는데, 호출자 검사(Sec-Fetch-Site/Origin)·스로틀·업스트림 타임아웃이 전혀 없다. DB 쪽은 0007_abuse_limits에서 '클라이언트 검증은 편의일 뿐'이라는 원칙으로 한도를 DB에 두었지만 같은 원칙이 Route Handler에는 적용되지 않았다. 게이팅 자체는 정책/기능 결정이므로 리팩토링 후보로 넣기보다 **C38 PR에서 함께 결정할 항목으로 분리 조사만 권장**. **impact 2 / S / low**.

---

## 9. 2차 검증에서 정정한 1차 보고서 항목

비평가가 지적한 보고서 자체의 오류·누락. 본문에는 이미 반영했고, 추적을 위해 요약한다.

1. **요약 문장과 표의 impact 4 개수 불일치** — 1차 요약은 'impact 4는 6개(C01·C22·C45·C68·C83 + C14/C20 묶음)'라 했으나 표에서 C14·C20은 impact 3이고 impact 4 행은 정확히 5개(C01·C68·C45·C83·C22). 요약을 5개로 정정(2차 G 후보 중 impact 4는 없음).
2. **실행 순서 모순** — C23(2차)의 제안에 'tweaks 스토어를 makeJsonStore(normalize)로(C01과 동일)'가 들어 있어 같은 변경이 두 묶음에 중복 배정돼 있었고, C01은 표 최상위(impact 4/S/low, reportedBy 6)이며 오버레이 작업(C02·C04·C72)과 독립인데 파일 친화도만으로 3차까지 밀려 있었다. C01을 1차 첫 항목으로 당기고 C23에서 tweaks 부분을 뺐다.
3. **C19·C86의 Tailwind 전제 오류** — 'Tailwind 유틸은 layout.tsx:52-53 2개뿐'(C19)과 'mobile/ 삭제는 웹 빌드·typecheck·lint에 영향 없음'(C86)은 빌드 CSS에 mobile/의 NativeWind 유틸리티 49개가 섞여 나오는 사실(`.next/static/chunks/11~yhc~9._3gj.css`)을 놓쳤다 — G20 참조. C86 결정이 CSS 번들에도 (긍정적) 영향을 준다고 정정, C19에 G20 한 줄을 같은 커밋으로 묶음.
4. **C11 근거 줄번호** — '.gitignore(:44) next-env.d.ts'는 실제 45행(44행은 `*.tsbuildinfo`). 결론(fresh clone에서 PageProps 깨짐 가능)은 유효.
5. **C43 t() 섀도잉 누락** — 5곳 목록에 `profile-stats.tsx:78` `themeRecaps.find((t) => t.id …)`가 빠져 있었다 — 6번째로 추가.
6. **C72가 포커스 관리 부재를 문제로 세우지 않음** — '포커스 복원 2벌(week-picker:90-94, more-sheet:31-35)'을 적시하고도 Esc 통합만 제안했고, 13개 조사 관점 어디에도 접근성 후보가 없어 관점 자체가 빠져 있었다. 포커스 진입/트랩/복원은 Esc와 별개의 생명주기이므로 G11·G12로 분리하고 접근성 묶음(G13~G19)을 1차에 신설.
7. **perf 카테고리 전체 미측정** — C44('측정치 없음'), C51('미측정'), C82 모두 실측 없이 서술되고 번들 분석(@next/bundle-analyzer 미설치, `next build` 산출 크기 인용 0)도 없었다. 0차에 `next build` 크기 기준표 1회를 넣어 C19·#24·G01·§8 이미지/PWA의 우선순위 근거로 삼는다. G01의 번들·시간 수치는 후보 측 실측이며 리뷰에서 재측정하지 않았음을 명시.
8. **#25·C87이 sw.js/manifest.ts를 주석·description 문제로만 다룸** — 캐시 정책(모든 내비게이션 응답 저장, `sw.js:94-108`)은 읽지 않았다. 증거가 `sw.js:1-2` 한 줄뿐인 것이 그 흔적 — §8 PWA 추가 조사로 기록.
9. **200줄 이상 파일 커버리지** — src/ 27개 파일 모두 보고서에 언급됨. 지나가듯만 언급된 `use-swipe-nav.ts`(247줄, C13 re-export·C46 IGNORE_WITHIN)와 `poster-fit.tsx`(179줄)는 2차에서 전체를 읽어 확인 — 단일 책임·주석 충실·추출 후보 없음('정말 깨끗해서' 맞음). `modal.tsx`(219줄)는 Esc·드래그만 다뤄졌고 포커스 관리 공백은 G11에 기재.

**검증 결과 1차 보고서가 인용한 외부 근거는 대체로 정확함**: C85 allowJs(`writeConfigurationDefaults.js:110-111` `suggested:true`, `:250-253` 키 부재 시만 기록), C17 unstable_retry(`error.md:27-30`), C05 pushState 통합(`04-linking-and-navigating.md`), C71 '단일 엔트리 파일' 권고(`11-css.md:444`), C83 `vitest.md` 존재, C61의 0007/0008/0009 행 번호, C01·C68·C22·C13의 소스 행 번호, 기준선(eslint-disable 5곳, any 0), C80의 'useJournal 소비자 전부 /week 트리'(호출 13곳) 모두 일치.
