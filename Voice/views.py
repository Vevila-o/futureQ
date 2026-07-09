from django.views.decorators.csrf import csrf_exempt
import json
from datetime import timedelta
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from .models import DiaryEntry, AiConversation, GameSession, VoiceReply, Diarypost
from django.contrib.auth import get_user_model, authenticate, login, logout
from django.db.models import Max
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.files.base import ContentFile
from django.http import JsonResponse
import whisper
import os
import subprocess
import tempfile
from django.conf import settings
# 🌐 ✨ 引入 OpenAI 官方庫
from openai import OpenAI

# 登入頁
def login_view(request):
    next_url = request.POST.get('next') or request.GET.get('next') or '/index/'

    if request.user.is_authenticated:
        return redirect(next_url)

    error = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect(next_url)
        error = '帳號或密碼錯誤，請再試一次'

    return render(request, 'login.html', {
        'error': error,
        'next': next_url,
    })


# 登出
def logout_view(request):
    logout(request)
    return redirect('login_view')


# 1. 聲影日記首頁
def voiceIndex(request):
    today = timezone.localdate()

    User = get_user_model()
    target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if not target_user:
        target_user = User.objects.first()

    # 查詢目前月份的日記（只查自己的）
    entries = DiaryEntry.objects.filter(
        user=target_user,
        created_at__year=today.year,
        created_at__month=today.month,
    ).order_by("created_at")

    calendar_entries = []

    for entry in entries:
        created_at = timezone.localtime(entry.created_at)

        calendar_entries.append({
            "id": entry.id,
            "date": created_at.strftime("%Y-%m-%d"),
            "day": created_at.day,
            "title": entry.title or "聲影日記",
            "transcript": (
                entry.transcription
                or entry.diary_text
                or "尚無語音轉譯內容"
            ),
            "photo": entry.photo.url if entry.photo else "",
            "audio": entry.audio_file.url if entry.audio_file else "",
            "status": entry.status,
        })

    # 暫時加入，確認後端是否真的查到資料
    print("目前日期：", today)
    print("本月日記數量：", entries.count())
    print("月曆資料：", calendar_entries)

    has_today_diary = DiaryEntry.objects.filter(
        user=target_user,
        created_at__date=today,
        status="done",
    ).exists()

    return render(request, "index.html", {
        "calendar_entries": calendar_entries,
        "calendar_data_json": json.dumps(
            calendar_entries,
            cls=DjangoJSONEncoder,
            ensure_ascii=False,
        ),
        "current_year": today.year,
        "current_month": today.month,
        "has_today_diary": has_today_diary,
        "session_state_json": "{}",
    })
    
# 上傳照片頁
def upload_photo(request):
    return render(request, "photo.html")

# 核心問答 3 次限制
@csrf_exempt
    # 第一次 
def ai_firstQ(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': '只接受 POST'})
    
    data = json.loads(request.body)
    diary_id = data.get('diary_id')
    if not diary_id:
        return JsonResponse({'status': 'error', 'message': 'diary_id 缺失'})
    diary = get_object_or_404(DiaryEntry, pk=diary_id)
    
    conv = getattr(diary, 'ai_conversation', None)

    # 已有對話紀錄，直接回傳全部訊息讓前端重建
    if conv and conv.messages:
        status = 'finished' if conv.is_finished else 'success'
        return JsonResponse({
            'status': status,
            'messages': conv.messages,
            'remaining': AiConversation.MAX_ROUNDS - conv.round_count,
        })
    
    transcription = diary.transcription or ""
    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
        system_prompt = ("你是一位溫暖的長輩聊天夥伴，根據長輩的日記內容，提出一個簡短有溫度的延伸問題（30字以內），讓他繼續分享。只回問題本身，不要其他說明。")

        res = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content":system_prompt },
                {"role": "user", "content": transcription}
            ],
            max_tokens=60,
            temperature=0.8
        )
        question = res.choices[0].message.content.strip()
    except Exception as e:
        print(f"AI 首問生成失敗: {e}")
        question = "今天這段經歷，讓你印象最深刻的是什麼呢？"
        
    conv, _ = AiConversation.objects.get_or_create(diary = diary)
    conv.messages = [{"role": "assistant", "content": question}]
    conv.round_count = 0
    conv.is_finished = False
    conv.save()

    return JsonResponse({'status': 'success', 'question': question, 'remaining': 3})



# 🎙️ ✨ 終極升級完全體：接收聊天室真實語音 ➡️ Whisper 轉文字 ➡️ OpenAI 智慧溫暖且籠統的回應
@csrf_exempt
def upload_chat_voice(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': '只接受 POST 請求'})
    
    audio_file = request.FILES.get('audio_data') # 接收前端錄音包
    if not audio_file:
        return JsonResponse({'status': 'error', 'message': '沒有收到錄音檔'})

    try:
        # === 階段一：呼叫 Whisper 進行語音轉文字 ===
        model = whisper.load_model("base")
        
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        temp_path = os.path.join(settings.MEDIA_ROOT, 'temp_chat_audio.wav')
        
        with open(temp_path, 'wb+') as destination:
            for chunk in audio_file.chunks():
                destination.write(chunk)
        
        # 🏆 在 VS Code 終端機印出大小，方便即時肉眼驗收是否有成功收到聲音
        print(f"=== 🎙️ 後端成功收到語音！音檔實體大小: {os.path.getsize(temp_path)} bytes ===")
        
        # 餵給 Whisper 辨識
        result = model.transcribe(temp_path, language="zh")
        whisper_text = result.get("text", "").strip()
        
        # 辨識完成後，立刻清理移除硬碟中的暫存檔
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        diary_id = request.POST.get('diary_id')
        diary = get_object_or_404(DiaryEntry, pk=diary_id) if diary_id else None
        conv = getattr(diary, 'ai_conversation', None) if diary else None

        if conv and conv.round_count >= AiConversation.MAX_ROUNDS:
            return JsonResponse({'status': 'error', 'message': '已達對話上限', 'remaining': 0})

        if not whisper_text:
            return JsonResponse({'status': 'error', 'message': '沒聽清楚，請再大聲說一次喔！'})


        # === 階段二：呼叫 OpenAI 進行智慧溫暖且籠統的回覆生成 ===
        api_key = settings.OPENAI_API_KEY
        base_url = settings.OPENAI_BASE_URL

        # 後端安全防呆
        if not api_key:
            return JsonResponse({'status': 'error', 'message': 'OPENAI_API_KEY 尚未在 .env 設定'})

        # 初始化 OpenAI 客戶端
        client = OpenAI(api_key=api_key, base_url=base_url)
        
        # 🧠 核心 Prompt 咒語設定：控管 AI 必須給出溫暖、精簡、籠統且帶有小追問的回應
        system_prompt = (
            "你是一位溫慢、有耐心、專門陪伴高齡長輩的 AI 聊天助手。現在長輩剛剛錄製完一段生活日記，並對你說了一句話。\n"
            "請遵守以下鐵律進行回覆：\n"
            "1. 根據長輩說的話，給出一句非常溫暖、正面肯定、讚美長輩的籠統回應（例如：聽起來真的很棒、能這樣真幸福、你記性真好）。\n"
            "2. 回應必須非常簡短精簡（嚴格限制在 35 個字以內），語氣要像體貼的晚輩或老朋友。\n"
            "3. 絕對不要給出嚴肅的醫療或生活建議，不要長篇大論。\n"
            "4. 在回覆的最後，請順著話題拋出一個極度簡單、沒有強迫感、好回答的「開放式小問題」，引導長輩繼續分享（例如：那當時還有誰在一起呀？、那後來呢？）。"
        )
        
        # 呼叫大模型（自動校正為官方標準的小模型名稱 gpt-4o-mini）
        response = client.chat.completions.create(
            model= settings.OPENAI_MODEL, 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": whisper_text}
            ],
            max_tokens=150,
            temperature=0.7
        )
        
        # 生成回應
        ai_reply = response.choices[0].message.content.strip()
        
        # 存入 AiConversation
        remaining = 0
        if conv:
            msgs = list(conv.messages)
            msgs.append({"role": "user", "content": whisper_text})
            msgs.append({"role": "assistant", "content": ai_reply})
            conv.messages = msgs
            conv.round_count += 1
            if conv.round_count >= AiConversation.MAX_ROUNDS:
                conv.is_finished = True
            conv.save()
            remaining = AiConversation.MAX_ROUNDS - conv.round_count
            

        # 回傳轉好的真實文字 (user_text) 與 AI 的智慧對答
        return JsonResponse({
            'status': 'success', 
            'user_text': whisper_text, 
            'reply': ai_reply,         
            'remaining': remaining
        })

    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return JsonResponse({'status': 'error', 'message': str(e)})


