// static/js/header.js

// 🚨 終極無間斷巡邏防線：每 100 毫秒（0.1秒）死死盯著畫面
// 不管是重整、返回、假換頁，只要發現畫面的「標題文字」跟「目前網址」對不起來，立刻強制肉體修正！
setInterval(() => {
  forceCorrectHeaderTitle();
}, 100);

// 強制比對與修正標題的核心邏輯
function forceCorrectHeaderTitle() {
  const currentPath = window.location.pathname;
  const headerTitleElement = document.querySelector('.header-title');

  // 如果 fetch 還沒完成，畫面上找不到標題物件，就直接跳出等下一次巡邏
  if (!headerTitleElement) return;

  // 取得目前畫面上純文字（去掉空白）
  const currentText = headerTitleElement.textContent.trim();

  if (currentPath.includes('/shop/')) {
    // 如果網址是商城，但畫面上的字不是「點數商城」，就強制導正
    if (currentText !== "點數商城") {
      headerTitleElement.innerHTML = `<span class="material-symbols-outlined" style="font-size:26px; font-variation-settings:'FILL' 1;">storefront</span>點數商城`;
    }
  } else if (currentPath.includes('/achievements/')) {
    // 如果網址是成就，但畫面上的字不是「我的成就」，重整後非同步載入完會在這裡被攔截修正！
    if (currentText !== "我的成就") {
      headerTitleElement.innerHTML = `<span class="material-symbols-outlined" style="font-size:26px; font-variation-settings:'FILL' 1;">military_tech</span>我的成就`;
    }
  } else {
    // 🎤 Boss 這裡改好了！其他所有主頁面、日記、遊戲頁面，如果字不是「聲影日記」，一律強制鎖定為麥克風圖標！
    if (currentText !== "聲影日記") {
      headerTitleElement.innerHTML = `<span class="material-symbols-outlined" style="font-size:26px; font-variation-settings:'FILL' 1;">mic</span>聲影日記`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetch("/header/")
    .then(response => {
      if (!response.ok) throw new Error("無法載入 Header");
      return response.text();
    })
    .then(data => {
      document.getElementById("header-placeholder").innerHTML = data;
      initHeaderLogic(); // HTML 載入完成後，初始化所有設定與通知功能
      forceCorrectHeaderTitle(); // 載入完當下立刻校正一次
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
  
  let readIds = new Set(JSON.parse(localStorage.getItem('notif-read-ids') || '[]'));

  function renderNotifications() {
    const list = document.getElementById("notif-list");
    const unreadCount = NOTIFICATIONS.filter(n => n.unread && !readIds.has(n.id)).length;
    const badge = document.getElementById("notif-badge");
    if (badge) badge.classList.toggle("hidden", unreadCount === 0);

    if (!list) return;
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
      item.addEventListener("click", () => { 
        readIds.add(n.id); 
        localStorage.setItem('notif-read-ids', JSON.stringify(Array.from(readIds)));
        renderNotifications(); 
      });
      list.appendChild(item);
    });
  }

  // 2. 顯示與隱藏面板的函式
  function openNotifications() {
    renderNotifications();
    const overlay = document.getElementById("notif-overlay");
    if (!overlay) return;
    overlay.style.display = "flex";
    requestAnimationFrame(() => {
      overlay.classList.add("open");
      requestAnimationFrame(() => overlay.classList.add("visible"));
    });
    setTimeout(() => {
      NOTIFICATIONS.forEach(n => readIds.add(n.id));
      localStorage.setItem('notif-read-ids', JSON.stringify(Array.from(readIds)));
      renderNotifications();
    }, 1500);
  }
  function closeNotifications() {
    const overlay = document.getElementById("notif-overlay");
    if (!overlay) return;
    overlay.classList.remove("visible");
    setTimeout(() => { overlay.classList.remove("open"); overlay.style.display = "none"; }, 250);
  }
  function openSettings() {
    const overlay = document.getElementById("settings-overlay");
    if (!overlay) return;
    overlay.style.display = "flex";
    requestAnimationFrame(() => {
      overlay.classList.add("open");
      requestAnimationFrame(() => overlay.classList.add("visible"));
    });
  }
  function closeSettings() {
    const overlay = document.getElementById("settings-overlay");
    if (!overlay) return;
    overlay.classList.remove("visible");
    setTimeout(() => { overlay.classList.remove("open"); overlay.style.display = "none"; }, 250);
  }

  // 3. 字體與主題設定邏輯
  const FONT_STEPS = [.8,.875,.95,1,1.1,1.2,1.35,1.5,1.65,1.8];
  const FONT_LABELS = ["最小","很小","較小","標準","稍大","大","很大","超大","特大","最大"];
  let fontIdx = 3;

  function applyFont() {
    document.documentElement.style.setProperty("--fs-scale", FONT_STEPS[fontIdx]);
    const fontVal = document.getElementById("font-val");
    const fontSizeLabel = document.getElementById("font-size-label");
    if (fontVal) fontVal.textContent = fontIdx + 1;
    if (fontSizeLabel) fontSizeLabel.textContent = `${FONT_LABELS[fontIdx]}（${Math.round(FONT_STEPS[fontIdx]*100)}%）`;
    
    const fontDec = document.getElementById("font-dec");
    const fontInc = document.getElementById("font-inc");
    if (fontDec) fontDec.disabled = (fontIdx === 0);
    if (fontInc) fontInc.disabled = (fontIdx === FONT_STEPS.length - 1);
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
    if (t.surfaceTint) document.documentElement.style.setProperty('--surface-tint', t.surfaceTint);
    if (t.iconColor) document.documentElement.style.setProperty('--icon-color', t.iconColor);
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
  const btnNotif = document.getElementById("btn-notif");
  if (btnNotif) btnNotif.addEventListener("click", openNotifications);
  
  const notifOverlay = document.getElementById("notif-overlay");
  if (notifOverlay) notifOverlay.addEventListener("click", e => { if (e.target === e.currentTarget) closeNotifications(); });
  
  const btnNotifClose = document.getElementById("btn-notif-close");
  if (btnNotifClose) btnNotifClose.addEventListener("click", closeNotifications);
  
  const btnNotifClear = document.getElementById("btn-notif-clear");
  if (btnNotifClear) {
    btnNotifClear.addEventListener("click", () => { 
      NOTIFICATIONS.forEach(n => readIds.add(n.id)); 
      localStorage.setItem('notif-read-ids', JSON.stringify(Array.from(readIds)));
      renderNotifications(); 
    });
  }

  const btnSettings = document.getElementById("btn-settings");
  if (btnSettings) btnSettings.addEventListener("click", openSettings);
  
  const settingsOverlay = document.getElementById("settings-overlay");
  if (settingsOverlay) settingsOverlay.addEventListener("click", e => { if (e.target === e.currentTarget) closeSettings(); });

  const fontDec = document.getElementById("font-dec");
  if (fontDec) fontDec.addEventListener("click", () => { if (fontIdx > 0) { fontIdx--; applyFont(); localStorage.setItem('app-font', fontIdx); } });
  
  const fontInc = document.getElementById("font-inc");
  if (fontInc) fontInc.addEventListener("click", () => { if (fontIdx < FONT_STEPS.length - 1) { fontIdx++; applyFont(); localStorage.setItem('app-font', fontIdx); } });

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

  const mainHeader = document.getElementById("main-header");
  window.addEventListener("scroll", () => {
    if (mainHeader) mainHeader.classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

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