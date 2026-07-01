// app.jsx — Day of Music: main app shell, navigation, tweaks wiring.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "aesthetic": "editorial",
  "typography": "editorial",
  "density": 7,
  "cardStyle": "with-meta",
  "layout": "grid",
  "platform": "desktop",
  "showJournal": true
}/*EDITMODE-END*/;

const SCREENS = [
  { id: 'week', label: 'Week', ko: '주간' },
  { id: 'month', label: 'Month', ko: '월간' },
  { id: 'search', label: 'Search', ko: '검색' },
  { id: 'profile', label: 'Profile', ko: '나의 기록' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState('week');
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date(2026, 0, 5)));
  const [openAlbum, setOpenAlbum] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [albumOverrides, setAlbumOverrides] = React.useState({});

  const today = new Date(2026, 0, 8); // "today" for the demo — Thursday

  React.useEffect(() => { ensureFonts(); }, []);
  const rootRef = React.useRef(null);
  React.useEffect(() => {
    applyTheme(rootRef.current, t.aesthetic, t.typography);
  }, [t.aesthetic, t.typography]);

  // Keyboard nav
  React.useEffect(() => {
    function onKey(e) {
      if (openAlbum || showAdd || showShare) {
        if (e.key === 'Escape') { setOpenAlbum(null); setShowAdd(false); setShowShare(false); }
        return;
      }
      if (screen !== 'week') return;
      if (e.key === 'ArrowLeft') setWeekStart(addDays(weekStart, -7));
      if (e.key === 'ArrowRight') setWeekStart(addDays(weekStart, 7));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAlbum, showAdd, showShare, weekStart, screen]);

  const visibleDays = React.useMemo(() => {
    const arr = [];
    const count = t.density === 14 ? 14 : t.density;
    for (let i = 0; i < count; i++) arr.push(addDays(weekStart, i));
    return arr;
  }, [weekStart, t.density]);

  function handleOpen(album) {
    // Apply overrides
    const merged = { ...album, ...(albumOverrides[album.id] || {}) };
    setOpenAlbum(merged);
  }
  function handleUpdate(id, patch) {
    setAlbumOverrides(prev => ({ ...prev, [id]: { ...(prev[id]||{}), ...patch } }));
    setOpenAlbum(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  }
  function handleSave(entry) {
    // Stub — would write to journal
    console.log('Saved entry', entry);
  }

  const inFrame = t.platform === 'mobile';

  const content = (
    <div className="dom-root" ref={rootRef} data-grid={t.aesthetic === 'editorial' || t.aesthetic === 'dark' ? '1' : '0'} data-mobile={inFrame ? '1' : '0'}>
      <TopBar screen={screen} onScreen={setScreen} onAdd={() => setShowAdd(true)} platform={t.platform} />

      <main className="dom-main">
        {screen === 'week' && (
          <WeeklyGrid
            weekStart={weekStart}
            days={visibleDays}
            density={t.density}
            cardStyle={t.cardStyle}
            layout={t.layout}
            today={today}
            inFrame={inFrame}
            onOpen={handleOpen}
            onPrev={() => setWeekStart(addDays(weekStart, -7))}
            onNext={() => setWeekStart(addDays(weekStart, 7))}
            onShare={() => setShowShare(true)}
          />
        )}
        {screen === 'month' && <MonthlyView today={today} onOpen={handleOpen} />}
        {screen === 'search' && <SearchView onOpen={handleOpen} />}
        {screen === 'profile' && <ProfileStats />}
      </main>

      {screen === 'week' && t.showJournal && !inFrame && (
        <JournalRail today={today} onOpen={handleOpen} />
      )}

      {openAlbum && <DayDetail album={openAlbum} onClose={() => setOpenAlbum(null)} onUpdate={handleUpdate} />}
      {showAdd && <AddFlow onClose={() => setShowAdd(false)} onSave={handleSave} />}
      {showShare && <ShareCard weekStart={weekStart} days={visibleDays} onClose={() => setShowShare(false)} />}
    </div>
  );

  return (
    <>
      {inFrame ? (
        <div className="dom-mobile-stage">
          <IOSDevice dark={t.aesthetic === 'dark'} statusBarDark={t.aesthetic !== 'dark'}>
            {content}
          </IOSDevice>
        </div>
      ) : content}

      <TweaksPanel>
        <TweakSection label="Aesthetic" />
        <TweakSelect
          label="Theme"
          value={t.aesthetic}
          options={Object.entries(AESTHETICS).map(([k, v]) => ({ value: k, label: v.label }))}
          onChange={(v) => setTweak('aesthetic', v)}
        />
        <TweakSelect
          label="Typography"
          value={t.typography}
          options={Object.entries(TYPE_PAIRS).map(([k, v]) => ({ value: k, label: v.label }))}
          onChange={(v) => setTweak('typography', v)}
        />
        <TweakSection label="Layout" />
        <TweakRadio
          label="Layout"
          value={t.layout}
          options={['grid','list','calendar']}
          onChange={(v) => setTweak('layout', v)}
        />
        <TweakRadio
          label="Card style"
          value={t.cardStyle}
          options={['with-meta','compact','bare']}
          onChange={(v) => setTweak('cardStyle', v)}
        />
        <TweakSection label="Frame" />
        <TweakRadio
          label="Platform"
          value={t.platform}
          options={['desktop','mobile']}
          onChange={(v) => setTweak('platform', v)}
        />
        <TweakToggle
          label="Show journal rail"
          value={t.showJournal}
          onChange={(v) => setTweak('showJournal', v)}
        />
      </TweaksPanel>
    </>
  );
}

function TopBar({ screen, onScreen, onAdd, platform }) {
  return (
    <header className="dom-topbar">
      <div className="dom-brand">
        <span className="dom-brand-mark">●</span>
        <span className="dom-brand-name">Day of Music</span>
        <span className="dom-brand-ko">하루의 음악</span>
      </div>
      <nav className="dom-nav">
        {SCREENS.map(s => (
          <button key={s.id} className="dom-nav-btn" data-active={screen===s.id?'1':'0'} onClick={() => onScreen(s.id)}>
            <span className="dom-nav-label">{s.label}</span>
            <span className="dom-nav-ko">{s.ko}</span>
          </button>
        ))}
      </nav>
      <div className="dom-topbar-actions">
        <button className="dom-btn" onClick={onAdd}>＋ Log album</button>
      </div>
    </header>
  );
}

function JournalRail({ today, onOpen }) {
  const todayAlbum = ALBUMS_BY_DATE[fmtDate(today)];
  const recent = ALBUMS.filter(a => parseDate(a.date) <= today).slice(-4).reverse();
  if (!todayAlbum) return null;

  return (
    <aside className="dom-rail">
      <div className="dom-rail-section">
        <div className="dom-rail-eyebrow">today · 오늘의 앨범</div>
        <button className="dom-rail-today" onClick={() => onOpen(todayAlbum)}>
          <Cover album={todayAlbum} size={220} />
          <div className="dom-rail-today-info">
            <div className="dom-rail-today-title">{todayAlbum.title}</div>
            <div className="dom-rail-today-artist">{todayAlbum.artist}</div>
            <div style={{ marginTop: 6 }}><Stars value={todayAlbum.rating} size={12} /></div>
          </div>
        </button>
      </div>

      <div className="dom-rail-section">
        <div className="dom-rail-eyebrow">my note · 메모</div>
        <p className="dom-rail-note">"{todayAlbum.note}"</p>
        <div className="dom-rail-mood">
          {todayAlbum.mood.map(m => <span key={m} className="dom-mood-chip">{m}</span>)}
        </div>
      </div>

      <div className="dom-rail-section">
        <div className="dom-rail-eyebrow">recent · 최근</div>
        <div className="dom-rail-recent">
          {recent.map(a => (
            <button key={a.id} className="dom-rail-recent-row" onClick={() => onOpen(a)}>
              <Cover album={a} size={40} />
              <div>
                <div className="dom-rail-recent-title">{a.title}</div>
                <div className="dom-rail-recent-artist">{a.artist}</div>
              </div>
              <div className="dom-rail-recent-date">{String(parseDate(a.date).getDate()).padStart(2,'0')}</div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
