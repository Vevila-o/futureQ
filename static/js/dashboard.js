// ===== Nav interaction =====
document.querySelectorAll('button, nav div').forEach(el => {
    el.addEventListener('click', function() {
        const icon = this.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.style.fontVariationSettings = "'FILL' 1";
            setTimeout(() => {
                if (!this.classList.contains('nav-item-highlight') && !this.closest('.nav-item-highlight')) {
                    icon.style.fontVariationSettings = "'FILL' 0";
                }
            }, 500);
        }
    });
});

// ===== Modal Logic =====
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');
const infoTriggers = document.querySelectorAll('.info-trigger');

const openModal = (title, content) => {
    modalTitle.innerText = title + '說明';
    modalContent.innerText = content;
    modalOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

const closeModal = () => {
    modalOverlay.style.display = 'none';
    document.body.style.overflow = 'auto';
};

infoTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const title = trigger.getAttribute('data-title');
        const description = trigger.getAttribute('data-desc');
        openModal(title, description);
    });
});

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
    const avgFinalPoints  = "50,25 71.6,37.5 71.6,62.5 50,75 28.4,62.5 28.4,37.5";

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
    const avgFinal  = parsePoints(avgFinalPoints);
    const centerPoints = userFinal.map(() => [cx, cy]);

    userPolygon.setAttribute('points', pointsToStr(centerPoints));
    avgPolygon.setAttribute('points', pointsToStr(centerPoints));

    let start = null;
    const duration = 900;

    function animate(ts) {
        if (!start) start = ts;
        const t = easeOutCubic(Math.min((ts - start) / duration, 1));

        userPolygon.setAttribute('points', pointsToStr(interpolatePoints(centerPoints, userFinal, t)));
        avgPolygon.setAttribute('points',  pointsToStr(interpolatePoints(centerPoints, avgFinal, t)));

        if (t < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
})();
