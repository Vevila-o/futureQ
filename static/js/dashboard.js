document.addEventListener("DOMContentLoaded", function () {
  const overlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalContent = document.getElementById("modal-content");
  const modalClose = document.getElementById("modal-close");

  // 點擊雷達圖標籤 → 開啟說明視窗
  document.querySelectorAll(".info-trigger").forEach(function (el) {
    el.addEventListener("click", function () {
      modalTitle.textContent = el.dataset.title;
      modalContent.textContent = el.dataset.desc;
      overlay.classList.add("show");
    });
  });

  // 點擊「我知道了」→ 關閉
  modalClose.addEventListener("click", function () {
    overlay.classList.remove("show");
  });

  // 點擊半透明背景 → 關閉
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      overlay.classList.remove("show");
    }
  });
});