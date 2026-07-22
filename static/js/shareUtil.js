// 共用的 LINE 分享文案組裝（share.html / community.html 都引用，格式維持一致）
function shareToLine(userName, postSummary, shareUrl) {
  var text = (userName || "朋友") + "今天的聲影日記發布囉～\n「" + postSummary + "」\n快來聽聽並留一句加油吧 🎈\n" + shareUrl;
  // LINE 官方分享文字的端點是 R/msg/text（不是 R/share），
  // 用錯端點 LINE 會認不出網址、直接把使用者導去 line.me 首頁而不是分享畫面。
  var lineUrl = "https://line.me/R/msg/text/?" + encodeURIComponent(text);
  window.open(lineUrl, "_blank");
}
