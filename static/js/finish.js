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

  var btnVoice = document.getElementById("btn-voice");
  var voiceBtnText = document.getElementById("voice-btn-text");
  var voiceIcon = document.getElementById("voice-icon");
  var voiceStatus = document.getElementById("voice-status");
  var chatBox = document.getElementById("chat-box");

  function updateVoiceUI() {
    if (!btnVoice || !voiceStatus) return;
    if (REPLIES_LEFT <= 0) {
      btnVoice.disabled = true;
      if (voiceBtnText) voiceBtnText.textContent = "今日對話已結束囉！";
      if (voiceIcon) voiceIcon.textContent = "lock";
      voiceStatus.textContent = "今日對話次數已滿囉！";
    } else {
      btnVoice.disabled = false;
      voiceStatus.textContent = "對話剩餘次數：" + REPLIES_LEFT + "/3";
    }
  }

  // 傳送實體音檔給全新擴充的後端 Whisper 處理中心
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

    var csrftoken = getCookie("csrftoken");

    // 🌐 射向我們剛剛在 urls.py 與 views.py 新建的通道！
    fetch("/api/upload-chat-voice/", {
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken,
      },
      body: formData,
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.status === "success") {
        // 🥊 A. 抓取後端 Whisper 轉出來的【真實文字】，強制吐在右邊！
        var userRow = document.createElement("div");
        userRow.className = "chat-row user-row";
        userRow.innerHTML =
          '<div class="user-bubble">' +
          data.user_text +
          "</div>" +
          '<div class="user-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">person</span></div>';
        chatBox.appendChild(userRow);
        chatBox.scrollTop = chatBox.scrollHeight;

        // 🤖 B. 稍微延遲一下下，左邊緊接著印出 AI 的下一句暖心台詞
        setTimeout(function () {
          var aiRow = document.createElement("div");
          aiRow.className = "chat-row ai-row";
          aiRow.innerHTML =
            '<div class="ai-avatar"><span class="material-symbols-outlined" style="font-variation-settings:\'FILL\' 1;">smart_toy</span></div>' +
            '<div class="ai-bubble">' +
            data.reply +
            "</div>";
          chatBox.appendChild(aiRow);
          chatBox.scrollTop = chatBox.scrollHeight;

          // 讀取後端剩下的真實計數
          REPLIES_LEFT = data.remaining;
          updateVoiceUI();
          
          if (REPLIES_LEFT > 0 && btnVoice) {
            if (voiceBtnText) voiceBtnText.textContent = "按一下開始說話";
            if (voiceIcon) voiceIcon.textContent = "mic";
          }
        }, 600);

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

  // LINE 分享與 FB 分享
  var btnShareLine = document.getElementById("btn-share-line");
  if (btnShareLine) {
    btnShareLine.addEventListener("click", function () {
      var text = document.querySelector(".summary-text p");
      var message = text ? text.textContent : "我的聲影日記";
      var url = "https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent(window.location.href) + "&text=" + encodeURIComponent(message);
      window.open(url, "_blank");
    });
  }

  var btnShareFb = document.getElementById("btn-share-fb");
  if (btnShareFb) {
    btnShareFb.addEventListener("click", function () {
      var url = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(window.location.href);
      window.open(url, "_blank");
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