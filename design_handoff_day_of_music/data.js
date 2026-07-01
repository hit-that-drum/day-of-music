// data.js — Day of Music dataset
// Original curatorial picks across genres. Covers are styled in code (typographic
// tiles), not bitmap reproductions of real album artwork.

// Cover style — declarative palette + layout hint per album. Rendered by Cover.jsx.
// styles: "stack" | "diag" | "center" | "split" | "edge" | "ring" | "block" | "ticker"

const ALBUMS = [
  // ── Week 1: Jan 5–11, 2026
  { id: 'a01', date: '2026-01-05', title: 'SOUR', titleKo: '사워', artist: 'Olivia Rodrigo',
    genre: 'Pop', year: 2021, format: 'Dolby Atmos · Lossless',
    cover: { style: 'stack', bg: '#b9a3d9', fg: '#1a1430', accent: '#f6e6ff' },
    mood: ['heartbreak', 'cathartic'],
    note: 'Best heard with the windows down. Track 7 still wrecks.',
    rating: 5, tracks: ['brutal', 'traitor', 'drivers license', 'good 4 u', '1 step forward, 3 steps back', 'enough for you', 'happier', 'jealousy, jealousy', 'favorite crime', 'hope ur ok', 'the rose'] },
  { id: 'a02', date: '2026-01-06', title: 'To Pimp a Butterfly', titleKo: '나비의 비행', artist: 'Kendrick Lamar',
    genre: 'Hip-Hop', year: 2015, format: 'Lossless',
    cover: { style: 'block', bg: '#1d1a18', fg: '#f4d35e', accent: '#c75146' },
    mood: ['urgent', 'jazz-laced'],
    note: 'Felt every line. Saved "u" on loop for an hour.',
    rating: 5, tracks: ['Wesleys Theory', 'For Free? (Interlude)', 'King Kunta', 'Institutionalized', 'These Walls', 'u', 'Alright', 'For Sale? (Interlude)', 'Momma', 'Hood Politics', 'How Much a Dollar Cost', 'Complexion', 'The Blacker the Berry', 'You Aint Gotta Lie (Momma Said)', 'i', 'Mortal Man'] },
  { id: 'a03', date: '2026-01-07', title: 'Discovery', titleKo: '디스커버리', artist: 'Daft Punk',
    genre: 'Electronic', year: 2001, format: 'Dolby Atmos · Lossless',
    cover: { style: 'ring', bg: '#0d0b1a', fg: '#ffd166', accent: '#ff5d8f' },
    mood: ['euphoric', 'nostalgic'],
    note: '"Something About Us" at 1am — religious experience.',
    rating: 4, tracks: ['One More Time', 'Aerodynamic', 'Digital Love', 'Harder, Better, Faster, Stronger', 'Crescendolls', 'Nightvision', 'Superheroes', 'High Life', 'Something About Us', 'Voyager', 'Veridis Quo', 'Short Circuit', 'Face to Face', 'Too Long'] },
  { id: 'a04', date: '2026-01-08', title: 'Kind of Blue', titleKo: '카인드 오브 블루', artist: 'Miles Davis',
    genre: 'Jazz', year: 1959, format: 'Hi-Res Lossless',
    cover: { style: 'split', bg: '#1e3a5f', fg: '#f8f4e3', accent: '#7fb3d5' },
    mood: ['quiet', 'searching'],
    note: 'Tried writing to this — ended up just listening for two hours.',
    rating: 5, tracks: ['So What', 'Freddie Freeloader', 'Blue in Green', 'All Blues', 'Flamenco Sketches'] },
  { id: 'a05', date: '2026-01-09', title: 'For Emma, Forever Ago', titleKo: '에마에게', artist: 'Bon Iver',
    genre: 'Indie Folk', year: 2007, format: 'Lossless',
    cover: { style: 'edge', bg: '#2a3d2e', fg: '#e9e4d4', accent: '#a8c5a5' },
    mood: ['cabin', 'aching'],
    note: 'Snow outside helped. "Skinny Love" never gets old.',
    rating: 5, tracks: ['Flume', 'Lump Sum', 'Skinny Love', 'The Wolves (Act I and II)', 'Blindsided', 'Creature Fear', 'Team', 're: Stacks'] },
  { id: 'a06', date: '2026-01-10', title: 'Renaissance', titleKo: '르네상스', artist: 'Beyoncé',
    genre: 'R&B · Dance', year: 2022, format: 'Dolby Atmos · Lossless',
    cover: { style: 'diag', bg: '#c8a4d4', fg: '#3a1f4d', accent: '#f5d491' },
    mood: ['liberation', 'sweaty'],
    note: 'Did dishes for 30min straight without noticing.',
    rating: 5, tracks: ['I\'M THAT GIRL', 'COZY', 'ALIEN SUPERSTAR', 'CUFF IT', 'ENERGY', 'BREAK MY SOUL', 'CHURCH GIRL', 'PLASTIC OFF THE SOFA', 'VIRGO\'S GROOVE', 'MOVE', 'HEATED', 'THIQUE', 'ALL UP IN YOUR MIND', 'AMERICA HAS A PROBLEM', 'PURE/HONEY', 'SUMMER RENAISSANCE'] },
  { id: 'a07', date: '2026-01-11', title: 'In Rainbows', titleKo: '인 레인보우즈', artist: 'Radiohead',
    genre: 'Alt Rock', year: 2007, format: 'Lossless',
    cover: { style: 'ticker', bg: '#e85d3f', fg: '#1a0f0d', accent: '#fff2e6' },
    mood: ['anxious', 'romantic'],
    note: 'Sunday night album. "Reckoner" mid-walk.',
    rating: 4, tracks: ['15 Step', 'Bodysnatchers', 'Nude', 'Weird Fishes/Arpeggi', 'All I Need', 'Faust Arp', 'Reckoner', 'House of Cards', 'Jigsaw Falling Into Place', 'Videotape'] },

  // ── Week 2: Jan 12–18, 2026
  { id: 'a08', date: '2026-01-12', title: 'Channel Orange', titleKo: '채널 오렌지', artist: 'Frank Ocean',
    genre: 'R&B', year: 2012, format: 'Lossless',
    cover: { style: 'center', bg: '#f57d2e', fg: '#1a1208', accent: '#fff' },
    mood: ['warm', 'late-night'],
    note: 'Pyramids takes 9:53 and you never want it to end.',
    rating: 5, tracks: ['Start', 'Thinkin Bout You', 'Fertilizer', 'Sierra Leone', 'Sweet Life', 'Not Just Money', 'Super Rich Kids', 'Pilot Jones', 'Crack Rock', 'Pyramids', 'Lost', 'White', 'Monks', 'Bad Religion', 'Pink Matter', 'Forrest Gump', 'End'] },
  { id: 'a09', date: '2026-01-13', title: 'Pink Moon', titleKo: '핑크 문', artist: 'Nick Drake',
    genre: 'Folk', year: 1972, format: 'Hi-Res Lossless',
    cover: { style: 'ring', bg: '#f4c2c2', fg: '#3d1a1a', accent: '#7a2d2d' },
    mood: ['fragile', 'autumnal'],
    note: '28 minutes. Just guitar and voice. Everything I needed.',
    rating: 5, tracks: ['Pink Moon', 'Place to Be', 'Road', 'Which Will', 'Horn', 'Things Behind the Sun', 'Know', 'Parasite', 'Free Ride', 'Harvest Breed', 'From the Morning'] },
  { id: 'a10', date: '2026-01-14', title: 'OK Computer', titleKo: '오케이 컴퓨터', artist: 'Radiohead',
    genre: 'Alt Rock', year: 1997, format: 'Lossless',
    cover: { style: 'block', bg: '#dde3e6', fg: '#1a1f24', accent: '#5b6770' },
    mood: ['paranoid', 'sweeping'],
    note: '"Let Down" still does the thing it does. Inevitable.',
    rating: 5, tracks: ['Airbag', 'Paranoid Android', 'Subterranean Homesick Alien', 'Exit Music (For a Film)', 'Let Down', 'Karma Police', 'Fitter Happier', 'Electioneering', 'Climbing Up the Walls', 'No Surprises', 'Lucky', 'The Tourist'] },
  { id: 'a11', date: '2026-01-15', title: 'Random Access Memories', titleKo: '랜덤 액세스 메모리스', artist: 'Daft Punk',
    genre: 'Electronic', year: 2013, format: 'Dolby Atmos · Lossless',
    cover: { style: 'diag', bg: '#1a1a1a', fg: '#d4af37', accent: '#f5f5dc' },
    mood: ['glossy', 'wide-screen'],
    note: 'Touch at full volume. Both Paul Williams verses.',
    rating: 4, tracks: ['Give Life Back to Music', 'The Game of Love', 'Giorgio by Moroder', 'Within', 'Instant Crush', 'Lose Yourself to Dance', 'Touch', 'Get Lucky', 'Beyond', 'Motherboard', 'Fragments of Time', 'Doin\' it Right', 'Contact'] },
  { id: 'a12', date: '2026-01-16', title: 'Blue', titleKo: '블루', artist: 'Joni Mitchell',
    genre: 'Folk', year: 1971, format: 'Hi-Res Lossless',
    cover: { style: 'edge', bg: '#1d3557', fg: '#f1faee', accent: '#a8dadc' },
    mood: ['confessional', 'open'],
    note: '"River" in January = a kind of weather inside you.',
    rating: 5, tracks: ['All I Want', 'My Old Man', 'Little Green', 'Carey', 'Blue', 'California', 'This Flight Tonight', 'River', 'A Case of You', 'The Last Time I Saw Richard'] },
  { id: 'a13', date: '2026-01-17', title: 'Un Verano Sin Ti', titleKo: '운 베라노 신 티', artist: 'Bad Bunny',
    genre: 'Latin · Reggaeton', year: 2022, format: 'Dolby Atmos · Lossless',
    cover: { style: 'split', bg: '#ff6f91', fg: '#0d0d0d', accent: '#ffe156' },
    mood: ['summer', 'breezy'],
    note: 'Played this in January to pretend it was July. Worked.',
    rating: 4, tracks: ['Moscow Mule', 'Después de la Playa', 'Me Porto Bonito', 'Tití Me Preguntó', 'Un Ratito', 'Yo No Soy Celoso', 'Tarot', 'Neverita', 'La Corriente', 'Efecto', 'Party', 'Aguacero', 'Enséñame a Bailar', 'Ojitos Lindos', 'Dos Mil 16', 'El Apagón', 'Otro Atardecer', 'Un Coco', 'Andrea', 'Me Fui de Vacaciones', 'Un Verano Sin Ti', 'Agosto', 'Callaíta'] },
  { id: 'a14', date: '2026-01-18', title: 'Carrie & Lowell', titleKo: '캐리 & 로웰', artist: 'Sufjan Stevens',
    genre: 'Indie Folk', year: 2015, format: 'Lossless',
    cover: { style: 'stack', bg: '#b5b7a8', fg: '#2f2a25', accent: '#e6dcc7' },
    mood: ['grief', 'tender'],
    note: 'Heavy. Cried at "Fourth of July". 10/10 do not recommend in airports.',
    rating: 5, tracks: ['Death With Dignity', 'Should Have Known Better', 'All of Me Wants All of You', 'Drawn to the Blood', 'Eugene', 'Fourth of July', 'The Only Thing', 'Carrie & Lowell', 'John My Beloved', 'No Shade in the Shadow of the Cross', 'Blue Bucket of Gold'] },
];

// Build a lookup by date for fast access.
const ALBUMS_BY_DATE = Object.fromEntries(ALBUMS.map(a => [a.date, a]));

// Format helpers
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const DOW_KO = ['일','월','화','수','목','금','토'];

function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate()+n); return x;
}
function startOfWeek(d) {
  // Week starts Monday (like reference)
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Mon
  x.setDate(x.getDate() - day);
  return x;
}
function weekOfMonth(d) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Math.ceil((d.getDate() + offset) / 7);
}

// Genres we cover (used by search)
const GENRES = ['Pop','Hip-Hop','Electronic','Jazz','Indie Folk','R&B','Alt Rock','Folk','Latin · Reggaeton','R&B · Dance'];

Object.assign(window, {
  ALBUMS, ALBUMS_BY_DATE, MONTHS, MONTHS_LONG, DOW, DOW_KO, GENRES,
  parseDate, fmtDate, addDays, startOfWeek, weekOfMonth,
});
