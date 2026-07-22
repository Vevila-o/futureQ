# 聲影日記 VoiceDiary

> 詳細環境建置教學請看 [tutor.md](tutor.md)
> 語言表達認知分析演算法細節請看 [語言認知分析.md](語言認知分析.md)
> 更詳細的系統技術文件（逐 view 拆解、資料流、已知技術債）請看 [system.md](system.md)

---

## 目錄

- [專案介紹](#專案介紹)
- [技術清單](#技術清單)
- [專案架構](#專案架構)
- [頁面路由](#頁面路由)
- [使用者流程](#使用者流程)
- [登入與後台](#登入與後台)
- [資料庫設計](#資料庫設計)
- [環境需求](#環境需求)
- [快速開始](#快速開始)
- [後台管理](#後台管理)
- [環境變數設定](#環境變數設定)

---

## 專案介紹

聲影日記是一個專為長者設計的語音日記系統。使用者登入帳號後上傳照片，系統用 OpenAI vision 辨識照片並生成第一個問題，帶使用者進入**聊天室**：透過 4 輪「AI 提問 → 語音回覆（本地 Whisper 轉文字）」完成一篇日記。4 輪結束後按下「生成日記」，才一次生成標題、AI 溫暖回應，並以本地認知分析演算法評估六個語言表達維度。首頁月曆只顯示自己的歷史日記，點擊可回放語音；動態回顧頁可瀏覽自己昨天與去年的日記。

完成日記後，AI 會把合併後的對話內容改寫成第一人稱短文並分類到「食衣住行育樂」六大生活類別，存成一則貼文，分享到社群動態頁讓朋友用語音留言加油打氣；分享出去的貼文也會附上 AI 生成的 3 句建議回覆句，方便朋友在不知道說什麼時照著唸。朋友留言加油後，日記主人會收到一筆站內通知。另外還有「大腦訓練遊戲」與對應的成就 / 點數商城頁面。

聊天室（`/voice/`）採用**點擊式錄音**：點擊麥克風按鈕開始錄音，按鈕圖示轉為「暫停」，旁邊浮現「完成」按鈕；再次點擊麥克風可暫停 / 繼續錄音，點擊「完成」即送出這一輪錄音，AI 氣泡回覆後自動進入下一輪。第 1 輪（描述照片）有 15 秒最短時長門檻，講太短會請使用者再多說一點（連續 3 次不足會自動放行）；第 3、4 輪可以按「這題跳過」略過不答。回覆滿 2 次後就會出現「生成日記」按鈕，可以提前結束或繼續錄到第 4 輪；錄滿 4 輪（或跳過湊滿）會自動結束對話。第 2～4 輪的錄音會暫存起來，讓使用者在對話氣泡旁可以回放自己剛剛說的話，按下「生成日記」後這些暫存檔會被清除。按下「生成日記」後在聊天室頁顯示 loading overlay（含「恭喜完成！」文案）再導向完成頁。完成頁（`/finish/`）舊版的 3 輪文字對話 UI 已移除，只保留分享卡片預覽與朗讀按鈕。

---

## 技術清單

| 類別 | 技術 |
|---|---|
| 後端框架 | Django 5.2 |
| 資料庫 | SQLite（本地開發）|
| 身份驗證 | Django Session-based Auth，自訂 `User` model（`AUTH_USER_MODEL = 'Voice.User'`）|
| 語音辨識 | OpenAI Whisper（本地執行，base model）|
| 認知分析 | 本地演算法（`Voice/utils.py`）|
| AI 生成 | OpenAI API（照片辨識首問 + 追問對話 + 標題 + 溫暖回應 + 分享貼文改寫 + 食衣住行育樂分類）|
| 前端 | HTML / CSS / JavaScript（無框架）|
| 音訊解碼 | FFmpeg |

---

## 專案架構

```
voiceDiary/
│
├── manage.py                      # Django 啟動入口
├── requirements.txt               # 套件清單
├── .env                           # 環境變數（不上傳 git）
├── .env.example                   # 環境變數範本
├── db.sqlite3                     # 本地資料庫（不上傳 git）
├── record.md                      # 開發筆記
├── 語言認知分析.md                 # Voice/utils.py 語言表達認知分析演算法詳細說明
│
├── voiceDiary/                    # Django 專案設定
│   ├── settings.py                # 全域設定（含 CSRF_TRUSTED_ORIGINS for ngrok）
│   ├── urls.py                    # 全域路由
│   ├── middleware.py              # DualSessionMiddleware：/admin/ 使用獨立 session cookie
│   ├── wsgi.py
│   └── asgi.py
│
├── Voice/                         # 主要 App
│   ├── models.py                  # 資料表定義（User、DiaryEntry、VoiceReply、Diarypost 等）
│   ├── views.py                   # 頁面與 API 邏輯
│   ├── utils.py                   # 本地認知分析演算法（六維度評分）
│   ├── admin.py                   # 後台管理設定
│   ├── apps.py
│   ├── migrations/                # 資料庫遷移紀錄
│   ├── service/
│   │   └── whisper.py             # Whisper 語音轉文字邏輯
│   └── management/
│       └── commands/
│           ├── seed_diary.py      # 假資料產生指令（10 筆日記）
│           └── cleanup_chat_audios.py  # 刪除超過 48 小時、對話一直沒 finalize 的孤兒暫存錄音（ChatReplyAudio）
│
├── static/                        # 靜態檔案
│   ├── css/
│   │   ├── index.css              # 首頁 / 共用樣式（CSS 變數、主題色）
│   │   ├── nav.css                # 底部導覽列
│   │   ├── header.css             # 頁首樣式
│   │   ├── login.css              # 登入頁
│   │   ├── photo.css              # 上傳照片頁（含保存按鈕上傳中旋轉動畫）
│   │   ├── voice.css              # 聊天室頁（對話氣泡 + 點擊式麥克風 / 完成按鈕 / 跳過鈕 / 氣泡內回放小按鈕）
│   │   ├── finish.css             # 完成頁（分享卡片預覽、朗讀按鈕；舊版 AI 對話氣泡／語音操作區樣式仍留在檔案裡，但對應 HTML 已移除、不會顯示）
│   │   ├── review.css             # 動態回顧頁
│   │   ├── dashboard.css          # 儀表板頁
│   │   ├── member.css             # 會員頁
│   │   ├── share.css              # 分享頁（含建議回覆句提詞卡樣式）
│   │   ├── community.css          # 社群動態頁（含每則日記的分享按鈕樣式）
│   │   ├── game.css               # 遊戲首頁（我的成績統計）
│   │   └── market.css             # 整理菜籃遊戲頁
│   ├── js/
│   │   ├── index.js               # 首頁月曆邏輯 + 日記 Modal 語音播放
│   │   ├── nav.js                 # 底部導覽列動態 + 路由
│   │   ├── header.js              # 共用頁首（每 0.1 秒巡邏並強制修正標題文字/圖示以避免重整或假換頁後跟網址對不起來；通知改抓 `/api/notifications/` 真實資料，不再是寫死的假資料）
│   │   ├── headerback.js          # 含返回鍵頁首
│   │   ├── photo.js               # 照片上傳邏輯（上傳時重命名為 voice_photo.jpg、防重複送出、保存按鈕 loading 動畫）
│   │   ├── voice.js               # 聊天室邏輯（照片首問 → 4 輪錄音+氣泡 → 生成日記；含第 1 輪 15 秒門檻、第 3/4 輪跳過、滿 2 輪提前生成日記、氣泡回放）
│   │   ├── finish.js              # 分享邏輯 + 貼文朗讀（Web Speech API）；仍會呼叫 `/api/ai-first-question/`，但對應的舊版聊天氣泡 DOM 已從頁面移除，此段為遺留無作用程式碼
│   │   ├── review.js              # 動態回顧邏輯 + 語音播放
│   │   ├── dashboard.js           # 儀表板圖表邏輯
│   │   ├── shareUtil.js           # 共用的 LINE 分享文案組裝（`shareToLine()`，share.html / community.js 都引用）
│   │   ├── share.js               # 分享頁邏輯（LINE 分享附文案/FB/儲存圖片/複製連結/建議回覆句提詞卡/語音加油錄製）
│   │   ├── community.js           # 社群動態頁邏輯（展開留言、語音加油播放、每則日記的 LINE 分享按鈕）
│   │   ├── recorder.js            # 備用錄音模組
│   │   ├── game.js                # 遊戲首頁互動（愛心按讚等）
│   │   ├── achievements.js        # 成就頁互動
│   │   ├── shop.js                # 點數商城互動
│   │   └── market.js              # 整理菜籃遊戲邏輯（計分、連續答對加乘、反應時間/猶豫紀錄）
│   └── img/                       # 靜態圖片資源
│
├── media/                         # 使用者上傳的檔案（不上傳 git）
│   ├── audio/                     # 語音檔（.webm / .mp3，僅第 1 輪永久保存）
│   ├── photo/                     # 照片（上傳時統一命名為 voice_photo.jpg）
│   ├── chat_replies/              # 聊天室第 2～4 輪的暫存錄音，finalize 成功後刪除；孤兒檔靠 cleanup_chat_audios 指令清
│   └── voice_replies/             # 社群語音加油回覆檔
│
├── templates/                     # HTML 頁面
│   ├── login.html                 # 登入頁
│   ├── index.html                 # 首頁（月曆 + 語音播放 Modal，僅顯示自己的日記）
│   ├── photo.html                 # 上傳照片
│   ├── voice.html                 # 聊天室（照片首問 + 對話氣泡區 + 點擊式麥克風 / 完成按鈕、loading overlay）
│   ├── finish.html                # 完成頁（分享卡片預覽 + 貼文朗讀按鈕；舊版 AI 對話氣泡區塊已移除）
│   ├── review.html                # 動態回顧（含語音播放 Modal，僅顯示自己的日記）
│   ├── dashboard.html             # 認知分析儀表板
│   ├── loading.html               # 計算等待畫面（logo + 旋轉齒輪）
│   ├── member.html                # 會員頁面（個人資料 + 連續天數）
│   ├── share.html                 # 分享頁（卡片 + OG tags + 操作按鈕 + 語音加油錄製）
│   ├── community.html             # 社群動態頁（僅顯示自己分享出去的日記與收到的語音加油）
│   ├── game.html                  # 遊戲首頁（問候語、每日建議、我的成績統計）
│   ├── achievements.html          # 成就頁
│   ├── shop.html                  # 點數商城頁
│   ├── market.html                # 整理菜籃遊戲（拖曳分類、四階段、結束時顯示點數回饋徽章）
│   ├── nav.html                   # 底部導覽列（共用元件）
│   ├── header.html                # 首頁頁首（共用元件）
│   └── headerback.html            # 含返回鍵頁首（共用元件）
│
└── tutor.md                       # 環境建置教學
```

---

## 頁面路由

| 路徑 | 說明 |
|---|---|
| `/`、`/login/` | 登入頁（已登入會自動導向 `next` 或 `/index/`）|
| `/logout/` | 登出，導回登入頁 |
| `/index/` | 首頁（月曆 + 日記入口，只顯示自己的日記）今天已完成時顯示完成狀態 |
| `/dashboard/` | 認知分析儀表板 |
| `/uploadPhoto/` | 上傳照片 |
| `/voice/` | 聊天室：照片辨識首問 + 最多 4 輪錄音對話，回覆滿 2 次即可提前「生成日記」（對話未完成離開會警告）|
| `/finish/` | 完成頁面（分享卡片預覽 + 貼文朗讀；讀取 `finalize_diary` 已生成好的內容，不重打 OpenAI）|
| `/review/` | 動態回顧（昨天 / 去年的今天，只顯示自己的日記）|
| `/member/` | 會員頁面（個人資料、日記數、連續天數）|
| `/loading/` | 計算等待畫面（Whisper 處理期間的安撫畫面）|
| `/share/` | 日記分享頁（第一人稱內文、hashtag、OG 預覽、儲存圖片、語音加油錄製）|
| `/share/?preview=1` | 同上，無 header / nav，供 LINE / Facebook 接收方瀏覽 |
| `/community/` | 社群動態頁（只顯示自己分享出去的日記，以及朋友回覆的語音加油）|
| `/game/` | 遊戲首頁（我的成績：最高分 / 累計次數 / 連續天數 / 最近紀錄，依 `GameSession` 動態計算）|
| `/achievements/` | 成就頁 |
| `/shop/` | 點數商城頁 |
| `/market/` | 整理菜籃遊戲（拖曳分類，四階段，答對計分 + 連續答對加乘；結束畫面依總分顯示點數回饋徽章，目前僅前端計算顯示，尚未寫入資料庫）|
| `/admin/` | Django 後台（獨立 session，見[登入與後台](#登入與後台)）|
| **API** | |
| `/saveDiary/` | 儲存照片、建立日記（POST）|
| `/api/vision-first-question/` | 聊天室進頁時呼叫：OpenAI vision 辨識照片 → 存 `photo_description` + 生成首問，建立 `AiConversation`（POST）|
| `/updateDiaryAudio/` | 聊天室第 1 輪：Whisper 轉文字，存進對話紀錄，生成下一句追問（POST，不再做標題/認知分析）；有 15 秒最短時長門檻（`ffprobe` 驗證，前端帶 `force=1` 可放行），太短回傳 `{"error": "too_short"}` |
| `/api/upload-chat-voice/` | 聊天室第 2～4 輪：Whisper 轉文字 + GPT 追問；錄音暫存進 `ChatReplyAudio` 供回放；第 4 輪不再生成追問，改回傳 `done: true`（POST）|
| `/api/skip-chat-round/` | 第 3、4 輪可以跳過不答（至少要先真實回覆 2 次才能跳過），佔位訊息不會進 `finalize_diary` 的合併語料（POST）|
| `/api/finalize-diary/` | 按下「生成日記」：合併回覆 → 認知分析 + 標題 + AI 回應 + 分享貼文（含建議回覆句）一次生成，並清除 `ChatReplyAudio` 暫存錄音（POST）|
| `/api/ai-first-question/` | 舊版首問 API，`finish.html` 載入時仍會呼叫並回傳完整對話歷史，但畫面上對應的聊天氣泡區塊已移除，目前呼叫結果不會顯示（POST）|
| `/api/ai-chat/` | AI 文字對話（POST，目前前端未使用）|
| `/api/save-game-result/` | 儲存一場遊戲的成績（總分、正確率、平均反應時間、猶豫次數，POST）|
| `/api/voice-reply/` | 朋友對某篇日記送出語音加油（POST），成功後會建立一筆站內通知給日記主人 |
| `/api/voice-reply/<reply_id>/transcribe/` | 將語音加油轉成文字（POST，Whisper）|
| `/api/notifications/` | 取得目前使用者的站內通知清單與未讀數（GET）|
| `/api/notifications/mark-read/` | 標記通知已讀，body 傳 `{"ids":[...]}` 或 `{"all":true}`（POST，通知仍留在清單裡）|
| `/api/notifications/clear/` | 清除通知（直接刪除，不只是標記已讀），body 格式同上（POST）|
| **共用元件** | |
| `/nav/` | 底部導覽列 HTML |
| `/header/` | 首頁頁首 HTML |
| `/headerback/` | 含返回鍵頁首 HTML |

---

## 使用者流程

```
登入 (/login/)
    ↓ 帳號密碼驗證 → 建立 session → 導向 /index/（或登入前想去的頁面）
首頁（月曆）
    ↓ 今天已完成 → 顯示「已完成今天的紀錄」，無法重複進入
    ↓ 點擊「今天」
上傳照片 (/uploadPhoto/)
    ↓ 選擇照片（自動重命名為 voice_photo.jpg）→ 點擊「保存照片」（按鈕顯示上傳中旋轉動畫，防止重複送出）→ 儲存 → 建立 DiaryEntry
聊天室 (/voice/?diary_id=...)
    ↓ 進頁自動呼叫 /api/vision-first-question/ → OpenAI vision 辨識照片 → 存 photo_description → AI 首問出現在氣泡（左側）
    ↓ 第 1 輪：點擊麥克風開始錄音（按鈕轉「暫停」，旁邊浮現「完成」）→ 點擊「完成」送出
    ↓     不足 15 秒 → 顯示鼓勵重錄氣泡（連續 3 次不足會自動放行，不卡住使用者）
    ↓     → Whisper 轉文字 → 使用者回覆出現在氣泡（右側，可回放）→ 後端 GPT 生成追問 → AI 追問氣泡（左側）
    ↓ 第 2 輪：重複「錄音 → 完成 → Whisper → GPT 追問」，錄音暫存進 ChatReplyAudio
    ↓     回覆滿 2 次後「生成日記」按鈕出現，可以直接生成，也可以繼續錄第 3、4 輪
    ↓ 第 3、4 輪：可以錄音回覆，也可以按「這題跳過」（打 /api/skip-chat-round/，不錄音直接進下一題）
    ↓ 錄滿 4 次回覆（含跳過）後自動結束對話，不再生成追問，改顯示「生成日記」按鈕（錄音區隱藏）
    ↓ 對話未完成就離開 → 警告「這段紀錄將會遺失」
    ↓ 點擊「生成日記」→ 聊天室頁顯示 loading overlay（恭喜完成！）→ 呼叫 /api/finalize-diary/
    ↓     合併真實回覆文字（跳過的佔位訊息不列入）→ 語言表達認知分析（六維度）
    ↓     → AI 生成標題（10 字內含 emoji）+ 溫暖回應 + 分享貼文/hashtag/分類/3 句建議回覆句
    ↓     → 清除第 2～4 輪的暫存錄音（ChatReplyAudio）
完成頁面 (/finish/?diary_id=...)
    ↓ 顯示分享卡片（AI 標題 + 第一人稱貼文 + hashtag + 照片）
    ↓ 「朗讀」按鈕：用瀏覽器 Web Speech API 唸出貼文內容（本地執行，不經任何伺服器）
    ↓ 點擊「分享社群」
分享頁 (/share/?diary_id=...)
    ↓ 顯示已生成好的第一人稱內文 + 3 個 hashtag（讀取 finalize_diary 存好的 Diarypost，不重打 OpenAI）
    ↓ 照片卡片 + LINE 分享（附暖心文案 + 貼文摘要）、儲存圖片、複製連結
    ↓ 朋友開啟分享連結（?preview=1）→ 若有建議回覆句會顯示提詞卡，點一句放大顯示在錄音鈕旁 → 可錄製「語音加油」回覆
    ↓     朋友送出語音加油後，日記主人會收到一筆站內通知（頁首鈴鐺圖示）
社群動態頁 (/community/)
    ↓ 只顯示自己分享出去的日記，展開可看到朋友的語音加油留言（可一鍵轉文字）
    ↓ 每則日記卡片右上角有「分享」鈕，可再次分享到 LINE
首頁（今天的日記標記在月曆上，顯示已完成狀態）
```

---

## 登入與後台

- 所有頁面（`/index/`、`/review/`、`/community/` 等）都會依照目前登入的使用者過濾資料，只顯示自己的日記；若未登入則退回 `demo_elder` 帳號（若存在）供展示用。
- `voiceDiary/middleware.py` 的 `DualSessionMiddleware` 讓 `/admin/` 使用獨立的 `admin_sessionid` cookie，跟前台的 `sessionid` 分開。這樣在瀏覽器同時開著前台跟後台時，登入其中一邊不會把另一邊的登入狀態蓋掉。
- 新使用者預設 `is_staff = False`，無法進入 `/admin/`；要讓帳號能登入後台，需要在 Django admin 的使用者權限裡手動勾選「工作人員狀態」。

---

## 資料庫設計

資料表之間有關聯（FK / OneToOne）。

### User（使用者）

繼承 Django 內建 `AbstractUser`，額外新增：

| 欄位 | 類型 | 說明 |
|---|---|---|
| gender | CharField | 性別（male / female / other）|
| userbirth | DateField | 生日 |

### DiaryEntry（聲影日記）

| 欄位 | 類型 | 說明 |
|---|---|---|
| user | ForeignKey → User | 日記所屬使用者 |
| title | CharField | AI 生成標題（10 字內含 emoji）|
| audio_file | FileField | 語音檔（上傳至 `media/audio/`）|
| photo | ImageField | 照片（上傳至 `media/photo/`，統一命名 voice_photo.jpg）|
| transcription | TextField | 聊天室 4 輪回覆合併後的文字（`finalize_diary` 寫入）|
| diary_text | TextField | 同 transcription |
| photo_description | TextField | 照片 AI 描述（`vision_firstQ` 進聊天室時用 OpenAI vision 生成）|
| ai_response | TextField | AI 溫暖回應（100 字內，`finalize_diary` 生成）|
| status | CharField | 分析狀態（pending / processing / done / failed）|
| created_at | DateTimeField | 建立時間 |
| updated_at | DateTimeField | 更新時間 |

### CognitiveAnalysis（認知分析）

與 `DiaryEntry` 為 OneToOne 關係。由 `finalize_diary` 對聊天室 4 輪合併後的文字分析一次（見 [語言認知分析.md](語言認知分析.md) 了解演算法細節）。

| 欄位 | 類型 | 說明 |
|---|---|---|
| diary | OneToOneField → DiaryEntry | 對應日記 |
| is_valid | BooleanField | 樣本是否有效；空錄音/雜音/Whisper 幻覺會是 `False` |
| invalid_reason | CharField | 無效原因（`too_short` / `suspect_hallucination` / `low_confidence`），`is_valid=True` 時為空字串 |
| fluency_score | IntegerField（可為 null）| 流暢度（0–4）|
| information_score | IntegerField（可為 null）| 資訊量（0–4）|
| sentence_score | IntegerField（可為 null）| 句子結構（0–4）|
| naming_score | IntegerField（可為 null）| 命名能力（0–4）|
| semantic_score | IntegerField（可為 null）| 語意完整性（0–4）|
| communication_score | IntegerField（可為 null）| 整體溝通能力（0–4，前五項加權平均，不重複計入總分）|
| total_score | IntegerField（可為 null）| 五項獨立維度加總，滿分 20 |
| average_score | DecimalField（可為 null）| `total_score / 5` |
| risk_level | CharField（可為 null）| 風險等級（low ≥16 / medium ≥11 / high 其餘）|
| suggestion | TextField | 給使用者的建議 |
| ai_feedback | TextField | AI 分析回饋 |
| analyzed_at | DateTimeField | 分析時間 |

`is_valid=False` 的樣本分數欄位一律留 `null`，`dashboard` 查詢都會加 `.filter(is_valid=True)`，不會混進平均分數與語言活力指數（LVI）估算。

### AiConversation（AI 追問對話）

與 `DiaryEntry` 為 OneToOne 關係，聊天室最多 4 輪（`MAX_ROUNDS = 4`），但回覆滿 2 次就可以提前生成日記，第 3、4 輪也可以用跳過代替真實回覆。

| 欄位 | 類型 | 說明 |
|---|---|---|
| diary | OneToOneField → DiaryEntry | 對應日記 |
| messages | JSONField | 對話訊息列表，`[{"role": "assistant"/"user", "content": "..."}, ...]`；跳過第 3、4 輪時 user 訊息內容會是固定佔位字串（見 `Voice/views.py` 的 `SKIP_PLACEHOLDER`），`finalize_diary` 合併語料時會濾掉 |
| round_count | IntegerField | 目前收到的使用者回覆數（最多 4，跳過也算一次）；語意是「user 訊息數」，不是「來回輪數」|
| is_finished | BooleanField | 是否已收滿 4 次回覆（含跳過）|
| created_at | DateTimeField | 建立時間 |
| updated_at | DateTimeField | 更新時間 |

### ChatReplyAudio（聊天室暫存錄音）

與 `AiConversation` 為 ForeignKey 關係（`related_name="reply_audios"`），存第 2～4 輪的錄音供使用者回放，`finalize_diary` 成功後會刪除該對話底下的所有列（實體檔 + 資料列）。若使用者錄到一半就離開、對話一直沒被 finalize，靠 `cleanup_chat_audios` 這個 management command 定期清除孤兒檔（預設超過 48 小時）。

| 欄位 | 類型 | 說明 |
|---|---|---|
| conversation | ForeignKey → AiConversation | 對應對話 |
| reply_index | IntegerField | 第幾次回覆（2 / 3 / 4）|
| audio_file | FileField | 暫存錄音（上傳至 `media/chat_replies/`）|
| created_at | DateTimeField | 建立時間 |

### GameSession（大腦訓練遊戲紀錄）

每場遊戲（目前為「整理菜籃」）結束後由前端呼叫 `/api/save-game-result/` 寫入一筆。

| 欄位 | 類型 | 說明 |
|---|---|---|
| user | ForeignKey → User | 遊玩的使用者 |
| game_name | CharField | 遊戲名稱（預設「菜市場」）|
| score | IntegerField | 總分（答對 +10，最後階段 +30，連續答對有加乘）|
| total_questions | IntegerField | 本場總題數 |
| accuracy | DecimalField | 正確率（%，以每題「第一次就答對」計算）|
| avg_reaction_time | DecimalField | 平均反應時間（秒）|
| hesitation_count | IntegerField | 猶豫次數（答錯重來 / 拖曳中猶豫切換籃子 / 反應過久）|
| played_at | DateTimeField | 遊玩時間 |

### VoiceReply（語音加油）

朋友在分享頁（`/share/?preview=1`）錄音回覆某篇日記時寫入一筆。

| 欄位 | 類型 | 說明 |
|---|---|---|
| diary | ForeignKey → DiaryEntry（`related_name="voice_replies"`）| 對應日記 |
| audio_file | FileField | 語音加油檔案（上傳至 `media/voice_replies/`）|
| sender_name | CharField | 送出者暱稱（預設「匿名朋友」）|
| transcribed_text | TextField | 語音轉文字結果（呼叫轉文字 API 後才有值）|
| created_at | DateTimeField | 送出時間 |

### Diarypost（AI 貼文）

由 `finalize_diary` 在生成日記當下建立一筆（`share_page` / `finish_page` 之後只讀取，讀不到才會退回即時生成一次，見 `_get_or_generate_share_content`）。

| 欄位 | 類型 | 說明 |
|---|---|---|
| user | ForeignKey → User | 貼文所屬使用者 |
| diary_title | ForeignKey → DiaryEntry（`related_name="diary_posts"`）| 對應日記 |
| post | TextField | AI 改寫後的第一人稱貼文內容 |
| category | CharField（choices）| 食 / 衣 / 住 / 行 / 育 / 樂，AI 依日記內容分類 |
| hashtags | JSONField | AI 生成的 3 個 hashtag |
| suggested_replies | JSONField | AI 生成的 3 句建議回覆句，給 `/share/?preview=1` 的朋友當提詞卡用，不是使用者可送出的文字留言 |
| card_image | ImageField | 分享卡片截圖（`save_share_card_image` 上傳） |
| created_at | DateTimeField | 建立時間 |

### Notification（站內通知）

目前只有「收到語音加油」一種類型（`kind="voice_reply"`），`api_voice_reply` 成功時寫入一筆。沒有 WebSocket 或背景任務，是「下次打開頁面才看到」的站內通知，不是即時推播。

| 欄位 | 類型 | 說明 |
|---|---|---|
| user | ForeignKey → User（`related_name="notifications"`）| 通知對象 |
| kind | CharField | 通知類型（預留其他類型擴充，目前只有 `voice_reply`）|
| diary | ForeignKey → DiaryEntry（可為 null）| 對應日記 |
| message | CharField | 通知內容 |
| is_read | BooleanField | 是否已讀 |
| created_at | DateTimeField | 建立時間 |

`/api/notifications/mark-read/` 只改 `is_read`，通知仍留在清單裡；`/api/notifications/clear/` 才是真的刪除，對應頁首鈴鐺面板的「清除全部」按鈕。

---

## 環境需求

開始之前請確認電腦已安裝：

- Python 3.12
- FFmpeg（加入系統 PATH）
- Git

詳細安裝步驟請看 [tutor.md](tutor.md)

---

## 快速開始

### 1. 複製專案

```bash
git clone 你的repo網址
cd voiceDiary
```

### 2. 建立並啟動虛擬環境

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

啟動成功後終端機前面會出現 `(venv)`。

### 3. 安裝套件

```bash
pip install -r requirements.txt
```

### 4. 設定環境變數

複製範本並填入你的 API 金鑰：

```bash
copy .env.example .env
```

用編輯器打開 `.env` 填入：

```
OPENAI_API_KEY=你的金鑰
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

### 5. 建立資料庫

```bash
python manage.py migrate
```

### 6. 建立後台管理員帳號

```bash
python manage.py createsuperuser
```

### 7. 產生假資料（可選）

```bash
python manage.py seed_diary
```

建立 10 筆假日記（含認知分析），用於測試月曆、儀表板與動態回顧。

需要確認 `media/audio/` 下存在以下音檔：

```
demo_short.mp3
demo_activity.mp3
demo_vegetable.mp3
demo_drawing.mp3
demo_hospital.mp3
demo_lunch.mp3
demo_tea.mp3
demo_market.mp3
demo_family.mp3
```

> 若有舊資料衝突，重新執行會略過已存在的日期，不會重複建立。

> **注意**：`media/` 目錄下的音檔與照片不會 push 至 git，需另外傳送取得（請向專案成員索取壓縮包）。

### 8. 啟動伺服器

```bash
python manage.py runserver
```

開啟瀏覽器進入 `http://127.0.0.1:8000/index/`

---

## 使用 ngrok 對外測試

Django 4.0+ 需要明確設定 `CSRF_TRUSTED_ORIGINS` 才能接受 HTTPS 請求。`settings.py` 已預設允許 ngrok 網域，直接啟動 ngrok 即可：

```bash
ngrok http 8000
```

若需自訂允許的 origin，可在 `.env` 加入：

```
CSRF_TRUSTED_ORIGINS=https://你的網域.ngrok-free.app
```

---

## 後台管理

進入 `http://127.0.0.1:8000/admin`，用 `createsuperuser` 建立的帳號登入。

後台可以管理：
- 使用者帳號
- 聲影日記紀錄
- 認知分析結果
- AI 對話紀錄
- 遊戲成績紀錄（GameSession）
- 語音加油紀錄（VoiceReply）
- AI 貼文（Diarypost，可依食衣住行育樂分類篩選）

---

## 環境變數設定

| 變數名稱 | 說明 | 預設值 |
|---|---|---|
| OPENAI_API_KEY | OpenAI API 金鑰 | （必填）|
| OPENAI_MODEL | 使用的 GPT 模型 | gpt-4.1-mini |
| OPENAI_BASE_URL | API 網址 | https://api.openai.com/v1 |
| CSRF_TRUSTED_ORIGINS | 允許的 HTTPS 來源（逗號分隔）| ngrok 萬用字元 |
