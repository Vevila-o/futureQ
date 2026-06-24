
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

  if (localStorage.getItem('app-dark') === '1') {
    document.body.classList.add('dark');
  }
})();

const fileInput   = document.getElementById('file-input');
const uploadZone  = document.getElementById('upload-zone');
const zoneContent = document.getElementById('zone-content');
const previewImg  = document.getElementById('preview-img');
const deleteBtn   = document.getElementById('btn-delete');
const saveBtn     = document.getElementById('btn-save');

let currentPhotoDataUrl = null;
let selectedPhotoFile = null;

uploadZone.addEventListener('click', (e) => {
  if (e.target.closest('#btn-delete')) return;
  if (uploadZone.classList.contains('has-img')) return;
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('照片超過 5MB，請選擇較小的檔案', true);
    fileInput.value = '';
    return;
  }

  selectedPhotoFile = file;

  const reader = new FileReader();
  reader.onload = () => {
    currentPhotoDataUrl = reader.result;
    previewImg.src = currentPhotoDataUrl;
    previewImg.classList.add('visible');
    uploadZone.classList.add('has-img');
    zoneContent.style.display = 'none';
    saveBtn.disabled = false;
  };
  reader.onerror = () => {
    showToast('照片讀取失敗，請重新選擇', true);
  };
  reader.readAsDataURL(file);
});

deleteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  currentPhotoDataUrl = null;
  selectedPhotoFile = null;
  fileInput.value = '';

  previewImg.src = '';
  previewImg.classList.remove('visible');
  uploadZone.classList.remove('has-img');
  zoneContent.style.display = '';
  saveBtn.disabled = true;
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!uploadZone.classList.contains('has-img'))
    uploadZone.style.background = 'var(--secondary-container)';
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.background = '';
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.style.background = '';
  if (uploadZone.classList.contains('has-img')) return;
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

saveBtn.addEventListener('click', async (e) => {
  e.preventDefault();

  if (!selectedPhotoFile) {
    showToast('請先選擇照片', true);
    return;
  }

  if (currentPhotoDataUrl) {
    try {
      sessionStorage.setItem('diaryPhoto', currentPhotoDataUrl);
    } catch (e) {}
  }

  const formData = new FormData();
  formData.append('photo', selectedPhotoFile);

  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  try {
    const response = await fetch('/saveDiary/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken
      },
      body: formData
    });

    if (response.ok) {
      showToast('照片已儲存！');

      setTimeout(() => {
        window.location.href = response.url;
      }, 500);
    } else {
      showToast('照片儲存失敗，請再試一次', true);
    }
  } catch (error) {
    showToast('連線失敗，請再試一次', true);
  }
});

window.addEventListener('scroll', () => {
  document.querySelector('header')
    .classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const icon  = toast.querySelector('.material-symbols-outlined');
  document.getElementById('toast-msg').textContent = msg;
  icon.textContent = isError ? 'error' : 'check_circle';
  icon.style.color = isError ? '#eb5757' : '#6fcf97';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}
