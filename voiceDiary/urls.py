"""
URL configuration for voiceDiary project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from Voice import views
from Voice import views as voice_views
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),

    # 頁面
    path('index/', voice_views.voiceIndex, name="index"),
    path('dashboard/', voice_views.dashboard, name='dashboard'),
    path('uploadPhoto/', voice_views.upload_photo, name='upload_photo'),
    path('member/', voice_views.member_page, name='member_page'),
    path('loading/', voice_views.loading_page, name='loading_page'),
    path('voice/', voice_views.voice_page, name='voice_page'),
    path('finish/', voice_views.finish_page, name='finish_page'),
    path('review/', voice_views.review_page, name='review_page'),
    # path('api/ai-chat/', voice_views.ai_chat_api, name='ai_chat_api'), 

    # 儲存聲影日記
    path('saveDiary/', voice_views.save_diary, name='save_diary'),
    path('updateDiaryAudio/', voice_views.update_diary_audio, name='update_diary_audio'),
    
    # 三次對話
    path('api/ai-first-question/', voice_views.ai_firstQ, name='ai_firstQ'), # 第一次對話
    path('api/upload-chat-voice/', voice_views.upload_chat_voice, name='upload_chat_voice'),

    # 共用元件
    path('header/', voice_views.header_partial, name='header_partial'),
    path('headerback/', voice_views.headerback_partial, name='headerback_partial'),
    path('nav/', voice_views.nav_partial, name='nav_partial'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)