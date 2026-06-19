// 暫時用假資料模擬，等 B 的 API 完成後換掉
var MOCK_DATA = {
  photo_url: "https://gemini.google.com/share/0a44e8eef133",
  transcription: "今天我和孫子在公園玩，看到紅色的花開了，我們真開心！",
  ai_response: "AI助手：今天跟孫子玩什麼呀？我們聊天吧！",
};

// 把假資料顯示在頁面上
var photoEl = document.querySelector(".summary-photo img");
var transcriptEl = document.querySelector(".summary-text p");
var aiBubbleText = document.querySelector(".ai-bubble p");

if (photoEl) photoEl.src = MOCK_DATA.photo_url;
if (transcriptEl) transcriptEl.textContent = MOCK_DATA.transcription;
if (aiBubbleText) aiBubbleText.textContent = MOCK_DATA.ai_response;

(function () {
  "use strict";

  // 1. 主題與字體初始化
  (function () {
    var THEMES = {
      green: { primary: "#36684c", secondary: "#d4ede0", onSecondary: "#0d3325" },
      blue: { primary: "#3872ef", secondary: "#dbeafe", onSecondary: "#1e3a8a" },
      purple: { primary: "#854be9", secondary: "#ede9fe", onSecondary: "#4c1d95" },
      warm: { primary: "#e97345", secondary: "#ffedd5", onSecondary: "#7c2d12" },
    };
    var t = THEMES[localStorage.getItem("app-theme")] || THEMES["green"];
    document.documentElement.style.setProperty("--primary", t.primary);
    document.documentElement.style.setProperty("--secondary-container", t.secondary);
    document.documentElement.style.setProperty("--on-secondary-container", t.onSecondary);

    var font = localStorage.getItem("app-font");
    if (font !== null) {
      var STEPS = [0.8, 0.875, 0.95, 1, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8];
      document.documentElement.style.setProperty("--fs-scale", STEPS[parseInt(font)] || 1);
    }

    if (localStorage.getItem("app-dark") === "1") {
      document.body.classList.add("dark");
    }
  })();

  // 2. 日期顯示
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  var today = new Date();
  var dateEl = document.getElementById("congrats-date");
  if (dateEl) {
    dateEl.textContent =
      today.getFullYear() + "年" + (today.getMonth() + 1) + "月" + today.getDate() + "日 星期" + WEEK[today.getDay()];
  }

  // ==========================================
  // ✨ 3. AI 問答後端連動修改
  // ==========================================
  var REPLIES_LEFT = 3;
  var btnReply = document.getElementById("btn-reply");
  var aiBubbleText = document.querySelector(".ai-bubble p");

  if (btnReply) {
    // 讓按鈕可以點擊並亮起來
    btnReply.textContent = "回覆 (剩餘次數 " + REPLIES_LEFT + "/3)";
    btnReply.disabled = false;
    btnReply.style.opacity = "1";
    btnReply.style.cursor = "pointer";

    btnReply.addEventListener("click", function () {
      var userPrompt = prompt("想跟 AI 助手說什麼呢？");
      if (!userPrompt) return;

      // 發送 Fetch 請求給你的 Django 後端 API
      fetch("/api/ai-chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userPrompt }),
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (data.status === "success") {
            // 更新 AI 的對話框內容
            if (aiBubbleText) aiBubbleText.textContent = "AI助手：" + data.reply;

            // 更新剩餘次數
            REPLIES_LEFT = data.remaining;
            btnReply.textContent = "回覆 (剩餘次數 " + REPLIES_LEFT + "/3)";

            // 次數用完，自動鎖定按鈕
            if (REPLIES_LEFT <= 0) {
              btnReply.disabled = true;
              btnReply.textContent = "回覆 (次數已滿)";
              btnReply.style.backgroundColor = "#ccc";
              btnReply.style.cursor = "not-allowed";
            }
          } else {
            alert(data.message);
          }
        })
        .catch(function (err) {
          console.error("錯誤:", err);
        });
    });
  }

  // 4. 略過功能
  var btnSkip = document.getElementById("btn-skip");
  var aiZone = document.getElementById("ai-zone");
  if (btnSkip && aiZone) {
    btnSkip.addEventListener("click", function () {
      aiZone.style.display = "none";
    });
  }

  // 5. 分享功能
  var btnShare = document.getElementById("btn-share");
  var btnNoShare = document.getElementById("btn-no-share");
  var feedback = document.getElementById("share-feedback");

  function finishShare(message) {
    if (btnShare) btnShare.disabled = true;
    if (btnNoShare) btnNoShare.disabled = true;
    if (feedback) {
      feedback.textContent = message;
      feedback.style.display = "block";
    }
    setTimeout(function () {
      window.location.href = "/index/";
    }, 1200);
  }
  if (btnShare)
    btnShare.addEventListener("click", function () {
      finishShare("已分享到動態牆！");
    });
  if (btnNoShare)
    btnNoShare.addEventListener("click", function () {
      finishShare("好的，這篇只留給自己。");
    });

  window.addEventListener(
    "scroll",
    function () {
      var header = document.getElementById("main-header");
      if (header) header.classList.toggle("scrolled", window.scrollY > 10);
    },
    { passive: true }
  );
})();
