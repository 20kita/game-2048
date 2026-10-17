// ---------- One-time reset ----------
// Clears the test diamonds, unlocked themes and missions once, on the first start
// of this version. Scores and saved games are kept.
if (localStorage.getItem("testDataCleared") !== "yes") {
  localStorage.removeItem("diamonds");
  localStorage.removeItem("unlocked");
  localStorage.removeItem("missions");
  localStorage.setItem("testDataCleared", "yes");
}

// ---------- State ----------
let mode = "classic";   // a key of MODES below, e.g. "animals"
let size = 4;           // 3, 4 or 5
let board = [];         // board[r][c] = tile object { value, r, c, el }, or null
let score = 0;
let best = 0;
let bestAtStart = 0;    // best score before this game started (to detect a new record)
let recordPlayed = false; // "new record" sound already played in this game?

let merges = [];          // tile pairs that merged in the current move
let slideTimer = null;
let finishPending = null; // the "after the slide" part of the current move
const SLIDE_MS = 160;     // must match "transform 160ms" in style.css (.tile and .tile.absorbing)

// Makes 16 tile colors that blend smoothly through the given colors (light -> dark).
// Text color is picked automatically: dark on light tiles, white on dark tiles.
function ramp(anchors) {
  const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const result = [];
  for (let i = 0; i < 16; i++) {
    const pos = i / 15 * (anchors.length - 1);
    const a = Math.floor(pos), part = pos - a;
    const from = toRgb(anchors[a]), to = toRgb(anchors[Math.min(a + 1, anchors.length - 1)]);
    const rgb = from.map((v, k) => Math.round(v + (to[k] - v) * part));
    const light = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) > 160;
    result.push(["#" + rgb.map(v => v.toString(16).padStart(2, "0")).join(""), light ? "#2F2A33" : "#FFFFFF"]);
  }
  return result;
}

// All game modes. "tiles" = emoji from smallest (2) to biggest (65536), 16 each.
// Modes with a "price" are themes you unlock with diamonds.
// "board" and "colors" are optional: themes can have their own board and tile colors.
const MODES = {
  classic: { icon: "🔢" },
  animals: {
    icon: "🐾",
    // ant ladybug bee butterfly mouse rabbit cat fox dog wolf lion bear giraffe rhino elephant whale
    tiles: ["🐜", "🐞", "🐝", "🦋", "🐭", "🐰", "🐱", "🦊",
            "🐶", "🐺", "🦁", "🐻", "🦒", "🦏", "🐘", "🐳"]
  },
  fruits: {
    icon: "🍓",
    // cherry strawberry kiwi lemon banana peach orange green-apple red-apple pear mango grapes coconut pineapple melon watermelon
    tiles: ["🍒", "🍓", "🥝", "🍋", "🍌", "🍑", "🍊", "🍏", "🍎",
            "🍐", "🥭", "🍇", "🥥", "🍍", "🍈", "🍉"]
  },
  halloween: {
    icon: "🎃", price: 100, board: "#2B2238",
    // candy lollipop spider web bat owl candle pumpkin skull coffin ghost zombie vampire witch haunted-house full-moon
    tiles: ["🍬", "🍭", "🕷\uFE0F", "🕸\uFE0F", "🦇", "🦉", "🕯\uFE0F", "🎃",
            "💀", "⚰\uFE0F", "👻", "🧟", "🧛", "🧙", "🏚\uFE0F", "🌕"],
    colors: [
      ["#F3E6D3", "#3B2A4A"], ["#F6D2A8", "#3B2A4A"], ["#F4B26B", "#3B2A4A"], ["#EE8F3D", "#FFFFFF"],
      ["#D96C2C", "#FFFFFF"], ["#B9A3D6", "#2B2238"], ["#9178BF", "#FFFFFF"], ["#7457A3", "#FFFFFF"],
      ["#563F80", "#FFFFFF"], ["#9CC56B", "#2B2238"], ["#6E9A47", "#FFFFFF"], ["#C0392B", "#FFFFFF"],
      ["#8E2C2C", "#FFFFFF"], ["#E07A2E", "#FFFFFF"], ["#4E3B6E", "#FFFFFF"], ["#F5D76E", "#2B2238"]
    ]
  },
  christmas: {
    icon: "🎄", price: 100, board: "#24493D",
    // snowflake cookie bell sock ribbon gloves scarf candle gift snowman deer sled tree mrs-claus santa star
    tiles: ["❄\uFE0F", "🍪", "🔔", "🧦", "🎀", "🧤", "🧣", "🕯\uFE0F",
            "🎁", "⛄", "🦌", "🛷", "🎄", "🤶", "🎅", "🌟"],
    colors: [
      ["#F4F1EA", "#24493D"], ["#EADBC8", "#24493D"], ["#F2C6C2", "#24493D"], ["#E8A0A0", "#FFFFFF"],
      ["#D1495B", "#FFFFFF"], ["#B33A3A", "#FFFFFF"], ["#EDAE49", "#24493D"], ["#C9A227", "#FFFFFF"],
      ["#9BC1A3", "#24493D"], ["#66A182", "#FFFFFF"], ["#3E7C59", "#FFFFFF"], ["#A44A3F", "#FFFFFF"],
      ["#5C946E", "#FFFFFF"], ["#E26D5A", "#FFFFFF"], ["#C0392B", "#FFFFFF"], ["#F5D76E", "#24493D"]
    ]
  },
  ocean: {
    icon: "🌊", price: 100, board: "#1F4E6B",
    // drop shell shrimp crab fish tropical-fish blowfish squid octopus turtle penguin dolphin shark whale big-whale wave
    tiles: ["💧", "🐚", "🦐", "🦀", "🐟", "🐠", "🐡", "🦑",
            "🐙", "🐢", "🐧", "🐬", "🦈", "🐳", "🐋", "🌊"],
    colors: ramp(["#E6F4F1", "#B8E3EA", "#7CC6DE", "#F7D9A8", "#F2A97E", "#3A9BB8", "#1E6F8F", "#0E3F5C"])
  },
  space: {
    icon: "🚀", price: 100, board: "#1B1D3A",
    // sparkles dizzy shooting-star comet satellite rocket ufo alien new-moon half-moon full-moon earth sun star big-star galaxy
    tiles: ["✨", "💫", "🌠", "☄\uFE0F", "🛰\uFE0F", "🚀", "🛸", "👽",
            "🌑", "🌓", "🌕", "🌍", "🌞", "⭐", "🌟", "🌌"],
    colors: ramp(["#E9E4F7", "#C7BDF0", "#9A8BE0", "#F4C9E8", "#E98FC7", "#6E5BC8", "#3E3A8C", "#F5D76E"])
  },
  sweets: {
    icon: "🧁", price: 100, board: "#7A4E5E",
    // candy lollipop chocolate cookie dango donut cupcake pudding ice-cream shaved-ice sundae pancakes honey pie cake birthday-cake
    tiles: ["🍬", "🍭", "🍫", "🍪", "🍡", "🍩", "🧁", "🍮",
            "🍦", "🍧", "🍨", "🥞", "🍯", "🥧", "🍰", "🎂"],
    colors: ramp(["#FBEFF2", "#F8D3DC", "#F2AFC0", "#F7E1B5", "#E9B97A", "#C98B5E", "#A0627A", "#6E3F55"])
  },
  garden: {
    icon: "🌷", price: 100, board: "#3E5C3A",
    // seedling clover mushroom herb rice blossom cherry-blossom tulip rose hibiscus sunflower bouquet cactus palm pine tree
    tiles: ["🌱", "🍀", "🍄", "🌿", "🌾", "🌼", "🌸", "🌷",
            "🌹", "🌺", "🌻", "💐", "🌵", "🌴", "🌲", "🌳"],
    colors: ramp(["#F1F6E9", "#D6EBC0", "#B0D98F", "#F7E6A4", "#F4B6C2", "#E07A8F", "#6FA35B", "#3F7A3A"])
  },
  valentine: {
    icon: "💘", price: 100, board: "#8C3B55",
    // love-letter kiss chocolate rose ribbon teddy bouquet hearts... ring wedding
    tiles: ["💌", "💋", "🍫", "🌹", "🎀", "🧸", "💐", "💗",
            "💓", "💕", "💞", "💖", "💝", "💘", "💍", "💒"],
    colors: ramp(["#FFF0F3", "#FBD3DC", "#F6A9BA", "#EF7F98", "#E25574", "#C53A5A", "#9E2A47", "#F5D76E"])
  },
  farm: {
    icon: "🚜", price: 100, board: "#8E4A3A",
    // egg hatching-chick baby-chick chick hen rooster duck rabbit cat dog goat sheep pig cow horse tractor
    tiles: ["🥚", "🐣", "🐤", "🐥", "🐔", "🐓", "🦆", "🐇",
            "🐈", "🐕", "🐐", "🐑", "🐖", "🐄", "🐎", "🚜"],
    colors: ramp(["#FFF6E0", "#F8E3B0", "#F2C98A", "#E6A86B", "#C9805A", "#A6633F", "#7E4A33", "#5A3A2A"])
  },
  jungle: {
    icon: "🌴", price: 100, board: "#2F5233",
    // lizard frog parrot snake monkey sloth leopard zebra tiger lion gorilla crocodile giraffe hippo rhino elephant
    tiles: ["🦎", "🐸", "🦜", "🐍", "🐒", "🦥", "🐆", "🦓",
            "🐅", "🦁", "🦍", "🐊", "🦒", "🦛", "🦏", "🐘"],
    colors: ramp(["#EAF4DC", "#C9E4A9", "#A3CF7A", "#F2D16B", "#E8A13F", "#7FAF5A", "#4E8A45", "#2E5E32"])
  },
  birds: {
    icon: "🦜", price: 100, board: "#3E6E8E",
    // egg hatching-chick baby-chick chick bird penguin dove parrot owl duck rooster turkey eagle swan peacock flamingo
    tiles: ["🥚", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊\uFE0F", "🦜",
            "🦉", "🦆", "🐓", "🦃", "🦅", "🦢", "🦚", "🦩"],
    colors: ramp(["#F1F8FC", "#CDE8F4", "#A6D3EA", "#F7E3A1", "#F4B78B", "#E58C98", "#5E9CC2", "#2F6A92"])
  },
  sports: {
    icon: "🏆", price: 100, board: "#334E68",
    // ping-pong tennis baseball volleyball football basketball rugby boxing skateboard hockey badminton golf bronze silver gold trophy
    tiles: ["🏓", "🎾", "⚾", "🏐", "⚽", "🏀", "🏈", "🥊",
            "🛹", "🏒", "🏸", "⛳", "🥉", "🥈", "🥇", "🏆"],
    colors: ramp(["#F4F6F8", "#DCE6EE", "#F2C46B", "#E89A4B", "#D9677A", "#6FA35B", "#4B7FA8", "#F5D76E"])
  }
};

