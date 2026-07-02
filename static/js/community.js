(function () {
  "use strict";

  // 主題 / 字體初始化
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
    if (localStorage.getItem('app-dark') === '1') document.body.classList.add('dark');
  })();

  var diaries    = window.COMMUNITY_DATA || [];
  var autoExpId  = String(window.COMMUNITY_AUTO_EXPAND || '');
  var feed       = document.getElementById('community-feed');
  var emptyEl    = document.getElementById('community-empty');

  var currentAudio   = null;
  var currentPlayBtn = null;

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stopCurrentAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (currentPlayBtn) {
      currentPlayBtn.innerHTML =
        '<span class="material-symbols-outlined">play_arrow</span>播放語音';
    }
    currentAudio   = null;
    currentPlayBtn = null;
  }

  function buildRepliesHTML(replies) {
    if (!replies || replies.length === 0) {
      return '<p class="community-card-no-replies">還沒有語音加油，快把這篇日記分享出去吧！</p>';
    }
    return replies.map(function (r) {
      return (
        '<div class="reply-bubble-row">' +
          '<div class="reply-avatar"><span class="material-symbols-outlined">person</span></div>' +
          '<div class="reply-bubble">' +
            '<div class="reply-sender">' + escHtml(r.sender) + '</div>' +
            '<button class="reply-play-btn" data-audio-url="' + escHtml(r.audio_url) + '">' +
              '<span class="material-symbols-outlined">play_arrow</span>播放語音' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="reply-time">' + escHtml(r.time) + '</div>'
      );
    }).join('');
  }

  function buildCard(diary) {
    var thumbHTML = diary.photo
      ? '<img src="' + escHtml(diary.photo) + '" alt="日記照片"/>'
      : '<span class="material-symbols-outlined">image</span>';

    var badgeHTML = diary.reply_count > 0
      ? '<span class="community-reply-badge"><span class="material-symbols-outlined">favorite</span>' + diary.reply_count + ' 則加油</span>'
      : '<span class="community-reply-badge" style="background:transparent;color:var(--on-surface-variant);opacity:.5;"><span class="material-symbols-outlined">mic_none</span>0</span>';

    var card = document.createElement('div');
    card.className = 'community-card';
    card.dataset.diaryId = diary.id;

    card.innerHTML =
      '<div class="community-card-header">' +
        '<div class="community-card-thumb">' + thumbHTML + '</div>' +
        '<div class="community-card-info">' +
          '<div class="community-card-title">' + escHtml(diary.title) + '</div>' +
          '<div class="community-card-text">' + escHtml(diary.text) + '</div>' +
          '<div class="community-card-meta">' +
            '<span class="community-card-date">' + escHtml(diary.date) + '</span>' +
            badgeHTML +
          '</div>' +
        '</div>' +
        '<span class="material-symbols-outlined community-card-expand-icon">expand_more</span>' +
      '</div>' +
      '<div class="community-card-replies" id="replies-' + diary.id + '">' +
        '<div class="reply-section-label">語音加油留言</div>' +
        buildRepliesHTML(diary.replies) +
      '</div>';

    // 展開 / 收合
    var header = card.querySelector('.community-card-header');
    header.addEventListener('click', function () {
      var isOpen = card.classList.contains('expanded');

      document.querySelectorAll('.community-card.expanded').forEach(function (c) {
        c.classList.remove('expanded');
        c.querySelector('.community-card-replies').classList.remove('open');
      });
      stopCurrentAudio();

      if (!isOpen) {
        card.classList.add('expanded');
        document.getElementById('replies-' + diary.id).classList.add('open');
        setTimeout(function () {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    });

    // 播放按鈕（事件委派）
    card.addEventListener('click', function (e) {
      var btn = e.target.closest('.reply-play-btn');
      if (!btn) return;
      e.stopPropagation();

      var audioUrl = btn.dataset.audioUrl;
      if (!audioUrl) return;

      if (currentPlayBtn === btn && currentAudio && !currentAudio.paused) {
        currentAudio.pause();
        btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>播放語音';
        currentAudio   = null;
        currentPlayBtn = null;
        return;
      }

      stopCurrentAudio();

      var audio = new Audio(audioUrl);
      currentAudio   = audio;
      currentPlayBtn = btn;
      btn.innerHTML  = '<span class="material-symbols-outlined">pause</span>暫停';

      audio.addEventListener('ended', function () {
        btn.innerHTML  = '<span class="material-symbols-outlined">play_arrow</span>播放語音';
        currentAudio   = null;
        currentPlayBtn = null;
      });

      audio.play().catch(function () {
        btn.innerHTML  = '<span class="material-symbols-outlined">play_arrow</span>播放語音';
        currentAudio   = null;
        currentPlayBtn = null;
      });
    });

    return card;
  }

  // 渲染
  if (diaries.length === 0) {
    emptyEl.style.display = 'flex';
  } else {
    diaries.forEach(function (diary) {
      feed.appendChild(buildCard(diary));
    });
  }

  // 從分享頁跳轉時自動展開指定日記
  if (autoExpId) {
    var target = document.querySelector('[data-diary-id="' + autoExpId + '"]');
    if (target) {
      var hdr = target.querySelector('.community-card-header');
      if (hdr) setTimeout(function () { hdr.click(); }, 150);
    }
  }

  window.addEventListener('scroll', function () {
    var header = document.getElementById('main-header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
})();
