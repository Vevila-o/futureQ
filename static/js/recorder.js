let mediaRecorder = null;  // 錄音器實例
let audioChunks = [];      // 儲存錄音的音訊片段
let countDown = null; //倒數
let recordedBlob = null // 錄好的Blob

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
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });  // 組合成完整音訊檔
            resolve(audioBlob);
        };
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());  // 釋放麥克風
    });
}

// 上傳音訊到 Django 後端
async function uploadAudio(audioBlob) {
    const formData = new FormData();
    formData.append("audio_file", audioBlob, "recording.webm");  // 加入音訊檔案
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
    document.getElementById("timer").classList.remove("hidden");

    // 倒數計時
    let seconds = 60 //測試版為60秒
    countDown = setInterval(function(){
        seconds --;
        document.getElementById("timer-sec").textContent = seconds;
        if (seconds <= 0){
            clearInterval(countDown) //停止計時
            document.getElementById("btn-stop").click();
        }
    }, 1000) //每次倒數1秒

})

// 監聽停止錄音
document.getElementById("btn-stop").addEventListener("click", async function() {
     // 倒數計時尚未結束時停止錄音
    clearInterval(countDown);
    document.getElementById("timer").classList.add("hidden");
    document.getElementById("timer-sec").textContent = 60;
    
    recordedBlob = await stopRecording();
    document.getElementById("btn-stop").classList.add("hidden");
    document.getElementById("btn-submit").classList.remove("hidden");
    document.getElementById("btn-retry").classList.remove("hidden");
})

//完成錄音
document.getElementById("btn-submit").addEventListener("click", async function() {
    document.getElementById("phase-record").classList.add("hidden");
    document.getElementById("phase-processing").classList.remove("hidden");

    const data = await uploadAudio(recordedBlob);
    document.getElementById("processing-msg").textContent = "分析中...";

    const a = data.analyze;
    document.getElementById("result-summary-text").textContent  = a.summary;
    document.getElementById("result-vocabulary").textContent    = a.vocabulary_richness;
    document.getElementById("result-fluency").textContent       = a.sentence_fluency;
    document.getElementById("result-coherence").textContent     = a.topic_coherence;
    document.getElementById("result-wordcount").textContent     = a.word_count;
    document.getElementById("result-hesitation").textContent    = a.hesitation_count;
    document.getElementById("result-risk").textContent          = a.risk_level;

    document.getElementById("phase-processing").classList.add("hidden");
    document.getElementById("phase-result").classList.remove("hidden");
})


// 重置錄音
document.getElementById("btn-retry").addEventListener("click", function() {
    recordedBlob = null;
    document.getElementById("btn-submit").classList.add("hidden");
    document.getElementById("btn-retry").classList.add("hidden");
    document.getElementById("btn-record").classList.remove("hidden");
})

// 分享社群
document.getElementById("btn-share").addEventListener("click", async function() {
    // 1. 照片
    document.getElementById("share-photo").src = photoObjectURL;

    // 2. 摘要
    const summary = document.getElementById("result-summary-text").textContent;
    document.getElementById("share-post-text").textContent = summary;

    // 3. 跳轉分享頁面
    document.getElementById("phase-result").classList.add("hidden");
    document.getElementById("phase-share").classList.remove("hidden");
    
})

// 分享到 Line
document.getElementById("btn-share-line").addEventListener("click", function() {
    const text = document.getElementById("share-post-text").textContent;
    window.open(`https://social-plugins.line.me/lineit/share?text=${encodeURIComponent(text)}`);
})

// 分享到 Threads
document.getElementById("btn-share-threads").addEventListener("click", function() {
    const text = document.getElementById("share-post-text").textContent;
    window.open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`);
})

// 複製按鈕
document.getElementById("btn-copy").addEventListener("click", async function() {
    const text = document.getElementById("share-post-text").textContent;
    await navigator.clipboard.writeText(text);
    alert("已複製到剪貼簿");
})