// Which tiles can randomly appear, and how often (in %).
// "from" = the biggest tile on the board must be at least this big.
const SPAWN_LEVELS = [
  { from: 0,     tiles: { 2: 90, 4: 10 } },
  { from: 256,   tiles: { 2: 75, 4: 15, 8: 10 } },
  { from: 1024,  tiles: { 2: 60, 4: 20, 8: 12, 16: 8 } },
  { from: 4096,  tiles: { 2: 50, 4: 20, 8: 14, 16: 10, 32: 6 } },
  { from: 16384, tiles: { 2: 40, 4: 20, 8: 15, 16: 12, 32: 8, 64: 5 } }
];

// [background, text color] for each tile, same order as above
const TILE_COLORS = [
  ["#DBD3C9", "#3B4A52"],  // 2
  ["#FAD4D8", "#3B4A52"],  // 4
  ["#F2B5BC", "#3B4A52"],  // 8
  ["#B4CEB3", "#3B4A52"],  // 16
  ["#8FB58E", "#3B4A52"],  // 32
  ["#6E9A70", "#FFFFFF"],  // 64
  ["#88A0A8", "#FFFFFF"],  // 128
  ["#6F8A94", "#FFFFFF"],  // 256
  ["#3F525C", "#FFFFFF"],  // 512
  ["#E58C98", "#FFFFFF"],  // 1024
  ["#D9677A", "#FFFFFF"],  // 2048
  ["#2F3E46", "#FFFFFF"],  // 4096
  ["#B85C6E", "#FFFFFF"],  // 8192
  ["#4F7A52", "#FFFFFF"],  // 16384
  ["#5E7C89", "#FFFFFF"],  // 32768
  ["#8E3F52", "#FFFFFF"],  // 65536
  ["#1F2A30", "#FFFFFF"]   // 131072 and bigger
];

// ---------- Settings (theme + language) ----------

let prefs = { theme: "light", lang: "en", sound: true };

