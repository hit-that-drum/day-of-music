// messages.ts — UI copy for the five supported languages (EN · KO · JP · CN · SP).
// Key-first so each string's five translations sit together (easy to review and
// spot gaps). Typed as Record<Locale, string> per key so a missing translation
// is a compile error. `{name}` tokens are filled by translate() in i18n.ts.
//
// Scope: the always-visible app chrome — header, Tweaks panel, and the Profile
// settings surface. Deeper flows (add-flow, day detail, share, auth, the
// Profile modals/toasts) still carry their original copy and migrate to these
// keys incrementally using the same t() calls.

import type { Locale } from "@/lib/day-of-music/i18n";

export const MESSAGES: Record<string, Record<Locale, string>> = {
  // ── Header nav ──────────────────────────────────────────────────────────
  "nav.week": { en: "Week", ko: "주간", ja: "週間", zh: "周", es: "Semana" },
  "nav.month": { en: "Month", ko: "월간", ja: "月間", zh: "月", es: "Mes" },
  "nav.journal": { en: "Journal", ko: "저널", ja: "ジャーナル", zh: "日志", es: "Diario" },
  "nav.logs": { en: "My Logs", ko: "나의 기록", ja: "マイログ", zh: "我的记录", es: "Mis registros" },
  "nav.profile": { en: "Profile", ko: "프로필", ja: "プロフィール", zh: "个人资料", es: "Perfil" },

  // Brand subtitle under the wordmark. EN keeps just the wordmark (empty here).
  "brand.tagline": { en: "", ko: "하루의 음악", ja: "一日の音楽", zh: "每日音乐", es: "Música del día" },

  // ── Header actions ──────────────────────────────────────────────────────
  "actions.signIn": { en: "Sign in", ko: "로그인", ja: "ログイン", zh: "登录", es: "Iniciar sesión" },
  "actions.signUp": { en: "Sign up", ko: "회원가입", ja: "新規登録", zh: "注册", es: "Registrarse" },
  "actions.signOut": { en: "Sign out", ko: "로그아웃", ja: "ログアウト", zh: "退出登录", es: "Cerrar sesión" },
  "lang.label": { en: "Language", ko: "언어", ja: "言語", zh: "语言", es: "Idioma" },

  // ── Guest banner ────────────────────────────────────────────────────────
  "guest.banner": {
    en: "Guest mode — your edits live only in this tab and reset when you leave. ",
    ko: "게스트 모드 — 편집 내용은 이 탭에서만 유지되며 나가면 초기화됩니다. ",
    ja: "ゲストモード — 編集内容はこのタブ内でのみ保持され、離れるとリセットされます。 ",
    zh: "访客模式 — 你的修改仅在此标签页中有效，离开后会被重置。 ",
    es: "Modo invitado: tus cambios solo existen en esta pestaña y se restablecen al salir. ",
  },
  "guest.signup": {
    en: "Sign up to keep your journal",
    ko: "가입하고 기록을 보관하세요",
    ja: "登録して記録を保存",
    zh: "注册以保存你的记录",
    es: "Regístrate para conservar tu diario",
  },

  // ── Tweaks panel ────────────────────────────────────────────────────────
  "tweaks.title": { en: "Tweaks", ko: "꾸미기", ja: "カスタマイズ", zh: "个性化", es: "Ajustes" },
  "tweaks.aesthetic": { en: "Aesthetic", ko: "무드", ja: "スタイル", zh: "风格", es: "Estética" },
  "tweaks.typography": { en: "Typography", ko: "타이포그래피", ja: "タイポグラフィ", zh: "字体", es: "Tipografía" },
  "tweaks.theme": { en: "Theme", ko: "테마", ja: "テーマ", zh: "主题", es: "Tema" },
  "tweaks.layout": { en: "Layout", ko: "레이아웃", ja: "レイアウト", zh: "布局", es: "Diseño" },
  "tweaks.splitWeeks": {
    en: "Split weeks by month",
    ko: "주를 월 단위로 나누기",
    ja: "週を月ごとに分割",
    zh: "按月拆分周",
    es: "Dividir semanas por mes",
  },
  "tweaks.on": { en: "On", ko: "켜짐", ja: "オン", zh: "开", es: "Sí" },
  "tweaks.off": { en: "Off", ko: "꺼짐", ja: "オフ", zh: "关", es: "No" },
  "tweaks.close": { en: "Close", ko: "닫기", ja: "閉じる", zh: "关闭", es: "Cerrar" },

  // ── Profile: headings & sections ────────────────────────────────────────
  "profile.kicker": { en: "profile", ko: "프로필", ja: "プロフィール", zh: "个人资料", es: "perfil" },
  "profile.title": { en: "Profile", ko: "프로필", ja: "プロフィール", zh: "个人资料", es: "Perfil" },
  "profile.section.account": { en: "Account", ko: "계정", ja: "アカウント", zh: "账户", es: "Cuenta" },
  "profile.section.preferences": { en: "Preferences", ko: "환경설정", ja: "環境設定", zh: "偏好设置", es: "Preferencias" },
  "profile.section.themes": { en: "Themes", ko: "테마", ja: "テーマ", zh: "主题", es: "Temas" },
  "profile.section.sharedLinks": { en: "Shared links", ko: "공유 링크", ja: "共有リンク", zh: "分享链接", es: "Enlaces compartidos" },

  // ── Profile: account rows ───────────────────────────────────────────────
  "profile.email": { en: "Email", ko: "이메일", ja: "メール", zh: "邮箱", es: "Correo" },
  "profile.signInRow": { en: "Sign-in", ko: "로그인 방식", ja: "サインイン", zh: "登录方式", es: "Inicio de sesión" },
  "profile.status": { en: "Status", ko: "상태", ja: "ステータス", zh: "状态", es: "Estado" },
  "profile.statusSignedIn": {
    en: "Signed in · synced",
    ko: "로그인됨 · 동기화됨",
    ja: "サインイン済み · 同期済み",
    zh: "已登录 · 已同步",
    es: "Sesión iniciada · sincronizado",
  },
  "profile.guestNote": {
    en: "You're browsing as a guest. Sign in to sync your logs and profile across devices.",
    ko: "게스트로 둘러보는 중입니다. 로그인하면 기록과 프로필이 기기 간에 동기화됩니다.",
    ja: "ゲストとして閲覧中です。サインインすると記録とプロフィールがデバイス間で同期されます。",
    zh: "你正在以访客身份浏览。登录后可在各设备间同步记录和资料。",
    es: "Estás navegando como invitado. Inicia sesión para sincronizar tus registros y perfil entre dispositivos.",
  },
  "profile.localNote": {
    en: "Local mode — your settings are saved on this device only.",
    ko: "로컬 모드 — 설정이 이 기기에만 저장됩니다.",
    ja: "ローカルモード — 設定はこのデバイスにのみ保存されます。",
    zh: "本地模式 — 设置仅保存在此设备上。",
    es: "Modo local: tu configuración se guarda solo en este dispositivo.",
  },

  // ── Profile: preferences form ───────────────────────────────────────────
  "profile.username": { en: "Username", ko: "사용자 이름", ja: "ユーザー名", zh: "用户名", es: "Nombre de usuario" },
  "profile.storeCountry": { en: "Store country", ko: "스토어 국가", ja: "ストアの国", zh: "商店国家/地区", es: "País de la tienda" },
  "profile.searchCountry": { en: "Search country", ko: "국가 검색", ja: "国を検索", zh: "搜索国家/地区", es: "Buscar país" },
  "profile.save": { en: "Save changes", ko: "변경 사항 저장", ja: "変更を保存", zh: "保存更改", es: "Guardar cambios" },
  "profile.settingsNote": {
    en: "Shown as @{handle} on shared images. Music search checks the {country} store first, then the others. ",
    ko: "공유 이미지에 @{handle}로 표시됩니다. 음악 검색은 {country} 스토어를 먼저 확인한 뒤 다른 스토어를 살펴봅니다. ",
    ja: "共有画像に @{handle} として表示されます。音楽検索はまず {country} ストアを確認し、その後で他のストアを検索します。 ",
    zh: "在分享图片中显示为 @{handle}。音乐搜索会先查询 {country} 商店，再查询其他商店。 ",
    es: "Se muestra como @{handle} en las imágenes compartidas. La búsqueda de música consulta primero la tienda de {country} y luego las demás. ",
  },
  "profile.syncedNote": {
    en: "Synced to your account.",
    ko: "계정에 동기화됨.",
    ja: "アカウントに同期済み。",
    zh: "已同步到你的账户。",
    es: "Sincronizado con tu cuenta.",
  },
  "profile.localSaveNote": {
    en: "Saved on this device.",
    ko: "이 기기에 저장됨.",
    ja: "このデバイスに保存済み。",
    zh: "已保存在此设备。",
    es: "Guardado en este dispositivo.",
  },

  // ── Profile: account actions ────────────────────────────────────────────
  "profile.changePassword": { en: "Change password", ko: "비밀번호 변경", ja: "パスワード変更", zh: "修改密码", es: "Cambiar contraseña" },
  "profile.cancel": { en: "Cancel", ko: "취소", ja: "キャンセル", zh: "取消", es: "Cancelar" },
  "profile.deleteAccount": { en: "Delete account", ko: "회원 탈퇴", ja: "アカウント削除", zh: "注销账户", es: "Eliminar cuenta" },

  // ── Profile: theme manager ──────────────────────────────────────────────
  "profile.themes.add": { en: "Add theme", ko: "테마 추가", ja: "テーマを追加", zh: "添加主题", es: "Añadir tema" },
  "profile.themes.save": { en: "Save themes", ko: "테마 저장", ja: "テーマを保存", zh: "保存主题", es: "Guardar temas" },
  "profile.themes.note": {
    en: "Each theme is its own daily lane. {syncNote} Deleting one hides its entries without erasing them from the server.",
    ko: "각 테마는 하나의 하루 레인입니다. {syncNote} 삭제해도 그 테마의 기록은 서버에서 지워지지 않고 숨겨집니다.",
    ja: "各テーマは独立した日々のレーンです。{syncNote} 削除しても、そのテーマの記録はサーバーから消えず非表示になります。",
    zh: "每个主题都是独立的每日轨道。{syncNote} 删除后其记录不会从服务器删除，只会被隐藏。",
    es: "Cada tema es su propia franja diaria. {syncNote} Al eliminar uno, sus entradas se ocultan sin borrarlas del servidor.",
  },

  // ── Profile: shared links summary ───────────────────────────────────────
  "profile.sharedLinks.manage": { en: "Manage links", ko: "공유 링크 관리", ja: "リンクを管理", zh: "管理链接", es: "Gestionar enlaces" },
  "profile.sharedLinks.note": {
    en: "View and manage all the share links you've created in one place.",
    ko: "만든 공유 링크를 한곳에서 확인하고 관리할 수 있습니다.",
    ja: "作成した共有リンクを一か所で確認・管理できます。",
    zh: "在一处查看并管理你创建的所有分享链接。",
    es: "Consulta y gestiona en un solo lugar todos los enlaces que has creado.",
  },

  // ── Shared aria labels (theme editor rows) ──────────────────────────────
  "aria.themeEmoji": { en: "Theme emoji", ko: "테마 이모지", ja: "テーマの絵文字", zh: "主题表情", es: "Emoji del tema" },
  "aria.themeName": { en: "Theme name", ko: "테마 이름", ja: "テーマ名", zh: "主题名称", es: "Nombre del tema" },
  "aria.moveUp": { en: "Move up", ko: "위로 이동", ja: "上へ移動", zh: "上移", es: "Subir" },
  "aria.moveDown": { en: "Move down", ko: "아래로 이동", ja: "下へ移動", zh: "下移", es: "Bajar" },
  "aria.deleteTheme": { en: "Delete theme", ko: "테마 삭제", ja: "テーマを削除", zh: "删除主题", es: "Eliminar tema" },

  // ── Best of Week (tournament) ───────────────────────────────────────────
  "bow.button": { en: "Best of Week", ko: "이 주의 베스트", ja: "今週のベスト", zh: "本周最佳", es: "Mejor de la semana" },
  "bow.title": { en: "Best of Week", ko: "이 주의 베스트", ja: "今週のベスト", zh: "本周最佳", es: "Mejor de la semana" },
  "bow.choose": {
    en: "How should the bracket run?",
    ko: "토너먼트 방식을 골라주세요",
    ja: "トーナメント方式を選んでください",
    zh: "选择对战方式",
    es: "¿Cómo se juega el torneo?",
  },
  "bow.sequential": { en: "Sequential", ko: "순차 토너먼트", ja: "順番トーナメント", zh: "顺序对战", es: "Secuencial" },
  "bow.sequentialDesc": {
    en: "Seed by day order — Mon vs Tue, Wed vs Thu, Fri vs Sat, Sun gets a bye.",
    ko: "요일 순서대로 — 월vs화, 수vs목, 금vs토, 일요일은 부전승.",
    ja: "曜日順 — 月vs火、水vs木、金vs土、日は不戦勝。",
    zh: "按星期顺序 — 周一对周二、周三对周四、周五对周六，周日轮空。",
    es: "Por orden de día — Lun vs Mar, Mié vs Jue, Vie vs Sáb, Dom con pase.",
  },
  "bow.random": { en: "Random", ko: "랜덤 토너먼트", ja: "ランダムトーナメント", zh: "随机对战", es: "Aleatorio" },
  "bow.randomDesc": {
    en: "Shuffle the days into random matchups.",
    ko: "참가 날짜를 랜덤으로 섞어 대진합니다.",
    ja: "参加日をランダムに組み合わせます。",
    zh: "将参赛日期随机配对。",
    es: "Baraja los días en enfrentamientos al azar.",
  },
  "bow.vs": { en: "VS", ko: "VS", ja: "VS", zh: "VS", es: "VS" },
  "bow.pick": {
    en: "Tap the day you liked more",
    ko: "더 좋았던 하루를 선택하세요",
    ja: "より良かった日を選んでください",
    zh: "点选你更喜欢的一天",
    es: "Toca el día que más te gustó",
  },
  "bow.final": { en: "Final", ko: "결승", ja: "決勝", zh: "决赛", es: "Final" },
  "bow.semifinal": { en: "Semifinal", ko: "준결승", ja: "準決勝", zh: "半决赛", es: "Semifinal" },
  "bow.round": { en: "Round {n}", ko: "{n}라운드", ja: "ラウンド{n}", zh: "第{n}轮", es: "Ronda {n}" },
  "bow.progress": { en: "{cur} / {total}", ko: "{cur} / {total}", ja: "{cur} / {total}", zh: "{cur} / {total}", es: "{cur} / {total}" },
  "bow.champion": { en: "Best of Week", ko: "이 주의 베스트", ja: "今週のベスト", zh: "本周最佳", es: "Mejor de la semana" },
  "bow.redo": { en: "Start over", ko: "다시 하기", ja: "やり直す", zh: "重新开始", es: "Reiniciar" },
  "bow.saveImage": { en: "Save image", ko: "이미지 저장", ja: "画像を保存", zh: "保存图片", es: "Guardar imagen" },
  "bow.empty": {
    en: "No albums logged this week.",
    ko: "이 주에 기록된 앨범이 없어요.",
    ja: "今週は記録された作品がありません。",
    zh: "本周还没有记录的专辑。",
    es: "No hay álbumes registrados esta semana.",
  },
  "bow.emptyHint": {
    en: "Log at least two days to run a Best of Week.",
    ko: "베스트를 뽑으려면 최소 이틀 이상 기록해 주세요.",
    ja: "ベストを選ぶには2日以上の記録が必要です。",
    zh: "至少记录两天才能评选本周最佳。",
    es: "Registra al menos dos días para elegir la mejor.",
  },
};
