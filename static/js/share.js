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

// 回首頁
document.getElementById('btn-back-home').addEventListener('click', () => {
  window.location.href = '/index/';
});

window.addEventListener('scroll', () => {
  const header = document.getElementById('main-header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });
