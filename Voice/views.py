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
import os
from django.conf import settings

# 🌐 ✨ 引入 OpenAI 官方庫
from openai import OpenAI

# 1. 聲影日記首頁
def voiceIndex(request):
    today = timezone.localdate()

    # 查詢所有日記 (讓前端月曆能自由切換月份並看到資料)
    entries = DiaryEntry.objects.all().order_by("created_at")

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

    return render(request, "index.html", {
        "calendar_entries": calendar_entries,
        "calendar_data_json": json.dumps(
            calendar_entries,
            cls=DjangoJSONEncoder,
            ensure_ascii=False,
        ),
        "current_year": today.year,
        "current_month": today.month,
        "session_state_json": "{}",
    })
    
# 上傳照片頁
def upload_photo(request):
    return render(request, "photo.html")

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


# 🎙️ ✨ 終極升級完全體：接收聊天室真實語音 ➡️ Whisper 轉文字 ➡️ OpenAI 智慧溫暖且籠統的回應
@csrf_exempt
def upload_chat_voice(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': '只接受 POST 請求'})
        
    # 檢查對話次數防線
    chat_count = request.session.get('chat_count', 0)
    if chat_count >= 3:
        return JsonResponse({'status': 'error', 'message': '已經達到今日問答上限（3次）囉！', 'remaining': 0})
        
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

        if not whisper_text:
            return JsonResponse({'status': 'error', 'message': '沒聽清楚，請再大聲說一次喔！'})


        # === 階段二：呼叫 OpenAI 進行智慧溫暖且籠統的回覆生成 ===
        # 🟢 為了順利 Git Push 通關，這裡故意留空！
        api_key = ""
        base_url = "https://api.openai.com/v1"
        
        # 後端安全防呆
        if not api_key:
            return JsonResponse({'status': 'error', 'message': '後端尚未配置金鑰，請組長或組員手動在 views.py 填入！'})
        
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
            model="gpt-4o-mini", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": whisper_text}
            ],
            max_tokens=150,
            temperature=0.7
        )
        
        # 成功拿到大腦動態生成的精緻回應
        ai_reply = response.choices[0].message.content.strip()


        # === 階段三：推進問答階段與扣除次數 ===
        chat_count += 1
        request.session['chat_count'] = chat_count
        remaining = 3 - chat_count

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

            # === 進行語言表達認知分析並儲存結果 ===
            from Voice.utils import analyze_transcription
            from .models import CognitiveAnalysis
            
            try:
                analysis_result = analyze_transcription(transcription)
                CognitiveAnalysis.objects.create(
                    diary=diary,
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
    from datetime import date
    
    User = get_user_model()
    # 獲取當前登入者，若未登入，尋找 demo_elder 或第一個使用者
    target_user = request.user if request.user.is_authenticated else User.objects.filter(username="demo_elder").first()
    if not target_user:
        target_user = User.objects.first()
        
    # 查詢與 target_user 關聯的日記認知分析，必須連續7天都有資料才進行分析
    analyses = CognitiveAnalysis.objects.none()
    has_week_data = False
    if target_user:
        latest_analysis = CognitiveAnalysis.objects.filter(
            diary__user=target_user
        ).order_by('-diary__created_at').first()
        
        if latest_analysis:
            latest_date = timezone.localtime(latest_analysis.diary.created_at).date()
            consecutive_days = [latest_date - timedelta(days=i) for i in range(7)]
            
            # 檢查這連續 7 天是否每天都有至少一筆日記分析資料
            has_all_7_days = True
            for day in consecutive_days:
                if not CognitiveAnalysis.objects.filter(
                    diary__user=target_user,
                    diary__created_at__date=day
                ).exists():
                    has_all_7_days = False
                    break
            
            if has_all_7_days:
                has_week_data = True
                analyses = CognitiveAnalysis.objects.filter(
                    diary__user=target_user,
                    diary__created_at__date__in=consecutive_days
                )
            else:
                has_week_data = False
                
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
        
    # 計算腦年齡
    actual_age = 78
    if target_user and target_user.userbirth:
        birth = target_user.userbirth
        today = date.today()
        actual_age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        
    # 根據認知表現估算健康狀態與腦年齡
    from Voice.utils import get_risk_result
    
    risk_info = get_risk_result(total_score_avg)
    risk_level = risk_info["risk_level"]
    health_message = risk_info["suggestion"]
    
    if risk_level == "low":
        health_status = "健康"
        brain_age = max(45, actual_age - 5)
    elif risk_level == "medium":
        health_status = "中等"
        brain_age = actual_age + 2
    else:
        health_status = "須注意"
        brain_age = actual_age + 8

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
        "brain_age": brain_age,
        "health_status": health_status,
        "health_message": health_message,
    }
    
    return render(request, "dashboard.html", context)


# 共用元件
def header_partial(request):
    return render(request, "header.html")

def headerback_partial(request):
    return render(request, "headerback.html")

def nav_partial(request):
    return render(request, "nav.html")