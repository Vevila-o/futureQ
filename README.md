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

聲影日記是一個專為長者設計的語音日記系統。使用者可以上傳照片並錄製語音，系統會自動將語音轉換成文字（透過本地 Whisper 模型），並以本地認知分析演算法評估六個認知維度，最後透過 OpenAI API 進行 AI 追問對話。

---

## 技術清單

| 類別 | 技術 |
|---|---|
| 後端框架 | Django 5.2 |
| 資料庫 | SQLite（本地開發）|
| 語音辨識 | OpenAI Whisper（本地執行，base model）|
| 認知分析 | 本地演算法（`Voice/utils.py`）|
| AI 對話 | OpenAI API（gpt-4.1-mini）|
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
│   ├── settings.py                # 全域設定（資料庫、語言、媒體路徑等）
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
│   │   ├── index.css              # 首頁 / 共用樣式
│   │   ├── nav.css                # 底部導覽列
│   │   ├── header.css             # 頁首樣式
│   │   ├── photo.css              # 上傳照片頁
│   │   ├── voice.css              # 錄音頁
│   │   ├── finish.css             # 完成頁
│   │   ├── review.css             # 動態回顧頁
│   │   └── dashboard.css          # 儀表板頁
│   ├── js/
│   │   ├── index.js               # 首頁月曆邏輯
│   │   ├── nav.js                 # 底部導覽列動態 + 路由
│   │   ├── header.js              # 首頁頁首
│   │   ├── headerback.js          # 含返回鍵頁首
│   │   ├── photo.js               # 照片上傳邏輯
│   │   ├── voice.js               # 錄音邏輯
│   │   ├── finish.js              # AI 對話 + 分享邏輯
│   │   ├── review.js              # 動態回顧邏輯
│   │   ├── dashboard.js           # 儀表板圖表邏輯
│   │   └── recorder.js            # 備用錄音模組
│   └── img/                       # 靜態圖片資源
│
├── media/                         # 使用者上傳的檔案（不上傳 git）
│   ├── audio/                     # 語音檔（.webm / .mp3）
│   └── photo/                     # 照片
│
├── templates/                     # HTML 頁面
│   ├── index.html                 # 首頁（月曆）
│   ├── photo.html                 # 上傳照片
│   ├── voice.html                 # 錄音
│   ├── finish.html                # 完成 + AI 對話
│   ├── review.html                # 動態回顧
│   ├── dashboard.html             # 認知分析儀表板
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
| `/index/` | 首頁（月曆 + 日記入口）|
| `/dashboard/` | 認知分析儀表板 |
| `/uploadPhoto/` | 上傳照片 |
| `/voice/` | 語音錄音 |
| `/finish/` | 完成頁面 + AI 三輪對話 |
| `/review/` | 動態回顧 |
| `/admin/` | Django 後台 |
| **API** | |
| `/saveDiary/` | 儲存照片、建立日記（POST）|
| `/updateDiaryAudio/` | 更新語音檔 + Whisper 轉文字（POST）|
| `/api/ai-chat/` | AI 文字對話（POST）|
| `/api/upload-chat-voice/` | AI 語音對話（Whisper + GPT，POST）|
| **共用元件** | |
| `/nav/` | 底部導覽列 HTML |
| `/header/` | 首頁頁首 HTML |
| `/headerback/` | 含返回鍵頁首 HTML |

---

## 使用者流程

```
首頁（月曆）
    ↓ 點擊「今天」
上傳照片 (/uploadPhoto/)
    ↓ 選擇照片 → 儲存 → 建立 DiaryEntry
錄音 (/voice/?diary_id=...)
    ↓ 錄音 → 保存 → Whisper 語音轉文字
完成頁面 (/finish/?diary_id=...)
    ↓ 顯示日記摘要 + AI 三輪追問對話（可略過）
首頁（看到今天的日記標記在月曆上）
```

---

## 資料庫設計

資料表之間有關聯（FK / OneToOne）。

### User（使用者）

繼承 Django 內建 `AbstractUser`，額外新增：

| 欄位 | 類型 | 說明 |
|---|---|---|
| gender | CharField | 性別 |
| userbirth | DateField | 生日 |

### DiaryEntry（聲影日記）

| 欄位 | 類型 | 說明 |
|---|---|---|
| user | ForeignKey → User | 日記所屬使用者 |
| title | CharField | 日記標題 |
| audio_file | FileField | 語音檔（上傳至 `media/audio/`）|
| photo | ImageField | 照片（上傳至 `media/photo/`）|
| transcription | TextField | Whisper 語音轉文字結果 |
| diary_text | TextField | 日記文字 |
| photo_description | TextField | 照片 AI 描述 |
| ai_response | TextField | AI 溫暖回應 |
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

建立 10 筆假日記（含認知分析），用於測試月曆與儀表板。

### 8. 啟動伺服器

```bash
python manage.py runserver
```

開啟瀏覽器進入 `http://127.0.0.1:8000/index/`

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
