(function () {
  'use strict';

  (function () {
    var THEMES = {
      green:  { primary: '#36684c', secondary: '#d4ede0', onSecondary: '#0d3325' },
      blue:   { primary: '#3872ef', secondary: '#dbeafe', onSecondary: '#1e3a8a' },
      purple: { primary: '#854be9', secondary: '#ede9fe', onSecondary: '#4c1d95' },
      warm:   { primary: '#e97345', secondary: '#ffedd5', onSecondary: '#7c2d12' },
    };
    var t = THEMES[localStorage.getItem('app-theme')] || THEMES['green'];
    document.documentElement.style.setProperty('--primary', t.primary);
    document.documentElement.style.setProperty('--secondary-container', t.secondary);
    document.documentElement.style.setProperty('--on-secondary-container', t.onSecondary);

    var font = localStorage.getItem('app-font');
    if (font !== null) {
      var STEPS = [.8, .875, .95, 1, 1.1, 1.2, 1.35, 1.5, 1.65, 1.8];
      document.documentElement.style.setProperty('--fs-scale', STEPS[parseInt(font)] || 1);
    }

    if (localStorage.getItem('app-dark') === '1') {
      document.body.classList.add('dark');
    }
  })();

  try {
    var savedPhoto = sessionStorage.getItem('diaryPhoto');
    if (savedPhoto) {
      var photoImg = document.querySelector('.prompt-photo img');
      if (photoImg) photoImg.src = savedPhoto;
    }
  } catch (e) {}

  var LIMIT = 180; 
  var remaining = LIMIT;
  var timerId = null;
  var state = 'idle'; 

  var elDot      = document.getElementById('status-dot');
  var elLabel     = document.getElementById('status-label');
  var elTimer     = document.getElementById('record-timer');
  var elControls  = document.getElementById('record-controls');
  var elSave      = document.getElementById('btn-save');
  var elWave      = document.getElementById('waveform');
  var waveBars    = elWave ? elWave.querySelectorAll('.wave-bar') : [];

  function formatTime(s) {
    var m = Math.floor(s / 60).toString().padStart(2, '0');
    var sec = (s % 60).toString().padStart(2, '0');
    return m + ':' + sec;
  }

  function makeCtrlButton(icon, label, cls, handler) {
    var wrap = document.createElement('div');
    wrap.className = 'ctrl-item';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ctrl-btn ' + cls;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = '<span class="material-symbols-outlined">' + icon + '</span>';
    btn.addEventListener('click', handler);

    var labelEl = document.createElement('span');
    labelEl.className = 'ctrl-label';
    labelEl.textContent = label;

    wrap.appendChild(btn);
    wrap.appendChild(labelEl);
    return wrap;
  }

  function renderControls() {
    elControls.innerHTML = '';
    if (state === 'recording') {
      elControls.appendChild(makeCtrlButton('replay', '重新', 'ctrl-btn-outline-neutral', onRestart));
      elControls.appendChild(makeCtrlButton('pause', '暫停', 'ctrl-btn-primary', onPause));
      elControls.appendChild(makeCtrlButton('stop', '結束', 'ctrl-btn-danger', onStop));
    } else if (state === 'paused' || state === 'idle') {
      elControls.appendChild(makeCtrlButton('mic', '開始', 'ctrl-btn-outline-primary', onStart));
    }
  }

  function renderStatus() {
    elTimer.textContent = formatTime(remaining);
    elDot.classList.toggle('pulsing', state === 'recording');
    if (elWave) elWave.classList.toggle('active', state === 'recording');

    if (state === 'idle') {
      elLabel.textContent = '尚未開始';
      elDot.style.backgroundColor = 'var(--outline-variant)';
    } else if (state === 'recording') {
      elLabel.textContent = '錄音中';
      elDot.style.backgroundColor = 'var(--error)';
    } else if (state === 'paused') {
      elLabel.textContent = '已暫停';
      elDot.style.backgroundColor = '#e9a13d';
    } else if (state === 'ended') {
      elLabel.textContent = '錄音完成';
      elDot.style.backgroundColor = 'var(--primary)';
    }
    elSave.disabled = (state === 'idle');
  }

  function tick() {
    remaining--;
    if (remaining <= 0) {
      remaining = 0;
      stopTimer();
      state = 'ended';
      renderControls();
      renderStatus();
      return;
    }
    renderStatus();
  }

  function startTimer() { stopTimer(); timerId = setInterval(tick, 1000); }
  function stopTimer()  { if (timerId) { clearInterval(timerId); timerId = null; } }

  function onStart()   { state = 'recording'; startTimer(); renderControls(); renderStatus(); }
  function onPause()   { state = 'paused'; stopTimer(); renderControls(); renderStatus(); }
  function onRestart() { remaining = LIMIT; state = 'recording'; startTimer(); renderControls(); renderStatus(); }
  function onStop()    { state = 'ended'; stopTimer(); renderControls(); renderStatus(); }

  elSave.addEventListener('click', function () {
    if (elSave.disabled) return;
    stopTimer();
    window.location.href = 'finish.html';
  });

  setInterval(function () {
    if (state !== 'recording') return;
    waveBars.forEach(function (bar) {
      bar.style.height = (Math.floor(Math.random() * 40) + 8) + 'px';
    });
  }, 300);

  window.addEventListener('scroll', function () {
    var header = document.getElementById('main-header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  renderControls();
  renderStatus();
})();
