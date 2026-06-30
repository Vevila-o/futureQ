# 聲影日記 VoiceDiary

> 詳細環境建置教學請看 [tutor.md](tutor.md)

---

## 目錄

- [專案介紹](#專案介紹)
- [技術清單](#技術清單)
- [專案架構](#專案架構)
- [頁面路由](#頁面路由)
- [使用者流程](#使用者流程)
- [資料庫設計](#資料庫設計)
- [環境需求](#環境需求)
- [快速開始](#快速開始)
- [後台管理](#後台管理)
- [環境變數設定](#環境變數設定)

---

## 專案介紹

聲影日記是一個專為長者設計的語音日記系統。使用者可以上傳照片並錄製語音，系統會自動將語音轉換成文字（透過本地 Whisper 模型），由 OpenAI API 生成日記標題與 AI 溫暖回應，並以本地認知分析演算法評估六個認知維度。首頁月曆顯示歷史日記，點擊可回放語音；動態回顧頁可瀏覽昨天與去年的日記。

錄音頁採用**長按拖曳手勢**（類似微信語音輸入）：長按麥克風開始錄音，同時全螢幕模糊背景出現，照片保持清晰，底部弧狀白色區域顯示操作選項；滑向上方的「暫停」或「完成」按鈕後放開即觸發對應動作，直接放開則預設暫停。錄音完成後波形區域原地轉為內嵌迷你播放器，可試聽後再保存。

---

## 技術清單

| 類別 | 技術 |
|---|---|
| 後端框架 | Django 5.2 |
| 資料庫 | SQLite（本地開發）|
| 語音辨識 | OpenAI Whisper（本地執行，base model）|
| 認知分析 | 本地演算法（`Voice/utils.py`）|
| AI 生成 | OpenAI API（標題 + 溫暖回應 + 追問對話）|
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
│   ├── wsgi.py
│   └── asgi.py
│
├── Voice/                         # 主要 App
│   ├── models.py                  # 資料表定義（User、DiaryEntry 等）
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
│   │   ├── photo.css              # 上傳照片頁
│   │   ├── voice.css              # 錄音頁（含長按 overlay、弧狀選項區、內嵌播放器）
│   │   ├── finish.css             # 完成頁
│   │   ├── review.css             # 動態回顧頁
│   │   ├── dashboard.css          # 儀表板頁
│   │   ├── member.css             # 會員頁
│   │   └── share.css              # 分享頁
│   ├── js/
│   │   ├── index.js               # 首頁月曆邏輯 + 日記 Modal 語音播放
│   │   ├── nav.js                 # 底部導覽列動態 + 路由
│   │   ├── header.js              # 首頁頁首
│   │   ├── headerback.js          # 含返回鍵頁首
│   │   ├── photo.js               # 照片上傳邏輯（上傳時重命名為 voice_photo.jpg）
│   │   ├── voice.js               # 錄音邏輯（長按拖曳手勢、全螢幕 overlay、內嵌播放器、返回警告）
│   │   ├── finish.js              # AI 對話 + 分享邏輯（錄音時隱藏略過按鈕）
│   │   ├── review.js              # 動態回顧邏輯 + 語音播放
│   │   ├── dashboard.js           # 儀表板圖表邏輯
│   │   ├── share.js               # 分享頁邏輯（LINE/FB/儲存圖片/複製連結）
│   │   └── recorder.js            # 備用錄音模組
│   └── img/                       # 靜態圖片資源
│
├── media/                         # 使用者上傳的檔案（不上傳 git）
│   ├── audio/                     # 語音檔（.webm / .mp3）
│   └── photo/                     # 照片（上傳時統一命名為 voice_photo.jpg）
│
├── templates/                     # HTML 頁面
│   ├── index.html                 # 首頁（月曆 + 語音播放 Modal）
│   ├── photo.html                 # 上傳照片
│   ├── voice.html                 # 錄音（長按手勢、全螢幕 overlay、弧狀操作區、內嵌播放器、loading overlay）
│   ├── finish.html                # 完成 + AI 對話
│   ├── review.html                # 動態回顧（含語音播放 Modal）
│   ├── dashboard.html             # 認知分析儀表板
│   ├── loading.html               # 計算等待畫面（logo + 旋轉齒輪）
│   ├── member.html                # 會員頁面（個人資料 + 連續天數）
│   ├── share.html                 # 分享頁（卡片 + OG tags + 操作按鈕）
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
| `/index/` | 首頁（月曆 + 日記入口）今天已完成時顯示完成狀態 |
| `/dashboard/` | 認知分析儀表板 |
| `/uploadPhoto/` | 上傳照片 |
| `/voice/` | 語音錄音（錄音中離開會警告） |
| `/finish/` | 完成頁面 + AI 三輪對話 |
| `/review/` | 動態回顧（昨天 / 去年的今天）|
| `/member/` | 會員頁面（個人資料、日記數、連續天數）|
| `/loading/` | 計算等待畫面（Whisper 處理期間的安撫畫面）|
| `/share/` | 日記分享頁（第一人稱內文、hashtag、OG 預覽、儲存圖片）|
| `/share/?preview=1` | 同上，無 header / nav，供 LINE / Facebook 接收方瀏覽 |
| `/admin/` | Django 後台 |
| **API** | |
| `/saveDiary/` | 儲存照片、建立日記（POST）|
| `/updateDiaryAudio/` | 更新語音檔 + Whisper 轉文字 + AI 生成標題與回應（POST）|
| `/api/ai-first-question/` | 生成首問 + 回傳完整對話歷史（POST）|
| `/share/` | 日記分享頁（GET，帶 `diary_id`）|
| `/api/ai-chat/` | AI 文字對話（POST，目前前端未使用）|
| `/api/upload-chat-voice/` | AI 語音對話（Whisper + GPT + 存 AiConversation，POST）|
| **共用元件** | |
| `/nav/` | 底部導覽列 HTML |
| `/header/` | 首頁頁首 HTML |
| `/headerback/` | 含返回鍵頁首 HTML |

---

## 使用者流程

```
首頁（月曆）
    ↓ 今天已完成 → 顯示「已完成今天的紀錄」，無法重複進入
    ↓ 點擊「今天」
上傳照片 (/uploadPhoto/)
    ↓ 選擇照片（自動重命名為 voice_photo.jpg）→ 儲存 → 建立 DiaryEntry
錄音 (/voice/?diary_id=...)
    ↓ 長按麥克風按鈕 → 全螢幕模糊背景出現（照片保持清晰）
    ↓ 底部弧狀白色區域 + 上方浮現「暫停」「完成」按鈕
    ↓ 滑向「暫停」放開 → 暫停 ／ 滑向「完成」放開 → 結束錄音
    ↓ 直接放開（不滑動）→ 預設暫停
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
    ↓ 點擊「LINE 分享」或「Facebook 分享」
分享頁 (/share/?diary_id=...)
    ↓ AI 生成第一人稱內文 + 3 個 hashtag
    ↓ 照片卡片 + LINE / Facebook 分享、儲存圖片、複製連結
首頁（今天的日記標記在月曆上，顯示已完成狀態）
```

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

---

## 環境變數設定

| 變數名稱 | 說明 | 預設值 |
|---|---|---|
| OPENAI_API_KEY | OpenAI API 金鑰 | （必填）|
| OPENAI_MODEL | 使用的 GPT 模型 | gpt-4.1-mini |
| OPENAI_BASE_URL | API 網址 | https://api.openai.com/v1 |
| CSRF_TRUSTED_ORIGINS | 允許的 HTTPS 來源（逗號分隔）| ngrok 萬用字元 |
