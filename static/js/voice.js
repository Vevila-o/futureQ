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
    if (savedPhoto) {
      var photoImg = document.querySelector(".prompt-photo img");
      if (photoImg) photoImg.src = savedPhoto;
    }
  } catch (e) {}

  var LIMIT = 180;
  var remaining = LIMIT;
  var timerId = null;
  var state = "idle"; // idle | recording | paused | ended

  var mediaRecorder = null;
  var audioChunks = [];
  var recordedBlob = null;
  var activeStream = null;

  var params = new URLSearchParams(window.location.search);
  var diaryId = params.get("diary_id");

  // DOM refs
  var elDot      = document.getElementById("status-dot");
  var elLabel    = document.getElementById("status-label");
  var elTimer    = document.getElementById("record-timer");
  var elSave     = document.getElementById("btn-save");
  var elWave     = document.getElementById("waveform");
  var waveBars   = document.querySelectorAll(".wave-bar");

  var holdBtn      = document.getElementById("hold-mic-btn");
  var holdMicIcon  = document.getElementById("hold-mic-icon");
  var holdHint     = document.getElementById("hold-hint");
  var btnRestart   = document.getElementById("btn-restart");
  var btnComplete  = document.getElementById("btn-complete");

  // Player refs (inside waveform)
  var waveBarsEl    = document.getElementById("wave-bars");
  var wavePlayerEl  = document.getElementById("wave-player");
  var audioPlayer   = document.getElementById("audio-player");
  var wavePlayBtn   = document.getElementById("wave-play-btn");
  var wavePlayIcon  = wavePlayBtn ? wavePlayBtn.querySelector(".material-symbols-outlined") : null;
  var progressFill  = document.getElementById("wave-progress-fill");
  var progressTrack = document.getElementById("wave-progress-track");
  var waveCurrentT  = document.getElementById("wave-current-time");
  var waveTotalT    = document.getElementById("wave-total-time");

  // ── Time formatting ───────────────────────────────────────────────────────

  function formatTime(s) {
    var m = Math.floor(s / 60).toString().padStart(2, "0");
    var sec = (s % 60).toString().padStart(2, "0");
    return m + ":" + sec;
  }

  function fmtPlayerTime(s) {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60).toString().padStart(2, "0");
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
      endRecording();
      return;
    }
    renderStatus();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderStatus() {
    elTimer.textContent = formatTime(remaining);
    elDot.classList.toggle("pulsing", state === "recording");
    if (elWave) elWave.classList.toggle("active", state === "recording");

    holdBtn.classList.remove("btn-paused");

    if (state === "idle") {
      elLabel.textContent = "尚未開始";
      elDot.style.backgroundColor = "var(--outline-variant)";
      holdMicIcon.textContent = "mic";
      holdHint.textContent = "點擊開始錄音";
      holdBtn.style.display = "flex";
      if (btnComplete) btnComplete.style.display = "none";
      if (btnRestart) btnRestart.style.display = "none";
      showWaveBars();
    } else if (state === "recording") {
      elLabel.textContent = "錄音中";
      elDot.style.backgroundColor = "var(--error)";
      holdMicIcon.textContent = "pause";
      holdHint.textContent = "點擊暫停，或按完成結束錄音";
      holdBtn.style.display = "flex";
      if (btnComplete) btnComplete.style.display = "flex";
      if (btnRestart) btnRestart.style.display = "none";
      showWaveBars();
    } else if (state === "paused") {
      elLabel.textContent = "已暫停";
      elDot.style.backgroundColor = "#e9a13d";
      holdMicIcon.textContent = "mic";
      holdHint.textContent = "點擊繼續錄音，或按完成結束錄音";
      holdBtn.classList.add("btn-paused");
      holdBtn.style.display = "flex";
      if (btnComplete) btnComplete.style.display = "flex";
      if (btnRestart) btnRestart.style.display = "inline-block";
      showWaveBars();
    } else if (state === "ended") {
      elLabel.textContent = "錄音完成";
      elDot.style.backgroundColor = "var(--primary)";
      holdHint.textContent = "可試聽後保存";
      holdBtn.style.display = "none";
      if (btnComplete) btnComplete.style.display = "none";
      if (btnRestart) btnRestart.style.display = "inline-block";
      showPlayer();
    }

    var canSave = state === "ended";
    elSave.style.display = canSave ? "block" : "none";
    elSave.disabled = !canSave;
  }

  function showWaveBars() {
    if (waveBarsEl)   waveBarsEl.style.display = "flex";
    if (wavePlayerEl) wavePlayerEl.style.display = "none";
  }

  function showPlayer() {
    if (waveBarsEl)   waveBarsEl.style.display = "none";
    if (wavePlayerEl) wavePlayerEl.style.display = "flex";
  }

  // ── Recording actions ─────────────────────────────────────────────────────

  async function startRecording() {
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      recordedBlob = null;
      resetPlayer();

      var mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
                   : MediaRecorder.isTypeSupported("audio/mp4")  ? "audio/mp4"
                   : "audio/ogg";
      mediaRecorder = new MediaRecorder(activeStream, { mimeType: mimeType });
      mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = function () {
        recordedBlob = new Blob(audioChunks, { type: mimeType });
        initPlayer(recordedBlob);
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
    if (mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume();
    }
    state = "recording";
    startTimer();
    renderStatus();
  }

  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.pause();
    }
    state = "paused";
    stopTimer();
    renderStatus();
  }

  function endRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    state = "ended";
    stopTimer();
    renderStatus();
  }

  function onRestart() {
    if (audioPlayer) audioPlayer.pause();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    remaining = LIMIT;
    state = "idle";
    recordedBlob = null;
    audioChunks = [];
    resetPlayer();
    renderStatus();
  }

  // ── Mini player ───────────────────────────────────────────────────────────

  function initPlayer(blob) {
    if (!audioPlayer) return;
    audioPlayer.src = URL.createObjectURL(blob);
    audioPlayer.load();

    audioPlayer.onloadedmetadata = function () {
      if (waveTotalT) waveTotalT.textContent = fmtPlayerTime(audioPlayer.duration);
    };
    audioPlayer.ontimeupdate = function () {
      var pct = audioPlayer.duration ? (audioPlayer.currentTime / audioPlayer.duration) * 100 : 0;
      if (progressFill) progressFill.style.width = pct + "%";
      if (waveCurrentT) waveCurrentT.textContent = fmtPlayerTime(audioPlayer.currentTime);
    };
    audioPlayer.onended = function () {
      if (wavePlayIcon) wavePlayIcon.textContent = "play_arrow";
    };
  }

  function resetPlayer() {
    if (audioPlayer) { audioPlayer.pause(); audioPlayer.src = ""; }
    if (progressFill) progressFill.style.width = "0%";
    if (waveCurrentT) waveCurrentT.textContent = "0:00";
    if (waveTotalT)   waveTotalT.textContent   = "0:00";
    if (wavePlayIcon) wavePlayIcon.textContent  = "play_arrow";
  }

  if (wavePlayBtn) {
    wavePlayBtn.addEventListener("click", function () {
      if (!audioPlayer || !audioPlayer.src) return;
      if (audioPlayer.paused) {
        audioPlayer.play();
        if (wavePlayIcon) wavePlayIcon.textContent = "pause";
      } else {
        audioPlayer.pause();
        if (wavePlayIcon) wavePlayIcon.textContent = "play_arrow";
      }
    });
  }

  if (progressTrack) {
    progressTrack.addEventListener("click", function (e) {
      if (!audioPlayer || !audioPlayer.duration) return;
      var r = progressTrack.getBoundingClientRect();
      var pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      audioPlayer.currentTime = pct * audioPlayer.duration;
    });
  }

  // ── Click handlers ────────────────────────────────────────────────────────

  holdBtn.addEventListener("click", function () {
    if (state === "idle") {
      startRecording();
    } else if (state === "recording") {
      pauseRecording();
    } else if (state === "paused") {
      resumeRecording();
    }
  });

  if (btnComplete) {
    btnComplete.addEventListener("click", function () {
      if (state !== "recording" && state !== "paused") return;
      endRecording();
    });
  }

  if (btnRestart) {
    btnRestart.addEventListener("click", onRestart);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  elSave.addEventListener("click", async function () {
    if (elSave.disabled) return;
    stopTimer();
    if (audioPlayer) audioPlayer.pause();

    if (!diaryId) { alert("找不到日記 ID，請重新上傳照片"); return; }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      await new Promise(function (r) { setTimeout(r, 500); });
    }
    if (!recordedBlob) { alert("尚未錄到音檔"); return; }

    var recordExt = recordedBlob.type.indexOf("mp4") !== -1 ? "mp4"
                   : recordedBlob.type.indexOf("ogg") !== -1 ? "ogg"
                   : "webm";

    var formData = new FormData();
    formData.append("diary_id", diaryId);
    formData.append("audio_file", recordedBlob, "diary_audio." + recordExt);
    formData.append("transcription", "這裡之後會放 Whisper 語音轉文字結果");

    var csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
    var overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = "flex";
    window.removeEventListener("beforeunload", beforeUnloadHandler);

    var response = await fetch("/updateDiaryAudio/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfToken },
      body: formData,
    });

    if (response.ok) {
      window.location.href = "/finish/?diary_id=" + diaryId;
    } else {
      if (overlay) overlay.style.display = "none";
      alert("錄音儲存失敗，請再試一次");
    }
  });

  // ── Waveform animation ────────────────────────────────────────────────────

  setInterval(function () {
    if (state !== "recording") return;
    waveBars.forEach(function (bar) {
      bar.style.height = Math.floor(Math.random() * 40) + 8 + "px";
    });
  }, 300);

  // ── Misc ──────────────────────────────────────────────────────────────────

  window.addEventListener("scroll", function () {
    var header = document.getElementById("main-header");
    if (header) header.classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  renderStatus();

  function beforeUnloadHandler(e) {
    if (state !== "idle") { e.preventDefault(); e.returnValue = ""; }
  }
  window.addEventListener("beforeunload", beforeUnloadHandler);

  document.addEventListener("click", function (e) {
    var backBtn = e.target.closest("#btn-back");
    if (!backBtn) return;
    if (state === "idle") return;
    e.stopPropagation();
    e.preventDefault();
    if (confirm("錄音尚未儲存，離開後錄音將會丟失。\n確定要離開嗎？")) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      history.back();
    }
  }, true);

})();
