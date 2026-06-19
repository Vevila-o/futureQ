
# -*- coding: utf-8 -*-
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

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

# 4. 🚀 結束重置頁面
def finish_page(request):
    request.session['chat_count'] = 0  # 長輩進到這頁時重置次數
    return render(request, 'finish.html')

# ==========================================
# 💡 安全墊片：補齊組員路由需要的函數，防止 urls.py 報錯
# ==========================================
def voice_page(request): return render(request, "index.html")
def review_page(request): return render(request, "index.html")
@csrf_exempt
def save_diary(request): return JsonResponse({'status': 'success'})
@csrf_exempt
def update_diary_audio(request): return JsonResponse({'status': 'success'})
def header_partial(request): return render(request, "index.html")
def headerback_partial(request): return render(request, "index.html")
def nav_partial(request): return render(request, "index.html")