// All texts in the game. To add a language, copy the "en" block and translate it.
const TEXTS = {
  en: {
    mode: "Mode", board: "Board", classic: "Classic", animals: "Animals", fruits: "Fruits",
    bestScore: "Best score", continue: "Continue", newGame: "New game", settings: "Settings",
    score: "Score", best: "Best", new: "New", tryAgain: "Try again", menu: "Menu", home: "Home",
    gameOver: "Game over", noMoves: "No more moves. Score: {score}",
    newRecord: "New best score!", points: "{score} points", pointsOld: "{score} points (old best: {old})",
    theme: "Theme", light: "Light", dark: "Dark", language: "Language", back: "Back",
    sound: "Sound", on: "On", off: "Off", appearance: "Appearance",
    halloween: "Halloween", christmas: "Christmas", ocean: "Ocean", space: "Space", sweets: "Sweets",
    garden: "Garden", valentine: "Valentine's", farm: "Farm", jungle: "Jungle", birds: "Birds", sports: "Sports",
    missions: "Missions", daily: "Daily", weekly: "Weekly", resetsIn: "Resets in {time}",
    claim: "Claim", claimed: "Done",
    unlockTitle: "Unlock {name}?", unlockText: "This theme costs {price} 💎. You have {have} 💎.",
    unlock: "Unlock", cancel: "Cancel", ok: "OK",
    notEnoughTitle: "Not enough diamonds",
    notEnoughText: "This theme costs {price} 💎 and you have {have} 💎. Complete missions to earn more!",
    m_merges: "Merge tiles {n} times", m_moves: "Make {n} moves", m_reach: "Create a {n} tile",
    m_scoreGame: "Score {n} points in one game", m_points: "Earn {n} points in total",
    m_games: "Finish {n} games", m_modeMoves: "Make {n} moves in {mode} mode",
    m_sizeMoves: "Make {n} moves on a {size} board",
    m_mergeAtLeast: "Create {n} tiles of {value} or bigger",
    m_combo: "Merge {count} pairs in one move, {n} times",
    m_variety: "Play in {n} different modes",
    m_sizeReach: "Create a {n} tile on a {size} board",
    m_sizeScore: "Score {n} points in one game on a {size} board",
    m_newRecord: "Beat your best score {n} times",
    easy: "Easy", normal: "Normal", hard: "Hard"
  },
  pl: {
    mode: "Tryb", board: "Plansza", classic: "Klasyczny", animals: "Zwierzęta", fruits: "Owoce",
    bestScore: "Rekord", continue: "Kontynuuj", newGame: "Nowa gra", settings: "Ustawienia",
    score: "Wynik", best: "Rekord", new: "Nowa", tryAgain: "Jeszcze raz", menu: "Menu", home: "Menu główne",
    gameOver: "Koniec gry", noMoves: "Brak ruchów. Wynik: {score}",
    newRecord: "Nowy rekord!", points: "{score} pkt", pointsOld: "{score} pkt (poprzedni rekord: {old})",
    theme: "Motyw", light: "Jasny", dark: "Ciemny", language: "Język", back: "Wstecz",
    sound: "Dźwięk", on: "Wł.", off: "Wył.", appearance: "Wygląd",
    halloween: "Halloween", christmas: "Święta", ocean: "Ocean", space: "Kosmos", sweets: "Słodycze",
    garden: "Ogród", valentine: "Walentynki", farm: "Farma", jungle: "Dżungla", birds: "Ptaki", sports: "Sport",
    missions: "Misje", daily: "Dzienne", weekly: "Tygodniowe", resetsIn: "Odnowienie za {time}",
    claim: "Odbierz", claimed: "Odebrano",
    unlockTitle: "Odblokować motyw {name}?", unlockText: "Ten motyw kosztuje {price} 💎. Masz {have} 💎.",
    unlock: "Odblokuj", cancel: "Anuluj", ok: "OK",
    notEnoughTitle: "Za mało diamentów",
    notEnoughText: "Ten motyw kosztuje {price} 💎, a masz {have} 💎. Wykonuj misje, aby zdobyć więcej!",
    m_merges: "Połącz kafelki {n} razy", m_moves: "Wykonaj {n} ruchów", m_reach: "Utwórz kafelek {n}",
    m_scoreGame: "Zdobądź {n} pkt w jednej grze", m_points: "Zdobądź łącznie {n} pkt",
    m_games: "Ukończ gry: {n}", m_modeMoves: "Wykonaj {n} ruchów w trybie {mode}",
    m_sizeMoves: "Wykonaj {n} ruchów na planszy {size}",
    m_mergeAtLeast: "Utwórz {n} kafelków {value} lub większych",
    m_combo: "Połącz {count} pary w jednym ruchu, {n} razy",
    m_variety: "Zagraj w {n} różnych trybach",
    m_sizeReach: "Utwórz kafelek {n} na planszy {size}",
    m_sizeScore: "Zdobądź {n} pkt w jednej grze na planszy {size}",
    m_newRecord: "Pobij swój rekord {n} razy",
    easy: "Łatwa", normal: "Średnia", hard: "Trudna"
  }
};

// t("noMoves", { score: 120 }) -> "No more moves. Score: 120"
function t(name, values) {
  let text = TEXTS[prefs.lang][name] || TEXTS.en[name];
  for (const k in values) text = text.replace("{" + k + "}", values[k]);
  return text;
}

function loadPrefs() {
  const saved = JSON.parse(localStorage.getItem("prefs"));
  if (saved) {
    prefs = Object.assign(prefs, saved);   // keeps defaults for settings added later (like sound)
  } else {
    // first start: follow the phone's language and dark mode
    prefs.lang = navigator.language.startsWith("pl") ? "pl" : "en";
    prefs.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
}

function savePrefs() {
  localStorage.setItem("prefs", JSON.stringify(prefs));
}

function applyTheme() {
  document.documentElement.dataset.theme = prefs.theme;
  document.querySelector('meta[name="theme-color"]').content = prefs.theme === "dark" ? "#1C2428" : "#F4F0EB";
}

// Puts the right text into every element with data-i18n="..."
function applyLanguage() {
  document.documentElement.lang = prefs.lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  drawModeLabel();
  renderModeButtons();
  if (currentScreen === "missions") renderMissions();
}

function updateSettings() {
  document.querySelectorAll("[data-theme-choice]").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.themeChoice === prefs.theme);
  });
  document.querySelectorAll("[data-lang-choice]").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.langChoice === prefs.lang);
  });
  document.querySelectorAll("[data-sound-choice]").forEach(btn => {
    btn.classList.toggle("selected", (btn.dataset.soundChoice === "on") === prefs.sound);
  });
}

// ---------- Sounds ----------
// No sound files: every sound is made by the phone (Web Audio API).
// Style: "soft wood" - a warm, marimba-like knock.

let audioCtx = null;
let master = null;   // overall volume

function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = 0.45;            // overall volume (0 = silent, 1 = loud)
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// One "wood" note: a pure tone plus a quieter higher overtone, softened by a filter.
// freq = pitch in Hz, delay = seconds from now
function woodNote(freq, delay) {
  const ctx = getAudio();
  const t = ctx.currentTime + 0.01 + delay;

  const main = ctx.createOscillator();
  main.type = "sine";
  main.frequency.value = freq;

  const overtone = ctx.createOscillator();     // gives the "wooden" color
  overtone.type = "sine";
  overtone.frequency.value = freq * 3.98;
  const overtoneVolume = ctx.createGain();
  overtoneVolume.gain.value = 0.25;

  const volume = ctx.createGain();             // quick knock, then fades away
  volume.gain.setValueAtTime(0.0001, t);
  volume.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
  volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

  const soften = ctx.createBiquadFilter();     // removes harsh high sounds
  soften.type = "lowpass";
  soften.frequency.value = 2800;

  main.connect(volume);
  overtone.connect(overtoneVolume).connect(volume);
  volume.connect(soften).connect(master);

  main.start(t); overtone.start(t);
  main.stop(t + 0.35); overtone.stop(t + 0.35);
}

// Notes of a pleasant scale (C major pentatonic), low to high
const NOTES = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];

function playSound(name, value) {
  if (!prefs.sound) return;
  try {
    if (name === "merge") {
      // bigger tile = higher note
      woodNote(NOTES[Math.min(tileIndex(value), NOTES.length - 1)], 0);
    } else if (name === "record") {
      // beat your record during the game: quick rising "ta-da"
      [5, 7, 8, 10].forEach((n, i) => woodNote(NOTES[n], i * 0.11));
    } else if (name === "gameOver") {
      // three notes going down
      [4, 2, 0].forEach((n, i) => woodNote(NOTES[n] * 0.75, i * 0.24));
    }
  } catch (e) {
    // sound is optional: never let it break the game
  }
}

// 2 -> 0, 4 -> 1, 8 -> 2 ... (position in the lists above)
function tileIndex(value) {
  return Math.log2(value) - 1;
}

function label(value) {
  const tiles = MODES[mode].tiles;
  if (!tiles) return value;                       // classic: numbers
  return tiles[tileIndex(value)] || value;        // past the list: show the number
}

function colorFor(value) {
  const colors = MODES[mode].colors || TILE_COLORS;   // themes have their own colors
  const i = Math.min(tileIndex(value), colors.length - 1);
  return colors[i];
}

// ---------- Tiles ----------

function createTile(value, r, c) {
  return { value: value, r: r, c: c, el: null };
}

// The board as plain numbers (0 = empty). Used for saving and game-over checks.
function boardValues() {
  return board.map(row => row.map(tile => tile ? tile.value : 0));
}

// ---------- Storage ----------

// Builds a storage key for the current mode and size, e.g. "save-animals-4"
function key(name) {
  return name + "-" + mode + "-" + size;
}

function saveGame() {
  localStorage.setItem(key("save"), JSON.stringify({ board: boardValues(), score: score, bestAtStart: bestAtStart }));
}

function loadGame() {
  const data = localStorage.getItem(key("save"));
  if (data === null) return false;
  const saved = JSON.parse(data);
  board = saved.board.map((row, r) =>
    row.map((value, c) => value ? createTile(value, r, c) : null)
  );
  score = saved.score;
  // older saves don't have bestAtStart: use the current best instead
  bestAtStart = saved.bestAtStart !== undefined ? saved.bestAtStart : Number(localStorage.getItem(key("best"))) || 0;
  return true;
}

function deleteSave() {
  localStorage.removeItem(key("save"));
}

function hasSavedGame() {
  return localStorage.getItem(key("save")) !== null;
}

function loadBest() {
  best = Number(localStorage.getItem(key("best"))) || 0;
}

function updateBest() {
  if (score > best) {
    best = score;
    localStorage.setItem(key("best"), best);
  }
}

function saveSettings() {
  localStorage.setItem("settings", JSON.stringify({ mode: mode, size: size }));
}

function loadSettings() {
  const s = JSON.parse(localStorage.getItem("settings"));
  if (s) {
    mode = s.mode;
    size = s.size;
  }
  if (!MODES[mode] || !isUnlocked(mode)) mode = "classic";
}

// ---------- Board data ----------

function createEmptyBoard() {
  board = [];
  for (let r = 0; r < size; r++) {
    board.push(new Array(size).fill(null));
  }
}

// The biggest tile on the board
function maxTile() {
  return Math.max(...boardValues().flat());
}

// Which SPAWN_LEVELS entry applies right now (0, 1, 2 ...)
function spawnLevel() {
  const biggest = maxTile();
  let level = 0;
  SPAWN_LEVELS.forEach((lvl, i) => {
    if (biggest >= lvl.from) level = i;
  });
  return level;
}

// Picks a random value using the % chances of the current level
function randomSpawnValue() {
  const chances = SPAWN_LEVELS[spawnLevel()].tiles;
  let roll = Math.random() * 100;
  for (const value in chances) {
    roll -= chances[value];
    if (roll < 0) return Number(value);
  }
  return 2;
}

// Adds a random tile to a random empty cell and returns it
function addRandomTile() {
  const empty = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const tile = createTile(randomSpawnValue(), r, c);
  board[r][c] = tile;
  return tile;
}

// ---------- Drawing ----------

// Middle of the header, e.g. "🍓 Fruits · 4×4"
function drawModeLabel() {
  document.getElementById("mode-label").textContent = MODES[mode].icon + " " + t(mode) + " · " + size + "×" + size;
}

// Builds the whole board from scratch (only at the start of a game)
function drawBoard() {
  const boardEl = document.getElementById("board");
  boardEl.className = "board " + mode;
  boardEl.style.setProperty("--size", size);
  // themes can have their own board color
  if (MODES[mode].board) boardEl.style.setProperty("--board-bg", MODES[mode].board);
  else boardEl.style.removeProperty("--board-bg");
  boardEl.innerHTML = "";

  // background: empty cells that never move
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    boardEl.appendChild(cell);
  }

  // tile layer on top
  const layer = document.createElement("div");
  layer.className = "tiles";
  layer.id = "tiles";
  boardEl.appendChild(layer);

  board.flat().forEach(tile => {
    if (tile) addTileElement(tile, "");
  });

  drawModeLabel();
  updateScores();
}

// Creates the HTML element for one tile.
// extraClass: "" (no animation) or "new" (dissolves in)
function addTileElement(tile, extraClass) {
  const el = document.createElement("div");
  el.className = "tile " + extraClass;
  tile.el = el;
  showValue(tile);
  showPosition(tile);
  if (extraClass === "new") {
    // make sure a new tile never slides in: no movement for its first frames
    el.style.transition = "none";
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ""; }));
  }
  document.getElementById("tiles").appendChild(el);
}

function showValue(tile) {
  const text = String(label(tile.value));
  const [background, color] = colorFor(tile.value);
  tile.el.textContent = text;
  tile.el.style.background = background;
  tile.el.style.color = color;
  tile.el.dataset.len = Math.min(text.length, 6);   // for font size of long numbers
}

// Changing --r / --c makes the tile slide there (CSS transition)
function showPosition(tile) {
  tile.el.style.setProperty("--r", tile.r);
  tile.el.style.setProperty("--c", tile.c);
}

function updateScores() {
  document.getElementById("score").textContent = score;
  document.getElementById("best").textContent = best;
}

// ---------- Moving ----------

