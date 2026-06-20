// js/index.js

// === 從 Django 資料庫傳來的真資料 ===
// index.html 需要先有：window.CALENDAR_DATA = [...]
const CALENDAR_DATA = window.CALENDAR_DATA || [];

// 轉成原本日曆程式吃得懂的格式：
// 原本 key 是 "2026-6-18"
const DEMO_ENTRIES = {};

CALENDAR_DATA.forEach(entry => {
  if (!entry.date) return;

  // entry.date 會是 "2026-06-18"
  const [year, month, day] = entry.date.split("-").map(Number);
  const key = `${year}-${month}-${day}`;

  DEMO_ENTRIES[key] = {
    type: entry.photo ? "photo" : "audio",
    transcript: entry.transcript || "尚無語音轉譯內容",
    photo: entry.photo || null,
    ai_response: entry.ai_response || "",
    status: entry.status || "",
  };
});

// === 日曆狀態變數 ===
const today = new Date();
let curYear  = today.getFullYear();
let curMonth = today.getMonth();
let calView  = "dot"; // "dot" | "list"
let pickerYear = curYear;

const WEEKDAYS = ["一","二","三","四","五","六","日"];
const WEEK_NAMES = ["日","一","二","三","四","五","六"];

// === 日曆渲染邏輯 ===
function buildCalendar() {
  updateCalHeader();
  if (calView === "dot") {
    renderDotView();
  } else {
    renderListView();
  }
}

function updateCalHeader() {
  document.getElementById("cal-title").textContent = `${curYear}年${String(curMonth+1).padStart(2,"0")}月`;
  document.getElementById("picker-label").textContent = `${curYear}年 ${curMonth+1}月`;
}

function renderDotView() {
  document.getElementById("cal-grid").style.display = "grid";
  document.getElementById("cal-list").style.display = "none";
  document.querySelector(".cal-weekdays").style.display = "grid";

  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";

  const firstDay    = new Date(curYear, curMonth, 1).getDay();
  const offset      = (firstDay === 0) ? 6 : firstDay - 1;
  const daysInMonth = new Date(curYear, curMonth+1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const el = document.createElement("div");
    el.className = "cal-cell cal-empty";
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell  = document.createElement("div");
    cell.className = "cal-cell";
    const key   = `${curYear}-${curMonth+1}-${d}`;
    const entry = DEMO_ENTRIES[key];
    const isToday = isTodayCheck(d);

    if (entry) {
      const dot = makeDotEl(entry, d);
      dot.addEventListener("click", () => openEntry(key, d));
      cell.appendChild(dot);
    } else if (isToday) {
      cell.classList.add("cal-day-today");
      const ring = document.createElement("div");
      ring.className = "day-ring";
      ring.textContent = d;
      cell.appendChild(ring);
    } else {
      const num = document.createElement("span");
      num.className = "cal-day-num";
      num.textContent = d;
      cell.appendChild(num);
    }
    grid.appendChild(cell);
  }
}

function makeDotEl(entry, d) {
  const dot = document.createElement("div");
  dot.className = "day-dot";
  if (entry.type === "photo" && entry.photo) {
    dot.classList.add("dot-photo");
    const img = document.createElement("img");
    img.src = entry.photo; img.alt = `${d}日照片`;
    dot.appendChild(img);
  } else if (entry.type === "emoji") {
    dot.classList.add("dot-emoji");
    dot.textContent = entry.emoji || "😊";
  } else {
    dot.classList.add("dot-audio");
    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.style.cssText = "color:#4B69FF;font-size:20px;font-variation-settings:'FILL' 1;";
    icon.textContent = "play_arrow";
    dot.appendChild(icon);
  }
  return dot;
}

function renderListView() {
  document.getElementById("cal-grid").style.display = "none";
  document.querySelector(".cal-weekdays").style.display = "none";
  const list = document.getElementById("cal-list");
  list.style.display = "block";
  list.innerHTML = "";

  const daysInMonth = new Date(curYear, curMonth+1, 0).getDate();
  const entriesThisMonth = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${curYear}-${curMonth+1}-${d}`;
    if (DEMO_ENTRIES[key]) entriesThisMonth.push({ d, key, entry: DEMO_ENTRIES[key] });
  }

  if (entriesThisMonth.length === 0) {
    list.innerHTML = `<div class="list-empty">這個月還沒有日記記錄</div>`;
    return;
  }

  entriesThisMonth.forEach(({ d, key, entry }) => {
    const dayDate = new Date(curYear, curMonth, d);
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-date">
        <div class="list-day-num">${d}</div>
        <div class="list-day-week">週${WEEK_NAMES[dayDate.getDay()]}</div>
      </div>
      <div class="list-thumb">
        ${entry.photo
          ? `<img src="${entry.photo}" alt="${d}日照片"/>`
          : `<span class="list-thumb-icon">${entry.type==="emoji" ? (entry.emoji||"😊") : "🎙️"}</span>`}
      </div>
      <div class="list-content">
        <div class="list-excerpt">${entry.transcript}</div>
      </div>
    `;
    item.addEventListener("click", () => openEntry(key, d));
    list.appendChild(item);
  });
}

