# 系統技術文件 System.md

> 這份文件比 [README.md](README.md) 更細，目標是給要直接改程式的人看：每個 view 收什麼、回什麼、副作用是什麼；資料表之間怎麼串；前端狀態機怎麼跑；還有目前已知但還沒處理的技術債。
> 語言表達認知分析演算法的計分細節請看 [語言認知分析.md](語言認知分析.md)，這份不重複講。
> 環境安裝步驟請看 [tutor.md](tutor.md)，這份不重複講。

---

## 目錄

- [1. 執行環境與設定](#1-執行環境與設定)
- [2. 認證與 Session](#2-認證與-session)
- [3. 資料模型](#3-資料模型)
- [4. 核心流程：日記產生 Pipeline](#4-核心流程日記產生-pipeline)
- [5. 前端狀態機：voice.js](#5-前端狀態機voicejs)
- [6. 其他頁面 View 摘要](#6-其他頁面-view-摘要)
- [7. 音訊處理與檔案儲存](#7-音訊處理與檔案儲存)
- [8. 共用元件](#8-共用元件)
- [9. 測試涵蓋](#9-測試涵蓋)
- [10. 已知技術債與風險](#10-已知技術債與風險)

---

## 1. 執行環境與設定

`voiceDiary/settings.py` 裡幾個非預設值得注意：

| 設定 | 值 | 說明 |
|---|---|---|
| `SECRET_KEY` | 寫死在檔案裡 | 目前是 Django 專案初始化時自動產生的值，**沒有**改用環境變數。上正式環境前要換掉並改讀 `.env`。|
| `DEBUG` | `True`（寫死）| 目前沒有依環境切換，正式部署前要改成讀環境變數並預設 `False`。|
| `ALLOWED_HOSTS` | `['*']` | 開發用，正式環境要限制實際網域。|
| `SILENCED_SYSTEM_CHECKS` | `['admin.E410']` | 因為用了 `DualSessionMiddleware` 取代原生 `SessionMiddleware`，Django 系統檢查會誤判成「沒裝 SessionMiddleware」，所以關掉這條檢查。|
| `MIDDLEWARE` 順序 | `SecurityMiddleware → DualSessionMiddleware → CommonMiddleware → CsrfViewMiddleware → AuthenticationMiddleware → MessageMiddleware → XFrameOptionsMiddleware` | `DualSessionMiddleware` 必須在 `AuthenticationMiddleware` 之前（要先把 `request.session` 準備好，`AuthenticationMiddleware` 才能用它查登入使用者）。|
| `AUTH_USER_MODEL` | `Voice.User` | 自訂使用者表，見 [3. 資料模型](#3-資料模型)。|
| `TIME_ZONE` | `Asia/Taipei`，`USE_TZ = True` | 資料庫存 UTC，畫面顯示前都要 `timezone.localtime()` / `timezone.localdate()` 轉換（views.py 裡到處看得到）。|
| `LOGIN_URL` | `/login/` | 只有 Django admin 或用到 `@login_required` 的地方才會用到這個，**目前 `Voice/views.py` 沒有任何一個前台 view 加 `@login_required`**（見 [10. 已知技術債](#10-已知技術債與風險)）。|
| `MEDIA_ROOT` / `MEDIA_URL` | `BASE_DIR/media` / `/media/` | 使用者上傳內容，`.gitignore` 排除，不進版控。|
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | 讀 `.env`，預設 model 是 `gpt-4.1-mini` | 所有 AI 生成（照片辨識、追問、標題、溫暖回應、分享貼文、分類）共用同一組設定，沒有針對不同任務切換模型。|
| `CSRF_TRUSTED_ORIGINS` | 預設含 `*.ngrok-free.app` / `*.ngrok.io` | 方便直接用 ngrok 對外展示，見 README「使用 ngrok 對外測試」。|
| Windows 主控台 UTF-8 patch | `sys.platform == "win32"` 時重設 `stdout`/`stderr` 編碼 | 修正 Windows 預設 `cp950` 主控台無法印 emoji 的 bug，細節見 [10. 已知技術債與風險](#10-已知技術債與風險)的歷史說明。|

---

## 2. 認證與 Session

### DualSessionMiddleware（`voiceDiary/middleware.py`）

Django 原生 `SessionMiddleware` 全站只有一個 session cookie（`sessionid`）。這個專案的後台（`/admin/`）跟前台共用同一個瀏覽器時，若原生機制在後台登入會覆蓋前台的登入狀態（反之亦然）。

`DualSessionMiddleware` 的作法：
- 依 `request.path` 是否以 `/admin/` 開頭，決定要讀寫哪一個 cookie：`/admin/` 用 `admin_sessionid`，其他路徑用預設的 `sessionid`（`settings.SESSION_COOKIE_NAME`）。
- 手動建立對應的 `SessionStore`，整段邏輯是原生 `SessionMiddleware.process_request` + `process_response` 的重寫版（存檔、設 cookie、過期時間、空 session 時刪 cookie 的邏輯都手動複製了一份）。
- 這個 middleware 完全取代原生 `SessionMiddleware`，`MIDDLEWARE` 清單裡**沒有**同時掛兩個。

### 「未登入」的實際行為

前台幾乎每個 view 都有這個 pattern：

```python
target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
if not target_user:
    target_user = User.objects.first()
```

也就是說：**沒有登入也能瀏覽所有頁面**，只是資料來源會退回 `demo_elder` 帳號（示範用假帳號），若連 `demo_elder` 都不存在，退回資料庫第一個使用者。這不是「未登入就擋下」的權限控制，純粹是「找不到明確使用者時要顯示誰的資料」的 fallback。目前沒有任何一個前台 view 用 `@login_required` 強制要求登入（見 [10](#10-已知技術債與風險)）。

`login_view` 本身邏輯：已登入直接依 `next` 參數導向；POST 帳密驗證成功才 `login()`。`is_staff=False` 的一般使用者無法進 `/admin/`，需要在 Django admin 手動勾選「工作人員狀態」。

---

## 3. 資料模型

以下是 `Voice/models.py` 完整欄位與關聯，比 README 的表格版本多列出方法、預設值來源、以及欄位語意變化的歷史脈絡。

### 關聯圖

```
User (AbstractUser + gender + userbirth)
 │
 ├─< DiaryEntry (FK user, nullable)
 │     ├─1:1─ CognitiveAnalysis (related_name=cognitive_analysis)
 │     ├─1:1─ AiConversation    (related_name=ai_conversation, nullable)
 │     │        └─< ChatReplyAudio (related_name=reply_audios)
 │     ├─<    VoiceReply        (related_name=voice_replies)
 │     └─<    Diarypost         (related_name=diary_posts, FK diary_title)
 │
 ├─< GameSession    (FK user, nullable)
 ├─< Diarypost      (FK user, nullable — 跟上面的 diary_posts 是同一張表，這裡只是另一個方向的 FK)
 └─< Notification   (FK user, related_name=notifications)
```

### User

繼承 `AbstractUser`，額外欄位：`gender`（CharField，male/female/other，非 choices 強制，純字串）、`userbirth`（DateField，可空）。

### DiaryEntry — 日記主表

| 欄位 | 型別 | 備註 |
|---|---|---|
| `user` | FK → User, nullable | 未登入建立的日記 `user` 會是 `None`（見 `save_diary`）|
| `title` | CharField(50) | 由 `finalize_diary` 生成，10 字內含 emoji |
| `audio_file` | FileField(`upload_to="audio"`) | 存的是第 1 輪（照片描述那段）錄音，轉成 mp3，永久保留。第 2～4 輪的錄音存在 `ChatReplyAudio`（暫存，`finalize_diary` 成功後刪除），不寫進這個欄位（見 [7](#7-音訊處理與檔案儲存)）|
| `photo` | ImageField(`upload_to="photo"`) | |
| `transcription` / `diary_text` | TextField | 兩者目前永遠同值，`finalize_diary` 同時寫入；歷史包袱（早期版本兩者語意不同），沒有合併成一個欄位 |
| `photo_description` | TextField | `vision_firstQ` 呼叫 OpenAI vision 產生 |
| `ai_response` | TextField | `finalize_diary` 生成，100 字內溫暖摘要 |
| `status` | CharField, choices | `pending → processing → done`，失敗是 `failed`。**注意**：`update_diary_audio`（第 1 輪）成功會把狀態設成 `processing`，但真正轉成 `done`只有 `finalize_diary` 會做；如果使用者錄完第 1～3 輪就離開不按「生成日記」，日記會卡在 `processing` 永遠不會變 `done`，月曆首頁的「今天已完成」判斷（`status="done"`）會顯示尚未完成，這是設計上刻意的行為（逼使用者按完成才算數），不是 bug。|

### CognitiveAnalysis — 認知分析結果（1:1 DiaryEntry）

`is_valid=False` 時六個分數欄位全部是 `null`（不是 0），配合 `invalid_reason` 記錄原因（`too_short` / `suspect_hallucination` / `low_confidence`，由 `Voice/utils.py` 的 `assess_sample_quality()` 判斷）。**所有讀取平均分數的查詢都要記得加 `.filter(is_valid=True)`**，目前 `dashboard()` view 已經這樣做，之後新增查詢要記得比照。

分數欄位語意（演算法細節見 [語言認知分析.md](語言認知分析.md)）：五個維度（`fluency_score`／`information_score`／`sentence_score`／`naming_score`／`semantic_score`）各 0–4 分，獨立加總成 `total_score`（滿分 20）；`communication_score`（也是 0–4）是前五項的加權平均，**不計入 total_score**，只是額外顯示用。`risk_level` 門檻：`total_score >= 16` low／`>= 11` medium／其餘 high。

### AiConversation — AI 追問對話（1:1 DiaryEntry，nullable）

`messages` 是 JSONField，存 `[{"role": "assistant"/"user", "content": "..."}]`，完整跑完是 1 則首問 + 最多 4 輪（各 1 則 user + 最多 1 則 assistant，第 4 輪 user 訊息後不再追加 assistant）。第 3、4 輪若使用者按「跳過」，該輪的 user 訊息內容會是固定字串 `SKIP_PLACEHOLDER = "[使用者選擇跳過此題]"`（定義在 `Voice/views.py`），`finalize_diary` 合併語料時會把這個字串濾掉，不會混進認知分析或分享貼文。

`round_count` 的語意在這次重構後改成「已收到的使用者回覆數」（0～4，跳過也算一次），**不是**「AI 來回輪數」。這是為了配合 `finish.html` 舊版對話 UI 遺留的 `remaining` 計算方式（`AiConversation.MAX_ROUNDS - conv.round_count`），現在只有 `ai_firstQ`（舊版首問 API）還在讀這個值。

**回覆滿 2 次即可 finalize**：`upload_chat_voice` / `skip_chat_round` 回傳的 `can_finalize` 欄位（`user_replies_so_far >= 2`）給前端判斷要不要顯示「生成日記」按鈕；後端的 `finalize_diary` 本身**沒有**強制檢查最少回覆數，只要 `combined` 合併後的文字非空就會執行（品質太差會被 `assess_sample_quality` 標記 `is_valid=False`，但不會擋下整個 finalize 請求）。

`can_continue()` / `add_message()` 這兩個 model 方法**目前完全沒有 view 在呼叫**——聊天室相關的 view（`update_diary_audio`、`upload_chat_voice`、`skip_chat_round`）都是直接操作 `conv.messages`（讀成 list、append、整包寫回、`conv.save()`），沒有透過 `add_message()`。这兩個方法是重構前寫的，重構後變成死程式碼，保留著沒刪（見 [10](#10-已知技術債與風險)）。

### ChatReplyAudio — 聊天室暫存錄音（FK AiConversation）

第 2～4 輪的錄音（`upload_chat_voice` 存進來的，`reply_index` 記第幾次回覆）給使用者在對話氣泡旁回放用。`finalize_diary` 成功時會把該對話底下所有列連同實體檔一起刪掉（`ra.audio_file.delete(save=False)` + `ra.delete()`）。若使用者錄到一半就離開、對話從沒被 finalize，這些列會一直留著，靠 `Voice/management/commands/cleanup_chat_audios.py` 這支 management command 手動或排程執行清除（預設清超過 48 小時的）。

### Notification — 站內通知（FK User）

`kind` 目前固定 `"voice_reply"`，`api_voice_reply` 成功時建立一筆。沒有 WebSocket／背景任務，是「下次打開頁面才看得到」的被動通知，不是即時推播。`is_read` 由 `/api/notifications/mark-read/` 更新（通知還留著），要整批消失要打 `/api/notifications/clear/`（直接 `.delete()`）。前端 `header.js` 進頁時打 `/api/notifications/` 拉清單，不再是早期寫死在 JS 裡的假資料。

### GameSession / VoiceReply / Diarypost

三張表跟聊天室流程無關，各自獨立：
- `GameSession`：`/api/save-game-result/` 寫入，`game_page` 讀出統計。
- `VoiceReply`：朋友在 `/share/?preview=1` 錄的語音加油，`transcribed_text` 要等使用者手動點「轉文字」（`api_voice_reply_transcribe`）才會填值，不是上傳時自動轉；送出成功會順便建立一筆 `Notification`。
- `Diarypost`：`finalize_diary` → `_generate_share_content()` 產生（改寫成第一人稱短文 + 3 個 hashtag + 食衣住行育樂分類 + 3 句建議回覆句 `suggested_replies`），`update_or_create(diary_title=diary)` 保證一篇日記只有一則貼文；`card_image` 是額外欄位，`save_share_card_image` view 事後才補上（前端用 `html2canvas` 把分享卡片截圖上傳）。`suggested_replies` 只在 `share_page` 的 `?preview=1` 模式渲染成提詞卡，不是使用者可送出的文字留言（`VoiceReply` 仍然只收語音）。

---

## 4. 核心流程：日記產生 Pipeline

這是整個系統最核心也最複雜的部分，改動前一定要看這節。

```
[uploadPhoto/] --POST--> save_diary()
    建立 DiaryEntry(status=PENDING, photo=上傳的照片)
    redirect → /voice/?diary_id=N

[voice/?diary_id=N] 頁面載入 → voice.js init()
    POST /api/vision-first-question/  → vision_firstQ()
        若 AiConversation 已存在且有 messages → 直接回傳（重整頁面時用，不重打 vision API）
        否則：_describe_photo(diary.photo.path)
            → PIL 縮圖到 1024px → base64 → OpenAI vision（JSON 格式：{"desc":..., "question":...}）
            → 存 diary.photo_description，建立 AiConversation(messages=[{"role":"assistant","content":question}])
        回傳 {status, question, user_replies:0}

── 第 1 輪（使用者描述照片，有 15 秒最短時長門檻）──
使用者錄音 → 點「完成」→ POST /updateDiaryAudio/ → update_diary_audio()
    存音檔（轉 mp3，見第 7 節）、status → PROCESSING
    _get_audio_duration_seconds(diary.audio_file.path)（ffprobe）：
        若 < MIN_FIRST_REPLY_SECONDS(13 秒) 且沒帶 force=1 → 刪掉剛存的音檔、status 退回 PENDING、
        回傳 {success:false, error:"too_short", duration}，不會往下轉文字或動到 AiConversation
        （前端在打這支 API 之前，已經先用自己算的錄音秒數擋過一次，見第 5 節；
        這裡是後端防呆，前端連續 3 次都不足會帶 force=1 放行）
    transcribe_audio() Whisper 轉文字 → 存 diary.transcription / diary_text
    AiConversation.messages 追加 user 訊息，round_count=1
    _generate_followup(messages) 生成追問 → 追加 assistant 訊息
    回傳 {success, transcription, question, user_replies:1, done:false, audio_url}
    （audio_url 是 diary.audio_file.url，給前端在氣泡旁顯示回放按鈕）

── 第 2～4 輪（追問回覆，第 3、4 輪可跳過）──
使用者錄音 → 點「完成」→ POST /api/upload-chat-voice/ → upload_chat_voice()
    存暫存檔 media/temp_chat_audio.wav（固定檔名，見第 7 節風險）→ transcribe_audio() 轉文字 → 立刻刪暫存檔
    以 conv.messages 裡 role=='user' 的訊息數量算「目前已回覆幾次」（不依賴 round_count 自動遞增）
    若已達 4 次 → 回錯誤 {status:error, done:true}（防呆，正常不會走到這支）
    未達 4 次時：
        append user 訊息
        _convert_audio_to_mp3(原始上傳檔) → 存進 ChatReplyAudio(conversation=conv, reply_index=目前回覆數)，
        回傳 audio_url 給前端做氣泡回放（這個暫存檔會留到 finalize 或 cleanup_chat_audios 才刪，
        跟上面 Whisper 用的固定檔名暫存檔是兩回事）
        若這次讓回覆數達到 4 → is_finished=True, round_count=4, done=True，不再生成追問
        否則 → _generate_followup() 生成下一句追問 → append assistant 訊息，回傳 remaining
    回傳 {status:success, user_text, reply, remaining, done, user_replies, audio_url, can_finalize}
    （can_finalize = user_replies_so_far >= 2，前端用來決定要不要顯示「生成日記」按鈕）

使用者點「這題跳過」（僅限第 3、4 輪，且必須已有 ≥2 次真實回覆）→ POST /api/skip-chat-round/ → skip_chat_round()
    user_replies_so_far < 2 → 回錯誤 {message:"min_replies_not_met"}（第 1、2 輪不可跳過）
    append user 訊息，內容固定是 SKIP_PLACEHOLDER（不錄音、不轉文字、不存 ChatReplyAudio）
    其餘邏輯（達 4 次結束 / 否則生成追問）跟 upload_chat_voice 一致，回傳格式也相同（多一個 can_finalize:true）

── 生成日記（回覆滿 2 次即可提前觸發，不必錄滿 4 輪）──
voice.js 依 can_finalize 顯示「生成日記」按鈕 → 使用者按下
    POST /api/finalize-diary/ → finalize_diary()
        取出 conv.messages 裡所有 role=='user' 且內容不是 SKIP_PLACEHOLDER 的內容，用「，」合併成 combined
        combined 寫回 diary.transcription / diary_text（取代單輪錄音內容）
        assess_sample_quality(combined) 判斷樣本品質：
            不合格 → CognitiveAnalysis(is_valid=False, invalid_reason=quality)，分數全空
            合格   → analyze_transcription(combined) → CognitiveAnalysis(is_valid=True, 六維度分數...)
        OpenAI 生成 diary.title（10 字內含 emoji）+ diary.ai_response（100 字內摘要）
        diary.status = DONE，diary.save()
        _generate_share_content(diary) → 生成第一人稱貼文 + 3 個 hashtag + 食衣住行育樂分類 + 3 句建議回覆句
            （suggested_replies，見 _generate_suggested_replies） → Diarypost.update_or_create()
        conv.reply_audios.all() 全部刪除（實體檔 + 資料列），清掉第 2～4 輪的暫存錄音
        回傳 {status:success, redirect_url: /finish/?diary_id=N}
    前端拿到 redirect_url → window.location.href 導過去

[finish/?diary_id=N] finish_page()
    _get_or_generate_share_content(diary)：優先讀 Diarypost（finalize_diary 已存好的），
    讀不到（例如舊資料、finalize 失敗但仍有 transcription）才退回即時呼叫 _generate_share_content() 補算一次
    render finish.html（純顯示，不再重打認知分析）
```

### 關鍵設計決策

- **認知分析只做一次，在 `finalize_diary`**，不是每輪錄音都分析。單輪錄音文字量太短，不足以做語言表達評分，所以改成合併 4 輪回覆後才分析一次，樣本量更接近建議值。
- **`vision_firstQ` 和 `update_diary_audio` / `upload_chat_voice` 是 idempotent-on-refresh 設計**：使用者中途重整頁面，`vision_firstQ` 會偵測 `AiConversation` 已存在就直接回傳現有訊息，不會重新辨識照片或重置對話。`voice.js` 的 `init()` 也會用回傳的 `messages` / `user_replies` / `done` 還原畫面到正確狀態（見第 5 節）。
- **`ai_firstQ`（舊版首問 API）完全沒有被新流程呼叫**，只保留給 `finish.html` 頁面載入時打（見第 6 節、第 10 節的死程式碼說明）。它自己也有「已有 messages 就直接回傳」的判斷，邏輯上不會跟 `vision_firstQ` 衝突，但兩支 API 意義重複，是重構過渡期的產物。

---

## 5. 前端狀態機：voice.js

`static/js/voice.js` 用兩個變數描述目前畫面狀態：

- **`phase`**（大狀態）：`loading → chat → uploading → chat（迴圈4次）→ done → finalizing`
- **`state`**（`phase === "chat"` 時的錄音子狀態）：`idle → recording ⇄ paused → （送出後回到 idle）`

```
phase=loading（頁面剛載入，等 vision_firstQ 回應）
  │
  ▼
phase=chat, state=idle（麥克風按鈕可點）
  │ 點麥克風 → startRecording()
  ▼
state=recording（計時中，波形跳動）── 點麥克風 → pauseRecording() ──▶ state=paused（可點「重新錄製」btn-restart）
  │                                                                        │ 點麥克風 → resumeRecording()
  │ 點「完成」btn-complete → completeRound()                                │
  │◀───────────────────────────────────────────────────────────────────────┘
  ▼
phase=uploading（送出中，錄音按鈕鎖住）
  │ submitFirstRound() 或 submitFollowupRound()（依 userReplies===0 判斷）
  │
  ├─ done=false → 顯示 AI 追問氣泡 → resetRoundUI() → 回到 phase=chat, state=idle（下一輪，
  │                此時若 userReplies >= MIN_REPLIES_TO_FINALIZE(2)，renderStatus() 會額外顯示
  │                一顆次要的「生成日記」按鈕，跟繼續錄音並存；userReplies 是 2 或 3 時同時顯示
  │                「這題跳過」鈕）
  └─ done=true  → finishConversation() → phase=done（顯示「生成日記」按鈕，錄音區隱藏）

phase=chat（userReplies>=2 時）
  │ 點次要的「生成日記」btn-finalize（跟 phase=done 時是同一顆按鈕、同一個 click handler）
  ▼
phase=done
  │ 點「生成日記」btn-finalize
  ▼
phase=finalizing（loading overlay 顯示，按鈕鎖住）→ 成功則整頁導到 /finish/
```

### 值得注意的實作細節

- **計時器倒數觸發自動送出**：`LIMIT = 180` 秒（3 分鐘），倒數到 0 會自動呼叫 `completeRound()`，不用使用者手動按完成。
- **`userReplies === 0` 決定要打哪支 API**：`completeRound()` 依這個值分派到 `submitFirstRound()`（打 `/updateDiaryAudio/`，欄位名是 `audio_file`）或 `submitFollowupRound()`（打 `/api/upload-chat-voice/`，欄位名是 `audio_data`）——兩支 API 的檔案欄位名不同，前端要對應正確，這是最容易改壞的地方。
- **第 1 輪 15 秒門檻**：`completeRound()` 用 `elapsedSec = LIMIT - remaining` 算這次錄了幾秒，`userReplies===0` 且 `elapsedSec < MIN_FIRST_REPLY_SEC(15)` 時，用 `firstRoundShortAttempts` 計數，前 2 次直接丟棄錄音、顯示鼓勵重錄的 assistant 氣泡、`resetRoundUI()`，不會打任何 API；第 3 次（`firstRoundShortAttempts >= MAX_SHORT_ATTEMPTS(3)`）改成帶 `force=1` 送出，讓後端不要再擋。後端回傳 `{error:"too_short"}` 時（例如前端計時被繞過的極端情況）`submitFirstRound()` 也會顯示同樣的重錄氣泡，不是丟原生 `alert()`。
- **第 3、4 輪跳過**：`renderStatus()` 在 `userReplies` 是 2 或 3 且 `state==="idle"` 時顯示 `#btn-skip-round`，點擊呼叫 `skipRound()` → POST `/api/skip-chat-round/`，回應格式跟 `submitFollowupRound()` 幾乎一樣（`reply`/`remaining`/`done`/`user_replies`），前端固定顯示「（已跳過本題）」當這輪的使用者氣泡文字（不是顯示後端存的 `SKIP_PLACEHOLDER` 原文）。
- **提前生成日記**：`renderStatus()` 只要 `userReplies >= MIN_REPLIES_TO_FINALIZE(2)` 且 `state==="idle"`（不管 `phase` 是 `"chat"` 還是 `"done"`）就會顯示並啟用 `#btn-finalize`，`chat` 階段的按鈕文字會帶目前已錄幾段（`"生成日記（已錄 N 段，可繼續或直接生成）"`），`done` 階段固定顯示「生成日記」。兩個階段共用同一個 click handler，行為完全一樣（POST `/api/finalize-diary/` → 導到 `/finish/`）。
- **氣泡回放**：`appendBubble(role, text, audioUrl)` 第三個參數是選填的錄音網址，只有 `role==="user"` 且有 `audioUrl` 時才會在氣泡裡插入一顆小播放鈕（原生 `Audio` 物件播放/暫停）。第 1 輪用 `update_diary_audio` 回傳的 `diary.audio_file.url`，第 2～4 輪用 `upload_chat_voice` 回傳的 `ChatReplyAudio.audio_file.url`；跳過的輪次沒有錄音，不會有播放鈕。**注意**：`init()` 重整頁面還原對話時呼叫的 `renderAllMessages()` 目前**沒有**把音檔網址帶進去，所以重整後舊的氣泡會暫時失去播放鈕（不是 bug，是還沒做的功能缺口）。
- **`init()` 的重整還原邏輯**：`vision_firstQ` 回傳 `messages`（非空）時，代表這不是全新對話，`renderAllMessages()` 把整個對話歷史重建成氣泡，再依 `done` 決定要進 `phase=done` 還是 `resetRoundUI()`（回到可錄音狀態，`userReplies` 設成後端回傳的實際數字，不是重新從 0 算）。
- **`beforeunload` 警告**：只要 `phase === "chat"` 且（正在錄音或已經回覆過至少 1 輪），離開分頁會跳原生確認視窗。點頁首返回鍵（`#btn-back`）另外攔截處理，用 `confirm()` 客製化文字提示「這段紀錄將會遺失」，確認後才真的 `history.back()`。`phase === "done"` 或 `"finalizing"` 之後兩種警告都不再出現（提前用次要按鈕 finalize 成功後會直接導頁，不會停留在會觸發警告的狀態）。
- **MIME type 協商**：`MediaRecorder.isTypeSupported()` 依序試 `audio/webm` → `audio/mp4` → `audio/ogg`，決定要送出的副檔名（iOS Safari 不支援 webm，會落到 mp4）。
- **等待 400ms 才讀 `recordedBlob`**：`mediaRecorder.stop()` 是非同步觸發 `onstop` 事件才會真正產生完整 Blob，`completeRound()` 用 `setTimeout(400ms)` 保守等待，不是精確的事件監聽（理論上有極小機率 blob 還沒準備好就繼續執行，但實務上 400ms 對短音檔綽綽有餘）。

---

## 6. 其他頁面 View 摘要

| View | 路由 | 摘要 |
|---|---|---|
| `voiceIndex` | `/index/` | 查當月 `target_user` 的所有 `DiaryEntry`，組成月曆用 JSON；`has_today_diary` 用 `status="done"` 判斷（跟第 4 節提到的「未按生成日記就離開會卡在 processing」互相呼應）。有除錯用 `print()`（目前還留著）。|
| `member_page` | `/member/` | 呼叫 `_compute_streak_days()`（跟 `dashboard`/`game_page` 各自重複實作一份幾乎一樣的連續天數演算法，見第 10 節）。|
| `dashboard` | `/dashboard/` | 抓近 7 天 `CognitiveAnalysis`（`is_valid=True`）算六維度平均，畫雷達圖；若近 7 天沒資料退回抓全部歷史；若完全沒資料，雷達圖用寫死的假分數（`3.0/2.5/3.2/2.8/3.0/2.9`）避免圖表空白，但 LVI（語言活力指數，見 `Voice/utils.py` 的 `calc_lvi`）獨立判斷，完全沒資料時老實顯示空狀態，不套用假分數——這兩套 fallback 邏輯是分開設計、不共用同一個「有沒有資料」的旗標，是刻意的（雷達圖跟 LVI 對「沒資料要怎麼顯示」的產品需求不同）。|
| `review_page` | `/review/` | 查「昨天」與「去年的今天」（`date.replace(year=-1)`，遇到 2/29 special-case 退回 2/28）的日記。|
| `share_page` | `/share/` | `?preview=1` 時代表朋友從分享連結打開（`share.html` 內會依這個旗標關掉 header/nav，切換成給外部朋友看的精簡版）。額外傳 `user_display_name`（給 LINE 分享文案用）跟 `suggested_replies`（給 preview 模式的提詞卡用，讀 `Diarypost.suggested_replies`）。|
| `save_share_card_image` | `/api/save-share-card-image/` POST | 前端 `html2canvas` 把 `#share-card` 截圖成 PNG 上傳，`get_or_create(diary_title=diary)` 避免與 `finalize_diary` 產生的 `Diarypost` 重複建立。|
| `community_page` | `/community/` | 只顯示 `status="done"` 且屬於 `target_user` 的日記（最新 20 筆），`prefetch_related("voice_replies", "diary_posts")` 避免 N+1。每筆日記額外算 `post_summary`（`Diarypost.post` 前 20 字＋刪節號）跟 `share_url`，給 `community.js` 組每張卡片的分享鈕；沒有 `Diarypost` 的日記 `post_summary` 是空字串，前端會不顯示分享鈕。|
| `api_voice_reply` | `/api/voice-reply/` POST | 朋友錄的語音加油，走跟聊天室錄音一樣的 `_convert_audio_to_mp3()` 轉檔；成功後若 `diary.user` 存在，順便建立一筆 `Notification`。|
| `api_voice_reply_transcribe` | `/api/voice-reply/<id>/transcribe/` POST | **注意**：這支自己 `whisper.load_model("base")`，沒有用 `Voice/utils.py` 的單例 `get_whisper_model()`，每次呼叫都重新載入模型（見第 10 節）。|
| `api_notifications` | `/api/notifications/` GET | 回傳 `target_user` 最新 20 筆通知（不分已讀/未讀）跟 `unread_count`；不會主動把回傳的通知標記已讀，讀取跟標記已讀是兩個分開的動作。|
| `api_notifications_mark_read` | `/api/notifications/mark-read/` POST | body `{"ids":[...]}` 標記指定幾筆，`{"all":true}` 標記全部；只改 `is_read`，通知還在清單裡。|
| `api_notifications_clear` | `/api/notifications/clear/` POST | body 格式同上，但是 `.delete()` 真的刪除，不是標記已讀；頁首鈴鐺面板的「清除全部」按鈕打這支。|
| `skip_chat_round` | `/api/skip-chat-round/` POST | 見第 4 節聊天室流程；`user_replies_so_far < 2` 會擋下（第 1、2 輪不可跳過）。|
| `game_page` / `save_game_result` | `/game/`、`/api/save-game-result/` | 遊戲成績統計 + 連續天數（又是一份獨立實作的連續天數演算法）。|
| `achievements_page` / `shop_page` | `/achievements/`、`/shop/` | 目前都是寫死的假資料（`unlocked_achievements_count=3`、`user_points=120`），還沒接資料庫。|
| `market_page` | `/market/` | 純渲染模板，遊戲邏輯全部在 `static/js/market.js` 前端算完，分數目前**不會**寫回 `GameSession`（跟 `game_page`/`save_game_result` 沒有串起來，是兩套獨立的東西）。|

---

## 7. 音訊處理與檔案儲存

### 兩種轉檔/轉文字路徑

1. **要存檔的音檔**（聊天室第 1 輪、語音加油）：`_convert_audio_to_mp3()` 把上傳檔案寫到系統暫存檔（`tempfile.NamedTemporaryFile`），呼叫外部 `ffmpeg` 轉成 mp3（`44100Hz / 立體聲 / 192kbps`），讀出 bytes 包成 `ContentFile` 存回 model 的 `FileField`；來源暫存檔與轉檔後暫存檔用完都手動 `os.remove()`。ffmpeg 失敗（例如沒裝、格式不支援）會回傳 `None`，呼叫端退回直接存原始上傳檔（`diary.audio_file = audio_file`），不會整支請求失敗。

2. **轉文字用的暫存檔**（聊天室第 2～4 輪）：`upload_chat_voice()` 先把原始上傳內容寫到**固定檔名** `media/temp_chat_audio.wav`，給 Whisper 轉完文字後立刻 `os.remove()`。**這個固定檔名不是唯一的**，若兩個使用者同時各錄一輪，後寫入的請求會覆蓋前一個還沒讀完的檔案內容，導致轉錄結果錯亂或讀到不完整的檔案。目前規模小、單機開發環境下機率低，正式上線前應該改成 `tempfile.NamedTemporaryFile` 或帶 `diary_id`/`uuid` 的檔名（已知風險，見第 10 節，故意先不修）。這個暫存檔跟下面第 3 點的 `ChatReplyAudio` 是兩回事：前者只活幾百毫秒、純粹餵給 Whisper；後者是同一段錄音另外轉成 mp3、真的存進資料庫給使用者回放用。

3. **回放用的暫存錄音**（聊天室第 2～4 輪）：跟上面第 2 點用的是同一次上傳、但獨立走一次 `_convert_audio_to_mp3()`，存進 `ChatReplyAudio.audio_file`（`media/chat_replies/`）。`finalize_diary` 成功時會把該對話底下的 `ChatReplyAudio` 全部刪除（實體檔 + 資料列）；如果使用者中途離開、對話從未 finalize，這些檔案會一直留著，要靠 `cleanup_chat_audios` 這個 management command 手動或排程清除（見第 10 節，目前沒有自動排程）。

### Whisper 模型載入

`Voice/utils.py` 有一個延遲初始化的單例：

```python
_whisper_model = None
def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = whisper.load_model("base")
    return _whisper_model
```

聊天室流程（`update_diary_audio`、`upload_chat_voice`）都透過 `transcribe_audio()` 走這個單例，一個 process 生命週期只載入一次模型。但 `api_voice_reply_transcribe`（語音加油轉文字）**沒有用這個單例**，自己重新 `whisper.load_model("base")`，等於每次朋友按「轉文字」都要重新載入一次模型（見第 10 節）。

### 檔案命名與儲存位置

| 用途 | 路徑 | 命名方式 |
|---|---|---|
| 日記照片 | `media/photo/` | Django `ImageField` 預設命名（前端 `photo.js` 上傳前會重命名成 `voice_photo.jpg`，但後端沒有強制檔名，重複上傳會被 Django `get_available_name()` 加隨機 7 碼尾綴）|
| 第 1 輪日記錄音 | `media/audio/` | 固定存成 `diary_audio.mp3`（同樣受 `get_available_name()` 影響，同一篇日記若重錄會產生新檔名，不會覆蓋舊檔）|
| 第 2～4 輪暫存錄音 | `media/chat_replies/` | 存成 `chat_reply_{回覆序號}.mp3`（`ChatReplyAudio`，finalize 或 `cleanup_chat_audios` 才會刪）|
| 語音加油 | `media/voice_replies/` | 固定存成 `voice_reply.mp3` |
| 分享卡片截圖 | `media/share_cards/` | 前端 `html2canvas` 產生後以 `share_card.png` 上傳 |

`media/` 整個目錄不進版控（見 `.gitignore`），示範假資料需要的音檔要另外向專案成員索取。

---

## 8. 共用元件

`header_partial` / `headerback_partial` / `nav_partial` 三支 view 各自只 `render()` 一個沒有 extra context 的小模板片段，給前端用 `fetch()` 動態插入頁面（`nav.js` / `headerback.js`）。這樣每個頁面的 `<template>` 不用重複貼一份 header/nav HTML，但也代表每個頁面初次載入時會多打 2～3 支額外的 HTML 請求（沒有做成 Django template `{% include %}` 純後端渲染，是前端 SPA-like 拼接的做法）。

---

## 9. 測試涵蓋

`Voice/tests.py` 共 33 個測試，分幾類：

- `AssessSampleQualityTest` / `TagAllCategoriesTest` / `CollapseRepetitionsTest` / `AnalyzeTranscriptionTest` / `GetRiskResultTest` / `LVITest`：純函式測試，對應 `Voice/utils.py` 各個演算法函式，不碰資料庫。
- `DashboardLVIViewTest`：測 `dashboard` view 在有資料/無資料時 LVI 顯示邏輯。
- `ChatFlowTest`：端對端測試聊天室流程，用 `unittest.mock.patch` 掉 Whisper 轉錄與 OpenAI 呼叫，避免測試真的打外部 API。這個測試類別的 `setUpClass`/`tearDownClass` 會把 `MEDIA_ROOT` 覆寫到系統暫存目錄，測試結束整個刪除，避免測試上傳的假檔案污染真正的 `media/` 目錄。除了原本的完整 4 輪流程與 finalize 測試，還包含：
  - `test_first_reply_under_15s_rejected` / `test_force_flag_bypasses_15s_threshold`：mock `_get_audio_duration_seconds` 測 15 秒門檻的擋下與 `force=1` 放行。
  - `test_skip_requires_two_replies`：只回覆 1 次就打 `/api/skip-chat-round/` 應該被拒絕。
  - `test_finalize_after_two_replies_with_skips`：2 次真實回覆 + 2 次跳過 → finalize 成功、跳過佔位不進合併語料、`ChatReplyAudio` 在過程中有存、finalize 後清空、`suggested_replies` 有生成（一次測完第 5 項的大部分行為）。
  - `test_notification_created_on_voice_reply` / `test_notifications_clear_deletes_all`：語音加油會建通知；`clear` 是真的刪除、`mark-read` 只是改 `is_read`。

執行方式：`python manage.py test Voice`。

---

## 10. 已知技術債與風險

依影響程度排序，這些都是**已知但刻意先不修**的項目：

1. **`upload_chat_voice` 的暫存檔案名稱固定**（`media/temp_chat_audio.wav`），同時多個使用者錄音有極小機率互相覆蓋、讀到錯誤內容。單機/小規模示範環境風險低，正式多人同時使用前要修。
2. **`SECRET_KEY` 寫死在 `settings.py`、`DEBUG=True` 也寫死**，沒有依環境變數切換。上正式環境（尤其是要對外開放註冊或處理真實個資）前必須改掉。
3. **前台沒有任何一個 view 用 `@login_required` 強制登入**，未登入使用者一律看到 `demo_elder` 的資料（不是被擋下，是看到別人的假帳號資料）。如果之後要求「必須登入才能用」，要幫多數 view 補上登入檢查，目前的 `request.user.is_authenticated else demo_elder` pattern 分散在近十個 view 裡，沒有集中成一個 decorator 或 mixin。
4. **`api_voice_reply_transcribe` 沒有用 `Voice/utils.py` 的 Whisper 單例**，每次朋友按「轉文字」都重新 `whisper.load_model("base")`，比聊天室流程慢很多、也重複佔用記憶體。應該改成呼叫 `Voice/utils.py` 的 `get_whisper_model()` / `transcribe_audio()`。
5. **`static/js/finish.js` 第 3、4 節（真實麥克風錄音、`#chat-box`/`#btn-voice`/`#ai-zone` 相關程式碼）已經是死程式碼**：對應的 HTML（`#ai-zone` 整塊）已經從 `finish.html` 移除，但 JS 還是會在頁面載入時打 `/api/ai-first-question/`，且 `chatBox`/`btnVoice` 等變數會是 `null`；若該次 API 回傳非空 `messages`，`chatBox.appendChild(...)` 會丟例外，被外層 `.catch()` 吞掉只印一行 console error，不影響畫面但是浪費一次 API 呼叫。之後確認新流程穩定後可以整段刪除。
6. **`AiConversation.can_continue()` / `add_message()` 兩個 model 方法沒有任何 view 呼叫**，是重構前寫的，views.py 現在都直接操作 `conv.messages` list。可以刪除，或改成讓 view 改用這兩個方法統一邏輯（目前沒有一致性問題，純粹是重複程式碼待清理）。
7. **`_compute_streak_days()` 這個「連續天數」演算法，`member_page`、`dashboard`（其實 dashboard 沒有算 streak）、`game_page` 各自有一份幾乎一樣但獨立實作的版本**（`game_page` 用 `played_dates` 集合，`member_page`/`review` 用 `_compute_streak_days()` 輔助函式），沒有統一成一個共用函式。
8. **`voiceIndex` 裡還留著除錯用的 `print()`**（"目前日期"、"本月日記數量"、"月曆資料"），正式環境應該拿掉或改用 `logging`。
9. **`market_page` 的遊戲分數目前只在前端算，沒有寫回 `GameSession`**，跟 `game_page`/`save_game_result` 是兩套獨立系統，`record.md` 裡也還沒排入這項整合。
10. **`urls.py` 裡 `path('api/ai-chat/', ...)` 被註解掉，`ai_chat_api` 這個 view 函式在 `views.py` 裡也不存在**——單純是遺留的死路由註解，沒有實際影響，但看到不用去找那個 view，它從沒被實作過。
11. **`cleanup_chat_audios` 這個 management command 沒有自動排程**，專案裡沒有 celery beat 或系統 cron 幫忙定期跑，示範/demo 期間要清孤兒暫存錄音得手動執行 `python manage.py cleanup_chat_audios`。正式上線要另外接排程（cron job 或 Windows 工作排程器都可以）。
12. **`Notification` 和 `ChatReplyAudio` 沒有註冊進 `Voice/admin.py`**，後台管理不到這兩張表（無法用 admin 手動標記通知已讀、查看或刪除暫存錄音），要 debug 只能用 Django shell 或直接查資料庫。
13. **`voice.js` 重整頁面還原對話時（`init()` 裡的 `renderAllMessages()`），第 1～4 輪的錄音回放按鈕會消失**，因為 `vision_firstQ` 回傳的 `messages` 只有 `role`/`content`，沒有帶對應的 `audio_url`；使用者重整過頁面後，已經講過的那幾輪就聽不到自己剛剛的錄音了（要重新設計 `vision_firstQ` 的回傳格式，把每則 user 訊息的音檔網址也一起帶出來才能修）。