// Moves ONE line of tiles to the left and merges equal neighbours
function slideRow(line) {
  const tiles = line.filter(tile => tile !== null);
  const result = [];
  for (let i = 0; i < tiles.length; i++) {
    const next = tiles[i + 1];
    if (next && tiles[i].value === next.value) {
      tiles[i].value *= 2;                                  // survivor doubles
      score += tiles[i].value;
      merges.push({ survivor: tiles[i], consumed: next });  // remember for the animation
      result.push(tiles[i]);
      i++;                                                  // skip the consumed tile
    } else {
      result.push(tiles[i]);
    }
  }
  while (result.length < size) result.push(null);
  return result;
}

// Moves the whole board (data only). Returns true if anything changed.
function move(direction) {
  merges = [];
  const before = JSON.stringify(boardValues());
  const horizontal = direction === "left" || direction === "right";
  const reversed = direction === "right" || direction === "down";

  for (let i = 0; i < size; i++) {
    let line = horizontal ? board[i] : board.map(row => row[i]);
    if (reversed) line = line.slice().reverse();

    const result = slideRow(line);
    if (reversed) result.reverse();

    // put the line back and tell every tile its new position
    for (let k = 0; k < size; k++) {
      const r = horizontal ? i : k;
      const c = horizontal ? k : i;
      board[r][c] = result[k];
      if (result[k]) {
        result[k].r = r;
        result[k].c = c;
      }
    }
  }

  // consumed tiles slide into the same cell as their partner
  merges.forEach(m => {
    m.consumed.r = m.survivor.r;
    m.consumed.c = m.survivor.c;
  });

  return JSON.stringify(boardValues()) !== before;
}

// ---------- Game over ----------

// Is any move still possible? (an empty cell, or two equal neighbours)
function canMove() {
  const v = boardValues();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (v[r][c] === 0) return true;
      if (c < size - 1 && v[r][c] === v[r][c + 1]) return true;
      if (r < size - 1 && v[r][c] === v[r + 1][c]) return true;
    }
  }
  return false;
}

function showGameOver() {
  const overlay = document.getElementById("overlay");
  const newRecord = score > bestAtStart;

  if (newRecord) {
    document.getElementById("overlay-icon").textContent = "🏆";
    document.getElementById("overlay-title").textContent = t("newRecord");
    document.getElementById("overlay-text").textContent = bestAtStart > 0
      ? t("pointsOld", { score: score, old: bestAtStart })
      : t("points", { score: score });
  } else {
    document.getElementById("overlay-icon").textContent = "😵";
    document.getElementById("overlay-title").textContent = t("gameOver");
    document.getElementById("overlay-text").textContent = t("noMoves", { score: score });
  }

  overlay.classList.toggle("record", newRecord);   // different color for a record
  trackMissions({ games: 1, newRecord: newRecord ? 1 : 0 });
  playSound(newRecord ? "record" : "gameOver");
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  document.getElementById("overlay").classList.add("hidden");
}

function overlayIsOpen() {
  return !document.getElementById("overlay").classList.contains("hidden");
}

// ---------- One turn ----------

function handleMove(direction) {
  if (document.getElementById("game").classList.contains("hidden")) return;
  if (overlayIsOpen()) return;
  if (drawerIsOpen() || modalIsOpen()) return;

  // Fast player? Finish the previous move right now instead of ignoring this swipe.
  finishTurn();
  if (overlayIsOpen()) return;   // that move might have ended the game

  const scoreBefore = score;
  if (!move(direction)) return;

  // 1. SLIDE: every tile glides to its new place
  board.flat().forEach(tile => {
    if (tile) showPosition(tile);
  });
  merges.forEach(m => {
    m.consumed.el.classList.add("absorbing");    // slides underneath its partner
    showPosition(m.consumed);
  });

  // 2. AFTER THE SLIDE (runs after SLIDE_MS, or earlier if the player swipes again)
  const turnMerges = merges;
  finishPending = () => {
    turnMerges.forEach(m => {
      m.consumed.el.remove();     // hidden under its partner
      showValue(m.survivor);      // new emoji/number; the color blends (CSS transition)
    });

    // sound: one note for the biggest merge (no sound when nothing merged)
    if (turnMerges.length > 0) {
      playSound("merge", Math.max(...turnMerges.map(m => m.survivor.value)));
    }

    // beat your old record during this game: short "ta-da" (only once)
    if (!recordPlayed && bestAtStart > 0 && score > bestAtStart) {
      recordPlayed = true;
      setTimeout(() => playSound("record"), 120);
    }

    const tile = addRandomTile();
    if (tile) addTileElement(tile, "new");

    updateBest();
    updateScores();

    // missions: count what happened in this move
    trackMissions({
      moves: 1, merges: turnMerges.length, points: score - scoreBefore,
      mergeValues: turnMerges.map(m => m.survivor.value),
      maxTile: maxTile(), gameScore: score, mode: mode, size: size
    });

    if (!canMove()) {
      deleteSave();                // a finished game can't be continued
      showGameOver();
    } else {
      saveGame();
    }
  };
  slideTimer = setTimeout(finishTurn, SLIDE_MS);
}

function finishTurn() {
  clearTimeout(slideTimer);
  if (finishPending) {
    const finish = finishPending;
    finishPending = null;
    finish();
  }
}

// ---------- Game ----------

function stopAnimation() {
  clearTimeout(slideTimer);
  finishPending = null;
}

function newGame() {
  stopAnimation();
  score = 0;
  createEmptyBoard();
  addRandomTile();
  addRandomTile();
  loadBest();
  bestAtStart = best;
  recordPlayed = false;
  saveGame();
  hideOverlay();
  drawBoard();
}

function continueGame() {
  stopAnimation();
  if (loadGame()) {
    loadBest();
    recordPlayed = score > bestAtStart;   // already beaten before closing the app: don't play it again
    hideOverlay();
    drawBoard();
  }
}

// ---------- Screens ----------

let currentScreen = "menu";
let screenBeforeSettings = "menu";
let screenBeforeMissions = "menu";

function showScreen(name) {
  ["menu", "game", "settings", "missions"].forEach(id => {
    document.getElementById(id).classList.toggle("hidden", id !== name);
  });
  currentScreen = name;
}

function openSettings() {
  screenBeforeSettings = currentScreen;
  closeDrawer();
  updateSettings();
  showScreen("settings");
}

// Highlights the chosen options and updates best score / Continue button
function openMissions() {
  screenBeforeMissions = currentScreen === "missions" ? "menu" : currentScreen;
  closeDrawer();
  renderMissions();
  showScreen("missions");
}

function updateMenu() {
  renderModeButtons();
  document.querySelectorAll("[data-size]").forEach(btn => {
    btn.classList.toggle("selected", Number(btn.dataset.size) === size);
  });
  loadBest();
  document.getElementById("menu-best").textContent = best;
  document.getElementById("continue-btn").classList.toggle("hidden", !hasSavedGame());
}

// ---------- Side menu (drawer) ----------

