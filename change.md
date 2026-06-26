# 變更紀錄：相對於 `origin/frontend-update`

比對分支：`origin/frontend-update` → 當前版本（SE_demo）

---

## 整體評估

**規模**：49+ 個檔案異動，純程式碼異動集中在 6 個 JS 檔、4 個 Template、1 個 views.py。

**性質**：功能補完 + AI 對話存 DB，非架構重構。

- 路由結構、Model 定義皆未變動
- `frontend-update` 版本的播放按鈕、AI 回應、nav 路由已有 UI 骨架但未接邏輯，本次主要將這些功能真正串通
- 新增兩個獨立頁面（member、loading），不影響主錄音流程
- `AiConversation` 模型本次首次被真正寫入（三輪追問對話存 DB）

**最大行為改變**：
- AI 生成日記標題 + 溫暖回應（原本留空）
- 三輪追問對話真正存入 `AiConversation`（原本只存 session）
- 刷新後對話紀錄完整還原
- 錄音中離頁警告
- 首頁「今天」按鈕的已完成狀態偵測
- 語音播放功能在首頁與回顧頁正式可用

**Merge 風險**：低。衝突點主要在 `views.py`（新增 view、AI 邏輯）與 `voice.js`、`finish.js`，其餘為新增檔案或小幅補丁。

---

## 後端（Django）

### `Voice/views.py`
- **新增 `share_page` view**：根據 `diary_id` 取得日記，計算 streak_days，呼叫 OpenAI 生成第一人稱日記內文（50 字內）與 3 個 hashtag；偵測 `?preview=1` 參數傳入 `is_preview`，供 template 條件渲染
- **新增 `ai_first_question` view**：根據日記 transcription 呼叫 OpenAI 生成首問，建立 `AiConversation`；已有對話時回傳完整 messages 歷史；`is_finished` 時回傳 `status: finished`
- **新增 `member_page` view**：查詢使用者資料、日記總數、連續記錄天數（今天無日記時從昨天起算）
- **新增 `loading_page` view**：回傳 loading.html 過場頁
- **`voiceIndex`**：新增 `has_today_diary` 查詢，今天已完成時傳入 template 以條件顯示
- **`update_diary_audio`**：Whisper 轉文字後呼叫 OpenAI API 生成 AI 標題（10 字內含 emoji）與溫暖回應（100 字內），存入 `diary.title` 和 `diary.ai_response`
- **`upload_chat_voice`**：改從 DB（`AiConversation`）計次取代 session；每輪將 user + assistant 訊息存入 `messages`，更新 `round_count`；最後一輪設 `is_finished = True`
- **`review_page`**：`entry_to_dict` 補上 `"audio": entry.audio_file.url` 欄位，供前端播放語音

### `voiceDiary/settings.py`
- 新增 `CSRF_TRUSTED_ORIGINS`，支援 ngrok HTTPS 請求（預設允許 `*.ngrok-free.app`、`*.ngrok.io`）

### `voiceDiary/urls.py`
- 新增路由 `/member/` → `member_page`
- 新增路由 `/loading/` → `loading_page`
- 新增路由 `/api/ai-first-question/` → `ai_first_question`
- 新增路由 `/share/` → `share_page`

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
- **LINE / Facebook 分享按鈕**：改為跳轉 `/share/?diary_id=...`（原本直接呼叫 social API），移除「儲存圖片」與「複製連結」（功能移至 share.html）
- **頁面載入時呼叫 `ai_first_question`**：取得完整對話歷史並逐一渲染到 chat box；`finished` 狀態直接鎖定 UI
- **`showTypingBubble(role)`**：錄音開始時右側出現使用者三點氣泡，後端回傳後換成左側 AI 三點氣泡，最後替換為 AI 回覆文字
- **`removeTypingBubble()`**：收到回覆後移除等待氣泡
- **`updateVoiceUI`**：達到上限時按鈕變灰、文字改為「已達對話上限」、狀態文字說明三次已完成
- FormData 補上 `diary_id`，讓後端能查到對應的 `AiConversation`

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
- `<script>window.DIARY_ID = "{{ diary.id }}";</script>` 傳 diary id 給 JS
- 新增三點跳動氣泡 CSS（`.typing-bubble`、`@keyframes typing-dot`）

### `templates/review.html`
- 新增 `<audio id="modal-audio">` 元素
- 播放按鈕新增 `id`（`modal-play-btn`、`modal-play-icon`、`modal-play-text`）

---

## 新增頁面與樣式

