# 聲影日記 VoiceDiary

> 詳細環境建置教學請看 [tutor.md](tutor.md)

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

聲影日記是一個專為長者設計的語音日記系統。使用者登入帳號後可以上傳照片並錄製語音，系統會自動將語音轉換成文字（透過本地 Whisper 模型），由 OpenAI API 生成日記標題與 AI 溫暖回應，並以本地認知分析演算法評估六個認知維度。首頁月曆只顯示自己的歷史日記，點擊可回放語音；動態回顧頁可瀏覽自己昨天與去年的日記。

完成日記後，AI 會把內容改寫成第一人稱短文並分類到「食衣住行育樂」六大生活類別，存成一則貼文，分享到社群動態頁讓朋友用語音留言加油打氣。另外還有「大腦訓練遊戲」與對應的成就 / 點數商城頁面。

錄音頁採用**點擊式操作**：點擊麥克風按鈕開始錄音，按鈕圖示轉為「暫停」，旁邊浮現「完成」按鈕；再次點擊麥克風可暫停 / 繼續錄音，點擊「完成」即結束錄音。錄音完成後波形區域原地轉為內嵌迷你播放器，可試聽後再保存。

---

## 技術清單

| 類別 | 技術 |
|---|---|
| 後端框架 | Django 5.2 |
| 資料庫 | SQLite（本地開發）|
| 身份驗證 | Django Session-based Auth，自訂 `User` model（`AUTH_USER_MODEL = 'Voice.User'`）|
| 語音辨識 | OpenAI Whisper（本地執行，base model）|
| 認知分析 | 本地演算法（`Voice/utils.py`）|
| AI 生成 | OpenAI API（標題 + 溫暖回應 + 追問對話 + 分享貼文改寫 + 食衣住行育樂分類）|
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
│           └── seed_diary.py      # 假資料產生指令（10 筆日記）
│
├── static/                        # 靜態檔案
│   ├── css/
│   │   ├── index.css              # 首頁 / 共用樣式（CSS 變數、主題色）
│   │   ├── nav.css                # 底部導覽列
│   │   ├── header.css             # 頁首樣式
│   │   ├── login.css              # 登入頁
│   │   ├── photo.css              # 上傳照片頁（含保存按鈕上傳中旋轉動畫）
│   │   ├── voice.css              # 錄音頁（點擊式麥克風 / 完成按鈕、內嵌播放器）
│   │   ├── finish.css             # 完成頁（含 AI 追問聊天氣泡、分享卡片預覽）
│   │   ├── review.css             # 動態回顧頁
│   │   ├── dashboard.css          # 儀表板頁
│   │   ├── member.css             # 會員頁
│   │   ├── share.css              # 分享頁
│   │   ├── community.css          # 社群動態頁
│   │   ├── game.css               # 遊戲首頁（我的成績統計）
│   │   └── market.css             # 整理菜籃遊戲頁
│   ├── js/
│   │   ├── index.js               # 首頁月曆邏輯 + 日記 Modal 語音播放
│   │   ├── nav.js                 # 底部導覽列動態 + 路由
│   │   ├── header.js              # 首頁頁首
│   │   ├── headerback.js          # 含返回鍵頁首
│   │   ├── photo.js               # 照片上傳邏輯（上傳時重命名為 voice_photo.jpg、防重複送出、保存按鈕 loading 動畫）
│   │   ├── voice.js               # 錄音邏輯（點擊開始 / 暫停 / 完成、內嵌播放器、返回警告）
│   │   ├── finish.js              # AI 對話 + 分享邏輯（錄音時隱藏略過按鈕）
│   │   ├── review.js              # 動態回顧邏輯 + 語音播放
│   │   ├── dashboard.js           # 儀表板圖表邏輯
│   │   ├── share.js               # 分享頁邏輯（LINE/FB/儲存圖片/複製連結/語音加油錄製）
│   │   ├── community.js           # 社群動態頁邏輯（展開留言、語音加油播放）
│   │   ├── recorder.js            # 備用錄音模組
│   │   ├── game.js                # 遊戲首頁互動（愛心按讚等）
│   │   ├── achievements.js        # 成就頁互動
│   │   ├── shop.js                # 點數商城互動
│   │   └── market.js              # 整理菜籃遊戲邏輯（計分、連續答對加乘、反應時間/猶豫紀錄）
│   └── img/                       # 靜態圖片資源
│
├── media/                         # 使用者上傳的檔案（不上傳 git）
│   ├── audio/                     # 語音檔（.webm / .mp3）
│   ├── photo/                     # 照片（上傳時統一命名為 voice_photo.jpg）
│   └── voice_replies/             # 社群語音加油回覆檔
│
├── templates/                     # HTML 頁面
│   ├── login.html                 # 登入頁
│   ├── index.html                 # 首頁（月曆 + 語音播放 Modal，僅顯示自己的日記）
│   ├── photo.html                 # 上傳照片
│   ├── voice.html                 # 錄音（點擊式麥克風 / 完成按鈕、內嵌播放器、loading overlay）
│   ├── finish.html                # 完成頁（AI 對話 + 分享卡片預覽）
│   ├── review.html                # 動態回顧（含語音播放 Modal，僅顯示自己的日記）
│   ├── dashboard.html             # 認知分析儀表板
│   ├── loading.html               # 計算等待畫面（logo + 旋轉齒輪）
│   ├── member.html                # 會員頁面（個人資料 + 連續天數）
│   ├── share.html                 # 分享頁（卡片 + OG tags + 操作按鈕 + 語音加油錄製）
│   ├── community.html             # 社群動態頁（僅顯示自己分享出去的日記與收到的語音加油）
│   ├── game.html                  # 遊戲首頁（問候語、每日建議、我的成績統計）
│   ├── achievements.html          # 成就頁
│   ├── shop.html                  # 點數商城頁
│   ├── market.html                # 整理菜籃遊戲（拖曳分類、四階段）
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
| `/voice/` | 語音錄音（錄音中離開會警告） |
| `/finish/` | 完成頁面 + AI 三輪對話 + 分享卡片預覽 |
| `/review/` | 動態回顧（昨天 / 去年的今天，只顯示自己的日記）|
| `/member/` | 會員頁面（個人資料、日記數、連續天數）|
| `/loading/` | 計算等待畫面（Whisper 處理期間的安撫畫面）|
| `/share/` | 日記分享頁（第一人稱內文、hashtag、OG 預覽、儲存圖片、語音加油錄製）|
| `/share/?preview=1` | 同上，無 header / nav，供 LINE / Facebook 接收方瀏覽 |
| `/community/` | 社群動態頁（只顯示自己分享出去的日記，以及朋友回覆的語音加油）|
| `/game/` | 遊戲首頁（我的成績：最高分 / 累計次數 / 連續天數 / 最近紀錄，依 `GameSession` 動態計算）|
| `/achievements/` | 成就頁 |
| `/shop/` | 點數商城頁 |
| `/market/` | 整理菜籃遊戲（拖曳分類，四階段，答對計分 + 連續答對加乘）|
| `/admin/` | Django 後台（獨立 session，見[登入與後台](#登入與後台)）|
| **API** | |
| `/saveDiary/` | 儲存照片、建立日記（POST）|
| `/updateDiaryAudio/` | 更新語音檔 + Whisper 轉文字 + AI 生成標題與回應（POST）|
| `/api/ai-first-question/` | 生成首問 + 回傳完整對話歷史（POST）|
| `/api/ai-chat/` | AI 文字對話（POST，目前前端未使用）|
| `/api/upload-chat-voice/` | AI 語音對話（Whisper + GPT + 存 AiConversation，POST）|
| `/api/save-game-result/` | 儲存一場遊戲的成績（總分、正確率、平均反應時間、猶豫次數，POST）|
| `/api/voice-reply/` | 朋友對某篇日記送出語音加油（POST）|
| `/api/voice-reply/<reply_id>/transcribe/` | 將語音加油轉成文字（POST，Whisper）|
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
錄音 (/voice/?diary_id=...)
    ↓ 點擊麥克風按鈕 → 開始錄音，按鈕圖示轉為「暫停」，旁邊浮現「完成」按鈕
    ↓ 再次點擊麥克風 → 暫停 ／ 繼續錄音
    ↓ 點擊「完成」→ 結束錄音（達 3 分鐘上限會自動結束）
    ↓ 錄音完成 → 波形區原地變成迷你播放器（播放鍵 + 進度條 + 時間）可試聽
    ↓ 錄音中離開 → 警告「錄音將丟失」
    ↓ 點擊「保存錄音」→ 顯示 loading overlay（齒輪旋轉）
    ↓ Whisper 轉文字 + AI 生成標題（10 字內含 emoji）+ AI 溫暖回應
完成頁面 (/finish/?diary_id=...)
    ↓ 顯示日記摘要（AI 標題 pill + 語音轉文字 + 紀錄時間）
    ↓ AI 溫暖回應氣泡
    ↓ 自動呼叫 /api/ai-first-question/ → 顯示 AI 首問（三點等待動畫）
    ↓ 使用者錄音回答 → 右側三點氣泡 → 後端 Whisper + GPT → 左側三點氣泡 → AI 回覆
    ↓ 最多三輪，對話存入 AiConversation；刷新後完整還原；達上限後按鈕鎖定
    ↓ 可略過對話
    ↓ AI 把日記內容改寫成第一人稱短文，分類到「食衣住行育樂」六類其中一類，存成一則 Diarypost
    ↓ 點擊「LINE 分享」或「Facebook 分享」
分享頁 (/share/?diary_id=...)
    ↓ 顯示 AI 生成的第一人稱內文 + 3 個 hashtag
    ↓ 照片卡片 + LINE / Facebook 分享、儲存圖片、複製連結
    ↓ 朋友開啟分享連結（?preview=1）可錄製「語音加油」回覆
社群動態頁 (/community/)
    ↓ 只顯示自己分享出去的日記，展開可看到朋友的語音加油留言（可一鍵轉文字）
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
| transcription | TextField | Whisper 語音轉文字結果 |
| diary_text | TextField | 日記文字 |
| photo_description | TextField | 照片 AI 描述 |
| ai_response | TextField | AI 溫暖回應（100 字內）|
| status | CharField | 分析狀態（pending / processing / done / failed）|
| created_at | DateTimeField | 建立時間 |
| updated_at | DateTimeField | 更新時間 |

### CognitiveAnalysis（認知分析）

與 `DiaryEntry` 為 OneToOne 關係。

| 欄位 | 類型 | 說明 |
|---|---|---|
| diary | OneToOneField → DiaryEntry | 對應日記 |
| fluency_score | IntegerField | 流暢度（0–100）|
| information_score | IntegerField | 資訊量（0–100）|
| sentence_score | IntegerField | 句子結構（0–100）|
| naming_score | IntegerField | 命名能力（0–100）|
| semantic_score | IntegerField | 語意正確性（0–100）|
| communication_score | IntegerField | 整體溝通能力（0–100）|
| total_score | IntegerField | 六維度總分 |
| average_score | DecimalField | 平均分數 |
| risk_level | CharField | 風險等級（low / medium / high）|
| suggestion | TextField | 給使用者的建議 |
| ai_feedback | TextField | AI 分析回饋 |
| analyzed_at | DateTimeField | 分析時間 |

### AiConversation（AI 追問對話）

與 `DiaryEntry` 為 OneToOne 關係，最多 3 輪。

| 欄位 | 類型 | 說明 |
|---|---|---|
| diary | OneToOneField → DiaryEntry | 對應日記 |
| messages | JSONField | 對話訊息列表 |
| round_count | IntegerField | 目前輪數（最多 3）|
| is_finished | BooleanField | 對話是否結束 |
| created_at | DateTimeField | 建立時間 |
| updated_at | DateTimeField | 更新時間 |

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

`share_page` / `finish_page` 產生分享內文時，會把結果連同分類標籤存一筆（同一篇日記重複產生只會更新，不會重複建立）。

| 欄位 | 類型 | 說明 |
|---|---|---|
| user | ForeignKey → User | 貼文所屬使用者 |
| diary_title | ForeignKey → DiaryEntry（`related_name="diary_posts"`）| 對應日記 |
| post | TextField | AI 改寫後的第一人稱貼文內容 |
| category | CharField（choices）| 食 / 衣 / 住 / 行 / 育 / 樂，AI 依日記內容分類 |
| created_at | DateTimeField | 建立時間 |

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