function openDrawer() {
  finishTurn();                 // finish a sliding move first
  updateDrawer();
  document.getElementById("drawer").classList.add("open");
  document.getElementById("drawer-backdrop").classList.add("open");
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("drawer-backdrop").classList.remove("open");
}

function drawerIsOpen() {
  return document.getElementById("drawer").classList.contains("open");
}

// Highlights the current mode and size
function updateDrawer() {
  renderModeButtons();
  document.querySelectorAll("[data-drawer-size]").forEach(btn => {
    btn.classList.toggle("selected", Number(btn.dataset.drawerSize) === size);
  });
}

// Switches to another mode/size: continues its saved game, or starts a new one
function switchGame(newMode, newSize) {
  if (newMode !== mode || newSize !== size) {
    mode = newMode;
    size = newSize;
    saveSettings();
    if (hasSavedGame()) continueGame();
    else newGame();
    animateBoardSwap();
  }
  closeDrawer();
}

function animateBoardSwap() {
  const wrap = document.querySelector(".board-wrap");
  wrap.classList.remove("swap");
  void wrap.offsetWidth;        // restart the animation
  wrap.classList.add("swap");
}

// ---------- Themes: mode buttons, unlocking ----------

let diamonds = Number(localStorage.getItem("diamonds")) || 0;
let unlocked = JSON.parse(localStorage.getItem("unlocked")) || [];   // e.g. ["halloween"]

// Themes that were removed from the game: give the diamonds back
unlocked.filter(id => !MODES[id]).forEach(() => { diamonds += 100; });
unlocked = unlocked.filter(id => MODES[id]);
localStorage.setItem("unlocked", JSON.stringify(unlocked));
localStorage.setItem("diamonds", diamonds);

function isUnlocked(id) {
  return !MODES[id].price || unlocked.includes(id);
}

// Builds the mode buttons in the home menu and in the side menu
function renderModeButtons() {
  const menuBox = document.getElementById("menu-modes");
  const drawerBox = document.getElementById("drawer-modes");
  menuBox.innerHTML = "";
  drawerBox.innerHTML = "";

  for (const id in MODES) {
    const m = MODES[id];
    const lock = isUnlocked(id) ? "" : "<small>🔒 " + m.price + " 💎</small>";

    const a = document.createElement("button");
    a.className = "option" + (id === mode ? " selected" : "") + (isUnlocked(id) ? "" : " locked");
    a.dataset.mode = id;
    a.innerHTML = m.icon + "<br><span>" + t(id) + "</span>" + lock;
    a.addEventListener("click", () => chooseMode(id, "menu"));
    menuBox.appendChild(a);

    const b = document.createElement("button");
    b.className = "drawer-option" + (id === mode ? " selected" : "") + (isUnlocked(id) ? "" : " locked");
    b.innerHTML = m.icon + " <span>" + t(id) + "</span>" + lock;
    b.addEventListener("click", () => chooseMode(id, "drawer"));
    drawerBox.appendChild(b);
  }
}

// A mode button was tapped (from the home menu or the side menu)
function chooseMode(id, from) {
  if (!isUnlocked(id)) {
    askUnlock(id, from);
    return;
  }
  if (from === "menu") {
    mode = id;
    saveSettings();
    updateMenu();
  } else {
    switchGame(id, size);
  }
}

function askUnlock(id, from) {
  const price = MODES[id].price;
  if (diamonds >= price) {
    showModal({
      icon: MODES[id].icon,
      title: t("unlockTitle", { name: t(id) }),
      text: t("unlockText", { price: price, have: diamonds }),
      buttons: [
        { label: t("unlock"), main: true, action: () => {
          addDiamonds(-price);
          unlocked.push(id);
          localStorage.setItem("unlocked", JSON.stringify(unlocked));
          playSound("record");
          chooseMode(id, from);
        } },
        { label: t("cancel") }
      ]
    });
  } else {
    showModal({
      icon: "💎",
      title: t("notEnoughTitle"),
      text: t("notEnoughText", { price: price, have: diamonds }),
      buttons: [
        { label: "🎯 " + t("missions"), main: true, action: openMissions },
        { label: t("ok") }
      ]
    });
  }
}

// ---------- Popup ----------

function showModal(options) {
  document.getElementById("modal-icon").textContent = options.icon;
  document.getElementById("modal-title").textContent = options.title;
  document.getElementById("modal-text").textContent = options.text;
  const box = document.getElementById("modal-buttons");
  box.innerHTML = "";
  options.buttons.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "btn" + (b.main ? " btn-main" : "");
    btn.textContent = b.label;
    btn.addEventListener("click", () => {
      hideModal();
      if (b.action) b.action();
    });
    box.appendChild(btn);
  });
  document.getElementById("modal").classList.remove("hidden");
}

function hideModal() {
  document.getElementById("modal").classList.add("hidden");
}

function modalIsOpen() {
  return !document.getElementById("modal").classList.contains("hidden");
}

// ---------- Diamonds ----------

// Use a negative number to spend.
function addDiamonds(amount) {
  diamonds += amount;
  localStorage.setItem("diamonds", diamonds);
  updateDiamonds(amount > 0);
}

// Updates every diamond counter, and the dot that says "a reward is waiting"
function updateDiamonds(bump) {
  document.querySelectorAll(".diamond-count").forEach(el => { el.textContent = diamonds; });
  const waiting = hasClaimable();
  document.querySelectorAll(".diamond-chip, .missions-btn").forEach(el => {
    el.classList.toggle("has-dot", waiting);
  });
  if (bump) {
    document.querySelectorAll(".chip").forEach(el => {
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    });
  }
}

// ---------- Missions ----------

// Diamonds for each difficulty
const REWARDS = {
  daily:  { easy: 10, normal: 20, hard: 30 },
  weekly: { normal: 50, hard: 100 }
};

// How many missions of each difficulty are picked
const MISSION_PLAN = {
  daily:  [["easy", 1], ["normal", 1], ["hard", 1]],
  weekly: [["normal", 2], ["hard", 1]]
};