# 會員頁
def member_page(request):
    User = get_user_model()
    user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if not user:
        user = User.objects.first()

    diary_count = DiaryEntry.objects.filter(user=user).count() if user else 0

    # 計算連續記錄天數（今天還沒寫但昨天有寫，仍算連續）
    streak_days = 0
    if user:
        today = timezone.localdate()
        check = today
        if not DiaryEntry.objects.filter(user=user, created_at__date=check, status="done").exists():
            check = today - timedelta(days=1)
        while DiaryEntry.objects.filter(user=user, created_at__date=check, status="done").exists():
            streak_days += 1
            check -= timedelta(days=1)

    gender_map = {"male": "男", "female": "女", "other": "其他"}

    ctx = {
        "user": user,
        "display_name": (user.get_full_name() or user.username) if user else "未登入",
        "join_date": user.date_joined.strftime("%Y 年 %m 月") if user else "—",
        "birth_date": user.userbirth.strftime("%Y / %m / %d") if user and user.userbirth else "尚未設定",
        "gender_display": gender_map.get(user.gender, user.gender or "尚未設定") if user else "—",
        "diary_count": diary_count,
        "streak_days": streak_days,
    }
    return render(request, "member.html", ctx)


# loading 過場頁
def loading_page(request):
    return render(request, "loading.html")


def _compute_streak_days(user):
    if not user:
        return 0
    streak_days = 0
    today = timezone.localdate()
    check = today
    if not DiaryEntry.objects.filter(user=user, created_at__date=check, status="done").exists():
        check = today - timedelta(days=1)
    while DiaryEntry.objects.filter(user=user, created_at__date=check, status="done").exists():
        streak_days += 1
        check -= timedelta(days=1)
    return streak_days


def _classify_diary_category(client, text):
    category_labels = dict(Diarypost.Category.choices)  # {"food": "食", ...}

    try:
        cat_res = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "請把以下日記內容歸類到「食、衣、住、行、育、樂」六個分類中最符合的一個，只回一個字（食/衣/住/行/育/樂），不要其他說明。"},
                {"role": "user", "content": text}
            ],
            max_tokens=5,
            temperature=0.3
        )
        label = cat_res.choices[0].message.content.strip()
        for value, display in category_labels.items():
            if display in label:
                return value
    except Exception as e:
        print(f"貼文分類 AI 生成失敗: {e}")

    return ""


def _generate_share_content(diary):
    first_person_text = diary.transcription or ""
    hashtags = ["#聲影日記", "#每日記錄", "#長者生活"]
    category = ""

    try:
        if settings.OPENAI_API_KEY and diary.transcription:
            client = OpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)

            fp_res = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "請將以下日記內容改寫成第一人稱、溫暖自然的短文（50字以內），保留主要事件。只回改寫後的文字。"},
                    {"role": "user", "content": diary.transcription}
                ],
                max_tokens=80,
                temperature=0.7
            )
            first_person_text = fp_res.choices[0].message.content.strip()

            tag_res = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "根據以下日記內容，生成 3 個中文 hashtag（含 # 號，用空格分隔），適合社群分享。只回 hashtag，不要其他說明。"},
                    {"role": "user", "content": diary.transcription}
                ],
                max_tokens=30,
                temperature=0.7
            )
            hashtags = tag_res.choices[0].message.content.strip().split()[:3]

            category = _classify_diary_category(client, diary.transcription)
    except Exception as e:
        print(f"分享內容 AI 生成失敗: {e}")

    if diary.transcription:
        Diarypost.objects.update_or_create(
            diary_title=diary,
            defaults={
                "user": diary.user,
                "post": first_person_text,
                "category": category,
            },
        )

    return first_person_text, hashtags


# 分享頁
def share_page(request):
    diary_id = request.GET.get('diary_id')
    diary = get_object_or_404(DiaryEntry, pk=diary_id)

    streak_days = _compute_streak_days(diary.user)
    first_person_text, hashtags = _generate_share_content(diary)

    card_post = diary.diary_posts.first()
    card_image_url = card_post.card_image.url if card_post and card_post.card_image else ""

    is_preview = request.GET.get('preview') == '1'

    return render(request, "share.html", {
        "diary": diary,
        "first_person_text": first_person_text,
        "hashtags": hashtags,
        "streak_days": streak_days,
        "card_image_url": card_image_url,
        "is_preview": is_preview,
    })


