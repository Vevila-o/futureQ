from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

# 聲影日記首頁
def voiceIndex(request):
    return render(request, "index.html", {
        "session_state_json": "{}",
    })  

# 上傳照片(僅測試尚未完成程式碼)
def upload_photo(request):
    pass

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