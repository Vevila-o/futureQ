document.addEventListener("DOMContentLoaded", () => {
  fetch("/nav/")
    .then(response => {
      if (!response.ok) throw new Error("無法載入導覽列");
      return response.text();
    })
    .then(data => {
      document.getElementById("nav-placeholder").innerHTML = data;

      // ── 1. 偵測目前頁面，決定哪個 nav 項目要高亮 ──
      const path = window.location.pathname;
      let activePage = "index"; // 預設高亮「聲影日記」

      if (path.includes("dashboard")) {
        activePage = "dashboard";
      } else if (path.includes("review")) {
        activePage = "index"; // 動態回顧屬於聲影日記流程
      } else if (
        path.includes("photo") ||
        path.includes("voice") ||
        path.includes("finish")
      ) {
        activePage = "index"; // 錄音流程屬於聲影日記流程
      }

      // ── 2. 把對應按鈕換成「凸起圓圈」樣式 ──
      const activeBtn = document.querySelector(`[data-page="${activePage}"]`);
      if (activeBtn) {
        activeBtn.className = "nav-item-home"; // 套用 nav.css 的高亮 class

        // 把圖示包進 home-circle div
        const icon = activeBtn.querySelector(".material-symbols-outlined");
        if (icon) {
          const circle = document.createElement("div");
          circle.className = "home-circle";
          icon.parentNode.insertBefore(circle, icon);
          circle.appendChild(icon);
        }
      }

      // ── 3. 綁定各按鈕的點擊導覽 ──
      const navLinks = {
        "index": "index.html",
        "home": "index.html",
        "dashboard": "dashboard.html",
        // "info" 和 "member" 頁面尚未完成，先不綁定
      };

      document.querySelectorAll("[data-page]").forEach(btn => {
        const page = btn.dataset.page;
        if (navLinks[page]) {
          btn.addEventListener("click", () => {
            window.location.href = navLinks[page];
          });
        }
      });
    })
    .catch(error => {
      console.error("載入導覽列發生錯誤:", error);
    });
});