
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

  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var today = new Date();
  var dateEl = document.getElementById('congrats-date');
  if (dateEl) {
    dateEl.textContent = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' +
      today.getDate() + '日 星期' + WEEK[today.getDay()];
  }

  var REPLIES_LEFT = 0; 
  var btnReply = document.getElementById('btn-reply');
  if (btnReply) {
    btnReply.textContent = '回覆 (可用次數 ' + REPLIES_LEFT + '/3)';
    btnReply.disabled = REPLIES_LEFT <= 0;
  }

  var btnSkip = document.getElementById('btn-skip');
  var aiZone  = document.getElementById('ai-zone');
  if (btnSkip && aiZone) {
    btnSkip.addEventListener('click', function () {
      aiZone.style.display = 'none';
    });
  }
  var btnShare   = document.getElementById('btn-share');
  var btnNoShare = document.getElementById('btn-no-share');
  var feedback   = document.getElementById('share-feedback');

  function finishShare(message) {
    if (btnShare) btnShare.disabled = true;
    if (btnNoShare) btnNoShare.disabled = true;
    if (feedback) {
      feedback.textContent = message;
      feedback.style.display = 'block';
    }
    setTimeout(function () { window.location.href = 'index.html'; }, 1200);
  }
  if (btnShare) btnShare.addEventListener('click', function () { finishShare('已分享到動態牆！'); });
  if (btnNoShare) btnNoShare.addEventListener('click', function () { finishShare('好的，這篇只留給自己。'); });

  window.addEventListener('scroll', function () {
    var header = document.getElementById('main-header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
})();
