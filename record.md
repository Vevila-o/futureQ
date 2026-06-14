## Hui 的筆記

####　6/11 日誌

- 建立專案
主要是基本的架構要一致，先前建立的REST API + Flutter版本對於現在來說有一定的學習成本，改成簡單的html + Django
- 建立資料庫 `User`, `DiaryEntry`, `CognitiveAnalysis`, `AiConversation`


#### 6/12 日誌
- 資料表註冊完成，基於Django 內建user再加上性別、生日
- whisper 模型建立完成

#### 6/13 日誌
- 圖片上傳功能完成
- 預覽功能調整中
- Whisper值回傳funcotion
- 網頁是同頁跳轉，不跳轉其他頁面

#### 6/14 日誌
- 錄音畫面的圖片預覽調整
- 上傳優化
- 語音上傳功能雛形完成(一堆bug要修氣數，成功還是很開心啦)
> 筆記
> models.py 裡上傳audio, photo 資料庫時路徑都設絕對，這會導致另外創建一個，`settings`裡已經有設定好默認路徑，應該直接輸入audio photo即可
- 語音分析完成(先都丟給ai來判斷，沒寫邏輯)