# 儲存分享卡片截圖（finish 頁按下分享時，前端用 html2canvas 產生後上傳）
@csrf_exempt
def save_share_card_image(request):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "只接受 POST"}, status=405)

    diary_id = request.POST.get("diary_id")
    image_file = request.FILES.get("card_image")
    if not diary_id or not image_file:
        return JsonResponse({"status": "error", "message": "缺少 diary_id 或圖片"}, status=400)

    diary = get_object_or_404(DiaryEntry, pk=diary_id)
    post, _ = Diarypost.objects.get_or_create(diary_title=diary, defaults={"user": diary.user})
    post.card_image = image_file
    post.save(update_fields=["card_image"])

    return JsonResponse({"status": "ok", "card_image_url": post.card_image.url})


# 錄音頁
def voice_page(request):
    return render(request, "voice.html")


def finish_page(request):
    request.session['chat_count'] = 0

    diary_id = request.GET.get('diary_id')
    diary = None
    first_person_text = ""
    hashtags = []
    if diary_id:
        diary = get_object_or_404(DiaryEntry, id=diary_id)
        first_person_text, hashtags = _generate_share_content(diary)

    return render(request, 'finish.html', {
        'diary': diary,
        'first_person_text': first_person_text,
        'hashtags': hashtags,
    })

# 動態回顧頁
def review_page(request):
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    try:
        last_year_day = today.replace(year=today.year - 1)
    except ValueError:
        last_year_day = today.replace(year=today.year - 1, day=28)

    User = get_user_model()
    target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if not target_user:
        target_user = User.objects.first()

    yesterday_entries = DiaryEntry.objects.filter(
        user=target_user,
        created_at__date=yesterday
    ).order_by("-created_at")

    lastyear_entries = DiaryEntry.objects.filter(
        user=target_user,
        created_at__date=last_year_day
    ).order_by("-created_at")

    def entry_to_dict(entry, tag):
        return {
            "date": entry.created_at.strftime("%Y年%m月%d日"),
            "tag": tag,
            "transcript": entry.transcription or "尚無語音轉譯內容",
            "photo": entry.photo.url if entry.photo else None,
            "audio": entry.audio_file.url if entry.audio_file else None,
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

def _convert_audio_to_mp3(uploaded_file):
    """把上傳的錄音（webm 等）轉成 mp3；iOS 對 webm 播放支援不完整。轉檔失敗回傳 None。"""
    uploaded_file.seek(0)
    suffix = os.path.splitext(uploaded_file.name or "")[1] or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as src:
        for chunk in uploaded_file.chunks():
            src.write(chunk)
        src_path = src.name

    dst_path = src_path + ".mp3"
    mp3_bytes = None
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", src_path, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", dst_path],
            check=True,
            capture_output=True,
        )
        with open(dst_path, "rb") as f:
            mp3_bytes = f.read()
    except Exception as e:
        print(f"音檔轉換 mp3 失敗: {e}")
    finally:
        if os.path.exists(src_path):
            os.remove(src_path)
        if os.path.exists(dst_path):
            os.remove(dst_path)
        uploaded_file.seek(0)

    return ContentFile(mp3_bytes) if mp3_bytes else None


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
            mp3_file = _convert_audio_to_mp3(audio_file)
            if mp3_file:
                diary.audio_file.save("diary_audio.mp3", mp3_file, save=False)
            else:
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

            # AI 生成標題 + 溫暖回應（共用同一個 client）
            try:
                api_key = settings.OPENAI_API_KEY
                if api_key and transcription:
                    client = OpenAI(api_key=api_key, base_url=settings.OPENAI_BASE_URL)

                    # 標題（10字以內）
                    title_res = client.chat.completions.create(
                        model=settings.OPENAI_MODEL,
                        messages=[
                            {"role": "system", "content": "請用10個字以內為這段日記取一個活潑有趣的標題，可以加上一個表情符號。只回標題，不要其他說明。"},
                            {"role": "user", "content": transcription}
                        ],
                        max_tokens=30,
                        temperature=0.9
                    )
                    diary.title = title_res.choices[0].message.content.strip()

                    # 溫暖回應（100字以內）
                    response = client.chat.completions.create(
                        model=settings.OPENAI_MODEL,
                        messages=[
                            {"role": "system", "content": "你是一位溫暖的長輩聊天夥伴，請根據長輩說的這段日記，做溫暖的摘要，嚴格限制 100 字以內。"},
                            {"role": "user", "content": transcription}
                        ],
                        max_tokens=100,
                        temperature=0.7
                    )
                    diary.ai_response = response.choices[0].message.content.strip()
            except Exception as ai_err:
                print(f"AI 生成失敗: {ai_err}")
                if not diary.title:
                    diary.title = transcription[:10]
                

            diary.status = DiaryEntry.Status.DONE
            diary.save()

            # === 進行語言表達認知分析並儲存結果 ===
            from Voice.utils import analyze_transcription, assess_sample_quality
            from .models import CognitiveAnalysis

            try:
                quality = assess_sample_quality(transcription, whisper_result=result)

                if quality != "ok":
                    # 空白錄音、雜音或 Whisper 幻覺輸出：記為無效樣本，
                    # 不建立分數，避免被誤判成「高風險」。
                    CognitiveAnalysis.objects.create(
                        diary=diary,
                        is_valid=False,
                        invalid_reason=quality,
                    )
                else:
                    analysis_result = analyze_transcription(transcription)
                    CognitiveAnalysis.objects.create(
                        diary=diary,
                        is_valid=True,
                        fluency_score=analysis_result["fluency_score"],
                        information_score=analysis_result["information_score"],
                        sentence_score=analysis_result["sentence_score"],
                        naming_score=analysis_result["naming_score"],
                        semantic_score=analysis_result["semantic_score"],
                        communication_score=analysis_result["communication_score"],
                        total_score=analysis_result["total_score"],
                        average_score=analysis_result["average_score"],
                        risk_level=analysis_result["risk_level"],
                        suggestion=analysis_result["suggestion"],
                        ai_feedback=analysis_result["ai_feedback"],
                    )
            except Exception as analysis_err:
                print(f"認知能力分析儲存失敗: {analysis_err}")

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

