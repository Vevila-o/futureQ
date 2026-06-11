from django.shortcuts import render

# Create your views here.


# 聲影日記首頁
def voiceIndex(request):
    return render(request, "index.html", {
        "session_state_json": "{}",
    })

# 上傳照片(僅測試尚未完成程式碼)
def upload_photo(request):
    pass
