(function () {
  "use strict";

  (function () {
    var THEMES = {
      green:  { primary: "#36684c", secondary: "#d4ede0", onSecondary: "#0d3325" },
      blue:   { primary: "#3872ef", secondary: "#dbeafe", onSecondary: "#1e3a8a" },
      purple: { primary: "#854be9", secondary: "#ede9fe", onSecondary: "#4c1d95" },
      warm:   { primary: "#e97345", secondary: "#ffedd5", onSecondary: "#7c2d12" },
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

  try {
    var savedPhoto = sessionStorage.getItem("diaryPhoto");
    var photoImg = document.getElementById("prompt-photo-img");
    if (savedPhoto && photoImg) photoImg.src = savedPhoto;
  } catch (e) {}

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

  var TARGET_REPLIES = 4;
  var MIN_REPLIES_TO_FINALIZE = 2; // 第 2 次回覆完成後就可以提前「生成日記」，不必錄滿 4 輪
  var MIN_FIRST_REPLY_SEC = 15;
  var MAX_SHORT_ATTEMPTS = 3; // 第 1 輪連續 3 次都不足 15 秒就放行，不要一直卡住使用者
  var LIMIT = 180;
  var remaining = LIMIT;
  var timerId = null;
  var state = "idle"; // idle | recording | paused
  var phase = "loading"; // loading | chat | uploading | done | finalizing

  var mediaRecorder = null;
  var audioChunks = [];
  var recordedBlob = null;
  var activeStream = null;
  var userReplies = 0;
  var firstRoundShortAttempts = 0;

  var params = new URLSearchParams(window.location.search);
  var diaryId = params.get("diary_id");
  var csrfToken = null;

  // DOM refs
  var elDot      = document.getElementById("status-dot");
  var elLabel    = document.getElementById("status-label");
  var elTimer    = document.getElementById("record-timer");
  var elWave     = document.getElementById("waveform");
  var waveBars   = document.querySelectorAll(".wave-bar");
  var chatBox    = document.getElementById("chat-box");
  var promptSub  = document.getElementById("prompt-sub");

  var holdBtn      = document.getElementById("hold-mic-btn");
  var holdMicIcon  = document.getElementById("hold-mic-icon");
  var holdHint     = document.getElementById("hold-hint");
  var btnRestart   = document.getElementById("btn-restart");
  var btnComplete  = document.getElementById("btn-complete");
  var btnFinalize  = document.getElementById("btn-finalize");
  var btnSkipRound = document.getElementById("btn-skip-round");
  var loadingOverlay = document.getElementById("loading-overlay");

  // ── Time formatting ───────────────────────────────────────────────────────

  function formatTime(s) {
    var m = Math.floor(s / 60).toString().padStart(2, "0");
    var sec = (s % 60).toString().padStart(2, "0");
    return m + ":" + sec;
  }

  // ── Timer ─────────────────────────────────────────────────────────────────

  function startTimer() {
    stopTimer();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }
  function tick() {
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      completeRound();
      return;
    }
    renderStatus();
  }

  // ── Chat bubbles ──────────────────────────────────────────────────────────

  function appendBubble(role, text, audioUrl) {
    var row = document.createElement("div");
    if (role === "assistant") {
      row.className = "chat-row ai-row";
      row.innerHTML =
        '<div class="ai-avatar"><span class="material-symbols-outlined" style="font-size:20px;">smart_toy</span></div>' +
        '<div class="ai-bubble"></div>';
      row.querySelector(".ai-bubble").textContent = text;
    } else {
      row.className = "chat-row user-row";
      row.innerHTML =
        '<div class="user-bubble"></div>' +
        '<div class="user-avatar"><span class="material-symbols-outlined" style="font-size:20px;">person</span></div>';
      row.querySelector(".user-bubble").textContent = text;
    }
    chatBox.appendChild(row);

    if (audioUrl && role === "user") {
      var bubble = row.querySelector(".user-bubble");
      var playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "bubble-play-btn";
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      var audio = null;
      playBtn.addEventListener("click", function () {
        if (audio && !audio.paused) {
          audio.pause();
          playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
          return;
        }
        audio = audio || new Audio(audioUrl);
        playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
        audio.play();
        audio.onended = function () {
          playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        };
      });
      bubble.appendChild(playBtn);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
    return row;
  }

  function showTypingBubble() {
    removeTypingBubble();
    var row = document.createElement("div");
    row.id = "typing-indicator";
    row.className = "chat-row ai-row";
    row.innerHTML =
      '<div class="ai-avatar"><span class="material-symbols-outlined" style="font-size:20px;">smart_toy</span></div>' +
      '<div class="ai-bubble typing-bubble"><span></span><span></span><span></span></div>';
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  function removeTypingBubble() {
    var el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  function renderAllMessages(messages) {
    chatBox.innerHTML = "";
    messages.forEach(function (m) { appendBubble(m.role, m.content); });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderStatus() {
    elTimer.textContent = formatTime(remaining);
    if (elDot) elDot.classList.toggle("pulsing", state === "recording");
    if (elWave) elWave.classList.toggle("active", state === "recording");
    holdBtn.classList.remove("btn-paused");

    if (phase === "loading") {
      elLabel.textContent = "準備中";
      holdBtn.disabled = true;
      holdHint.textContent = "正在準備問題…";
      if (btnComplete) btnComplete.style.display = "none";
      if (btnRestart) btnRestart.style.display = "none";
      if (btnFinalize) btnFinalize.style.display = "none";
      if (btnSkipRound) btnSkipRound.style.display = "none";
      return;
    }

    if (phase === "uploading") {
      elLabel.textContent = "辨識中";
      holdBtn.style.display = "flex";
      holdBtn.disabled = true;
      holdHint.textContent = "語音辨識與思考中…";
      if (btnComplete) btnComplete.style.display = "none";
      if (btnRestart) btnRestart.style.display = "none";
      if (btnFinalize) btnFinalize.style.display = "none";
      if (btnSkipRound) btnSkipRound.style.display = "none";
      return;
    }

    if (phase === "done") {
      elLabel.textContent = "對話完成";
      holdBtn.style.display = "none";
      if (btnComplete) btnComplete.style.display = "none";
      if (btnRestart) btnRestart.style.display = "none";
      if (elWave) elWave.style.display = "none";
      var infoRow = document.querySelector(".record-info-row");
      if (infoRow) infoRow.style.display = "none";
      holdHint.textContent = "四段對話都錄好了，按下面的按鈕生成今天的日記";
      if (btnFinalize) { btnFinalize.style.display = "block"; btnFinalize.disabled = false; btnFinalize.textContent = "生成日記"; }
      if (btnSkipRound) btnSkipRound.style.display = "none";
      return;
    }

    if (phase === "finalizing") {
      holdHint.textContent = "生成日記中…";
      if (btnFinalize) btnFinalize.disabled = true;
      return;
    }

    // phase === "chat"：可以錄音的狀態
    holdBtn.disabled = false;
    holdBtn.style.display = "flex";

    // 第 2 次回覆完成後就可以提前生成日記（不用錄滿 4 輪），跟繼續錄下一輪並存；
    // 只在還沒開始錄這一輪時顯示，避免跟錄音中的畫面搶注意力。
    var canFinalizeEarly = userReplies >= MIN_REPLIES_TO_FINALIZE && state === "idle";
    if (btnFinalize) {
      if (canFinalizeEarly) {
        btnFinalize.style.display = "block";
        btnFinalize.disabled = false;
        btnFinalize.textContent = "生成日記（已錄 " + userReplies + " 段，可繼續或直接生成）";
      } else {
        btnFinalize.style.display = "none";
      }
    }

    // 第 3、4 次（userReplies 已經是 2 或 3）可以跳過這題，第 1、2 次不行。
    var canSkip = userReplies >= 2 && userReplies < TARGET_REPLIES && state === "idle";
    if (btnSkipRound) btnSkipRound.style.display = canSkip ? "inline-block" : "none";

    var roundHint = userReplies === 0
      ? "請盡量詳細描述照片裡的人、地點、發生的事（至少講 15 秒喔）。"
      : "";

    if (state === "idle") {
      elLabel.textContent = "尚未開始";
      holdMicIcon.textContent = "mic";
      holdHint.textContent = roundHint + "點擊開始錄音";
      if (btnComplete) btnComplete.style.display = "none";
      if (btnRestart) btnRestart.style.display = "none";
    } else if (state === "recording") {
      elLabel.textContent = "錄音中";
      holdMicIcon.textContent = "pause";
      holdHint.textContent = "點擊暫停，或按完成送出";
      if (btnComplete) btnComplete.style.display = "flex";
      if (btnRestart) btnRestart.style.display = "none";
    } else if (state === "paused") {
      elLabel.textContent = "已暫停";
      holdMicIcon.textContent = "mic";
      holdHint.textContent = "點擊繼續錄音，或按完成送出";
      holdBtn.classList.add("btn-paused");
      if (btnComplete) btnComplete.style.display = "flex";
      if (btnRestart) btnRestart.style.display = "inline-block";
    }
  }

  // ── Recording actions ─────────────────────────────────────────────────────

  async function startRecording() {
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      recordedBlob = null;

      var mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                   : MediaRecorder.isTypeSupported("audio/mp4")  ? "audio/mp4"
                   : "audio/ogg";
      mediaRecorder = new MediaRecorder(activeStream, { mimeType: mimeType });
      mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = function () {
        recordedBlob = new Blob(audioChunks, { type: mimeType });
        activeStream.getTracks().forEach(function (t) { t.stop(); });
      };
      mediaRecorder.start();
      state = "recording";
      startTimer();
      renderStatus();
    } catch (err) {
      alert("無法使用麥克風，請確認瀏覽器是否允許錄音權限");
    }
  }

  function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === "paused") mediaRecorder.resume();
    state = "recording";
    startTimer();
    renderStatus();
  }

  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.pause();
    state = "paused";
    stopTimer();
    renderStatus();
  }

  function onRestart() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    remaining = LIMIT;
    state = "idle";
    recordedBlob = null;
    audioChunks = [];
    renderStatus();
  }

  function resetRoundUI() {
    remaining = LIMIT;
    state = "idle";
    recordedBlob = null;
    audioChunks = [];
    phase = "chat";
    renderStatus();
  }

  // 錄完一輪：停止錄音 → 等 blob 準備好 → 依目前是第幾輪送到對應的 API
  async function completeRound() {
    if (state !== "recording" && state !== "paused") return;
    stopTimer();

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      await new Promise(function (r) { setTimeout(r, 400); });
    }
    if (!recordedBlob) { alert("尚未錄到音檔，請重新錄製"); resetRoundUI(); return; }

    var elapsedSec = LIMIT - remaining;
    var forceShort = false;

    // 第 1 輪（描述照片）有 15 秒門檻：前端先擋一次，連續 3 次都不足就放行，
    // 不要一直卡住講不了那麼久的長輩。
    if (userReplies === 0 && elapsedSec < MIN_FIRST_REPLY_SEC) {
      firstRoundShortAttempts++;
      if (firstRoundShortAttempts < MAX_SHORT_ATTEMPTS) {
        appendBubble(
          "assistant",
          "再多說一點好嗎？可以講講照片裡有誰、在哪裡、發生了什麼事～（剛剛錄了 " + elapsedSec + " 秒）"
        );
        resetRoundUI();
        return;
      }
      forceShort = true;
    }

    phase = "uploading";
    renderStatus();

    var recordExt = recordedBlob.type.indexOf("mp4") !== -1 ? "mp4"
                   : recordedBlob.type.indexOf("ogg") !== -1 ? "ogg"
                   : "webm";

    try {
      if (userReplies === 0) {
        await submitFirstRound(recordedBlob, recordExt, forceShort);
      } else {
        await submitFollowupRound(recordedBlob, recordExt);
      }
    } catch (err) {
      console.error("送出錄音失敗:", err);
      alert("錄音送出失敗，請再試一次");
      phase = "chat";
      resetRoundUI();
    }
  }

  async function submitFirstRound(blob, ext, forceShort) {
    var formData = new FormData();
    formData.append("diary_id", diaryId);
    formData.append("audio_file", blob, "diary_audio." + ext);
    if (forceShort) formData.append("force", "1");

    var response = await fetch("/updateDiaryAudio/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfToken },
      body: formData,
    });
    var data = await response.json();

    if (!response.ok || !data.success) {
      if (data.error === "too_short") {
        appendBubble(
          "assistant",
          "再多說一點好嗎？可以講講照片裡有誰、在哪裡、發生了什麼事～（剛剛錄了 " + Math.round(data.duration || 0) + " 秒）"
        );
        resetRoundUI();
        return;
      }
      throw new Error(data.error || "第一輪錄音處理失敗");
    }

    appendBubble("user", data.transcription || "（沒有聽清楚）", data.audio_url);
    userReplies = data.user_replies || 1;

    if (data.done) {
      finishConversation();
    } else {
      showTypingBubble();
      setTimeout(function () {
        removeTypingBubble();
        appendBubble("assistant", data.question);
        resetRoundUI();
      }, 500);
    }
  }

  async function submitFollowupRound(blob, ext) {
    var formData = new FormData();
    formData.append("diary_id", diaryId);
    formData.append("audio_data", blob, "chat_audio." + ext);

    var response = await fetch("/api/upload-chat-voice/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfToken },
      body: formData,
    });
    var data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "錄音處理失敗");
    }

    appendBubble("user", data.user_text || "（沒有聽清楚）", data.audio_url);
    userReplies = data.user_replies || (userReplies + 1);

    if (data.done) {
      finishConversation();
    } else {
      showTypingBubble();
      setTimeout(function () {
        removeTypingBubble();
        appendBubble("assistant", data.reply);
        resetRoundUI();
      }, 500);
    }
  }

  // 第 3、4 題可以跳過：不錄音，直接打 skip 端點，維持跟 submitFollowupRound 一樣的收尾邏輯
  async function skipRound() {
    if (phase !== "chat" || state !== "idle") return;
    phase = "uploading";
    renderStatus();

    try {
      var formData = new FormData();
      formData.append("diary_id", diaryId);
      var response = await fetch("/api/skip-chat-round/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfToken },
        body: formData,
      });
      var data = await response.json();

      if (data.status !== "success") {
        throw new Error(data.message || "跳過失敗");
      }

      appendBubble("user", "（已跳過本題）");
      userReplies = data.user_replies || (userReplies + 1);

      if (data.done) {
        finishConversation();
      } else {
        showTypingBubble();
        setTimeout(function () {
          removeTypingBubble();
          appendBubble("assistant", data.reply);
          resetRoundUI();
        }, 500);
      }
    } catch (err) {
      console.error("跳過失敗:", err);
      alert("跳過失敗，請再試一次");
      phase = "chat";
      resetRoundUI();
    }
  }

  function finishConversation() {
    phase = "done";
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    renderStatus();
  }

  // ── Click handlers ────────────────────────────────────────────────────────

  holdBtn.addEventListener("click", function () {
    if (phase !== "chat") return;
    if (state === "idle") startRecording();
    else if (state === "recording") pauseRecording();
    else if (state === "paused") resumeRecording();
  });

  if (btnComplete) {
    btnComplete.addEventListener("click", function () { completeRound(); });
  }

  if (btnRestart) {
    btnRestart.addEventListener("click", onRestart);
  }

  if (btnSkipRound) {
    btnSkipRound.addEventListener("click", skipRound);
  }

  if (btnFinalize) {
    btnFinalize.addEventListener("click", async function () {
      if (btnFinalize.disabled) return;
      phase = "finalizing";
      renderStatus();
      if (loadingOverlay) loadingOverlay.style.display = "flex";

      try {
        var formData = new FormData();
        formData.append("diary_id", diaryId);
        var response = await fetch("/api/finalize-diary/", {
          method: "POST",
          headers: { "X-CSRFToken": csrfToken },
          body: formData,
        });
        var data = await response.json();
        if (data.status === "success") {
          window.location.href = data.redirect_url;
        } else {
          throw new Error(data.message || "生成日記失敗");
        }
      } catch (err) {
        console.error("生成日記失敗:", err);
        if (loadingOverlay) loadingOverlay.style.display = "none";
        alert("生成日記失敗，請再試一次");
        phase = "done";
        renderStatus();
      }
    });
  }

  // ── Waveform animation ────────────────────────────────────────────────────

  setInterval(function () {
    if (state !== "recording") return;
    waveBars.forEach(function (bar) {
      bar.style.height = Math.floor(Math.random() * 40) + 8 + "px";
    });
  }, 300);

  // ── Init：向後端要照片首問 ────────────────────────────────────────────────

  function init() {
    var tokenInput = document.querySelector("[name=csrfmiddlewaretoken]");
    csrfToken = tokenInput ? tokenInput.value : getCookie("csrftoken");

    if (!diaryId) {
      holdHint.textContent = "找不到日記，請重新上傳照片";
      if (promptSub) promptSub.textContent = "請從「上傳照片」重新開始";
      return;
    }

    fetch("/api/vision-first-question/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
      body: JSON.stringify({ diary_id: diaryId }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === "error") throw new Error(data.message);

        if (data.messages && data.messages.length > 0) {
          // 重整頁面：把已經進行到一半（或已結束）的對話還原
          renderAllMessages(data.messages);
          userReplies = data.user_replies || 0;
          if (data.done) {
            finishConversation();
          } else {
            resetRoundUI();
          }
        } else {
          appendBubble("assistant", data.question);
          userReplies = 0;
          resetRoundUI();
        }
      })
      .catch(function (err) {
        console.error("取得首問失敗:", err);
        holdHint.textContent = "問題載入失敗，請重新整理頁面";
      });
  }

  init();

  // ── Misc ──────────────────────────────────────────────────────────────────

  window.addEventListener("scroll", function () {
    var header = document.getElementById("main-header");
    if (header) header.classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  function beforeUnloadHandler(e) {
    if (phase === "chat" && (state !== "idle" || userReplies > 0)) {
      e.preventDefault(); e.returnValue = "";
    }
  }
  window.addEventListener("beforeunload", beforeUnloadHandler);

  document.addEventListener("click", function (e) {
    var backBtn = e.target.closest("#btn-back");
    if (!backBtn) return;
    if (phase === "loading" || (state === "idle" && userReplies === 0)) return;
    if (phase === "done" || phase === "finalizing") return;
    e.stopPropagation();
    e.preventDefault();
    if (confirm("對話尚未完成，離開後這段紀錄將會遺失。\n確定要離開嗎？")) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      history.back();
    }
  }, true);

})();