// Every day 3 daily missions are picked from this list, every week 3 weekly ones.
// Never two of the same type at once, and not the same missions as the day/week before.
// Add or change missions freely.
//
// Types:
//   merges        merge tiles N times
//   moves         make N moves
//   reach         create a tile of N
//   scoreGame     score N points in one game
//   points        earn N points in total
//   games         finish N games
//   modeMoves     make N moves in a mode            (mode: "animals")
//   sizeMoves     make N moves on a board size      (size: 3)
//   mergeAtLeast  create N tiles of "value" or more (value: 64)
//   combo         merge "count" pairs in one move, N times (count: 3)
//   variety       play in N different modes
//   sizeReach     create a tile of N on a board size (size: 3)
//   sizeScore     score N points in one game on a board size (size: 3)
//   newRecord     beat your best score N times
const MISSION_POOL = {
  daily: {
    easy: [
      { type: "merges", target: 60 },
      { type: "moves", target: 150 },
      { type: "reach", target: 128 },
      { type: "scoreGame", target: 1500 },
      { type: "points", target: 3000 },
      { type: "games", target: 2 },
      { type: "modeMoves", mode: "classic", target: 60 },
      { type: "modeMoves", mode: "animals", target: 60 },
      { type: "modeMoves", mode: "fruits", target: 60 },
      { type: "sizeMoves", size: 3, target: 60 },
      { type: "variety", target: 2 }
    ],
    normal: [
      { type: "merges", target: 120 },
      { type: "moves", target: 250 },
      { type: "reach", target: 256 },
      { type: "scoreGame", target: 2500 },
      { type: "points", target: 5000 },
      { type: "games", target: 3 },
      { type: "sizeMoves", size: 4, target: 100 },
      { type: "sizeMoves", size: 5, target: 100 },
      { type: "mergeAtLeast", value: 32, target: 10 },
      { type: "sizeReach", size: 3, target: 64 }
    ],
    hard: [
      { type: "merges", target: 200 },
      { type: "reach", target: 512 },
      { type: "scoreGame", target: 4000 },
      { type: "points", target: 8000 },
      { type: "mergeAtLeast", value: 64, target: 5 },
      { type: "combo", count: 3, target: 3 },
      { type: "sizeReach", size: 3, target: 128 },
      { type: "sizeScore", size: 3, target: 500 }
    ]
  },
  weekly: {
    normal: [
      { type: "merges", target: 1000 },
      { type: "moves", target: 1500 },
      { type: "reach", target: 1024 },
      { type: "scoreGame", target: 12000 },
      { type: "points", target: 40000 },
      { type: "games", target: 10 },
      { type: "modeMoves", mode: "classic", target: 400 },
      { type: "modeMoves", mode: "animals", target: 400 },
      { type: "modeMoves", mode: "fruits", target: 400 },
      { type: "sizeMoves", size: 3, target: 300 },
      { type: "mergeAtLeast", value: 128, target: 15 },
      { type: "combo", count: 3, target: 20 },
      { type: "variety", target: 3 }
    ],
    hard: [
      { type: "merges", target: 2000 },
      { type: "moves", target: 2500 },
      { type: "reach", target: 2048 },
      { type: "scoreGame", target: 20000 },
      { type: "points", target: 60000 },
      { type: "games", target: 15 },
      { type: "sizeMoves", size: 5, target: 600 },
      { type: "mergeAtLeast", value: 256, target: 5 },
      { type: "combo", count: 4, target: 3 },
      { type: "sizeReach", size: 3, target: 256 },
      { type: "sizeReach", size: 5, target: 2048 },
      { type: "sizeScore", size: 3, target: 2000 },
      { type: "sizeScore", size: 5, target: 20000 },
      { type: "newRecord", target: 2 }
    ]
  }
};

let missionsData = null;   // { dayKey, daily: [...], weekKey, weekly: [...] }

// "2026-10-16" style key for today (phone's local time)
function dayKey(d) {
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

// Monday of this week (weeks start on Monday)
function mondayOf(d) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return monday;
}

// Random numbers that are always the same for the same text,
// so everyone gets the same missions on the same day
function seededRandom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// Picks missions for "daily" or "weekly" following MISSION_PLAN (e.g. 1 easy, 1 normal, 1 hard).
// "avoid" = the missions from the day/week before, so they don't repeat.
function pickMissions(group, seedText, avoid) {
  const random = seededRandom(seedText);
  const same = (a, b) => a.type === b.type && a.target === b.target && a.mode === b.mode &&
                         a.size === b.size && a.value === b.value && a.count === b.count;
  const picked = [];
  const types = [];
  MISSION_PLAN[group].forEach(([level, count]) => {
    const list = MISSION_POOL[group][level].filter(m => !(avoid || []).some(old => same(old, m)));
    for (let i = list.length - 1; i > 0; i--) {        // shuffle
      const k = Math.floor(random() * (i + 1));
      [list[i], list[k]] = [list[k], list[i]];
    }
    let added = 0;
    for (const m of list) {
      if (added === count) break;
      if (types.includes(m.type)) continue;            // only one of each type
      picked.push(Object.assign({}, m, {
        level: level, reward: REWARDS[group][level], progress: 0, claimed: false
      }));
      types.push(m.type);
      added++;
    }
  });
  return picked;
}

// Loads missions, and makes new ones when a new day or week started
function ensureMissions() {
  if (!missionsData) missionsData = JSON.parse(localStorage.getItem("missions")) || {};
  // missions made before difficulty levels existed: replace them once
  if (missionsData.version !== 2) missionsData = { version: 2 };
  const now = new Date();
  const today = dayKey(now);
  const week = dayKey(mondayOf(now));
  let changed = false;
  if (missionsData.dayKey !== today) {
    missionsData.dayKey = today;
    missionsData.daily = pickMissions("daily", "day" + today, missionsData.daily);
    changed = true;
  }
  if (missionsData.weekKey !== week) {
    missionsData.weekKey = week;
    missionsData.weekly = pickMissions("weekly", "week" + week, missionsData.weekly);
    changed = true;
  }
  if (changed) saveMissions();
}

function saveMissions() {
  localStorage.setItem("missions", JSON.stringify(missionsData));
}

// Called after every move and at game over with what happened
function trackMissions(e) {
  ensureMissions();
  missionsData.daily.concat(missionsData.weekly).forEach(m => {
    if (m.claimed) return;
    if (m.type === "reach" && e.maxTile)          m.progress = Math.max(m.progress, e.maxTile);
    else if (m.type === "scoreGame" && e.gameScore) m.progress = Math.max(m.progress, e.gameScore);
    else if (m.type === "merges")                 m.progress += e.merges || 0;
    else if (m.type === "moves")                  m.progress += e.moves || 0;
    else if (m.type === "points")                 m.progress += e.points || 0;
    else if (m.type === "games")                  m.progress += e.games || 0;
    else if (m.type === "modeMoves" && e.mode === m.mode) m.progress += e.moves || 0;
    else if (m.type === "sizeMoves" && e.size === m.size) m.progress += e.moves || 0;
    else if (m.type === "mergeAtLeast")
      m.progress += (e.mergeValues || []).filter(v => v >= m.value).length;
    else if (m.type === "combo" && (e.merges || 0) >= m.count) m.progress += 1;
    else if (m.type === "variety" && e.moves) {
      m.played = m.played || [];                       // modes played in
      if (!m.played.includes(e.mode)) m.played.push(e.mode);
      m.progress = m.played.length;
    }
    else if (m.type === "sizeReach" && e.size === m.size && e.maxTile)
      m.progress = Math.max(m.progress, e.maxTile);
    else if (m.type === "sizeScore" && e.size === m.size && e.gameScore)
      m.progress = Math.max(m.progress, e.gameScore);
    else if (m.type === "newRecord")                 m.progress += e.newRecord || 0;
    m.progress = Math.min(m.progress, m.target);
  });
  saveMissions();
  updateDiamonds(false);
}