### `templates/share.html`（新增）
- 分享專用頁面：照片卡片、第一人稱日記內文、連續記錄天數、hashtag pill、品牌 logo
- 含 Open Graph meta tags（LINE / Facebook 預覽時自動帶出標題、描述、照片）
- 操作區：LINE 分享、Facebook 分享、html2canvas 儲存圖片、複製連結
- **雙模式**：`is_preview=False`（一般）顯示 header + nav；`is_preview=True`（`?preview=1`）完全隱藏 header / nav，頂部 padding 縮減，適合社群平台接收方瀏覽

### `templates/loading.html`（新增）
- 全頁綠色背景，白色圓形 logo + 旋轉齒輪，作為 Whisper 計算等待畫面

### `templates/member.html`（新增）
- 個人資料頁：顯示姓名、加入日期、生日、性別、日記總數、連續記錄天數

### `static/css/share.css`（新增）
- 分享卡片樣式：照片區、標題、內文、meta 列、hashtag pill、品牌列
- LINE 綠、Facebook 藍按鈕樣式，次要按鈕（儲存圖片 / 複製連結）樣式

### `static/js/share.js`（新增）
- 主題 / 字體 / 深色模式初始化
- `buildShareUrl()`：分享至 LINE / Facebook 時自動在連結後附加 `&preview=1`，確保接收方看到無 header/nav 的乾淨頁面
- preview 模式下自動將 `main` 的 `padding-top` 縮減至 24px
- LINE 分享：開啟 `social-plugins.line.me` 分享視窗
- Facebook 分享：開啟 `facebook.com/sharer` 分享視窗
- html2canvas 儲存卡片圖片（scale: 2 高畫質）
- 複製頁面連結（含 clipboard fallback）
- **本地端限制**：`?preview=1` 可在瀏覽器手動加入測試；實際社群分享需 ngrok 或部署環境

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


# 菜市場遊戲頁面 (整理菜籃) 開發紀錄

## 📌 功能概述
於 `feature/game-page` 分支新增「整理菜籃」樂齡遊戲的專屬前端頁面。
情境為協助老闆將剛買回來的食材歸位，透過拖曳食材至對應籃子來完成任務，並包含四個動態切換的分類規則。

## 📂 異動檔案
* **新增** `market.html` (前端結構，預留 header/nav placeholder，後續將整合至 Django `templates/`)
* **新增** `market.css` (專屬樣式，移除 Tailwind 依賴，後續將放置於 `static/css/`)
* **新增** `market.js` (遊戲邏輯與音效互動，後續將放置於 `static/js/`)

## ✨ 實作細節與修改重點

### 1. 遊戲邏輯與階段推進
* 實作四個連貫的遊戲階段，無需手動選擇模式：
  * **階段一 (10題)**：依「種類」分類 (蔬菜籃、水果籃、肉蛋籃)。
  * **階段二 (10題)**：依「顏色」分類 (紅色籃、綠色籃、黃色籃)。
  * **階段三 (10題)**：依「能否生吃」分類 (生食籃、熟食籃)。
  * **階段四 (12題)**：隨機混合，每題更新畫面上方的提示框，籃子同步跟著切換。

### 2. UI/UX 與排版設計 (純 CSS 調整)
* **響應式設計 (RWD)**：改用 Media Query 設定斷點 (手機 `< 480px`、平板 `≥ 480px`、桌機 `≥ 768px`)，確保各裝置與網頁大螢幕的排版皆能正常顯示。
* **籃子視覺優化**：
  * 改為正方形比例 (`aspect-ratio: 1`)，使用中性背景色使視覺更穩重。
  * 分類標籤採「懸浮 Pill」設計 (`position: absolute; bottom: -13px`) 貼齊籃子底部邊緣，並套用各分類的專屬顏色。
* **食材卡片優化**：
  * 卡片上方新增 `<p id="itemName">` 標示食材中文名稱。
  * 拖曳時，卡片會自動縮小 (`scale(0.75)`) 並呈現半透明 (`opacity: 0.45`)，避免遮擋下方籃子，讓使用者清楚確認目標。

### 3. 互動與回饋機制
* **直覺操作**：移除長按延遲，改為 `touchstart` 一碰即可直接拖曳，提升操作流暢度。
* **無挫折回饋設計**：
  * **答對**：籃子閃綠光，並使用 Web Audio API 合成輕快音效 (C-E-G 上升音)。
  * **答錯**：食材自動退回原位，籃子閃黃光，搭配低頻鋸波音效。全程不顯示「錯誤」字樣，降低長者挫折感。

### 4. 系統環境相容與除錯
* **跳轉邏輯修正**：修改「返回首頁」的程式碼，自動偵測當前環境。無論是直接開啟 HTML 靜態檔測試 (跳轉 `game.html`)，或是啟動 Django Server (跳轉 `/game/`)，皆能正確導航。