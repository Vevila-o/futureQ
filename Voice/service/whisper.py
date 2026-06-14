import whisper

_model = None

# 啟動模型
def get_model():
  global _model
  if _model is None: # 第一次呼叫載入
    _model = whisper.load_model("base") #模型選擇base
  return _model

# 音檔回傳
"""
回傳後就不會再生成五個檔案
"""
def transcribe(audio_path: str) -> dict:
  model = get_model()
  result = model.transcribe(audio_path)
  return {
    "text": result["text"],
    "segments": result["segments"],
  }


