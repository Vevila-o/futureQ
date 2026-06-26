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
  // ✨ 3. 真實麥克風錄音與後端 Whisper API 完美對接
  // ==========================================
  var REPLIES_LEFT = 3; 
  var isRecording = false;
  var mediaRecorder = null;
  var audioChunks = [];

  var diaryId = window.DIARY_ID || "";

  var btnVoice = document.getElementById("btn-voice");
  var voiceBtnText = document.getElementById("voice-btn-text");
  var voiceIcon = document.getElementById("voice-icon");
  var voiceStatus = document.getElementById("voice-status");
  var chatBox = document.getElementById("chat-box");

  // 頁面載入後自動取得 AI 首問
  if (diaryId) {
    fetch("/api/ai-first-question/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({ diary_id: diaryId }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(function (msg) {
            var row = document.createElement("div");
            if (msg.role === "assistant") {
              row.className = "chat-row ai-row";
              row.innerHTML =
                '<div class="ai-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">smart_toy</span></div>' +
                '<div class="ai-bubble">' + msg.content + "</div>";
            } else {
              row.className = "chat-row user-row";
              row.innerHTML =
                '<div class="user-bubble">' + msg.content + "</div>" +
                '<div class="user-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">person</span></div>';
            }
            chatBox.appendChild(row);
          });
          chatBox.scrollTop = chatBox.scrollHeight;
        }
        REPLIES_LEFT = data.remaining || 0;
        updateVoiceUI();
      })
      .catch(function (err) {
        console.error("首問取得失敗:", err);
      });
  }

  function updateVoiceUI() {
    if (!btnVoice || !voiceStatus) return;
    if (REPLIES_LEFT <= 0) {
      btnVoice.disabled = true;
      btnVoice.style.backgroundColor = "#9e9e9e";
      btnVoice.style.cursor = "not-allowed";
      if (voiceBtnText) voiceBtnText.textContent = "已達對話上限";
      if (voiceIcon) voiceIcon.textContent = "lock";
      voiceStatus.textContent = "三次對話已完成，感謝你的分享！";
    } else {
      btnVoice.disabled = false;
      btnVoice.style.backgroundColor = "";
      btnVoice.style.cursor = "";
      voiceStatus.textContent = "對話剩餘次數：" + REPLIES_LEFT + "/3";
    }
  }

  // 傳送實體音檔給全新擴充的後端 Whisper 處理中心
  function showTypingBubble(role) {
    removeTypingBubble();
    var row = document.createElement("div");
    row.id = "typing-indicator";
    if (role === "user") {
      row.className = "chat-row user-row";
      row.innerHTML =
        '<div class="user-bubble typing-bubble"><span></span><span></span><span></span></div>' +
        '<div class="user-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">person</span></div>';
    } else {
      row.className = "chat-row ai-row";
      row.innerHTML =
        '<div class="ai-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">smart_toy</span></div>' +
        '<div class="ai-bubble typing-bubble"><span></span><span></span><span></span></div>';
    }
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function removeTypingBubble() {
    var el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  function sendAudioFileToBackend(audioBlob) {
    if (REPLIES_LEFT <= 0) return;

    if (btnVoice) {
      btnVoice.disabled = true;
      if (voiceBtnText) voiceBtnText.textContent = "語音辨識與思考中...";
      if (voiceIcon) voiceIcon.textContent = "sync";
    }

    // 打包成二進位 FormData
    var formData = new FormData();
    formData.append('audio_data', audioBlob);
    formData.append('diary_id', diaryId);

    var csrftoken = getCookie("csrftoken");

    fetch("/api/upload-chat-voice/", {
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken,
      },
      body: formData,
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      removeTypingBubble();
      if (data.status === "success") {
        // 使用者文字出現（右側）
        var userRow = document.createElement("div");
        userRow.className = "chat-row user-row";
        userRow.innerHTML =
          '<div class="user-bubble">' + data.user_text + "</div>" +
          '<div class="user-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">person</span></div>';
        chatBox.appendChild(userRow);
        chatBox.scrollTop = chatBox.scrollHeight;

        // AI 思考中氣泡（左側）
        showTypingBubble("ai");

        setTimeout(function () {
          removeTypingBubble();
          var aiRow = document.createElement("div");
          aiRow.className = "chat-row ai-row";
          aiRow.innerHTML =
            '<div class="ai-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">smart_toy</span></div>' +
            '<div class="ai-bubble">' + data.reply + "</div>";
          chatBox.appendChild(aiRow);
          chatBox.scrollTop = chatBox.scrollHeight;

          REPLIES_LEFT = data.remaining;
          updateVoiceUI();

          if (REPLIES_LEFT > 0 && btnVoice) {
            if (voiceBtnText) voiceBtnText.textContent = "按一下開始說話";
            if (voiceIcon) voiceIcon.textContent = "mic";
          }
        }, 800);

      } else {
        alert(data.message);
        resetVoiceButton();
      }
    })
    .catch(function (err) {
      console.error("發送音檔失敗:", err);
      alert("錄音上傳失敗，請檢查網路或伺服器狀態");
      resetVoiceButton();
    });
  }

  function resetVoiceButton() {
    isRecording = false;
    if (btnVoice) {
      btnVoice.classList.remove("recording");
    }
    updateVoiceUI();
    if (REPLIES_LEFT > 0 && btnVoice) {
      if (voiceBtnText) voiceBtnText.textContent = "按一下開始說話";
      if (voiceIcon) voiceIcon.textContent = "mic";
    }
  }

  if (btnVoice) {
    updateVoiceUI();
    
    btnVoice.addEventListener("click", function() {
      if (REPLIES_LEFT <= 0) return;
      
      if (!isRecording) {
        // 🔴 1. 調用實體麥克風權限
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function(stream) {
            isRecording = true;
            var skipBtn = document.getElementById("btn-skip");
            if (skipBtn) skipBtn.style.display = "none";
            audioChunks = []; 
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = function(e) {
              audioChunks.push(e.data);
            };

            mediaRecorder.onstop = function() {
              // 打包 WAV 實體結構
              var audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
              // 丟給發送管線
              sendAudioFileToBackend(audioBlob);
            };

            mediaRecorder.start();
            showTypingBubble("user");
            btnVoice.classList.add("recording");
            if (voiceBtnText) voiceBtnText.textContent = "正在錄音中...再按一次結束";
            if (voiceIcon) voiceIcon.textContent = "stop";
          })
          .catch(function(err) {
            console.error("無法開啟麥克風:", err);
            alert("麥克風啟動失敗，請確認網頁是否擁有錄音授權喔！");
          });
      } else {
        // ⏹️ 2. 停止錄音，觸發上面的 onstop 打包與發送
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach(function(track) { track.stop(); });
        }
        isRecording = false;
        btnVoice.classList.remove("recording");
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

  // ==========================================
  // 5. 分享功能與按鈕
  // ==========================================
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

  // LINE / Facebook 分享 → 前往分享頁
  var shareUrl = "/share/?diary_id=" + (window.DIARY_ID || "");

  var btnShareLine = document.getElementById("btn-share-line");
  if (btnShareLine) {
    btnShareLine.addEventListener("click", function () {
      window.location.href = shareUrl;
    });
  }

  var btnShareFb = document.getElementById("btn-share-fb");
  if (btnShareFb) {
    btnShareFb.addEventListener("click", function () {
      window.location.href = shareUrl;
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