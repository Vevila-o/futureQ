// static/js/achievements.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('憶智防線：成就系統前端 JS 載入成功（無 nav 簡潔版）！');

    // 🏆 預留擴充功能：如果未來長輩點擊「已解鎖」卡片，可以彈出成就詳情
    const achieveCards = document.querySelectorAll('.achieve-card:not(.locked)');
    achieveCards.forEach(card => {
        card.addEventListener('click', function() {
            const name = this.querySelector('.achieve-name').innerText;
            console.log(`長輩點擊了已解鎖成就：${name}`);
            // 這裡未來可以加入彈窗特效
        });
    });

    // 🔒 預留擴充功能：點擊「未解鎖」卡片
    const lockedCards = document.querySelectorAll('.achieve-card.locked');
    lockedCards.forEach(card => {
        card.addEventListener('click', function() {
            const name = this.querySelector('.achieve-name').innerText;
            console.log(`長輩查看了未解鎖成就：${name}`);
            // 這裡未來可以加入提示長輩如何解鎖的說明
        });
    });
});