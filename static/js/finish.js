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

  // 輔助函式：從 Cookie 抓取 Django 的 CSRF Token
  function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      var cookies = document.cookie.split(";");
      for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === name + "=") {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // ==========================================
  // ✨ 3. 聊天室連動機制 (精準同步後端、強制限制3次)
  // ==========================================
  var REPLIES_LEFT = 3; // 預設值，隨後會與後端 Session 精準同步
  var btnReply = document.getElementById("btn-reply");
  var userInput = document.getElementById("user-input");
  var chatBox = document.getElementById("chat-box");

  // 💡 [更新 UI 狀態函式]：根據剩餘次數，即時調整輸入框的提示字與鎖定狀態
  function updateInputUI() {
    if (!userInput) return;
    if (REPLIES_LEFT <= 0) {
      if (btnReply) btnReply.disabled = true;
      userInput.disabled = true;
      userInput.placeholder = "今日對話次數已滿囉！";
    } else {
      if (btnReply) btnReply.disabled = false;
      userInput.disabled = false;
      userInput.placeholder = "回覆 (剩餘次數 " + REPLIES_LEFT + "/3)";
    }
  }

  function sendMessage() {
    // 💡 安全閥：如果已經沒次數了，按鈕按得下去也直接攔截，絕不放行
    if (!userInput || !btnReply || REPLIES_LEFT <= 0) {
      updateInputUI();
      return;
    }

    var userPrompt = userInput.value.trim();
    if (!userPrompt) return;

    // 🥊 A. 動態長出使用者泡泡（結構：泡泡在左、頭像在右）
    var userRow = document.createElement("div");
    userRow.className = "chat-row user-row";
    userRow.innerHTML =
      '<div class="user-bubble">' +
      userPrompt +
      "</div>" +
      '<div class="user-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">person</span></div>';
    chatBox.appendChild(userRow);

    // 清空輸入並將滾動條推至最底部
    userInput.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // 💡 送出瞬間立刻強制鎖死輸入框，防止長輩手速太快連續狂點導致次數爆掉
    btnReply.disabled = true;
    userInput.disabled = true;
    userInput.placeholder = "AI 助手正在思考中...";

    var csrftoken = getCookie("csrftoken");

    // B. 發送 Fetch 請求給 Django 後端
    fetch("/api/ai-chat/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
      },
      body: JSON.stringify({ message: userPrompt }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.status === "success") {
          // 🤖 C. 成功收到回覆，追加左側 AI 泡泡
          var aiRow = document.createElement("div");
          aiRow.className = "chat-row ai-row";
          aiRow.innerHTML =
            '<div class="ai-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">smart_toy</span></div>' +
            '<div class="ai-bubble">' +
            data.reply +
            "</div>";
          chatBox.appendChild(aiRow);

          // 滾動條聚焦至底部
          chatBox.scrollTop = chatBox.scrollHeight;

          // 💡 關鍵核心：強行用後端傳回來的剩餘次數覆蓋前端變數，達成絕對同步
          REPLIES_LEFT = data.remaining;

          // 💡 釋放鎖定並更新 placeholder 數字
          updateInputUI();
          if (REPLIES_LEFT > 0) {
            userInput.focus(); // 聚焦回文字框方便長輩連續操作
          }
        } else {
          // 如果後端拋出已達上限等警告，跳出提示，並同步鎖死
          alert(data.message);
          REPLIES_LEFT = 0;
          updateInputUI();
        }
      })
      .catch(function (err) {
        console.error("錯誤:", err);
        // 發生異常時解鎖介面讓使用者可以重試
        btnReply.disabled = false;
        userInput.disabled = false;
        userInput.placeholder = "連線失敗，請再試一次 (剩餘次數 " + REPLIES_LEFT + "/3)";
      });
  }

  // 綁定點擊與 Enter 鍵事件
  if (btnReply && userInput) {
    // 💡 頁面剛載入時，先執行一次 UI 初始化設定
    updateInputUI();

    btnReply.addEventListener("click", sendMessage);
    userInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        sendMessage();
      }
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
