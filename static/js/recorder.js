let mediaRecorder = null;  // 錄音器實例
let audioChunks = [];      // 儲存錄音的音訊片段

// 開始錄音
async function startRecording() {
    // 向使用者請求麥克風權限
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioChunks = [];  // 清空上次的錄音資料
    mediaRecorder = new MediaRecorder(stream);

    // 每次有音訊資料就存進 audioChunks
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };

    mediaRecorder.start();
}

// 停止錄音並回傳 Blob
function stopRecording() {
    return new Promise((resolve) => {
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/m4a" });  // 組合成完整音訊檔
            resolve(audioBlob);
        };
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());  // 釋放麥克風
    });
}

// 上傳音訊到 Django 後端
async function uploadAudio(audioBlob) {
    const formData = new FormData();
    formData.append("audio_file", audioBlob, "recording.m4a");  // 加入音訊檔案
    formData.append("entry_id", currentEntryId);

    //這邊暫時空api的位置，等功能寫出來再fetch
    const response = await fetch("/uploadAudio/", {
        method: "POST",
        headers: {
            "X-CSRFToken": getCookie("csrftoken"),  // Django CSRF 驗證
        },
        body: formData,
    });

    return response.json();
}

// 從 cookie 取得 CSRF token（Django 必要）
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}

// 監聽開始錄音
document.getElementById("btn-record").addEventListener("click", async function(){
    await startRecording();
    document.getElementById("btn-record").classList.add("hidden")
    document.getElementById("btn-stop").classList.remove("hidden");
})

// 監聽停止錄音
document.getElementById("btn-stop").addEventListener("click", async function() {
    const getRecordBlob = await stopRecording();
    document.getElementById("btn-record").classList.remove("hidden")
    document.getElementById("btn-stop").classList.add("hidden");
    await uploadAudio(getRecordBlob)
    
})