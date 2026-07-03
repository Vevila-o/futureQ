(function () {
  const THEMES = {
    green:  { primary: '#36684c', secondary: '#d4ede0', onSecondary: '#0d3325' },
    blue:   { primary: '#3872ef', secondary: '#dbeafe', onSecondary: '#1e3a8a' },
    purple: { primary: '#854be9', secondary: '#ede9fe', onSecondary: '#4c1d95' },
    warm:   { primary: '#e97345', secondary: '#ffedd5', onSecondary: '#7c2d12' },
  };
  const t = THEMES[localStorage.getItem('app-theme')] || THEMES['green'];
  document.documentElement.style.setProperty('--primary', t.primary);
  document.documentElement.style.setProperty('--secondary-container', t.secondary);
  document.documentElement.style.setProperty('--on-secondary-container', t.onSecondary);

  const font = localStorage.getItem('app-font');
  if (font !== null) {
    const STEPS = [.8, .875, .95, 1, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8];
    document.documentElement.style.setProperty('--fs-scale', STEPS[parseInt(font)] || 1);
  }
  if (localStorage.getItem('app-dark') === '1') document.body.classList.add('dark');
})();

const SHARE_DATA = window.SHARE_DATA || {};
const pageUrl = SHARE_DATA.pageUrl || window.location.href;
const isPreview = SHARE_DATA.isPreview || false;

// preview 模式：移除頂部空白（沒有 header）
if (isPreview) {
  var main = document.querySelector('main');
  if (main) main.style.paddingTop = '24px';
}

// 分享到平台時的連結加上 preview=1，讓接收方看到乾淨頁面
function buildShareUrl() {
  var url = new URL(pageUrl);
  url.searchParams.set('preview', '1');
  return url.toString();
}

function showFeedback(msg) {
  const el = document.getElementById('share-feedback');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// LINE 分享（接收方看到的是 preview 版）
document.getElementById('btn-share-line').addEventListener('click', () => {
  const url = encodeURIComponent(buildShareUrl());
  window.open('https://social-plugins.line.me/lineit/share?url=' + url, '_blank');
});

// Facebook 分享（接收方看到的是 preview 版）
document.getElementById('btn-share-fb').addEventListener('click', () => {
  const url = encodeURIComponent(buildShareUrl());
  window.open('https://www.facebook.com/sharer/sharer.php?u=' + url, '_blank');
});

// 儲存圖片（html2canvas）
document.getElementById('btn-save-img').addEventListener('click', async () => {
  const card = document.getElementById('share-card');
  if (!card) return;

  const btn = document.getElementById('btn-save-img');
  btn.disabled = true;
  btn.textContent = '處理中...';

  try {
    const canvas = await html2canvas(card, {
      useCORS: true,
      scale: 2,
      backgroundColor: '#ffffff',
    });
    const link = document.createElement('a');
    link.download = '聲影日記.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showFeedback('圖片已儲存！');
  } catch (e) {
    showFeedback('圖片產生失敗，請截圖儲存');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">download</span>儲存圖片';
  }
});

// 複製連結
document.getElementById('btn-copy-link').addEventListener('click', () => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(pageUrl).then(() => {
      showFeedback('連結已複製！');
    }).catch(() => {
      fallbackCopy();
    });
  } else {
    fallbackCopy();
  }
});

function fallbackCopy() {
  const el = document.createElement('textarea');
  el.value = pageUrl;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  showFeedback('連結已複製！');
}

// 回首頁（preview 模式沒有此按鈕）
const btnBackHome = document.getElementById('btn-back-home');
if (btnBackHome) {
  btnBackHome.addEventListener('click', () => {
    window.location.href = '/index/';
  });
}

window.addEventListener('scroll', () => {
  const header = document.getElementById('main-header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ── 語音加油錄製 ──────────────────────────────────────────────
(function () {
  var vrMicBtn      = document.getElementById('vr-mic-btn');
  if (!vrMicBtn) return; // preview mode: section absent

  var diaryId       = (document.querySelector('main[data-diary-id]') || {}).dataset
                        ? document.querySelector('main').dataset.diaryId : null;
  var vrMicIcon     = document.getElementById('vr-mic-icon');
  var vrHint        = document.getElementById('vr-hint');
  var vrTimer       = document.getElementById('vr-timer');
  var vrPreview     = document.getElementById('vr-preview');
  var vrAudioPlayer = document.getElementById('vr-audio-player');
  var vrSendBtn     = document.getElementById('vr-send-btn');
  var vrRedoBtn     = document.getElementById('vr-redo-btn');
  var vrFeedback    = document.getElementById('vr-feedback');

  var MAX_SEC      = 10;
  var mediaRecorder = null;
  var audioChunks  = [];
  var recordedBlob = null;
  var activeStream = null;
  var timerId      = null;
  var elapsed      = 0;
  var pressing     = false;

  function padTwo(n) { return String(n).padStart(2, '0'); }

  function tickTimer() {
    elapsed++;
    vrTimer.textContent = '00:' + padTwo(elapsed) + ' / 00:10';
    if (elapsed >= MAX_SEC) stopRecording();
  }

  async function startRecording() {
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks  = [];
      recordedBlob = null;

      var mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                   : MediaRecorder.isTypeSupported('audio/mp4')  ? 'audio/mp4'
                   : 'audio/ogg';

      mediaRecorder = new MediaRecorder(activeStream, { mimeType: mimeType });
      mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = function () {
        recordedBlob = new Blob(audioChunks, { type: mimeType });
        activeStream.getTracks().forEach(function (t) { t.stop(); });
        showPreview();
      };
      mediaRecorder.start();

      elapsed = 0;
      timerId = setInterval(tickTimer, 1000);
      vrMicIcon.textContent = 'graphic_eq';
      vrHint.textContent    = '錄音中... 放開停止';
      vrTimer.style.display = 'block';
      vrTimer.textContent   = '00:00 / 00:10';
      vrMicBtn.classList.add('vr-recording');
    } catch (err) {
      alert('無法使用麥克風，請確認瀏覽器是否已允許錄音權限');
    }
  }

  function stopRecording() {
    clearInterval(timerId);
    timerId = null;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    vrMicBtn.classList.remove('vr-recording');
    vrTimer.style.display = 'none';
    vrMicIcon.textContent = 'mic';
    vrHint.textContent    = '長按開始錄音';
  }

  function showPreview() {
    if (!recordedBlob) return;
    vrAudioPlayer.src       = URL.createObjectURL(recordedBlob);
    vrPreview.style.display = 'flex';
    vrHint.style.display    = 'none';
  }

  function resetRecorder() {
    recordedBlob            = null;
    audioChunks             = [];
    vrPreview.style.display = 'none';
    vrHint.style.display    = 'block';
    vrHint.textContent      = '長按開始錄音';
    vrAudioPlayer.src       = '';
  }

  vrMicBtn.addEventListener('touchstart', function (e) {
    e.preventDefault();
    pressing = true;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') startRecording();
  }, { passive: false });

  vrMicBtn.addEventListener('mousedown', function () {
    pressing = true;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') startRecording();
  });

  document.addEventListener('touchend', function () {
    if (!pressing) return;
    pressing = false;
    if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
  });

  document.addEventListener('mouseup', function () {
    if (!pressing) return;
    pressing = false;
    if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
  });

  vrRedoBtn.addEventListener('click', resetRecorder);

  vrSendBtn.addEventListener('click', async function () {
    if (!recordedBlob || !diaryId) return;
    vrSendBtn.disabled = true;
    vrSendBtn.textContent = '傳送中...';

    var ext = recordedBlob.type.includes('mp4') ? 'mp4'
            : recordedBlob.type.includes('ogg') ? 'ogg' : 'webm';

    var formData = new FormData();
    formData.append('diary_id', diaryId);
    formData.append('audio_file', recordedBlob, 'voice_reply.' + ext);
    formData.append('sender_name', '匿名朋友');

    try {
      var res  = await fetch('/api/voice-reply/', { method: 'POST', body: formData });
      var data = await res.json();
      if (data.status === 'ok') {
        vrPreview.style.display  = 'none';
        vrFeedback.innerHTML     = '✓ 語音加油已送出！感謝您的鼓勵';
        vrFeedback.style.display = 'block';
        vrFeedback.classList.add('vr-feedback--success');
        setTimeout(function () {
          vrFeedback.style.display = 'none';
          vrFeedback.classList.remove('vr-feedback--success');
          resetRecorder();
        }, 3500);
      } else {
        vrFeedback.textContent   = '送出失敗，請再試一次';
        vrFeedback.style.display = 'block';
        vrSendBtn.disabled = false;
        vrSendBtn.innerHTML = '<span class="material-symbols-outlined">send</span>送出語音加油';
      }
    } catch (err) {
      vrFeedback.textContent   = '網路錯誤，請稍後再試';
      vrFeedback.style.display = 'block';
      vrSendBtn.disabled = false;
      vrSendBtn.innerHTML = '<span class="material-symbols-outlined">send</span>送出語音加油';
    }
  });
})();
