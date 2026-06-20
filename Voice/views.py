from django.views.decorators.csrf import csrf_exempt
import json
from datetime import timedelta
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from .models import DiaryEntry
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.files.base import ContentFile
from django.http import JsonResponse
import whisper

# 1. 聲影日記首頁
def voiceIndex(request):
    return render(request, "index.html", {"session_state_json": "{}"})  

# 2. 🚀 錄音上傳
@csrf_exempt
def upload_photo(request):
    return JsonResponse({'status': 'success', 'message': '語音轉錄成功！'})

# 3. 🚀 核心問答 API：Session 完美控管 3 次限制，每次都精準回應並扣除次數
@csrf_exempt
def ai_chat_api(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': '只接受 POST 請求'})
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '')

        # 取得目前次數，預設為 0
        chat_count = request.session.get('chat_count', 0)

        # 後端第一道防線：滿 3 次直接攔截
        if chat_count >= 3:
            return JsonResponse({'status': 'error', 'message': '已經達到今日問答上限（3次）囉！', 'remaining': 0})

        chat_count += 1
        request.session['chat_count'] = chat_count
        remaining = 3 - chat_count

        # 3次有問有答暖心台詞
        ai_reply = ""
        if chat_count == 1:
            ai_reply = "聽起來今天過得很開心呢！可以再跟我說說，你最喜歡照片裡的哪個部分嗎？"
        elif chat_count == 2:
            ai_reply = "原來是和孫子一起去公園呀，那你們當時有做什麼有趣的事情嗎？"
        elif chat_count == 3:
            ai_reply = "這真是很溫暖的回憶，今天這件事讓你心情如何呢？"

        return JsonResponse({'status': 'success', 'reply': ai_reply, 'chat_count': chat_count, 'remaining': remaining})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})


# 錄音頁
def voice_page(request):
    return render(request, "voice.html")


def finish_page(request):
    request.session['chat_count'] = 0  

    diary_id = request.GET.get('diary_id')
    diary = None
    if diary_id:
        diary = get_object_or_404(DiaryEntry, id=diary_id)

    return render(request, 'finish.html', {
        'diary': diary
    })

# 動態回顧頁
def review_page(request):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    try:
        last_year_day = today.replace(year=today.year - 1)
    except ValueError:
        last_year_day = today.replace(year=today.year - 1, day=28)

    yesterday_entries = DiaryEntry.objects.filter(
        created_at__date=yesterday
    ).order_by("-created_at")

    lastyear_entries = DiaryEntry.objects.filter(
        created_at__date=last_year_day
    ).order_by("-created_at")

    def entry_to_dict(entry, tag):
        return {
            "date": entry.created_at.strftime("%Y年%m月%d日"),
            "tag": tag,
            "transcript": entry.transcription or "尚無語音轉譯內容",
            "photo": entry.photo.url if entry.photo else None,
            "ai_response": entry.ai_response or "",
            "status": entry.status,
        }

    review_data = {
        "yesterday": [
            entry_to_dict(entry, "昨天") for entry in yesterday_entries
        ],
        "lastyear": [
            entry_to_dict(entry, "去年的今天") for entry in lastyear_entries
        ],
    }

    return render(request, "review.html", {
        "review_data_json": json.dumps(review_data, cls=DjangoJSONEncoder),
    })

#儲存日記內容
def save_diary(request):
    if request.method == "POST":
        photo = request.FILES.get("photo")

        diary = DiaryEntry.objects.create(
            user=request.user if request.user.is_authenticated else None,
            photo=photo,
            status=DiaryEntry.Status.PENDING,
        )

        return redirect(f"/voice/?diary_id={diary.id}")

    return redirect("upload_photo")

#儲存日記錄音
def update_diary_audio(request):
    if request.method == "POST":
        diary_id = request.POST.get("diary_id")
        audio_file = request.FILES.get("audio_file")

        diary = get_object_or_404(DiaryEntry, id=diary_id)

        if not audio_file:
            return JsonResponse({
                "success": False,
                "error": "沒有收到錄音檔"
            }, status=400)

        try:
            diary.audio_file = audio_file
            diary.status = DiaryEntry.Status.PROCESSING
            diary.save()

            model = whisper.load_model("base")
            result = model.transcribe(
                diary.audio_file.path,
                language="zh"
            )

            transcription = result.get("text", "").strip()

            diary.transcription = transcription
            diary.diary_text = transcription

            if not diary.title and transcription:
                diary.title = transcription[:20]

            diary.status = DiaryEntry.Status.DONE
            diary.save()

            return JsonResponse({
                "success": True,
                "diary_id": diary.id,
                "transcription": transcription,
                "redirect_url": "/finish/"
            })

        except Exception as e:
            diary.status = DiaryEntry.Status.FAILED
            diary.save(update_fields=["status"])

            return JsonResponse({
                "success": False,
                "error": str(e)
            }, status=500)

    return JsonResponse({
        "success": False,
        "error": "只接受 POST"
    }, status=405)


# 共用元件
def header_partial(request):
    return render(request, "header.html")

def headerback_partial(request):
    return render(request, "headerback.html")

def nav_partial(request):
    return render(request, "nav.html")