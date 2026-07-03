// static/js/shop.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('憶智防線：點數商城前端 JS 載入成功！');

    // 🪙 核心改動：選取所有按鈕，不阻擋灰色按鈕，這樣它才能接收點擊事件！
    const exchangeButtons = document.querySelectorAll('.exchange-btn');
    const pointsElement = document.getElementById('user-points');
    
    // 初始化按鈕顏色狀態的函數 (一進來或扣完點都會執行)
    function refreshButtonStyles(currentPoints) {
        document.querySelectorAll('.product-card').forEach(card => {
            const cardCost = parseInt(card.getAttribute('data-cost')) || 0;
            const cardBtn = card.querySelector('.exchange-btn');
            if (cardBtn) {
                if (currentPoints >= cardCost) {
                    cardBtn.classList.remove('disabled');
                } else {
                    cardBtn.classList.add('disabled');
                }
            }
        });
    }

    // 網頁載入時，先根據後端傳入的點數初始化一次按鈕外觀
    if (pointsElement) {
        let initialPoints = parseInt(pointsElement.innerText) || 0;
        refreshButtonStyles(initialPoints);
    }
    
    // 綁定各個按鈕的點擊監聽事件 (沿用你原本的迴圈綁定隊形)
    exchangeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const productCard = this.closest('.product-card');
            const productName = productCard.querySelector('.product-name').innerText.replace('\n', '');
            const cost = parseInt(productCard.getAttribute('data-cost')) || 0;
            
            // 抓取目前畫面上最新剩餘點數
            const currentPoints = pointsElement ? (parseInt(pointsElement.innerText) || 0) : 0;

            // 🔴 情況 A：如果使用者點到的是點數不足的「灰色按鈕」
            if (this.classList.contains('disabled')) {
                const shortOf = cost - currentPoints; // 計算相差點數
                alert(`❌ 點數不足唷！\n【${productName}】需要 ${cost} 點，您目前有 ${currentPoints} 點（還差 ${shortOf} 點）。\n\n快去玩遊戲或記錄聲影日記賺取點數吧！💪`);
                return; // 直接攔截阻擋，不往下走兌換流程
            }
            
            // 🟢 情況 B：點到正常亮綠色按鈕 (執行確認兌換與動態扣點)
            const confirmExchange = confirm(`確認要消耗 ${cost} 點兌換【${productName}】嗎？`);
            
            if (confirmExchange) {
                if (pointsElement) {
                    const newPoints = currentPoints - cost;
                    pointsElement.innerText = `${newPoints} 點`; // 更新總點數顯示
                    
                    // 核心：扣完點後，即時刷新所有商品按鈕外觀（讓不夠錢的自動變灰）
                    refreshButtonStyles(newPoints);
                }
                
                alert(`🎉 兌換成功！已扣除 ${cost} 點。`);
            }
        });
    });
});