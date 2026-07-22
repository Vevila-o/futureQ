// home.js — 憶智防線首頁互動

document.addEventListener("DOMContentLoaded", () => {

  // 讓 nav.js 知道這頁對應的是「home」項目（若未來有加入首頁按鈕）
  // 目前 nav.js 已自動處理 active 狀態，此處保留空白供未來擴充

  // 愛心按讚切換
  const btnLike = document.getElementById("btn-like");
  if (btnLike) {
    let liked = false;
    const icon = btnLike.querySelector(".material-symbols-outlined");
    const count = btnLike.querySelector("span:last-child");
    btnLike.addEventListener("click", () => {
      liked = !liked;
      icon.style.fontVariationSettings = liked ? "'FILL' 1" : "'FILL' 0";
      icon.style.color = liked ? "#e53935" : "";
      count.textContent = liked ? "25" : "24";
    });
  }

});
