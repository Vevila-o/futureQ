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

    # 登入 / 登出
    path('', voice_views.login_view, name='login_root'),
    path('login/', voice_views.login_view, name='login_view'),
    path('logout/', voice_views.logout_view, name='logout_view'),

    # 頁面
    path('index/', voice_views.voiceIndex, name="index"),
    path('dashboard/', voice_views.dashboard, name='dashboard'),
    path('uploadPhoto/', voice_views.upload_photo, name='upload_photo'),
    path('member/', voice_views.member_page, name='member_page'),
    path('loading/', voice_views.loading_page, name='loading_page'),
    path('voice/', voice_views.voice_page, name='voice_page'),
    path('finish/', voice_views.finish_page, name='finish_page'),
    path('review/', voice_views.review_page, name='review_page'),
    path('share/', voice_views.share_page, name='share_page'),
    path('game/', voice_views.game_page, name='game_page'),
    path('market/', voice_views.market_page, name='market_page'),
    
    # 🌟 成功接通！成就頁面的路徑
    path('achievements/', voice_views.achievements_page, name='achievements_page'),
    
    path('api/save-game-result/', voice_views.save_game_result, name='save_game_result'),
    path('community/', voice_views.community_page, name='community_page'),
    # path('api/ai-chat/', voice_views.ai_chat_api, name='ai_chat_api'),

    # 儲存聲影日記
    path('saveDiary/', voice_views.save_diary, name='save_diary'),
    path('updateDiaryAudio/', voice_views.update_diary_audio, name='update_diary_audio'),
    
    # 三次對話
    path('api/ai-first-question/', voice_views.ai_firstQ, name='ai_firstQ'),
    path('api/upload-chat-voice/', voice_views.upload_chat_voice, name='upload_chat_voice'),
    path('api/voice-reply/', voice_views.api_voice_reply, name='api_voice_reply'),
    path('api/voice-reply/<int:reply_id>/transcribe/', voice_views.api_voice_reply_transcribe, name='api_voice_reply_transcribe'),

    # 共用元件
    path('header/', voice_views.header_partial, name='header_partial'),
    path('headerback/', voice_views.headerback_partial, name='headerback_partial'),
    path('nav/', voice_views.nav_partial, name='nav_partial'),

    #點數商城
    path('shop/', voice_views.shop_page, name='shop_page'),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)