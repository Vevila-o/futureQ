# 變更紀錄：相對於 `origin/frontend-update`

比對分支：`origin/frontend-update` → 當前版本（SE_demo）

---

## 整體評估

**規模**：49 個檔案異動，+1,327 行 / -260 行。但約一半為媒體檔案（demo 音檔、圖片、ngrok.exe）與文件（README、test_plan），純程式碼異動集中在 5 個 JS 檔、4 個 Template、1 個 views.py。

**性質**：功能補完，非架構重構。

- 路由結構、Model、Whisper 流程皆未變動
- `frontend-update` 版本的播放按鈕、AI 回應、nav 路由已有 UI 骨架但未接邏輯，本次主要將這些功能真正串通
- 新增兩個獨立頁面（member、loading），不影響主錄音流程

**最大行為改變**：
- AI 生成日記標題 + 溫暖回應（原本留空）
- 錄音中離頁警告
- 首頁「今天」按鈕的已完成狀態偵測
- 語音播放功能在首頁與回顧頁正式可用

**Merge 風險**：低。若要合回 `frontend-update`，衝突點主要在 `views.py`（新增 view、AI 邏輯）與 `voice.js`（按鈕顯示、overlay、返回攔截），其餘為新增檔案或小幅補丁，衝突機率低。

---

## 後端（Django）

### `Voice/views.py`
- **新增 `member_page` view**：查詢使用者資料、日記總數、連續記錄天數（今天無日記時從昨天起算）
- **新增 `loading_page` view**：回傳 loading.html 過場頁
- **`voiceIndex`**：新增 `has_today_diary` 查詢，今天已完成時傳入 template 以條件顯示
- **`update_diary_audio`**：Whisper 轉文字後呼叫 OpenAI API 生成 AI 標題（10 字內含 emoji）與溫暖回應（100 字內），存入 `diary.title` 和 `diary.ai_response`
- **`upload_chat_voice`**：API key 改從 `settings.OPENAI_API_KEY` 讀取，移除原本寫死的空字串
- **`review_page`**：`entry_to_dict` 補上 `"audio": entry.audio_file.url` 欄位，供前端播放語音

### `voiceDiary/settings.py`
- 新增 `CSRF_TRUSTED_ORIGINS`，支援 ngrok HTTPS 請求（預設允許 `*.ngrok-free.app`、`*.ngrok.io`）

### `voiceDiary/urls.py`
- 新增路由 `/member/` → `member_page`
- 新增路由 `/loading/` → `loading_page`

---

## 前端 JavaScript

### `static/js/voice.js`
- **「保存錄音」按鈕**：錄音進行中隱藏（`display:none`），僅在 `paused` 或 `ended` 狀態顯示
- **Loading overlay**：點擊「保存錄音」後立即顯示旋轉齒輪畫面；fetch 失敗時隱藏
- **返回鍵警告**：
  - `beforeunload` 事件：錄音進行中離頁觸發瀏覽器原生警告
  - capture phase click：攔截頁首返回按鈕，顯示 `confirm` 確認後才離頁

### `static/js/finish.js`
- 使用者點擊「開始說話」錄音時，隱藏「略過對話」按鈕

### `static/js/photo.js`
- `formData.append` 第三參數補上 `'voice_photo.jpg'`，上傳時統一重命名

### `static/js/nav.js`
- 路由改為 Django URL（`/index/`、`/dashboard/`、`/member/`），移除舊的 `.html` 路徑
- 新增 `member` 頁面的 `activePage` 偵測與導覽

### `static/js/index.js`
- `DEMO_ENTRIES` 新增 `audio` 欄位（對應 `entry.audio`）
- `openEntry()`：設定 `<audio>` 元素 src、重置播放按鈕狀態
- `closeEntry()`：關閉 Modal 時暫停音訊並重置按鈕
- 播放按鈕綁定事件：播放 / 暫停切換，播完自動重置

### `static/js/review.js`
- 新增 `<audio>` 元素綁定與 `resetPlayBtn()` 函數
- `openModal()`：設定音訊 src、重置播放狀態
- `closeModal()`：關閉時呼叫 `resetPlayBtn()` 停止播放
- 播放按鈕綁定事件：播放 / 暫停切換，播完自動重置

---

## 前端 Template

### `templates/index.html`
- 「今天」按鈕：`has_today_diary` 為 true 時改顯示「已完成今天的紀錄」（`check_circle` 圖示、無法再進入）
- Modal 新增隱藏 `<audio id="modal-audio">` 元素
- 播放按鈕新增 `id`（`modal-play-btn`、`modal-play-icon`、`modal-play-text`），供 JS 控制

### `templates/voice.html`
- `btn-save` 按鈕預設加上 `style="display:none;"` 隱藏
- 新增 `loading-overlay` div（綠底 + logo 圓圈 + 旋轉齒輪 + 「計算中請稍後」）
- 新增 `@keyframes gear-spin` CSS 動畫

### `templates/finish.html`
- 頂部補上 `{% load tz %}`
- `data-back` 從 `"back"` 修正為 `"/index/"`
- Summary 卡片新增 `summary-title`（AI 生成標題 pill），條件顯示
- `summary-time` 改為動態時間 `{{ diary.created_at|date:"g:i A" }}`（原為寫死 `10:45 AM`）
- AI 氣泡改顯示 `diary.ai_response`（無資料時才顯示預設文字）

### `templates/review.html`
- 新增 `<audio id="modal-audio">` 元素
- 播放按鈕新增 `id`（`modal-play-btn`、`modal-play-icon`、`modal-play-text`）

---

## 新增頁面與樣式

### `templates/loading.html`（新增）
- 全頁綠色背景，白色圓形 logo + 旋轉齒輪，作為 Whisper 計算等待畫面

### `templates/member.html`（新增）
- 個人資料頁：顯示姓名、加入日期、生日、性別、日記總數、連續記錄天數

### `static/css/member.css`（新增）
- 會員頁樣式：banner、統計卡片、資料欄位、帳號管理區

### `static/css/finish.css`
- `.summary-title`：新增 pill 樣式（圓角、主題色背景、20px 粗體、overflow ellipsis）
- `.summary-text p`：字重改為 `400`（正常），顏色改為 `on-surface-variant`

---

## 假資料與媒體資源

### `Voice/management/commands/seed_diary.py`
- 假資料從 7 筆擴充至 10 筆（新增 15 天前、30 天前、365 天前）
- 每筆補上 `ai_response` 欄位
- 第 1 筆音檔從 `demo_park.mp3`（缺檔）改為 `demo_short.mp3`

### `media/audio/`（新增音檔）
- `demo_short.mp3`、`demo_activity.mp3`、`demo_vegetable.mp3`
- `demo_drawing.mp3`、`demo_hospital.mp3`、`demo_lunch.mp3`
- `demo_tea.mp3`、`demo_market.mp3`、`demo_family.mp3`

### `media/photo/`
- 圖片路徑從 `media/voiceDiary/media/photo/` 修正至 `media/photo/`

### `static/img/logo.jpg.png`（新增）
- loading 頁與 loading overlay 使用的 App logo
