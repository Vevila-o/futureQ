// js/headerback.js
document.addEventListener("DOMContentLoaded", () => {
  const placeholder = document.getElementById("headerback-placeholder");
  if (!placeholder) return;

  // 從 HTML 標籤取得參數，如果沒有設定就使用預設值
  const title = placeholder.getAttribute("data-title") || "憶智防線";
  const icon = placeholder.getAttribute("data-icon") || "";
  const backUrl = placeholder.getAttribute("data-back") || "back";

  fetch("headerback.html")
    .then(response => {
      if (!response.ok) throw new Error("無法載入 HeaderBack");
      return response.text();
    })
    .then(data => {
      // 1. 塞入 HTML
      placeholder.innerHTML = data;

      // 2. 設定標題與 Icon
      const titleEl = document.getElementById("headerback-title");
      if (titleEl) {
        let innerHTML = "";
        if (icon) {
          innerHTML += `<span class="material-symbols-outlined" style="font-size:22px;font-variation-settings:'FILL' 1;">${icon}</span> `;
        }
        innerHTML += title;
        titleEl.innerHTML = innerHTML;
      }

      // 3. 設定返回按鈕的點擊邏輯
      const btnBack = document.getElementById("btn-back");
      if (btnBack) {
        btnBack.addEventListener("click", () => {
          if (backUrl === "back") {
            history.back(); // 回上一頁
          } else {
            window.location.href = backUrl; // 跳轉到指定頁面
          }
        });
      }

      // 4. 綁定滾動變色效果
      window.addEventListener("scroll", () => {
        const header = document.getElementById("main-header");
        if (header) {
          header.classList.toggle("scrolled", window.scrollY > 10);
        }
      }, { passive: true });
    })
    .catch(error => console.error("載入 HeaderBack 發生錯誤:", error));
});