# 聲影日記 VoiceDiary

> 詳細環境建置教學請看 [tutor.md](tutor.md)

> 目前只完成到分享，貼文產生跟ai三次交流還沒完成
---

## 目錄

- [專案介紹](#專案介紹)
- [使用流程](#使用流程)
- [技術清單](#技術清單)
- [專案架構](#專案架構)
- [資料庫設計](#資料庫設計)
- [環境需求](#環境需求)
- [快速開始](#快速開始)
- [後台管理](#後台管理)
- [環境變數設定](#環境變數設定)

---

## 專案介紹

聲影日記是一個專為長者設計的語音日記系統。使用者可以上傳照片並錄製語音，系統會自動將語音轉換成文字（透過本地 Whisper 模型），並以 AI 進行認知分析，提供溫暖回應與風險評估，最後可分享到社群媒體。

---

## 使用流程

```
Phase 1 上傳照片
    ↓
Phase 2 錄音（最長 60 秒，可重錄）
    ↓
Phase 3 處理中（Whisper 語音轉文字 + AI 分析）
    ↓
Phase 4 結果（詞彙豐富度、語句流暢度、話題連貫性、風險等級等）
    ↓
Phase 5 分享（分享到 Line / Threads，或複製文字）
```

---

## 技術清單

| 類別 | 技術 |
|---|---|
| 後端框架 | Django 5.2 |
| 資料庫 | SQLite（本地開發）|
| 語音辨識 | OpenAI Whisper（本地執行，base 模型）|
| AI 回應 | OpenAI API |
| 前端 | HTML / CSS / JavaScript |
| 音訊解碼 | FFmpeg（需安裝並加入系統 PATH）|

---

## 專案架構

```
voiceDiary/
│
├── manage.py                    # Django 啟動入口
├── requirements.txt             # 所有套件版本
├── .env                         # 環境變數（不上傳 git）
├── .env.example                 # 環境變數範本
├── db.sqlite3                   # 本地資料庫（不上傳 git）
│
├── voiceDiary/                  # Django 專案設定
│   ├── settings.py              # 全域設定（資料庫、語言、媒體路徑等）
│   ├── urls.py                  # 全域路由
│   ├── wsgi.py
│   └── asgi.py
│
├── Voice/                       # 主要 App
│   ├── models.py                # 資料表定義
│   ├── views.py                 # API 邏輯
│   ├── admin.py                 # 後台管理設定
│   ├── migrations/              # 資料庫遷移紀錄
│   └── service/
│       └── whisper.py           # Whisper 語音轉文字邏輯
│
├── static/                      # 靜態檔案
│   ├── index.css                # 全域樣式
│   └── js/
│       ├── photo.js             # 照片上傳、預覽、切換 Phase 邏輯
│       └── recorder.js          # 錄音、倒數計時、上傳、結果顯示、分享邏輯
│
├── media/                       # 使用者上傳的檔案（不上傳 git）
│   ├── audio/                   # 語音檔
│   └── photo/                   # 照片
│
└── templates/
    └── index.html               # 主頁面（含全部 5 個 Phase）
```

---

## 資料庫設計

> 目前資料表之間**沒有關聯**，各自獨立。

### User（使用者）
繼承 Django 內建帳號系統，額外新增：

| 欄位 | 說明 |
|---|---|
| gender | 性別 |
| userbirth | 生日 |

Django 內建已包含：帳號、密碼、信箱、是否為管理員等。

### DiaryEntry（聲影日記）

| 欄位 | 說明 |
|---|---|
| audio_file | 語音檔案，存放於 `media/audio/` |
| photo | 照片，存放於 `media/photo/` |
| transcription | Whisper 語音轉文字結果 |
| photo_description | 照片 AI 描述 |
| ai_response | AI 溫暖回應 |
| status | 分析狀態（等待／分析中／完成／失敗）|
| created_at | 建立時間 |
| updated_at | 更新時間 |

### CognitiveAnalysis（認知分析）

| 欄位 | 說明 |
|---|---|
| vocabulary_richness | 詞彙豐富度 |
| sentence_fluency | 語句流暢度 |
| topic_coherence | 話題連貫性 |
| word_count | 總字數 |
| hesitation_count | 停頓次數 |
| risk_level | 風險等級（低／中／高）|
| summary | AI 分析摘要 |
| analyzed_at | 分析時間 |

### AiConversation（AI 追問對話）

| 欄位 | 說明 |
|---|---|
| messages | 對話訊息（JSON 格式）|
| round_count | 目前輪數（最多 3 輪）|
| is_finished | 對話是否結束 |
| created_at | 建立時間 |

---

## 環境需求

開始之前請確認電腦已安裝：

- Python 3.12
- FFmpeg（需加入系統 PATH，詳見 [tutor.md](tutor.md)）
- Git

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

> Whisper 模型（約 145MB）會在第一次執行時自動下載，不包含在套件安裝中。

### 4. 設定環境變數

複製範本並填入你的 API 金鑰：

```bash
copy .env.example .env
```

用編輯器打開 `.env` 填入：

```
OPENAI_API_KEY=你的金鑰
```

### 5. 建立資料庫

```bash
python manage.py migrate
```

### 6. 建立後台管理員帳號

```bash
python manage.py createsuperuser
```

### 7. 啟動伺服器

```bash
python manage.py runserver
```

開啟瀏覽器進入 `http://127.0.0.1:8000/index/`

---

## 後台管理

進入 `http://127.0.0.1:8000/admin`，用 `createsuperuser` 建立的帳號登入。

後台可以管理：
- 使用者帳號（含性別、生日）
- 聲影日記紀錄（語音、照片、轉文字結果、分析狀態）
- 認知分析結果（各項分數、風險等級）
- AI 對話紀錄

---

## 環境變數設定

| 變數名稱 | 說明 | 預設值 |
|---|---|---|
| OPENAI_API_KEY | OpenAI API 金鑰 | （必填）|
| OPENAI_MODEL | 使用的 GPT 模型 | gpt-4.1-mini |
| OPENAI_BASE_URL | API 網址 | https://api.openai.com/v1 |