#健康儀表板
def dashboard(request):
    from django.contrib.auth import get_user_model
    from django.db.models import Avg
    from .models import CognitiveAnalysis, DiaryEntry

    User = get_user_model()
    # 獲取當前登入者，若未登入，尋找 demo_elder 或第一個使用者
    target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if not target_user:
        target_user = User.objects.first()
        
    # 計算一周內 (7天內) 的認知分數平均
    one_week_ago = timezone.now() - timedelta(days=7)
    
    # 查詢與 target_user 關聯的日記認知分析
    analyses = CognitiveAnalysis.objects.none()
    has_week_data = False
    if target_user:
        week_analyses = CognitiveAnalysis.objects.filter(
            diary__user=target_user,
            diary__created_at__gte=one_week_ago,
            is_valid=True,
        )
        if week_analyses.exists():
            has_week_data = True
            analyses = week_analyses
        else:
            has_week_data = False
            # 如果一周內沒有資料，則退而求其次抓該使用者的所有分析紀錄
            analyses = CognitiveAnalysis.objects.filter(diary__user=target_user, is_valid=True)
        
    has_data = analyses.exists()
    
    if has_data:
        avg_scores = analyses.aggregate(
            avg_fluency=Avg('fluency_score'),
            avg_information=Avg('information_score'),
            avg_sentence=Avg('sentence_score'),
            avg_naming=Avg('naming_score'),
            avg_semantic=Avg('semantic_score'),
            avg_communication=Avg('communication_score'),
            avg_total=Avg('total_score'),
        )
        scores = {
            "fluency_score": float(avg_scores['avg_fluency'] or 0),
            "information_score": float(avg_scores['avg_information'] or 0),
            "sentence_score": float(avg_scores['avg_sentence'] or 0),
            "naming_score": float(avg_scores['avg_naming'] or 0),
            "semantic_score": float(avg_scores['avg_semantic'] or 0),
            "communication_score": float(avg_scores['avg_communication'] or 0),
        }
        total_score_avg = float(avg_scores['avg_total'] or 0)
    else:
        # 完全無資料時的預設假資料
        scores = {
            "fluency_score": 3.0,
            "information_score": 2.5,
            "sentence_score": 3.2,
            "naming_score": 2.8,
            "semantic_score": 3.0,
            "communication_score": 2.9,
        }
        total_score_avg = sum(scores.values())
        
    # 根據認知表現估算健康狀態建議文字
    from Voice.utils import get_risk_result

    risk_info = get_risk_result(total_score_avg)
    risk_level = risk_info["risk_level"]
    health_message = risk_info["suggestion"]

    if risk_level == "low":
        health_status = "流暢"
    elif risk_level == "medium":
        health_status = "中等"
    else:
        health_status = "須注意"

    # 語言活力指數（LVI）：取代原本沒有醫學依據的「腦年齡」估算。
    # 獨立於上面雷達圖用的 has_data 假資料 fallback，完全沒有真實紀錄時
    # 就老實顯示空狀態，不再用預設假分數湊出一個數字。
    from Voice.utils import calc_lvi, calc_lvi_trend

    recent_qs = CognitiveAnalysis.objects.filter(
        diary__user=target_user,
        diary__created_at__gte=one_week_ago,
        is_valid=True,
    ).order_by("diary__created_at") if target_user else CognitiveAnalysis.objects.none()
    recent_scores = [a.total_score for a in recent_qs]

    if recent_scores:
        current_avg = sum(recent_scores) / len(recent_scores)
        data_source = "recent_7d"
    else:
        all_qs = CognitiveAnalysis.objects.filter(
            diary__user=target_user, is_valid=True
        ).order_by("diary__created_at") if target_user else CognitiveAnalysis.objects.none()
        all_scores = [a.total_score for a in all_qs]
        current_avg = (sum(all_scores) / len(all_scores)) if all_scores else None
        data_source = "all_history" if all_scores else "no_data"

    baseline_qs = CognitiveAnalysis.objects.filter(
        diary__user=target_user,
        diary__created_at__lt=one_week_ago,
        is_valid=True,
    ).order_by("diary__created_at") if target_user else CognitiveAnalysis.objects.none()
    baseline_scores = [a.total_score for a in baseline_qs]

    lvi = calc_lvi(current_avg)
    lvi_trend, lvi_delta = calc_lvi_trend(current_avg, baseline_scores)
    lvi_state = "empty" if data_source == "no_data" else "ok"

    # 雷達圖數據的陣列格式 (流暢度, 資訊量, 句子結構, 命名能力, 語意正確性, 整體溝通能力)
    radar_data = [
        scores["fluency_score"],
        scores["information_score"],
        scores["sentence_score"],
        scores["naming_score"],
        scores["semantic_score"],
        scores["communication_score"],
    ]
    
    context = {
        "has_data": has_data,
        "has_week_data": has_week_data,
        "radar_data_json": json.dumps(radar_data),
        "health_status": health_status,
        "health_message": health_message,
        "lvi_state": lvi_state,
        "lvi": lvi,
        "lvi_trend": lvi_trend,
        "lvi_delta": lvi_delta,
        "data_source": data_source,
    }
    
    return render(request, "dashboard.html", context)

