from django.shortcuts import render
from Voice.service.whisper import transcribe
from django.http import JsonResponse
from .models import DiaryEntry

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
        audio = request.FILES["audio_file"]
        
        entry = DiaryEntry.objects.create(
            audio_file = audio
        )
        text = transcribe(entry.audio_file.path)
        entry.transcription = text
        entry.status = DiaryEntry.Status.DONE
        entry.save()
        return JsonResponse({"text": text})