function hasClaimable() {
  ensureMissions();
  return missionsData.daily.concat(missionsData.weekly).some(m => !m.claimed && m.progress >= m.target);
}

function missionText(m) {
  return t("m_" + m.type, {
    n: m.target.toLocaleString(prefs.lang),
    mode: t(m.mode || "classic"),
    size: m.size + "×" + m.size,
    value: m.value,
    count: m.count
  });
}

// "5h 12m" or "3d 4h" until a time
function timeLeft(until) {
  const minutes = Math.max(0, Math.floor((until - Date.now()) / 60000));
  const d = Math.floor(minutes / 1440), h = Math.floor(minutes % 1440 / 60), min = minutes % 60;
  if (d > 0) return d + "d " + h + "h";
  if (h > 0) return h + "h " + min + "m";
  return min + "m";
}

function renderMissions() {
  ensureMissions();
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextMonday = mondayOf(now);
  nextMonday.setDate(nextMonday.getDate() + 7);
  document.getElementById("daily-reset").textContent = t("resetsIn", { time: timeLeft(tomorrow) });
  document.getElementById("weekly-reset").textContent = t("resetsIn", { time: timeLeft(nextMonday) });

  ["daily", "weekly"].forEach(group => {
    const list = document.getElementById(group + "-list");
    list.innerHTML = "";
    missionsData[group].forEach((m, i) => {
      const done = m.progress >= m.target;
      const card = document.createElement("div");
      card.className = "mission" + (done ? " done" : "") + (m.claimed ? " claimed" : "");

      const text = document.createElement("div");
      text.className = "mission-text";
      text.innerHTML = '<span class="level level-' + m.level + '">' + t(m.level) + "</span> ";
      text.appendChild(document.createTextNode(missionText(m)));

      const side = document.createElement("div");
      side.className = "mission-side";
      if (m.claimed) {
        // already collected: the card is just dimmed, nothing else shown
      } else if (done) {
        const btn = document.createElement("button");
        btn.className = "btn btn-main claim-btn";
        btn.textContent = t("claim") + " +" + m.reward + " 💎";
        btn.addEventListener("click", () => claimMission(group, i));
        side.appendChild(btn);
      } else {
        side.innerHTML = '<span class="reward">+' + m.reward + " 💎</span>";
      }

      const progress = document.createElement("div");
      progress.className = "mission-progress";
      const percent = Math.round(m.progress / m.target * 100);
      progress.innerHTML = '<div class="bar"><i style="width:' + percent + '%"></i></div>' +
        "<span>" + m.progress.toLocaleString(prefs.lang) + " / " + m.target.toLocaleString(prefs.lang) + "</span>";

      card.append(text, side, progress);
      list.appendChild(card);
    });
  });
  updateDiamonds(false);
}

function claimMission(group, i) {
  const m = missionsData[group][i];
  if (m.claimed || m.progress < m.target) return;
  m.claimed = true;
  saveMissions();
  addDiamonds(m.reward);
  playSound("record");
  renderMissions();
}

// ---------- Buttons ----------

// Home menu: board size (mode buttons are made in renderModeButtons)
document.querySelectorAll("[data-size]").forEach(btn => {
  btn.addEventListener("click", () => {
    size = Number(btn.dataset.size);
    saveSettings();
    updateMenu();
  });
});

document.getElementById("start-btn").addEventListener("click", () => {
  newGame();
  showScreen("game");
});

document.getElementById("continue-btn").addEventListener("click", () => {
  continueGame();
  showScreen("game");
});

// Game screen header
document.getElementById("menu-btn").addEventListener("click", openDrawer);
document.getElementById("new-game").addEventListener("click", () => {   // in the side menu
  closeDrawer();
  newGame();
});

// Game over message
document.getElementById("again-btn").addEventListener("click", newGame);
document.getElementById("overlay-menu-btn").addEventListener("click", () => {
  updateMenu();
  showScreen("menu");
});

// Side menu
document.querySelectorAll("[data-drawer-size]").forEach(btn => {
  btn.addEventListener("click", () => switchGame(mode, Number(btn.dataset.drawerSize)));
});

document.getElementById("drawer-backdrop").addEventListener("click", closeDrawer);

document.getElementById("drawer-home").addEventListener("click", () => {
  closeDrawer();
  updateMenu();
  showScreen("menu");
});

// Missions and diamonds
document.getElementById("menu-missions-btn").addEventListener("click", openMissions);
document.getElementById("drawer-missions").addEventListener("click", openMissions);
document.querySelectorAll(".diamond-chip").forEach(chip => chip.addEventListener("click", openMissions));
document.getElementById("missions-back").addEventListener("click", () => {
  if (screenBeforeMissions === "menu") updateMenu();
  showScreen(screenBeforeMissions);
});

// Settings
document.getElementById("menu-settings-btn").addEventListener("click", openSettings);
document.getElementById("drawer-settings").addEventListener("click", openSettings);

document.querySelectorAll("[data-theme-choice]").forEach(btn => {
  btn.addEventListener("click", () => {
    prefs.theme = btn.dataset.themeChoice;
    savePrefs();
    applyTheme();
    updateSettings();
  });
});

document.querySelectorAll("[data-lang-choice]").forEach(btn => {
  btn.addEventListener("click", () => {
    prefs.lang = btn.dataset.langChoice;
    savePrefs();
    applyLanguage();
    updateSettings();
  });
});

document.querySelectorAll("[data-sound-choice]").forEach(btn => {
  btn.addEventListener("click", () => {
    prefs.sound = btn.dataset.soundChoice === "on";
    savePrefs();
    updateSettings();
  });
});

document.getElementById("settings-back").addEventListener("click", () => {
  if (screenBeforeSettings === "menu") updateMenu();
  showScreen(screenBeforeSettings);
});

// ---------- Controls ----------

// Arrow keys (computer)
document.addEventListener("keydown", e => {
  const keys = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  const dir = keys[e.key];
  if (!dir) return;
  e.preventDefault();
  handleMove(dir);
});

// Swipes (phone): compare where the finger started and where it lifted
let startX = 0;
let startY = 0;

document.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;

  // drawer open: swipe left closes it, nothing else happens
  if (drawerIsOpen()) {
    if (dx < -50 && Math.abs(dx) > Math.abs(dy)) closeDrawer();
    return;
  }

  const MIN_SWIPE = 30;   // pixels; shorter than this counts as a tap
  if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    handleMove(dx > 0 ? "right" : "left");
  } else {
    handleMove(dy > 0 ? "down" : "up");
  }
});

// ---------- Start ----------
ensureMissions();
loadPrefs();
applyTheme();
applyLanguage();
loadSettings();
updateMenu();
updateDiamonds(false);
showScreen("menu");
