// js/header.js
document.addEventListener("DOMContentLoaded", () => {
  fetch("/header/")
    .then(response => {
      if (!response.ok) throw new Error("無法載入 Header");
      return response.text();
    })
    .then(data => {
      document.getElementById("header-placeholder").innerHTML = data;
      initHeaderLogic(); // HTML 載入完成後，初始化所有設定與通知功能
    })
    .catch(error => console.error("載入 Header 發生錯誤:", error));
});

function initHeaderLogic() {
  // 1. 通知資料與邏輯
  const NOTIFICATIONS = [
    { id: 1, type:"reminder", unread:true, icon:"🔔", title:"今日尚未記錄", desc:"今天還沒有日記喔，點這裡開始錄音吧！", time:"剛剛" },
    { id: 2, type:"family", unread:true, icon:"👨‍👩‍👧", title:"家人查看了你的日記", desc:"小明在 10 分鐘前看了你 6月11日 的茉莉花記錄", time:"10 分鐘前" },
    { id: 3, type:"memory", unread:true, icon:"✨", title:"一年前的今天", desc:"去年的 6月15日 你記錄了和老伴去陽明山踏青", time:"1 小時前" },
    { id: 4, type:"health", unread:false, icon:"🧠", title:"認知健康週報", desc:"本週你共記錄了 5 篇日記，語言流暢度良好", time:"昨天" },
    { id: 5, type:"family", unread:false, icon:"💌", title:"女兒傳了訊息", desc:"林小玲：「媽，記得吃藥喔～我下週五回來看你！」", time:"昨天" },
    { id: 6, type:"reminder", unread:false, icon:"📸", title:"相片上傳成功", desc:"你在 6月14日 上傳的書法展照片已儲存完成。", time:"2 天前" }
  ];
  let readIds = new Set();

  function renderNotifications() {
    const list = document.getElementById("notif-list");
    const unreadCount = NOTIFICATIONS.filter(n => n.unread && !readIds.has(n.id)).length;
    const badge = document.getElementById("notif-badge");
    badge.classList.toggle("hidden", unreadCount === 0);

    list.innerHTML = "";
    if (NOTIFICATIONS.length === 0) {
      list.innerHTML = `<div class="notif-empty"><span class="material-symbols-outlined" style="font-size:40px;opacity:.3;">notifications_none</span>目前沒有通知</div>`;
      return;
    }
    NOTIFICATIONS.forEach(n => {
      const isUnread = n.unread && !readIds.has(n.id);
      const item = document.createElement("div");
      item.className = `notif-item${isUnread?" unread":""}`;
      const typeClass = { reminder:"type-reminder", family:"type-family", memory:"type-memory", health:"type-health" }[n.type] || "";
      item.innerHTML = `
        <div class="notif-icon ${typeClass}">${n.icon}</div>
        <div class="notif-body">
          <div class="notif-title">${n.title}</div>
          <div class="notif-desc">${n.desc}</div>
          <div class="notif-time">${n.time}</div>
        </div>
      `;
      item.addEventListener("click", () => { readIds.add(n.id); renderNotifications(); });
      list.appendChild(item);
    });
  }

  // 2. 顯示與隱藏面板的函式
  function openNotifications() {
    renderNotifications();
    const overlay = document.getElementById("notif-overlay");
    overlay.style.display = "flex";
    requestAnimationFrame(() => {
      overlay.classList.add("open");
      requestAnimationFrame(() => overlay.classList.add("visible"));
    });
    setTimeout(() => {
      NOTIFICATIONS.forEach(n => readIds.add(n.id));
      renderNotifications();
    }, 1500);
  }
  function closeNotifications() {
    const overlay = document.getElementById("notif-overlay");
    overlay.classList.remove("visible");
    setTimeout(() => { overlay.classList.remove("open"); overlay.style.display = "none"; }, 250);
  }
  function openSettings() {
    const overlay = document.getElementById("settings-overlay");
    overlay.style.display = "flex";
    requestAnimationFrame(() => {
      overlay.classList.add("open");
      requestAnimationFrame(() => overlay.classList.add("visible"));
    });
  }
  function closeSettings() {
    const overlay = document.getElementById("settings-overlay");
    overlay.classList.remove("visible");
    setTimeout(() => { overlay.classList.remove("open"); overlay.style.display = "none"; }, 250);
  }

  // 3. 字體與主題設定邏輯
  const FONT_STEPS = [.8,.875,.95,1,1.1,1.2,1.35,1.5,1.65,1.8];
  const FONT_LABELS = ["最小","很小","較小","標準","稍大","大","很大","超大","特大","最大"];
  let fontIdx = 3;

  function applyFont() {
    document.documentElement.style.setProperty("--fs-scale", FONT_STEPS[fontIdx]);
    document.getElementById("font-val").textContent = fontIdx + 1;
    document.getElementById("font-size-label").textContent = `${FONT_LABELS[fontIdx]}（${Math.round(FONT_STEPS[fontIdx]*100)}%）`;
    document.getElementById("font-dec").disabled = (fontIdx === 0);
    document.getElementById("font-inc").disabled = (fontIdx === FONT_STEPS.length - 1);
  }

  const THEMES = {
    green:  { primary: '#36684c', secondary: '#d4ede0', onSecondary: '#0d3325' },
    blue:   { primary: '#3872ef', secondary: '#dbeafe', onSecondary: '#1e3a8a' },
    purple: { primary: '#854be9', secondary: '#ede9fe', onSecondary: '#4c1d95' },
    warm:   { primary: '#e97345', secondary: '#ffedd5', onSecondary: '#7c2d12' },
  };
  function applyTheme(name) {
    const t = THEMES[name] || THEMES['green'];
    document.documentElement.style.setProperty('--primary', t.primary);
    document.documentElement.style.setProperty('--secondary-container', t.secondary);
    document.documentElement.style.setProperty('--on-secondary-container', t.onSecondary);
    document.documentElement.style.setProperty('--surface-tint', t.surfaceTint);  // 新增
    document.documentElement.style.setProperty('--icon-color', t.iconColor);      // 新增
  }

  function setupToggle(id, cb) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const on = btn.classList.toggle("on");
      btn.setAttribute("aria-checked", on);
      if (cb) cb(on);
    });
  }

  // 4. 綁定所有的事件監聽器
  document.getElementById("btn-notif").addEventListener("click", openNotifications);
  document.getElementById("notif-overlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeNotifications(); });
  document.getElementById("btn-notif-close").addEventListener("click", closeNotifications);
  document.getElementById("btn-notif-clear").addEventListener("click", () => { NOTIFICATIONS.forEach(n => readIds.add(n.id)); renderNotifications(); });

  document.getElementById("btn-settings").addEventListener("click", openSettings);
  document.getElementById("settings-overlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeSettings(); });

  document.getElementById("font-dec").addEventListener("click", () => { if (fontIdx > 0) { fontIdx--; applyFont(); localStorage.setItem('app-font', fontIdx); } });
  document.getElementById("font-inc").addEventListener("click", () => { if (fontIdx < FONT_STEPS.length - 1) { fontIdx++; applyFont(); localStorage.setItem('app-font', fontIdx); } });

  setupToggle("toggle-dark", on => { document.body.classList.toggle("dark", on); localStorage.setItem('app-dark', on ? '1' : '0'); });
  setupToggle("toggle-contrast", on => document.body.classList.toggle("high-contrast", on));
  setupToggle("toggle-reminder");
  setupToggle("toggle-sound");

  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyTheme(chip.dataset.theme);
      localStorage.setItem('app-theme', chip.dataset.theme);
    });
  });

  window.addEventListener("scroll", () => {
    document.getElementById("main-header").classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  // 5. 讀取之前的 LocalStorage 設定
  const savedTheme = localStorage.getItem('app-theme') || 'green';
  applyTheme(savedTheme);
  const savedChip = document.querySelector(`.theme-chip[data-theme="${savedTheme}"]`);
  if (savedChip) {
    document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'));
    savedChip.classList.add('active');
  }

  const savedFont = localStorage.getItem('app-font');
  if (savedFont !== null) { fontIdx = parseInt(savedFont); }
  applyFont();

  if (localStorage.getItem('app-dark') === '1') {
    document.body.classList.add('dark');
    const td = document.getElementById('toggle-dark');
    if (td) { td.classList.add('on'); td.setAttribute('aria-checked', 'true'); }
  }

  renderNotifications();
}