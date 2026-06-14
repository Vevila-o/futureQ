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
from django.urls import path, include
from Voice import views as voice_views

# voice 命名空間（不需要獨立 urls.py）

urlpatterns = [
    path('admin/', admin.site.urls),
    path('index/', voice_views.voiceIndex, name="index"), #首頁
    path('uploadPhoto/',voice_views.upload_photo, name='upload_photo'), #照片上傳
    path('uploadAudio/',voice_views.upload_audio, name='upload_photo'), #語音上傳
]