#遊戲首頁
def game_page(request):
    User = get_user_model()
    target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if target_user is None:
        target_user = User.objects.first()

    sessions = GameSession.objects.filter(user=target_user).order_by('-played_at')

    highest_score = sessions.aggregate(Max('score'))['score__max'] or 0
    total_count = sessions.count()

    # 連續天數：從今天往前推算，每天都有至少一筆紀錄才算連續
    played_dates = {timezone.localtime(s.played_at).date() for s in sessions}
    today = timezone.localdate()
    streak_days = 0
    day = today
    while day in played_dates:
        streak_days += 1
        day -= timedelta(days=1)

    recent_records = []
    for s in sessions[:5]:
        played_date = timezone.localtime(s.played_at).date()
        days_ago = (today - played_date).days
        if days_ago == 0:
            date_label = "今天"
        elif days_ago == 1:
            date_label = "昨天"
        else:
            date_label = f"{days_ago} 天前"

        recent_records.append({
            "game_name": s.game_name,
            "date_label": date_label,
            "score": s.score,
        })

    return render(request, 'game.html', {
        "highest_score": highest_score,
        "total_count": total_count,
        "streak_days": streak_days,
        "recent_records": recent_records,
    })

#商城首頁
def market_page(request):
    return render(request, 'market.html')

