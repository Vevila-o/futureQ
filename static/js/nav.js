document.addEventListener("DOMContentLoaded", () => {
  fetch("/nav/")
    .then(response => {
      if (!response.ok) throw new Error("無法載入導覽列");
      return response.text();
    })
    .then(data => {
      document.getElementById("nav-placeholder").innerHTML = data;
      
      const journalBtn = document.querySelector(".nav-item-home");
      if (journalBtn) {
        journalBtn.addEventListener("click", () => {
          window.location.href = "/index/";
        });
      }
    })
    .catch(error => {
      console.error("載入導覽列發生錯誤:", error);
    });
});