from django.shortcuts import render
from Voice.service.whisper import transcribe
from Voice.service.cognitive import analyze
from django.http import JsonResponse
from .models import DiaryEntry, CognitiveAnalysis

# Create your views here.


# 聲影日記首頁
def voiceIndex(request):
    return render(request, "index.html", {
        "session_state_json": "{}",
    })  

# 上傳照片(僅測試尚未完成程式碼)
def upload_photo(request):
    if request.method == "POST":
        photo = request.FILES["photo_file"]
        entry = DiaryEntry.objects.create(
            photo = photo
        )
        return JsonResponse({"id": entry.id})
        

# 上傳語音轉譯回傳
def upload_audio(request):
    if request.method == "POST":
        # 語音上傳
        audio = request.FILES["audio_file"]
        entry_id = request.POST.get("entry_id")
        entry = DiaryEntry.objects.get(id = entry_id)
        entry.audio_file = audio 
        entry.save() # 第一次存到硬碟
                
        # whisper 轉譯
        result = transcribe(entry.audio_file.path)
        entry.transcription = result["text"]
        entry.status = DiaryEntry.Status.DONE
        entry.save() # 第二次存轉譯結果

        analysis = analyze(result["text"],result["segments"])
        # ai 分析
        CognitiveAnalysis.objects.create(
            vocabulary_richness = analysis["vocabulary_richness"],
            sentence_fluency    = analysis["sentence_fluency"],
            topic_coherence     = analysis["topic_coherence"],
            word_count          = analysis["word_count"],
            hesitation_count    = analysis["hesitation_count"],
            risk_level          = analysis["risk_level"],
            summary             = analysis["summary"],
            raw_llm_output      = analysis["raw_llm_output"],
        )
        return JsonResponse({
            "text": result["text"],
            "analyze":{
                "vocabulary_richness" :analysis["vocabulary_richness"],
                "sentence_fluency"    : analysis["sentence_fluency"],
                "topic_coherence"     : analysis["topic_coherence"],
                "word_count"          : analysis["word_count"],
                "hesitation_count"    : analysis["hesitation_count"],
                "risk_level"          : analysis["risk_level"],
                "summary"             : analysis["summary"],
            }
    })


