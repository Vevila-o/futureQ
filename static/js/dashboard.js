document.addEventListener("DOMContentLoaded", function () {
  // === 1. 說明彈窗控制 ===
  const overlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalContent = document.getElementById("modal-content");
  const modalClose = document.getElementById("modal-close");

  if (overlay && modalClose) {
    // ── 檢查是否有一周內的資料，若無則跳出溫馨彈窗 ──
    if (window.HAS_WEEK_DATA === false) {
      modalTitle.textContent = "溫馨小提醒 🌸";
      modalContent.textContent = "親愛的長輩您好！為了能更精準地為您分析大腦的健康狀況，建議您可以先持續完成 7 天的聲影日記喔。讓我們每天一起用聲音記錄生活，守護智慧與健康，加油！❤️";
      if (modalClose) {
        modalClose.textContent = "去寫日記";
      }
      overlay.classList.add("show");
    }

    // 點擊雷達圖標籤 → 開啟說明視窗
    document.querySelectorAll(".info-trigger").forEach(function (el) {
      el.addEventListener("click", function () {
        modalTitle.textContent = el.dataset.title;
        modalContent.textContent = el.dataset.desc;
        overlay.classList.add("show");
      });
    });

    // 點擊「我知道了」/「去寫日記」→ 關閉或導頁
    modalClose.addEventListener("click", function () {
      if (window.HAS_WEEK_DATA === false) {
        window.location.href = "/index/";
      } else {
        overlay.classList.remove("show");
      }
    });

    // 點擊半透明背景 → 關閉 (無週資料時禁止點擊背景關閉)
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay && window.HAS_WEEK_DATA !== false) {
        overlay.classList.remove("show");
      }
    });
  }

  // === 2. 雷達圖資料計算與動態動畫 ===
  const userPolygon = document.getElementById("radar-user");
  const avgPolygon = document.getElementById("radar-avg");
  const dots = document.querySelectorAll(".radar-dot");

  // 取得後端傳入的長者分數 (若無，預設為備用假資料)
  const userScores = window.RADAR_USER_DATA || [3.0, 2.5, 3.2, 2.8, 3.0, 2.9];
  // 同齡平均分數 (固定值，對應 points: 50,20 76,35 76,65 50,80 24,65 24,35)
  // 這相當於每項都是 2.667 分 (30 / 45 * 4 = 2.667)
  const avgScores = [2.667, 2.667, 2.667, 2.667, 2.667, 2.667];

  const center = 50;
  const maxRadius = 45;
  const maxScore = 4;

  // 計算最終座標點
  function getFinalCoords(scores) {
    return scores.map((score, i) => {
      const value = Math.max(0, Math.min(maxScore, score));
      const radius = (value / maxScore) * maxRadius;
      const angle = -Math.PI / 2 + (i * Math.PI) / 3;
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      return { x, y };
    });
  }

  const userFinalCoords = getFinalCoords(userScores);
  const avgFinalCoords = getFinalCoords(avgScores);

  // 動態插值 (Lerp) 函數
  function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  // 三次方緩和函數 (Ease Out Cubic)
  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  let startTime = null;
  const duration = 1000; // 動畫總長度 1 秒 (1000毫秒)

  function animateRadar(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = easeOutCubic(progress);

    // 計算當前影格的點座標
    const currentUserPoints = [];
    const currentAvgPoints = [];

    // 1. 長者多邊形與圓點動畫
    userFinalCoords.forEach((coord, i) => {
      const curX = lerp(center, coord.x, easeProgress);
      const curY = lerp(center, coord.y, easeProgress);
      currentUserPoints.push(`${curX.toFixed(1)},${curY.toFixed(1)}`);

      // 更新對應的小圓點位置
      if (dots[i]) {
        dots[i].setAttribute("cx", curX.toFixed(1));
        dots[i].setAttribute("cy", curY.toFixed(1));
      }
    });

    // 2. 同齡平均值多邊形動畫
    avgFinalCoords.forEach((coord) => {
      const curX = lerp(center, coord.x, easeProgress);
      const curY = lerp(center, coord.y, easeProgress);
      currentAvgPoints.push(`${curX.toFixed(1)},${curY.toFixed(1)}`);
    });

    // 套用 points 屬性
    if (userPolygon) {
      userPolygon.setAttribute("points", currentUserPoints.join(" "));
    }
    if (avgPolygon) {
      avgPolygon.setAttribute("points", currentAvgPoints.join(" "));
    }

    if (progress < 1) {
      requestAnimationFrame(animateRadar);
    }
  }

  // 啟動動畫
  requestAnimationFrame(animateRadar);
});