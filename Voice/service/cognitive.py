# 語音認知分析 #

import json
from openai import OpenAI
from django.conf import settings


# openAI Client 端
def get_client():
  return OpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL
  )
  
# 分析

# 停頓分析
def count_hesitations(segments: list, pause_threshold: float = 1.0) -> int:
  count = 0
  for i in range(1, len(segments)):
    gap = segments[i]["start"] - segments[i -1]["end"]
    if gap >= pause_threshold:
      count += 1
  return count

def analyze(transcription: str, segments: list) -> dict:
  client = get_client()
  word_count = len(transcription.replace(" ",""))
  hesitation_count = count_hesitations(segments)
  
  # GPT system prompt
  prompt = f"""
  你是一位語言認知分析師。請分析以下語音轉譯文字，回傳 JSON 格式，不要有其他說明。

  轉譯文字：
  {transcription}

  請回傳以下 JSON：
  {{
    "vocabulary_richness": 0到1之間的浮點數,
    "sentence_fluency": 0到1之間的浮點數,
    "topic_coherence": 0到1之間的浮點數,
    "risk_level": "low" 或 "medium" 或 "high",（判斷標準：low=語言流暢詞彙豐富主題連貫；medium=偶有停頓或詞彙重複話題稍有偏離；high=大量停頓詞彙貧乏話題混亂語意不清）,
    "summary": "50字以內的中文摘要"
  }}
  """
  response = client.chat.completions.create(
    model=settings.OPENAI_MODEL,
    messages=[{"role": "user", "content": prompt}],
    response_format={"type": "json_object"},
  )
  llm_output = json.loads(response.choices[0].message.content)
  
  return {
    "vocabulary_richness": llm_output.get("vocabulary_richness"),
    "sentence_fluency":    llm_output.get("sentence_fluency"),
    "topic_coherence":     llm_output.get("topic_coherence"),
    "risk_level":          llm_output.get("risk_level", "low"),
    "summary":             llm_output.get("summary", ""),
    "word_count":          word_count,
    "hesitation_count":    hesitation_count,
    "raw_llm_output":      llm_output,
}
