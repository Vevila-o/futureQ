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
      } else if (path.includes("member")) {
        activePage = "member";
      } else if (path.includes("review")) {
        activePage = "index";
      } else if (
        path.includes("photo") ||
        path.includes("voice") ||
        path.includes("finish")
      ) {
        activePage = "index";
      }

      // ── 2. 把對應按鈕換成「凸起圓圈」樣式 ──
      const activeBtn = document.querySelector(`[data-page="${activePage}"]`);
      if (activeBtn) {
        activeBtn.className = "nav-item-home";

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
        "index": "/index/",
        "home": "/index/",
        "dashboard": "/dashboard/",
        "member": "/member/",
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