function isTodayCheck(d) {
  return curYear  === today.getFullYear()
      && curMonth === today.getMonth()
      && d        === today.getDate();
}

function toggleView() {
  calView = (calView === "dot") ? "list" : "dot";
  const btn = document.getElementById("btn-view-toggle");
  btn.textContent = (calView === "dot") ? "以日期顯示" : "以圓點顯示";
  btn.classList.toggle("active-view", calView === "list");
  buildCalendar();
}

// === 日記 Modal 邏輯 ===
function openEntry(key, day) {
  const entry = DEMO_ENTRIES[key];
  if (!entry) return;

  document.getElementById("modal-date").textContent = `${curYear}年${curMonth+1}月${day}日`;

  const img         = document.getElementById("modal-photo-img");
  const placeholder = document.getElementById("modal-photo-placeholder");
  if (entry.photo) {
    img.src = entry.photo;
    img.style.display = "block";
    placeholder.style.display = "none";
  } else {
    img.style.display = "none";
    placeholder.style.display = "flex";
  }
  document.getElementById("modal-transcript").textContent = entry.transcript || "尚無轉譯內容。";

  showOverlay("entry-overlay", "entry-modal", "translateY(100%)", "translateY(0)");
}

function closeEntry() {
  hideOverlay("entry-overlay", "entry-modal", "translateY(100%)");
}

// === 年月選擇器邏輯 ===
function openPicker() {
  pickerYear = curYear;
  renderPicker();
  const popup = document.getElementById("picker-popup");
  popup.style.display = "flex";
  requestAnimationFrame(() => {
    popup.classList.add("open");
    requestAnimationFrame(() => popup.classList.add("visible"));
  });
}

function closePicker() {
  const popup = document.getElementById("picker-popup");
  popup.classList.remove("visible");
  setTimeout(() => { popup.classList.remove("open"); popup.style.display = "none"; }, 200);
}

function renderPicker() {
  document.getElementById("picker-year-label").textContent = `${pickerYear} 年`;
  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const grid = document.getElementById("picker-months");
  grid.innerHTML = "";
  monthNames.forEach((name, idx) => {
    const btn = document.createElement("button");
    btn.className = "picker-month-btn";
    btn.textContent = name;
    if (pickerYear === curYear && idx === curMonth) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      curYear = pickerYear; curMonth = idx;
      buildCalendar(); closePicker();
    });
    grid.appendChild(btn);
  });
}

// === 通用 Overlay 顯示/隱藏函數 ===
function showOverlay(overlayId, panelId, fromTransform, toTransform) {
  const overlay = document.getElementById(overlayId);
  const panel   = document.getElementById(panelId);
  if (panel) panel.style.transform = fromTransform;
  overlay.style.display = "flex";
  requestAnimationFrame(() => {
    overlay.classList.add("open");
    requestAnimationFrame(() => {
      overlay.classList.add("visible");
      if (panel) panel.style.transform = toTransform;
    });
  });
}

function hideOverlay(overlayId, panelId, toTransform) {
  const overlay = document.getElementById(overlayId);
  const panel   = document.getElementById(panelId);
  overlay.classList.remove("visible");
  if (panel) panel.style.transform = toTransform;
  setTimeout(() => { overlay.classList.remove("open"); overlay.style.display = "none"; }, 300);
}

// === 初始化 ===
document.addEventListener("DOMContentLoaded", () => {
  // 渲染初始日曆
  buildCalendar();

  // 日曆切換月份與視圖
  document.getElementById("btn-prev").addEventListener("click", () => {
    curMonth--; if (curMonth < 0) { curMonth = 11; curYear--; } buildCalendar();
  });
  document.getElementById("btn-next").addEventListener("click", () => {
    curMonth++; if (curMonth > 11) { curMonth = 0; curYear++; } buildCalendar();
  });
  document.getElementById("btn-view-toggle").addEventListener("click", toggleView);

  // 選擇器事件
  document.getElementById("btn-picker").addEventListener("click", openPicker);
  document.getElementById("picker-popup").addEventListener("click", e => {
    if (e.target === e.currentTarget) closePicker();
  });
  document.getElementById("picker-prev-year").addEventListener("click", () => {
    pickerYear--; renderPicker();
  });
  document.getElementById("picker-next-year").addEventListener("click", () => {
    pickerYear++; renderPicker();
  });

  // 日記 Modal 事件
  document.getElementById("modal-close-btn").addEventListener("click", closeEntry);
  document.getElementById("entry-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeEntry();
  });
});