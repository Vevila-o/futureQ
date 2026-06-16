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
    const STEPS = [.8,.875,.95,1,1.1,1.2,1.35,1.5,1.65,1.8];
    document.documentElement.style.setProperty('--fs-scale', STEPS[parseInt(font)] || 1);
  }
  if (localStorage.getItem('app-dark') === '1') document.body.classList.add('dark');
})();

const today = new Date();

function dateLabel(d) {
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

const lastYear = new Date(today);
lastYear.setFullYear(today.getFullYear() - 1);

const DEMO = {
  yesterday: [
    {
      date: dateLabel(yesterday),
      tag: '昨天',
      transcript: '昨天下午去菜市場買了蔬菜，順便和隔壁的李阿姨聊了聊。她說她的孫子快要回來了，我們都很期待。回家後煮了一鍋排骨湯，香味飄滿整個廚房。',
      photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDabO9XMCmKxNTHNYWiTInrpQ2R7RDQTEn_9txxTwr1GLgNGAK3YeRGUL7P598rugiKhwBSY_k8tQz8PMOEt6GiV1aYpl4XkVMRPAwkefY-W9ybY8NVfZkgiNywfUHx0H78Nqsn6nyZBatI66brxK3c9aArJC0rsylt2DHwcGqC8WkypgBpFnUw-61Fr9wb6jTQQZUbNOg-nTInyd6Q82nqoK7MIl0UzHNc9qedT1o6acw1t10xKesvnAUReZTBxcu5wD_VtxNClZBk'
    },
    {
      date: dateLabel(yesterday),
      tag: '昨天傍晚',
      transcript: '傍晚和老伴在社區公園散步，夕陽很美，我們坐在長椅上聊了很久年輕時候的事。那個時候日子苦，但心裡很踏實。',
      photo: null
    }
  ],
  lastyear: [
    {
      date: dateLabel(lastYear),
      tag: '去年的今天',
      transcript: '去年的今天，小女兒帶著外孫回來住了三天。外孫第一次學會叫「阿嬤」，我高興得眼眶都濕了。我們去附近的公園拍了好多照片，那天的天氣特別好。',
      photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHQRG1zXlP-uAliC8Yrlbivdr4kYy15tzMgqomHbjQzYc52qaVkB9rmDbwGkPRionT5UeWD2sSvqMlP_rjzQ1QQz_EkR2mA_-CTsgaUV4jZk-ga5nU7n8ydh5m8qbOsmv0UFGoqSYGKaaTE1XoIvFPn0lsVhypwfEoljl6m6jZd5K4Ybx2oF2Ba_bVHOdL1as-EQcODMY5-yqGG79rOhXV2o-4zoIMFHVW6ZVdKte4gVXTbTeL9mk3PaNj_9F7aLVfOCbfqy5ZDJmd'
    }
  ]
};

function renderCards(entries, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!entries || entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">sentiment_neutral</span>
        <div class="empty-title">這天還沒有日記</div>
        <div class="empty-sub">快去記錄今天的故事吧！</div>
      </div>`;
    return;
  }

  const label = document.createElement('div');
  label.className = 'section-label';
  label.innerHTML = `
    <span>${entries[0].tag}</span>
    <div class="section-label-line"></div>
    <span>${entries[0].date}</span>`;
  container.appendChild(label);

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'diary-card';
    card.innerHTML = `
      ${entry.photo
        ? `<img class="card-photo" src="${entry.photo}" alt="日記照片"/>`
        : `<div class="card-photo-placeholder">
             <span class="material-symbols-outlined" style="font-size:40px;">image</span>
           </div>`}
      <div class="card-body">
        <div class="card-date-row">
          <span class="card-date">${entry.date}</span>
          <span class="card-tag">${entry.tag}</span>
        </div>
        <div class="card-transcript">${entry.transcript}</div>
        <div class="card-play-row">
          <button class="card-play-btn">
            <span class="material-symbols-outlined" style="font-size:18px;font-variation-settings:'FILL' 1;">play_arrow</span>
            播放語音
          </button>
        </div>
      </div>`;
    card.addEventListener('click', () => openModal(entry));
    container.appendChild(card);
  });
}

function openModal(entry) {
  document.getElementById('modal-date').textContent = `${entry.date}（${entry.tag}）`;
  const img         = document.getElementById('modal-photo-img');
  const placeholder = document.getElementById('modal-photo-placeholder');
  if (entry.photo) {
    img.src = entry.photo;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }
  document.getElementById('modal-transcript').textContent = entry.transcript;
  const overlay = document.getElementById('entry-overlay');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });
}

function closeModal() {
  const overlay = document.getElementById('entry-overlay');
  overlay.classList.remove('visible');
  setTimeout(() => { overlay.classList.remove('open'); overlay.style.display = 'none'; }, 300);
}

document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('entry-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

function switchTab(tab) {
  document.getElementById('tab-yesterday').classList.toggle('active', tab === 'yesterday');
  document.getElementById('tab-lastyear').classList.toggle('active', tab === 'lastyear');
  document.getElementById('panel-yesterday').style.display = tab === 'yesterday' ? '' : 'none';
  document.getElementById('panel-lastyear').style.display  = tab === 'lastyear'  ? '' : 'none';
}

window.addEventListener('scroll', () => {
  document.getElementById('main-header').classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

renderCards(DEMO.yesterday, 'panel-yesterday');
renderCards(DEMO.lastyear,  'panel-lastyear');