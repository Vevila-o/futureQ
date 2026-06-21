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

// ── 渲染長者數值雷達圖 ──
const userData = window.RADAR_USER_DATA;
if (userData && Array.isArray(userData)) {
  const center = 50;
  const maxRadius = 45;
  const maxScore = 4; // 評分滿分為 4 分

  const points = [];
  const dots = document.querySelectorAll(".radar-dot");

  userData.forEach((score, i) => {
    // 確保分數在 0 到 maxScore 之間
    const value = Math.max(0, Math.min(maxScore, score));
    // 計算相對於中心的半徑距離 (最高為 45px)
    const radius = (value / maxScore) * maxRadius;

    // 6 個頂點的角度分配，起始為 -90 度 (上方)，每步順時鐘旋轉 60 度 (PI / 3)
    const angle = -Math.PI / 2 + (i * Math.PI) / 3;

    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);

    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);

    // 同步更新雷達圖上的小圓圈座標
    if (dots[i]) {
      dots[i].setAttribute("cx", x.toFixed(1));
      dots[i].setAttribute("cy", y.toFixed(1));
    }
  });

  // 更新雷達圖多邊形的 points 屬性
  const polygon = document.getElementById("radar-user");
  if (polygon) {
    polygon.setAttribute("points", points.join(" "));
  }
}



modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ===== 雷達圖動畫 =====
(function () {
  const userPolygon = document.getElementById('radar-user');
  const avgPolygon = document.getElementById('radar-avg');

  if (!userPolygon || !avgPolygon) return;

  const userFinalPoints = "50,20 68,40 72,68 50,78 28,65 32,38";
  const avgFinalPoints = "50,25 71.6,37.5 71.6,62.5 50,75 28.4,62.5 28.4,37.5";

  function parsePoints(str) {
    return str.trim().split(/\s+/).map(p => p.split(',').map(Number));
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function interpolatePoints(from, to, t) {
    return from.map((p, i) => [lerp(p[0], to[i][0], t), lerp(p[1], to[i][1], t)]);
  }

  function pointsToStr(pts) {
    return pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
  }

  const cx = 50, cy = 50;
  const userFinal = parsePoints(userFinalPoints);
  const avgFinal = parsePoints(avgFinalPoints);
  const centerPoints = userFinal.map(() => [cx, cy]);

  userPolygon.setAttribute('points', pointsToStr(centerPoints));
  avgPolygon.setAttribute('points', pointsToStr(centerPoints));

  let start = null;
  const duration = 900;

  function animate(ts) {
    if (!start) start = ts;
    const t = easeOutCubic(Math.min((ts - start) / duration, 1));

    userPolygon.setAttribute('points', pointsToStr(interpolatePoints(centerPoints, userFinal, t)));
    avgPolygon.setAttribute('points', pointsToStr(interpolatePoints(centerPoints, avgFinal, t)));

    if (t < 1) requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
