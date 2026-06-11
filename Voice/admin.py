from django.contrib import admin
from .models import User, DiaryEntry, CognitiveAnalysis, AiConversation
# Register your models here.

admin.site.register(User)
admin.site.register(DiaryEntry)
admin.site.register(CognitiveAnalysis)
admin.site.register(AiConversation)