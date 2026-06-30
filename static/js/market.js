// =========================================
// market.js — 整理菜籃遊戲邏輯
// 操作：直接拖曳（無長按等待）
// 四個階段：種類 → 顏色 → 生熟 → 隨機混合
// =========================================

// ──────────────────────────────────────────
// 工具函式
// ──────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ──────────────────────────────────────────
// 音效（Web Audio API，不需音檔）
// ──────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return _audioCtx;
}
function playTone(freq, dur, type = 'sine', vol = 0.25) {
  const ctx = getAudioCtx(); if (!ctx) return;
  try {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function playCorrectSound() {
  playTone(523, .1);
  setTimeout(() => playTone(659, .1), 90);
  setTimeout(() => playTone(784, .18), 180);
}
function playWrongSound() { playTone(280, .25, 'sawtooth', .12); }

// ──────────────────────────────────────────
// 遊戲資料
// ──────────────────────────────────────────
const RULE_BASKETS = {
  kind: [
    { label: '蔬菜', emoji: '🥦', color: 'green'  },
    { label: '水果', emoji: '🍎', color: 'orange' },
    { label: '肉蛋', emoji: '🥩', color: 'warm'   },
  ],
  color: [
    { label: '紅色', emoji: '🔴', color: 'red'    },
    { label: '綠色', emoji: '🟢', color: 'green'  },
    { label: '黃色', emoji: '🟡', color: 'yellow' },
  ],
  cook: [
    { label: '生食', emoji:'🥗', color: 'green'  },
    { label: '熟食', emoji:'🍳', color: 'orange' },
  ],
};

const RULE_NAMES = { kind: '種類', color: '顏色', cook: '能否生吃' };

const STAGES_CONFIG = [
  {
    id: 1, name: '第 1 階段', ruleName: '種類',
    announceTitle: '遊戲開始！',
    announceDesc:  '請依照「種類」\n將食材放入對應的籃子！',
    baskets: RULE_BASKETS.kind, totalQ: 3,
    items: [
      { emoji: '🥬', name: '菠菜',   basket: 0 },
      { emoji: '🥕', name: '紅蘿蔔', basket: 0 },
      { emoji: '🥦', name: '花椰菜', basket: 0 },
      { emoji: '🍎', name: '蘋果',   basket: 1 },
      { emoji: '🍌', name: '香蕉',   basket: 1 },
      { emoji: '🍇', name: '葡萄',   basket: 1 },
      { emoji: '🍉', name: '西瓜',   basket: 1 },
      { emoji: '🥚', name: '雞蛋',   basket: 2 },
      { emoji: '🥩', name: '豬肉',   basket: 2 },
      { emoji: '🐟', name: '魚',     basket: 2 },
    ],
  },
  {
    id: 2, name: '第 2 階段', ruleName: '顏色',
    announceTitle: '規則改變囉！',
    announceDesc:  '現在請依照食材的「顏色」\n分類放入對應的籃子！',
    baskets: RULE_BASKETS.color, totalQ: 3,
    items: [
      { emoji: '🍎', name: '蘋果',   basket: 0 },
      { emoji: '🍓', name: '草莓',   basket: 0 },
      { emoji: '🍅', name: '番茄',   basket: 0 },
      { emoji: '🌶️', name: '紅辣椒', basket: 0 },
      { emoji: '🥬', name: '菠菜',   basket: 1 },
      { emoji: '🫑', name: '青椒',   basket: 1 },
      { emoji: '🥒', name: '小黃瓜', basket: 1 },
      { emoji: '🍌', name: '香蕉',   basket: 2 },
      { emoji: '🌽', name: '玉米',   basket: 2 },
      { emoji: '🍋', name: '檸檬',   basket: 2 },
    ],
  },
  {
    id: 3, name: '第 3 階段', ruleName: '能否生吃',
    announceTitle: '再次改變！',
    announceDesc:  '現在請依照「能否生吃」\n分類食材！',
    baskets: RULE_BASKETS.cook, totalQ: 3,
    items: [
      { emoji: '🍎', name: '蘋果',   basket: 0 },
      { emoji: '🍓', name: '草莓',   basket: 0 },
      { emoji: '🍇', name: '葡萄',   basket: 0 },
      { emoji: '🍉', name: '西瓜',   basket: 0 },
      { emoji: '🥬', name: '生菜',   basket: 0 },
      { emoji: '🍚', name: '白飯',   basket: 1 },
      { emoji: '🍜', name: '麵條',   basket: 1 },
      { emoji: '🍗', name: '烤雞',   basket: 1 },
      { emoji: '🥚', name: '水煮蛋', basket: 1 },
      { emoji: '🍔', name: '漢堡',   basket: 1 },
    ],
  },
  {
    id: 4, name: '第 4 階段', ruleName: '隨機挑戰',
    announceTitle: '最終挑戰！',
    announceDesc:  '每題前都會告訴你分類規則，\n請仔細看清楚再作答！',
    baskets: null, totalQ: 3, items: null,
  },
];

const STAGE4_POOL = [
  { emoji: '🍊', name: '橘子',   ruleKey: 'kind',  basket: 1 },
  { emoji: '🍄', name: '蘑菇',   ruleKey: 'kind',  basket: 0 },
  { emoji: '🦐', name: '蝦子',   ruleKey: 'kind',  basket: 2 },
  { emoji: '🍍', name: '鳳梨',   ruleKey: 'kind',  basket: 1 },
  { emoji: '🌶️', name: '紅椒',   ruleKey: 'color', basket: 0 },
  { emoji: '🥑', name: '酪梨',   ruleKey: 'color', basket: 1 },
  { emoji: '🌽', name: '玉米',   ruleKey: 'color', basket: 2 },
  { emoji: '🍓', name: '草莓',   ruleKey: 'color', basket: 0 },
  { emoji: '🍊', name: '橘子',   ruleKey: 'cook',  basket: 0 },
  { emoji: '🍱', name: '便當',   ruleKey: 'cook',  basket: 1 },
  { emoji: '🍇', name: '葡萄',   ruleKey: 'cook',  basket: 0 },
  { emoji: '🍳', name: '荷包蛋', ruleKey: 'cook',  basket: 1 },
];

// ──────────────────────────────────────────
// 遊戲狀態
// ──────────────────────────────────────────
let gs = {
  stageIndex:    0,
  questionIndex: 0,
  totalScore:    0,
  isAnimating:   false,
  stages:        [],
};

// ──────────────────────────────────────────
// DOM 快取
// ──────────────────────────────────────────
const cardWrap        = document.getElementById('cardWrap');
const gameCard        = document.getElementById('gameCard');
const itemEmoji       = document.getElementById('itemEmoji');
const itemName        = document.getElementById('itemName');
const stageBadge      = document.getElementById('stageBadge');
const progressLabel   = document.getElementById('progressLabel');
const progressPct     = document.getElementById('progressPct');
const progressFill    = document.getElementById('progressFill');
const ruleHint        = document.getElementById('ruleHint');
const ruleHintText    = document.getElementById('ruleHintText');
const basketsEl       = document.getElementById('basketsEl');
const announceOverlay = document.getElementById('announceOverlay');
const announceStage   = document.getElementById('announceStage');
const announceTitle   = document.getElementById('announceTitle');
const announceDesc    = document.getElementById('announceDesc');
const announcePills   = document.getElementById('announcePills');
const announceBtn     = document.getElementById('announceBtn');
const endOverlay      = document.getElementById('endOverlay');

// ──────────────────────────────────────────
// 遊戲啟動
// ──────────────────────────────────────────
function initGame() {
  gs.stages = STAGES_CONFIG.map((cfg, i) => {
    const s = { ...cfg };
    if (i === 3) s.items = shuffle([...STAGE4_POOL]);
    else         s.items = shuffle([...cfg.items]);
    return s;
  });
  gs.stageIndex    = 0;
  gs.questionIndex = 0;
  gs.totalScore    = 0;
  gs.isAnimating   = false;
  endOverlay.style.display = 'none';
  showAnnounce(0);
}

// ──────────────────────────────────────────
// 階段說明
// ──────────────────────────────────────────
function showAnnounce(idx) {
  const stage = gs.stages[idx];
  announceStage.textContent = stage.name;
  announceTitle.textContent = stage.announceTitle;
  announceDesc.textContent  = stage.announceDesc;

  announcePills.innerHTML = '';
  if (idx === 3) {
    const p = document.createElement('div');
    p.className = 'mkt-announce-pill';
    p.textContent = '種類 / 顏色 / 能否生吃 混合出題';
    announcePills.appendChild(p);
  } else {
    stage.baskets.forEach(b => {
      const p = document.createElement('div');
      p.className = 'mkt-announce-pill';
      p.textContent = `${b.emoji} ${b.label}`;
      announcePills.appendChild(p);
    });
  }

  announceOverlay.style.display = 'flex';
  announceBtn.onclick = () => {
    announceOverlay.style.display = 'none';
    startStage(idx);
  };
}

// ──────────────────────────────────────────
// 開始階段
// ──────────────────────────────────────────
function startStage(idx) {
  gs.stageIndex    = idx;
  gs.questionIndex = 0;
  gs.isAnimating   = false;

  const stage = gs.stages[idx];
  stageBadge.textContent = `${stage.name}｜${stage.ruleName}`;
  ruleHint.style.display = idx === 3 ? 'flex' : 'none';

  showQuestion();
}

// ──────────────────────────────────────────
// 顯示題目
// ──────────────────────────────────────────
function showQuestion() {
  const stage = gs.stages[gs.stageIndex];
  const item  = stage.items[gs.questionIndex];

  const currentBaskets = gs.stageIndex === 3
    ? RULE_BASKETS[item.ruleKey]
    : stage.baskets;

  if (gs.stageIndex === 3) {
    ruleHintText.textContent = `本題請依照「${RULE_NAMES[item.ruleKey]}」分類`;
  }

  const q = gs.questionIndex, tot = stage.totalQ;
  progressLabel.textContent = `第 ${q + 1} 題 / 共 ${tot} 題`;
  progressPct.textContent   = `${Math.round((q / tot) * 100)}%`;
  progressFill.style.width  = `${Math.round((q / tot) * 100)}%`;

  itemEmoji.textContent = item.emoji;
  itemName.textContent  = item.name;

  resetCard();
  renderBaskets(currentBaskets);
}

// ──────────────────────────────────────────
// 渲染籃子
// ──────────────────────────────────────────
function renderBaskets(baskets) {
  basketsEl.innerHTML     = '';
  basketsEl.dataset.count = baskets.length;
  baskets.forEach((b, i) => {
    const el = document.createElement('div');
    el.className   = `mkt-basket mkt-basket--${b.color}`;
    el.dataset.idx = i;
    el.innerHTML = `
      <div class="mkt-basket-visual">🧺</div>
      <div class="mkt-basket-label">
        <span class="mkt-basket-cat-emoji">${b.emoji}</span>
        <span class="mkt-basket-cat-text">${b.label}</span>
      </div>
    `;
    basketsEl.appendChild(el);
  });
}

// ──────────────────────────────────────────
// 重設卡片
// ──────────────────────────────────────────
function resetCard() {
  cardWrap.classList.remove('dragging');
  cardWrap.style.transform  = '';
  cardWrap.style.transition = '';
  cardWrap.style.opacity    = '1';
}

// ──────────────────────────────────────────
// 答案判斷
// ──────────────────────────────────────────
function handleAnswer(droppedIdx) {
  if (gs.isAnimating) return;
  gs.isAnimating = true;

  const item    = gs.stages[gs.stageIndex].items[gs.questionIndex];
  const correct = droppedIdx === item.basket;

  if (correct) {
    gs.totalScore++;
    playCorrectSound();
    flashBasket(droppedIdx, 'correct');
    flyCardToBasket(droppedIdx, advanceQuestion);
  } else {
    playWrongSound();
    flashBasket(droppedIdx, 'wrong');
    snapCardBack(() => { gs.isAnimating = false; });
  }
}

// ──────────────────────────────────────────
// 卡片飛入籃子（答對）
// ──────────────────────────────────────────
function flyCardToBasket(basketIdx, callback) {
  const baskets    = basketsEl.querySelectorAll('.mkt-basket');
  const targetRect = baskets[basketIdx].getBoundingClientRect();
  const cardRect   = gameCard.getBoundingClientRect();

  const toX = (targetRect.left + targetRect.width  / 2) - (cardRect.left + cardRect.width  / 2);
  const toY = (targetRect.top  + targetRect.height / 2) - (cardRect.top  + cardRect.height / 2);

  const m = new DOMMatrix(window.getComputedStyle(cardWrap).transform);

  cardWrap.classList.remove('dragging');
  cardWrap.style.transition = 'transform .35s cubic-bezier(.4,0,.6,1), opacity .3s';
  cardWrap.style.transform  = `translate(${m.m41 + toX}px, ${m.m42 + toY}px) scale(.2)`;
  cardWrap.style.opacity    = '0';

  setTimeout(callback, 400);
}

// ──────────────────────────────────────────
// 卡片退回原位（答錯）
// ──────────────────────────────────────────
function snapCardBack(callback) {
  cardWrap.classList.remove('dragging');
  cardWrap.style.transition = 'transform .3s cubic-bezier(.175,.885,.32,1.275), opacity .2s';
  cardWrap.style.transform  = 'translate(0,0) scale(1)';
  cardWrap.style.opacity    = '1';
  setTimeout(() => { cardWrap.style.transition = ''; callback(); }, 330);
}

// ──────────────────────────────────────────
// 籃子閃光
// ──────────────────────────────────────────
function flashBasket(idx, type) {
  const el  = basketsEl.querySelectorAll('.mkt-basket')[idx];
  const cls = type === 'correct' ? 'flash-correct' : 'flash-wrong';
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 700);
}

// ──────────────────────────────────────────
// 前進下一題
// ──────────────────────────────────────────
function advanceQuestion() {
  gs.questionIndex++;
  if (gs.questionIndex >= gs.stages[gs.stageIndex].totalQ) {
    endStage();
  } else {
    gs.isAnimating = false;
    showQuestion();
  }
}

function endStage() {
  const nextIdx = gs.stageIndex + 1;
  if (nextIdx >= gs.stages.length) {
    showEndScreen();
  } else {
    setTimeout(() => showAnnounce(nextIdx), 300);
  }
}

// ──────────────────────────────────────────
// 遊戲結束
// ──────────────────────────────────────────
function showEndScreen() {
  const total = gs.stages.reduce((sum, s) => sum + s.totalQ, 0), score = gs.totalScore;
  const pct   = Math.round((score / total) * 100);
  let icon, msg;
  if      (pct >= 90) { icon = '🏆'; msg = '太厲害了！大腦超靈活！'; }
  else if (pct >= 70) { icon = '🎉'; msg = '表現很棒，繼續加油！'; }
  else if (pct >= 50) { icon = '😊'; msg = '不錯喔，再多練習幾次！'; }
  else                { icon = '💪'; msg = '多玩幾次，一定可以進步！'; }

  document.getElementById('endIcon').textContent  = icon;
  document.getElementById('endScore').textContent = `答對 ${score} / ${total} 題`;
  document.getElementById('endMsg').textContent   = msg;
  progressFill.style.width = '100%';
  progressPct.textContent  = '100%';
  endOverlay.style.display = 'flex';
}

// ──────────────────────────────────────────
// 直接拖曳互動
// ──────────────────────────────────────────
let isDragging = false;
let startX = 0, startY = 0;

function onDragStart(x, y) {
  if (gs.isAnimating) return;
  isDragging = true;
  startX = x; startY = y;
  cardWrap.classList.add('dragging');
}

function onDragMove(x, y) {
  if (!isDragging) return;
  cardWrap.style.transition = '';
  cardWrap.style.transform  = `translate(${x - startX}px, ${y - startY}px)`;
  highlightBasketAt(x, y);
}

function onDragEnd(x, y) {
  if (!isDragging) return;
  isDragging = false;
  basketsEl.querySelectorAll('.mkt-basket').forEach(b => b.classList.remove('drop-target'));

  const targetIdx = getBasketAt(x, y);
  if (targetIdx !== -1) {
    handleAnswer(targetIdx);
  } else {
    snapCardBack(() => { gs.isAnimating = false; });
  }
}

function getBasketAt(x, y) {
  const baskets = basketsEl.querySelectorAll('.mkt-basket');
  for (let i = 0; i < baskets.length; i++) {
    const r = baskets[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
  }
  return -1;
}

function highlightBasketAt(x, y) {
  basketsEl.querySelectorAll('.mkt-basket').forEach(b => {
    const r = b.getBoundingClientRect();
    b.classList.toggle('drop-target',
      x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  });
}

// 觸控事件
cardWrap.addEventListener('touchstart', e => {
  const t = e.touches[0];
  onDragStart(t.clientX, t.clientY);
}, { passive: true });

cardWrap.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  onDragMove(t.clientX, t.clientY);
}, { passive: false });

cardWrap.addEventListener('touchend', e => {
  const t = e.changedTouches[0];
  onDragEnd(t.clientX, t.clientY);
});

cardWrap.addEventListener('touchcancel', () => {
  isDragging = false;
  snapCardBack(() => { gs.isAnimating = false; });
});

// 滑鼠事件（電腦測試用）
cardWrap.addEventListener('mousedown', e => {
  onDragStart(e.clientX, e.clientY);
  const onMove = e => onDragMove(e.clientX, e.clientY);
  const onUp   = e => {
    onDragEnd(e.clientX, e.clientY);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
});

// ──────────────────────────────────────────
// 結束畫面按鈕
// ──────────────────────────────────────────
document.getElementById('btnReplay').addEventListener('click', initGame);

document.getElementById('btnBack').addEventListener('click', () => {
  // Django server 啟動時用 /game/
  // 直接開 HTML 檔測試時用相對路徑 game.html
  if (window.location.protocol === 'file:') {
    window.location.href = 'game.html';
  } else {
    window.location.href = '/game/';
  }
});

// ──────────────────────────────────────────
// 啟動
// ──────────────────────────────────────────
initGame();