#儲存遊戲成績（正確率、反應時間、猶豫次數等）
@csrf_exempt
def save_game_result(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    data = json.loads(request.body)

    User = get_user_model()
    target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if target_user is None:
        target_user = User.objects.first()

    session = GameSession.objects.create(
        user=target_user,
        game_name=data.get("game_name", "菜市場"),
        score=data.get("score", 0),
        total_questions=data.get("total_questions", 0),
        accuracy=data.get("accuracy", 0),
        avg_reaction_time=data.get("avg_reaction_time", 0),
        hesitation_count=data.get("hesitation_count", 0),
    )

    return JsonResponse({"success": True, "id": session.id})


# 語音加油 API
@csrf_exempt
def api_voice_reply(request):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "只接受 POST"}, status=405)

    diary_id = request.POST.get("diary_id")
    audio_file = request.FILES.get("audio_file")
    sender_name = (request.POST.get("sender_name", "") or "").strip() or "匿名朋友"

    if not diary_id:
        return JsonResponse({"status": "error", "message": "缺少 diary_id"}, status=400)
    if not audio_file:
        return JsonResponse({"status": "error", "message": "缺少音訊檔"}, status=400)

    diary = get_object_or_404(DiaryEntry, pk=diary_id)
    mp3_file = _convert_audio_to_mp3(audio_file)
    reply = VoiceReply(diary=diary, sender_name=sender_name)
    if mp3_file:
        reply.audio_file.save("voice_reply.mp3", mp3_file, save=False)
    else:
        reply.audio_file = audio_file
    reply.save()

    return JsonResponse({
        "status": "ok",
        "reply_id": reply.id,
        "audio_url": reply.audio_file.url,
        "created_at": reply.created_at.strftime("%Y/%m/%d %H:%M"),
    })


# 語音加油一鍵轉文字
@csrf_exempt
def api_voice_reply_transcribe(request, reply_id):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "只接受 POST"}, status=405)

    reply = get_object_or_404(VoiceReply, pk=reply_id)

    if reply.transcribed_text:
        return JsonResponse({"status": "ok", "text": reply.transcribed_text})

    try:
        model = whisper.load_model("base")
        result = model.transcribe(reply.audio_file.path, language="zh")
        text = result.get("text", "").strip() or "（沒有聽清楚語音內容）"

        reply.transcribed_text = text
        reply.save(update_fields=["transcribed_text"])

        return JsonResponse({"status": "ok", "text": text})
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


# 社群動態頁
def community_page(request):
    User = get_user_model()
    target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if not target_user:
        target_user = User.objects.first()

    entries = DiaryEntry.objects.filter(
        user=target_user,
        status="done"
    ).prefetch_related("voice_replies").order_by("-created_at")[:20]

    diary_list = []
    for entry in entries:
        replies = list(entry.voice_replies.all())
        diary_list.append({
            "id": entry.id,
            "title": entry.title or "聲影日記",
            "photo": entry.photo.url if entry.photo else "",
            "text": (entry.transcription or entry.diary_text or "")[:80],
            "date": entry.created_at.strftime("%Y年%m月%d日"),
            "reply_count": len(replies),
            "replies": [
                {
                    "id": r.id,
                    "sender": r.sender_name,
                    "audio_url": r.audio_file.url,
                    "time": r.created_at.strftime("%m/%d %H:%M"),
                    "transcribed_text": r.transcribed_text,
                }
                for r in replies
            ],
        })

    auto_expand_id = request.GET.get("diary_id", "")

    return render(request, "community.html", {
        "diary_list_json": json.dumps(diary_list, cls=DjangoJSONEncoder, ensure_ascii=False),
        "auto_expand_id": auto_expand_id,
    })


# 共用元件
def header_partial(request):
    return render(request, "header.html")

def headerback_partial(request):
    return render(request, "headerback.html")

def nav_partial(request):
    return render(request, "nav.html")

    # 🌟 成功接通！成就頁面的後端渲染邏輯
def achievements_page(request):
    # 這裡可以算一下解鎖了幾個，我們先預設傳送 3 個過去
    context = {
        'unlocked_achievements_count': 3
    }
    return render(request, 'achievements.html', context)

    # 🌟 成功接通！點數商城的後端渲染邏輯
def shop_page(request):
    # 這裡未來可以從資料庫撈取長輩實際的健康點數，目前我們先預設給 120 點供前端測試
    context = {
        'user_points': 120
    }
    return render(request, 'shop.html', context)