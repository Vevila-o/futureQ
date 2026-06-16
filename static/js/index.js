// js/index.js

// === 假資料區 ===
const DEMO_ENTRIES = {
  "2026-6-1":  { type:"audio", transcript:"今天天氣真好，和老伴去公園散步，看到好多人在打太極。空氣很清新，心情也跟著好起來了。", photo:null },
  "2026-6-2":  { type:"audio", transcript:"小孫子打電話來說學校運動會得了第一名，我好高興，晚上做了他最喜歡吃的紅燒肉。", photo:null },
  "2026-6-3":  { type:"audio", transcript:"去老社區找老朋友王阿姨喝茶，聊了一個下午。她說她兒子要從美國回來了，我們都很開心。", photo:null },
  "2026-6-5":  { type:"audio", transcript:"看了一部老電影，想起年輕時候的事情。那時候我們在電影院排隊好長時間，真的是美好的回憶。", photo:null },
  "2026-6-7":  { type:"audio", transcript:"早上去市場買菜，遇到賣水果的老闆說荔枝上市了，買了一斤回來，甜得很！", photo:null },
  "2026-6-8":  { type:"emoji", emoji:"😊", transcript:"今天心情很好，沒有特別的事，就是覺得生活很平靜很幸福。", photo:null },
  "2026-6-10": { type:"audio", transcript:"和女兒視訊，看到外孫女又長高了不少。她說學鋼琴進步了，還彈了一首給我聽，真開心。", photo:null },
  "2026-6-11": { type:"photo", transcript:"家門口的茉莉花開了，香味飄了整個走廊。拍下來留個紀念，以後翻看也能想起這個香味。", photo:"https://lh3.googleusercontent.com/aida-public/AB6AXuDabO9XMCmKxNTHNYWiTInrpQ2R7RDQTEn_9txxTwr1GLgNGAK3YeRGUL7P598rugiKhwBSY_k8tQz8PMOEt6GiV1aYpl4XkVMRPAwkefY-W9ybY8NVfZkgiNywfUHx0H78Nqsn6nyZBatI66brxK3c9aArJC0rsylt2DHwcGqC8WkypgBpFnUw-61Fr9wb6jTQQZUbNOg-nTInyd6Q82nqoK7MIl0UzHNc9qedT1o6acw1t10xKesvnAUReZTBxcu5wD_VtxNClZBk" },
  "2026-6-14": { type:"photo", transcript:"下午去看了社區的書法展，有好多漂亮的字。看到一幅寫「歲月靜好」的，買了一份印刷品帶回家。", photo:"https://lh3.googleusercontent.com/aida-public/AB6AXuBHQRG1zXlP-uAliC8Yrlbivdr4kYy15tzMgqomHbjQzYc52qaVkB9rmDbwGkPRionT5UeWD2sSvqMlP_rjzQ1QQz_EkR2mA_-CTsgaUV4jZk-ga5nU7n8ydh5m8qbOsmv0UFGoqSYGKaaTE1XoIvFPn0lsVhypwfEoljl6m6jZd5K4Ybx2oF2Ba_bVHOdL1as-EQcODMY5-yqGG79rOhXV2o-4zoIMFHVW6ZVdKte4gVXTbTeL9mk3PaNj_9F7aLVfOCbfqy5ZDJmd" }
};

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