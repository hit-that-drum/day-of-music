// screens.jsx — All screen components for Day of Music
// Screens: WeeklyGrid, MonthlyView, DayDetail, AddFlow, ProfileStats, Search

// ─────────────────────────────────────────────────────────────────────────────
// Small shared atoms
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ children, active, onClick, style }) {
  return (
    <button onClick={onClick} className="dom-chip" data-active={active ? '1' : '0'} style={style}>
      {children}
    </button>
  );
}

function Stars({ value = 0, size = 12, color }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} style={{ color: i <= value ? (color || 'var(--ink)') : 'var(--lineSoft)', fontSize: size, lineHeight: 1 }}>
        ★
      </span>
    );
  }
  return <span style={{ display: 'inline-flex', gap: size * 0.1 }}>{stars}</span>;
}

function MetaLine({ album, size = 9, showFormat = false }) {
  return (
    <div className="dom-meta" style={{ fontSize: size }}>
      {album.genre} <span className="dom-dot">·</span> {album.year}{showFormat ? <> <span className="dom-dot">·</span> {album.format}</> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Cell — used in weekly + monthly views
// ─────────────────────────────────────────────────────────────────────────────

function DayCell({ date, album, isToday, isFuture, cardStyle, onOpen, coverSize = 168 }) {
  const day = date.getDate();
  const dow = DOW[date.getDay()];
  const dowKo = DOW_KO[date.getDay()];

  return (
    <div className="dom-day" data-today={isToday ? '1' : '0'} data-future={isFuture ? '1' : '0'} data-empty={album ? '0' : '1'}>
      <div className="dom-day-hd">
        <span className="dom-day-num">{day}</span>
        <span className="dom-day-bar">|</span>
        <span className="dom-day-dow">{dow}</span>
        <span className="dom-day-dowKo">{dowKo}</span>
      </div>
      {album ? (
        <button className="dom-day-body" onClick={() => onOpen(album)} aria-label={`Open ${album.title}`}>
          <div className="dom-cover-wrap" style={{ maxWidth: coverSize }}>
            <Cover album={album} size="100%" />
          </div>
          {cardStyle !== 'bare' && (
            <div className="dom-day-meta">
              <div className="dom-title">{album.title}</div>
              {cardStyle === 'with-meta' && (
                <>
                  <div className="dom-artist">{album.artist}<span className="dom-artist-ko"> · {album.titleKo}</span></div>
                  <MetaLine album={album} />
                </>
              )}
            </div>
          )}
        </button>
      ) : (
        <div className="dom-day-body dom-day-empty" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Grid (main view)
// ─────────────────────────────────────────────────────────────────────────────

function WeeklyGrid({ weekStart, days, density, cardStyle, layout, onOpen, onPrev, onNext, today, onShare, inFrame }) {
  const monthLabel = MONTHS_LONG[weekStart.getMonth()];
  const weekNum = weekOfMonth(weekStart);

  const cols = density;
  const startCol = density === 14 ? 0 : 0;
  const visibleDays = days.slice(0, density);

  // Compute cover size based on grid columns + frame
  const coverSize = inFrame
    ? 130
    : (density === 5 ? 220 : density === 7 ? 168 : 110);

  if (layout === 'list') {
    // List layout shows ALL albums in the current month, ordered by date.
    const month = weekStart.getMonth();
    const year = weekStart.getFullYear();
    const monthAlbums = ALBUMS
      .filter(a => {
        const d = parseDate(a.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .sort((a,b) => a.date.localeCompare(b.date));
    return (
      <div className="dom-week">
        <WeekHeader monthLabel={monthLabel} weekNum={weekNum} onPrev={onPrev} onNext={onNext} onShare={onShare} listMode={true} />
        <div className="dom-list">
          {monthAlbums.map((a, i) => {
            const d = parseDate(a.date);
            const isToday = fmtDate(d) === fmtDate(today);
            return (
              <ListRow key={a.id} date={d} album={a} isToday={isToday} onOpen={onOpen} />
            );
          })}
          {!monthAlbums.length && <div className="dom-empty">No entries this month yet.</div>}
        </div>
      </div>
    );
  }

  if (layout === 'calendar') {
    // Compute the 5-week month grid containing weekStart
    return <CalendarLayout weekStart={weekStart} today={today} onOpen={onOpen} onPrev={onPrev} onNext={onNext} onShare={onShare} />;
  }

  // Default grid layout — pure 7-day grid; the label cell only appears in
  // 2-col mobile layout so the grid reads as label/MON · TUE/WED · THU/FRI · SAT/SUN.
  const gridCols = density >= 14 ? 7 : Math.min(cols, 7);
  return (
    <div className="dom-week">
      <WeekHeader monthLabel={monthLabel} weekNum={weekNum} onPrev={onPrev} onNext={onNext} onShare={onShare} />
      <div className="dom-grid" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
        <div className="dom-grid-label">
          <div className="dom-grid-label-inner">
            <div className="dom-month-line">
              <span className="dom-month-name">{monthLabel.toUpperCase()}</span>
            </div>
            <div className="dom-month-sub">— Week {weekNum}</div>
            <div className="dom-month-tag">{weekStart.getFullYear()} · 큐레이션</div>
          </div>
        </div>
        {visibleDays.map((d, i) => {
          const album = ALBUMS_BY_DATE[fmtDate(d)];
          const isToday = fmtDate(d) === fmtDate(today);
          const isFuture = d > today;
          return (
            <DayCell key={i} date={d} album={album} isToday={isToday} isFuture={isFuture} cardStyle={cardStyle} onOpen={onOpen} coverSize={coverSize} />
          );
        })}
      </div>
    </div>
  );
}

function WeekHeader({ monthLabel, weekNum, onPrev, onNext, onShare, listMode }) {
  return (
    <div className="dom-week-hd">
      <div className="dom-week-title">
        <span className="dom-eyebrow">{listMode ? '큐레이션 · monthly journal' : '큐레이션 · weekly view'}</span>
        <h1>
          {listMode ? monthLabel : (
            <>
              {monthLabel}
              <span className="dom-week-title-break"> — Week {weekNum}</span>
            </>
          )}
        </h1>
      </div>
      <div className="dom-week-actions">
        <button className="dom-iconbtn" onClick={onPrev} aria-label="Previous">←</button>
        <button className="dom-iconbtn" onClick={onNext} aria-label="Next">→</button>
        <button className="dom-btn" onClick={onShare}>{listMode ? 'SHARE MONTH' : 'SHARE WEEK'}</button>
      </div>
    </div>
  );
}

function ListRow({ date, album, isToday, onOpen }) {
  const day = date.getDate();
  const dow = DOW[date.getDay()];
  return (
    <button className="dom-listrow" onClick={() => album && onOpen(album)} data-today={isToday ? '1' : '0'} data-empty={album ? '0' : '1'}>
      <div className="dom-listrow-date">
        <div className="dom-listrow-day">{day}</div>
        <div className="dom-listrow-dow">{dow}</div>
      </div>
      <div className="dom-listrow-cover">
        {album ? <Cover album={album} size={72} /> : <div style={{width:72,height:72,background:'var(--chip)'}} />}
      </div>
      <div className="dom-listrow-info">
        {album ? (
          <>
            <div className="dom-listrow-title">{album.title}</div>
            <div className="dom-listrow-artist">{album.artist} · {album.titleKo}</div>
          </>
        ) : <div className="dom-listrow-empty">No album logged</div>}
      </div>
      {album && <div className="dom-listrow-meta"><MetaLine album={album} size={10} /><div style={{marginTop:6}}><Stars value={album.rating} size={11} /></div></div>}
      {album && <div className="dom-listrow-arrow">↗</div>}
    </button>
  );
}

function CalendarLayout({ weekStart, today, onOpen, onPrev, onNext, onShare }) {
  // Show the month containing weekStart
  const year = weekStart.getFullYear();
  const month = weekStart.getMonth();
  const monthStart = new Date(year, month, 1);
  const calStart = startOfWeek(monthStart);
  const days = [];
  for (let i = 0; i < 35; i++) days.push(addDays(calStart, i));
  // If we need 6 weeks, add another row
  const last = days[34];
  if (last.getMonth() === month) {
    for (let i = 0; i < 7; i++) days.push(addDays(calStart, 35 + i));
  }

  return (
    <div className="dom-week">
      <WeekHeader monthLabel={MONTHS_LONG[month]} weekNum={weekOfMonth(weekStart)} onPrev={onPrev} onNext={onNext} onShare={onShare} />
      <div className="dom-cal">
        <div className="dom-cal-head">
          {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="dom-cal-grid">
          {days.map((d, i) => {
            const album = ALBUMS_BY_DATE[fmtDate(d)];
            const inMonth = d.getMonth() === month;
            return (
              <button key={i} className="dom-cal-cell" data-inmonth={inMonth ? '1' : '0'} data-today={fmtDate(d)===fmtDate(today)?'1':'0'} onClick={() => album && onOpen(album)}>
                <div className="dom-cal-date">{d.getDate()}</div>
                {album && <div className="dom-cal-cover"><Cover album={album} size={64} /></div>}
                {album && <div className="dom-cal-mini">{album.title}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly Overview — editorial calendar grid + featured strip
// ─────────────────────────────────────────────────────────────────────────────

function MonthlyView({ today, onOpen }) {
  const all = ALBUMS;
  const year = 2026;
  const month = 0; // January

  // Build a Mon-start 5-row month grid
  const firstOfMonth = new Date(year, month, 1);
  const calStart = startOfWeek(firstOfMonth);
  const lastOfMonth = new Date(year, month + 1, 0);
  const numWeeks = Math.ceil((((lastOfMonth - calStart) / 86400000) + 1) / 7);
  const totalDays = numWeeks * 7;
  const days = [];
  for (let i = 0; i < totalDays; i++) days.push(addDays(calStart, i));

  const monthAlbums = all.filter(a => {
    const d = parseDate(a.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  // Editorial picks: 5-star albums of the month, ordered by date
  const featured = monthAlbums.filter(a => a.rating === 5);
  const heroPick = featured[0] || monthAlbums[0];
  const restFeatured = featured.slice(1, 4);

  const totalLogged = monthAlbums.length;
  const totalDaysInMonth = lastOfMonth.getDate();
  const completion = Math.round((totalLogged / totalDaysInMonth) * 100);

  return (
    <div className="dom-month">
      {/* Title block */}
      <div className="dom-month-hd">
        <div className="dom-month-hd-left">
          <span className="dom-eyebrow">한 달의 청음 · january in listening</span>
          <h1 className="dom-month-h1">
            <span className="dom-month-h1-name">January</span>
            <span className="dom-month-h1-year">2026</span>
          </h1>
        </div>
        <div className="dom-month-hd-right">
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">{String(totalLogged).padStart(2,'0')}</span>
            <span className="dom-month-stat-lbl">albums logged · 기록한 앨범</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">{completion}<i>%</i></span>
            <span className="dom-month-stat-lbl">of the month · 한 달의 비율</span>
          </div>
          <div className="dom-month-stat">
            <span className="dom-month-stat-num">{new Set(monthAlbums.map(a=>a.genre)).size}</span>
            <span className="dom-month-stat-lbl">genres · 장르</span>
          </div>
        </div>
      </div>

      {/* Featured pick + secondary picks */}
      {heroPick && (
        <div className="dom-month-feature">
          <div className="dom-month-feature-hero" onClick={() => onOpen(heroPick)} role="button">
            <Cover album={heroPick} size={280} />
            <div className="dom-month-feature-meta">
              <div className="dom-feature-eyebrow">★ pick of the month · 이달의 픽</div>
              <div className="dom-feature-title">{heroPick.title}</div>
              <div className="dom-feature-artist">{heroPick.artist} <span>· {heroPick.titleKo}</span></div>
              <p className="dom-feature-note">"{heroPick.note}"</p>
              <div className="dom-feature-meta-line">
                <span>{heroPick.genre}</span><span className="dom-dot">·</span>
                <span>{heroPick.year}</span><span className="dom-dot">·</span>
                <span>{String(parseDate(heroPick.date).getDate()).padStart(2,'0')} {MONTHS[month]}</span>
              </div>
            </div>
          </div>
          {restFeatured.length > 0 && (
            <div className="dom-month-feature-side">
              <div className="dom-feature-side-label">also five-stars · 다섯별</div>
              {restFeatured.map(a => (
                <button key={a.id} className="dom-feature-side-item" onClick={() => onOpen(a)}>
                  <Cover album={a} size={72} />
                  <div>
                    <div className="dom-feature-side-title">{a.title}</div>
                    <div className="dom-feature-side-artist">{a.artist}</div>
                  </div>
                  <div className="dom-feature-side-date">
                    <span>{String(parseDate(a.date).getDate()).padStart(2,'0')}</span>
                    <span className="dom-feature-side-dow">{DOW[parseDate(a.date).getDay()]}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar grid */}
      <div className="dom-month-cal">
        <div className="dom-month-cal-hd">
          {['MON','TUE','WED','THU','FRI','SAT','SUN'].map((d, i) => (
            <div key={d} className="dom-month-cal-dow">
              <span>{d}</span>
              <span className="dom-month-cal-dowKo">{DOW_KO[(i+1)%7]}</span>
            </div>
          ))}
        </div>
        <div className="dom-month-cal-grid" style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(140px, auto))` }}>
          {days.map((d, i) => {
            const album = ALBUMS_BY_DATE[fmtDate(d)];
            const inMonth = d.getMonth() === month;
            const isToday = fmtDate(d) === fmtDate(today);
            return (
              <button
                key={i}
                className="dom-month-cal-cell"
                data-inmonth={inMonth ? '1' : '0'}
                data-today={isToday ? '1' : '0'}
                data-empty={album ? '0' : '1'}
                onClick={() => album && onOpen(album)}
                disabled={!album}
              >
                <div className="dom-month-cal-date">
                  <span className="dom-month-cal-num">{d.getDate()}</span>
                  {isToday && <span className="dom-month-cal-today">TODAY</span>}
                </div>
                {album && (
                  <div className="dom-month-cal-cover">
                    <Cover album={album} size="100%" />
                  </div>
                )}
                {album && (
                  <div className="dom-month-cal-info">
                    <div className="dom-month-cal-title">{album.title}</div>
                    <div className="dom-month-cal-artist">{album.artist}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Detail — large cover, tracklist, note, rating
// ─────────────────────────────────────────────────────────────────────────────

function DayDetail({ album, onClose, onUpdate }) {
  const [tab, setTab] = React.useState('tracks');
  const d = parseDate(album.date);
  const day = d.getDate();
  const dow = DOW[d.getDay()];
  const dowKo = DOW_KO[d.getDay()];

  // Local edit state for note + rating
  const [note, setNote] = React.useState(album.note);
  const [rating, setRating] = React.useState(album.rating);
  React.useEffect(() => { setNote(album.note); setRating(album.rating); }, [album.id]);

  function commit() { onUpdate(album.id, { note, rating }); }

  return (
    <div className="dom-detail-scrim" onClick={onClose}>
      <div className="dom-detail" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose} aria-label="Close">×</button>

        <div className="dom-detail-left">
          <div className="dom-detail-cover">
            <Cover album={album} size={420} />
          </div>
          <div className="dom-detail-meta">
            <div className="dom-detail-date">
              <span className="dom-detail-day">{day}</span>
              <span className="dom-detail-dow">{dow} · {dowKo}요일</span>
            </div>
            <div className="dom-detail-format"><MetaLine album={album} size={11} showFormat={true} /></div>
          </div>
        </div>

        <div className="dom-detail-right">
          <div className="dom-detail-eyebrow">album of the day · 오늘의 앨범</div>
          <h1 className="dom-detail-title">{album.title}</h1>
          <h2 className="dom-detail-artist">{album.artist} <span>· {album.titleKo}</span></h2>

          <div className="dom-detail-tabs">
            <button data-active={tab==='tracks'?'1':'0'} onClick={() => setTab('tracks')}>Tracklist</button>
            <button data-active={tab==='journal'?'1':'0'} onClick={() => setTab('journal')}>Journal</button>
            <button data-active={tab==='info'?'1':'0'} onClick={() => setTab('info')}>Info</button>
          </div>

          {tab === 'tracks' && (
            <ol className="dom-tracks">
              {album.tracks.map((t, i) => (
                <li key={i}>
                  <span className="dom-track-num">{String(i+1).padStart(2,'0')}</span>
                  <span className="dom-track-name">{t}</span>
                  <span className="dom-track-time">{randomTime(i, album.id)}</span>
                </li>
              ))}
            </ol>
          )}

          {tab === 'journal' && (
            <div className="dom-journal">
              <div className="dom-journal-rating">
                <span className="dom-journal-label">My rating</span>
                <RatingInput value={rating} onChange={(v) => { setRating(v); onUpdate(album.id, { rating: v }); }} />
              </div>
              <div className="dom-journal-mood">
                <span className="dom-journal-label">Mood</span>
                <div className="dom-mood-chips">
                  {album.mood.map(m => <span key={m} className="dom-mood-chip">{m}</span>)}
                </div>
              </div>
              <div className="dom-journal-note">
                <span className="dom-journal-label">Note · 메모</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={commit} rows={5} placeholder="What did this one do to you?" />
              </div>
            </div>
          )}

          {tab === 'info' && (
            <div className="dom-info">
              <Info label="Released" value={album.year} />
              <Info label="Genre" value={album.genre} />
              <Info label="Format" value={album.format} />
              <Info label="Tracks" value={album.tracks.length} />
              <Info label="Logged on" value={`${day} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`} />
              <Info label="Mood" value={album.mood.join(' · ')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="dom-info-row">
      <span className="dom-info-label">{label}</span>
      <span className="dom-info-value">{value}</span>
    </div>
  );
}

function RatingInput({ value, onChange }) {
  return (
    <div className="dom-rating-input">
      {[1,2,3,4,5].map(i => (
        <button key={i} onClick={() => onChange(i)} aria-label={`${i} stars`}>
          <span style={{ color: i <= value ? 'var(--ink)' : 'var(--lineSoft)' }}>★</span>
        </button>
      ))}
    </div>
  );
}

function randomTime(i, seed) {
  // Deterministic pseudo time based on index + id
  const h = (seed.charCodeAt(seed.length-1) + i * 37) % 240;
  const min = 2 + (h % 5);
  const sec = (h * 7) % 60;
  return `${min}:${String(sec).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Log album flow
// ─────────────────────────────────────────────────────────────────────────────

function AddFlow({ onClose, onSave, defaultDate }) {
  const [step, setStep] = React.useState(1);
  const [query, setQuery] = React.useState('');
  const [picked, setPicked] = React.useState(null);
  const [date, setDate] = React.useState(defaultDate || fmtDate(new Date(2026, 0, 19)));
  const [rating, setRating] = React.useState(0);
  const [note, setNote] = React.useState('');

  const results = ALBUMS.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.artist.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  return (
    <div className="dom-detail-scrim" onClick={onClose}>
      <div className="dom-addflow" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose}>×</button>
        <div className="dom-addflow-eyebrow">log an album · 새 앨범 기록</div>
        <h1 className="dom-addflow-title">Step {step} of 3</h1>

        <div className="dom-addflow-progress">
          <div className="dom-addflow-progress-fill" style={{ width: `${(step/3)*100}%` }} />
        </div>

        {step === 1 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">Find an album</label>
            <input className="dom-input" autoFocus placeholder="Title or artist…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="dom-addflow-results">
              {results.map(a => (
                <button key={a.id} className="dom-addflow-result" data-active={picked?.id===a.id?'1':'0'} onClick={() => setPicked(a)}>
                  <Cover album={a} size={56} />
                  <div className="dom-addflow-result-info">
                    <div className="dom-addflow-result-title">{a.title}</div>
                    <div className="dom-addflow-result-artist">{a.artist} · {a.year}</div>
                  </div>
                  {picked?.id===a.id && <span className="dom-addflow-check">✓</span>}
                </button>
              ))}
              {query && !results.length && <div className="dom-addflow-empty">No matches. Try a different query.</div>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">Pick a day</label>
            <div className="dom-addflow-datestack">
              {Array.from({length: 7}).map((_, i) => {
                const d = addDays(new Date(2026, 0, 12), i);
                const k = fmtDate(d);
                return (
                  <button key={k} className="dom-addflow-date" data-active={date===k?'1':'0'} onClick={() => setDate(k)}>
                    <span className="dom-addflow-date-num">{d.getDate()}</span>
                    <span className="dom-addflow-date-dow">{DOW[d.getDay()]}</span>
                  </button>
                );
              })}
            </div>
            {picked && (
              <div className="dom-addflow-preview">
                <Cover album={picked} size={88} />
                <div>
                  <div className="dom-addflow-preview-title">{picked.title}</div>
                  <div className="dom-addflow-preview-artist">{picked.artist}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="dom-addflow-body">
            <label className="dom-addflow-label">Your rating</label>
            <RatingInput value={rating} onChange={setRating} />
            <label className="dom-addflow-label" style={{ marginTop: 14 }}>Note · 메모</label>
            <textarea className="dom-input dom-textarea" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A line you'll want to remember…" />
          </div>
        )}

        <div className="dom-addflow-actions">
          {step > 1 ? <button className="dom-btn dom-btn-ghost" onClick={() => setStep(step-1)}>← Back</button> : <div />}
          {step < 3
            ? <button className="dom-btn" disabled={step===1 && !picked} onClick={() => setStep(step+1)}>Continue →</button>
            : <button className="dom-btn" onClick={() => { onSave({ id: picked.id, date, rating, note }); onClose(); }}>Save entry</button>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile / Stats (wrapped-style)
// ─────────────────────────────────────────────────────────────────────────────

function ProfileStats() {
  const total = ALBUMS.length;
  const avgRating = (ALBUMS.reduce((s,a) => s + a.rating, 0) / total).toFixed(2);
  const byGenre = {};
  ALBUMS.forEach(a => { byGenre[a.genre] = (byGenre[a.genre]||0) + 1; });
  const topGenres = Object.entries(byGenre).sort((a,b) => b[1]-a[1]);
  const moods = {};
  ALBUMS.forEach(a => a.mood.forEach(m => moods[m] = (moods[m]||0)+1));
  const moodList = Object.entries(moods).sort((a,b) => b[1]-a[1]).slice(0, 10);

  const fives = ALBUMS.filter(a => a.rating === 5);

  return (
    <div className="dom-profile">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">올해의 청음 · 2026 in listening</span>
          <h1>My Year in Music</h1>
        </div>
        <div className="dom-week-actions">
          <button className="dom-btn dom-btn-ghost">Export</button>
          <button className="dom-btn">Share card</button>
        </div>
      </div>

      <div className="dom-stats-grid">
        <div className="dom-stat dom-stat-lg">
          <div className="dom-stat-label">albums logged</div>
          <div className="dom-stat-num">{String(total).padStart(2,'0')}</div>
          <div className="dom-stat-sub">across {Object.keys(byGenre).length} genres · 14 days</div>
        </div>
        <div className="dom-stat">
          <div className="dom-stat-label">average rating</div>
          <div className="dom-stat-num">{avgRating}</div>
          <div className="dom-stat-sub"><Stars value={Math.round(avgRating)} size={14} /></div>
        </div>
        <div className="dom-stat">
          <div className="dom-stat-label">five-star picks</div>
          <div className="dom-stat-num">{fives.length}</div>
          <div className="dom-stat-sub">{Math.round(fives.length/total*100)}% of catalog</div>
        </div>
        <div className="dom-stat dom-stat-wide">
          <div className="dom-stat-label">top genres</div>
          <div className="dom-bars">
            {topGenres.map(([g, n]) => (
              <div key={g} className="dom-bar">
                <span className="dom-bar-label">{g}</span>
                <div className="dom-bar-track">
                  <div className="dom-bar-fill" style={{ width: `${(n/total)*100}%` }} />
                </div>
                <span className="dom-bar-num">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dom-stat dom-stat-wide">
          <div className="dom-stat-label">mood map · 분위기</div>
          <div className="dom-moodcloud">
            {moodList.map(([m, n]) => (
              <span key={m} className="dom-moodcloud-item" style={{ fontSize: 14 + n*4 }}>{m}<sup>{n}</sup></span>
            ))}
          </div>
        </div>
      </div>

      <div className="dom-profile-section">
        <h2 className="dom-section-title">Five stars · 다섯별 앨범</h2>
        <div className="dom-fives">
          {fives.map(a => (
            <div key={a.id} className="dom-fives-item">
              <Cover album={a} size={140} />
              <div className="dom-fives-info">
                <div className="dom-fives-title">{a.title}</div>
                <div className="dom-fives-artist">{a.artist}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search / Discover
// ─────────────────────────────────────────────────────────────────────────────

function SearchView({ onOpen }) {
  const [q, setQ] = React.useState('');
  const [genre, setGenre] = React.useState('All');
  const filtered = ALBUMS.filter(a => {
    if (genre !== 'All' && a.genre !== genre) return false;
    if (!q) return true;
    const s = (a.title + ' ' + a.artist + ' ' + a.mood.join(' ')).toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <div className="dom-search">
      <div className="dom-week-hd">
        <div className="dom-week-title">
          <span className="dom-eyebrow">발견 · discover</span>
          <h1>Search the journal</h1>
        </div>
      </div>

      <div className="dom-search-box">
        <input className="dom-input dom-input-lg" placeholder="Search albums, artists, moods…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="dom-search-filters">
        <Chip active={genre==='All'} onClick={() => setGenre('All')}>All</Chip>
        {Array.from(new Set(ALBUMS.map(a => a.genre))).map(g => (
          <Chip key={g} active={genre===g} onClick={() => setGenre(g)}>{g}</Chip>
        ))}
      </div>

      <div className="dom-search-results">
        {filtered.map(a => (
          <button key={a.id} className="dom-search-result" onClick={() => onOpen(a)}>
            <Cover album={a} size={120} />
            <div className="dom-search-result-info">
              <div className="dom-search-result-title">{a.title}</div>
              <div className="dom-search-result-artist">{a.artist}<span> · {a.titleKo}</span></div>
              <MetaLine album={a} size={10} />
              <div style={{ marginTop: 6 }}><Stars value={a.rating} size={11} /></div>
            </div>
            <div className="dom-search-result-date">
              <div className="dom-search-result-day">{String(parseDate(a.date).getDate()).padStart(2,'0')}</div>
              <div className="dom-search-result-dow">{DOW[parseDate(a.date).getDay()]}</div>
            </div>
          </button>
        ))}
        {!filtered.length && <div className="dom-empty">No matches. Try clearing filters.</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Card (poster preview)
// ─────────────────────────────────────────────────────────────────────────────

function ShareCard({ weekStart, days, onClose }) {
  const monthLabel = MONTHS_LONG[weekStart.getMonth()];
  const weekNum = weekOfMonth(weekStart);
  const week = days.slice(0, 7).map(d => ALBUMS_BY_DATE[fmtDate(d)]).filter(Boolean);

  return (
    <div className="dom-detail-scrim" onClick={onClose}>
      <div className="dom-share" onClick={(e) => e.stopPropagation()}>
        <button className="dom-detail-close" onClick={onClose}>×</button>
        <div className="dom-share-card">
          <div className="dom-share-hd">
            <div>
              <div className="dom-share-eyebrow">DAY · OF · MUSIC</div>
              <div className="dom-share-title">{monthLabel} · Week {weekNum}</div>
            </div>
            <div className="dom-share-meta">@listener</div>
          </div>
          <div className="dom-share-grid">
            {week.map((a, i) => (
              <div key={i} className="dom-share-cell">
                <Cover album={a} size={140} />
                <div className="dom-share-cell-title">{a.title}</div>
                <div className="dom-share-cell-artist">{a.artist}</div>
              </div>
            ))}
          </div>
          <div className="dom-share-ft">
            <div>{week.length} albums · {new Set(week.map(a => a.genre)).size} genres</div>
            <div>★ {(week.reduce((s,a) => s+a.rating, 0)/week.length).toFixed(1)}</div>
          </div>
        </div>
        <div className="dom-share-actions">
          <button className="dom-btn dom-btn-ghost">Copy link</button>
          <button className="dom-btn">Save image</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  WeeklyGrid, MonthlyView, DayDetail, AddFlow, ProfileStats, SearchView, ShareCard,
  Stars, MetaLine, Chip,
});
