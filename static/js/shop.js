// static/js/shop.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('憶智防線：點數商城精美自訂彈窗版載入成功！');

    const exchangeButtons = document.querySelectorAll('.exchange-btn');
    const pointsElement = document.getElementById('user-points');
    
    // 獲取自訂彈窗相關元件
    const dialogOverlay = document.getElementById('custom-dialog');
    const dialogIcon = document.getElementById('dialog-icon');
    const dialogMessage = document.getElementById('dialog-message');
    const dialogBtnCancel = document.getElementById('dialog-btn-cancel');
    const dialogBtnConfirm = document.getElementById('dialog-btn-confirm');

    // 封裝彈窗顯示控制的 Promise 機制，讓程式碼像 confirm 一樣好讀
    function showCustomDialog({ icon, message, showCancel = true }) {
        return new Promise((resolve) => {
            dialogIcon.textContent = icon;
            dialogMessage.textContent = message;
            
            if (showCancel) {
                dialogBtnCancel.style.display = 'block';
                dialogBtnConfirm.style.width = 'auto';
            } else {
                dialogBtnCancel.style.display = 'none';
                dialogBtnConfirm.style.width = '100%'; // 提示成功時按鈕撐滿
            }

            dialogOverlay.classList.add('active');

            // 處理點擊按鈕
            const handleConfirm = () => { cleanUp(); resolve(true); };
            const handleCancel = () => { cleanUp(); resolve(false); };
            
            function cleanUp() {
                dialogBtnConfirm.removeEventListener('click', handleConfirm);
                dialogBtnCancel.removeEventListener('click', handleCancel);
                dialogOverlay.classList.remove('active');
            }

            dialogBtnConfirm.addEventListener('click', handleConfirm);
            dialogBtnCancel.addEventListener('click', handleCancel);
        });
    }

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

    if (pointsElement) {
        let initialPoints = parseInt(pointsElement.innerText) || 0;
        refreshButtonStyles(initialPoints);
    }
    
    exchangeButtons.forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            
            const productCard = this.closest('.product-card');
            const productName = productCard.querySelector('.product-name').innerText.replace('\n', '');
            const cost = parseInt(productCard.getAttribute('data-cost')) || 0;
            const currentPoints = pointsElement ? (parseInt(pointsElement.innerText) || 0) : 0;

            // 情況 A：點數不足
            if (this.classList.contains('disabled')) {
                const shortOf = cost - currentPoints;
                showCustomDialog({
                    icon: '❌',
                    message: `點數不足唷！\n【${productName}】需要 ${cost} 點，您目前有 ${currentPoints} 點（還差 ${shortOf} 點）。\n\n快去玩遊戲賺點數吧！💪`,
                    showCancel: false
                });
                return;
            }
            
            // 情況 B：點數足夠，跳出確認彈窗
            const confirmExchange = await showCustomDialog({
                icon: '🛒',
                message: `確認要消耗 ${cost} 點兌換\n【${productName}】嗎？`,
                showCancel: true
            });
            
            if (confirmExchange) {
                const updatedPoints = currentPoints - cost;
                if (pointsElement) {
                    pointsElement.innerText = `${updatedPoints} 點`;
                    refreshButtonStyles(updatedPoints);
                }
                
                // 成功之後跳出成功提示
                await showCustomDialog({
                    icon: '🎉',
                    message: `兌換成功！已扣除 ${cost} 點。`,
                    showCancel: false
                });
            }
        });
    });
});