
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

# Header 共用元件
def header_partial(request):
    return render(request, "header.html")


# 有返回鍵的 Header 共用元件
def headerback_partial(request):
    return render(request, "headerback.html")


# 底部導覽列共用元件
def nav_partial(request):
    return render(request, "nav.html")

# 聲影日記首頁
def voiceIndex(request):
    today = timezone.localdate()

    # 先抓目前這個月的日記
    entries = DiaryEntry.objects.filter(
        created_at__year=today.year,
        created_at__month=today.month,
    ).order_by("created_at")

    calendar_entries = []

    for entry in entries:
        calendar_entries.append({
            "id": entry.id,
            "date": entry.created_at.strftime("%Y-%m-%d"),
            "day": entry.created_at.day,
            "title": entry.title or "未命名日記",
            "transcript": entry.transcription or "尚無語音轉譯內容",
            "photo": entry.photo.url if entry.photo else None,
            "ai_response": entry.ai_response or "",
            "status": entry.status,
        })

    return render(request, "index.html", {
        "session_state_json": "{}",
        "calendar_data_json": json.dumps(calendar_entries, cls=DjangoJSONEncoder),
    })

# 上傳照片頁
def upload_photo(request):
    return render(request, "photo.html")

# ====================================================================
# ✨ 以下是你負責新增的 AI 三次對話限制功能（已經完美與原本的 views 融為一體）
# ====================================================================

@csrf_exempt
def ai_chat_api(request):
    """
    處理長輩與 AI 助手的對話 API，透過 session 限制最多 3 次
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_message = data.get('message', '')

            # 1. 取得目前的聊天次數，預設為 0
            chat_count = request.session.get('chat_count', 0)

            # 2. 檢查是否已滿 3 次
            if chat_count >= 3:
                return JsonResponse({
                    'status': 'error',
                    'message': '已經達到今日問答上限（3次）囉！',
                    'remaining': 0
                })

            # 3. 【AI 回覆邏輯】
            # 先用模擬字串回覆，之後開會定案大模型後，你可以在這裡串接真實 API 呼叫
            ai_reply = f"聽起來真棒！關於『{user_message}』，您可以多跟我說一點細節嗎？"

            # 4. 次數加 1，更新回 session 儲存
            chat_count += 1
            request.session['chat_count'] = chat_count
            remaining = 3 - chat_count

            return JsonResponse({
                'status': 'success',
                'reply': ai_reply,
                'chat_count': chat_count,
                'remaining': remaining
            })

        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)})
            
    return JsonResponse({'status': 'error', 'message': '只接受 POST 請求'})


def finish_page(request):
    """
    當長輩進到完成頁面時，自動重置次數為 0，讓他們可以重新聊 3 次
    """
    request.session['chat_count'] = 0  
    return render(request, 'finish.html')


# 錄音頁
def voice_page(request):
    return render(request, "voice.html")


# 完成頁
def finish_page(request):
    return render(request, "finish.html")


# 動態回顧頁
def review_page(request):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    # 避免 2/29 去年不存在的錯誤
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

        print("FILES =", request.FILES)
        print("收到的 photo =", photo)

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

        print("收到 diary_id =", diary_id)
        print("收到 audio_file =", audio_file)

        diary = get_object_or_404(DiaryEntry, id=diary_id)

        if not audio_file:
            return JsonResponse({
                "success": False,
                "error": "沒有收到錄音檔"
            }, status=400)

        try:
            # 1. 先存錄音檔
            diary.audio_file = audio_file
            diary.status = DiaryEntry.Status.PROCESSING
            diary.save()

            print("音檔已儲存，路徑 =", diary.audio_file.path)

            # 2. Whisper 轉文字
            model = whisper.load_model("base")
            result = model.transcribe(
                diary.audio_file.path,
                language="zh"
            )

            transcription = result.get("text", "").strip()
            print("Whisper 轉文字結果 =", transcription)

            # 3. 存轉文字結果
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

            print("Whisper 錯誤 =", e)

            return JsonResponse({
                "success": False,
                "error": str(e)
            }, status=500)

    return JsonResponse({
        "success": False,
        "error": "只接受 POST"
    }, status=405)
