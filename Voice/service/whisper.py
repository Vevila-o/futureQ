import whisper

_model = None

# 啟動模型
def get_model():
  global _model
  if _model is None: # 第一次呼叫載入
    _model = whisper.load_module("base") #模型選擇base
  return _model

