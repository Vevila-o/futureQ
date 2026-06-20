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
  var feedback = document.getElementById("share-feedback");

  function showFeedback(message) {
    if (feedback) {
      feedback.textContent = message;
      feedback.style.display = "block";
      setTimeout(function () {
        feedback.style.display = "none";
      }, 2000);
    }
  }

  // 儲存圖片
  var btnSaveImage = document.getElementById("btn-save-image");
  if (btnSaveImage) {
    btnSaveImage.addEventListener("click", function () {
      var img = document.querySelector(".summary-photo img");
      if (!img) {
        showFeedback("找不到圖片");
        return;
      }
      var a = document.createElement("a");
      a.href = img.src;
      a.download = "我的日記.jpg";
      a.click();
      showFeedback("圖片已儲存！");
    });
  }

  // 複製連結
  var btnCopyLink = document.getElementById("btn-copy-link");
  if (btnCopyLink) {
    btnCopyLink.addEventListener("click", function () {
      navigator.clipboard
        .writeText(window.location.href)
        .then(function () {
          showFeedback("連結已複製！");
        })
        .catch(function () {
          showFeedback("複製失敗，請手動複製網址");
        });
    });
  }

  // 判斷是否為手機裝置
  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // 分享到 LINE
  var btnShareLine = document.getElementById("btn-share-line");
  if (btnShareLine) {
    btnShareLine.addEventListener("click", function () {
      var text = document.querySelector(".summary-text p");
      var message = text ? text.textContent : "我的聲影日記";

      // 只有手機才用 Web Share API
      if (isMobile() && navigator.share) {
        navigator
          .share({
            title: "我的聲影日記",
            text: message + "\n\n" + window.location.href,
          })
          .catch(function (err) {
            console.log("分享取消", err);
          });
      } else {
        // 電腦版一律用 LINE 網頁分享
        var url =
          "https://social-plugins.line.me/lineit/share?url=" +
          encodeURIComponent(window.location.href) +
          "&text=" +
          encodeURIComponent(message);
        window.open(url, "_blank");
      }
    });
  }

  // 分享到 Facebook（強制走網頁版，避免手機跳轉 App）
  var btnShareFb = document.getElementById("btn-share-fb");
  if (btnShareFb) {
    btnShareFb.addEventListener("click", function () {
      var url = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(window.location.href);

      if (isMobile()) {
        // 手機：直接在目前頁面導向，不開新分頁，避免被導去 App
        window.location.href = url;
      } else {
        // 電腦：開新分頁
        window.open(url, "_blank");
      }
    });
  }

  // 完成回首頁
  var btnNoShare = document.getElementById("btn-no-share");
  if (btnNoShare) {
    btnNoShare.addEventListener("click", function () {
      window.location.href = "/index/";
    });
  }
})();
