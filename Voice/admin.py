from django.contrib import admin
from .models import User,DiaryEntry, CognitiveAnalysis, AiConversation
from django.contrib.auth.admin import UserAdmin


# 使用者(延伸註冊)
class UserAppend(UserAdmin):
  list_display = UserAdmin.list_display + ('gender', 'userbirth')
  fieldsets = UserAdmin.fieldsets + (
      (None, {
          "fields": (
              ("gender", "userbirth")
          ),
      }),
  )
admin.site.register(User,UserAppend)  


# 聲影日記主表
class DiaryEntryAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'photo',
        'audio_file',
        'transcription',
        'diary_text',
        'status',
        'created_at',
        'updated_at',
    )

    list_filter = (
        'status',
        'created_at',
    )

    search_fields = (
        'transcription',
        'diary_text',
        'ai_response',
    )

    ordering = (
        '-created_at',
    )

admin.site.register(DiaryEntry, DiaryEntryAdmin)

# 認知分析結果
class CognitiveAnalysisAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'diary',
        'fluency_score',
        'information_score',
        'sentence_score',
        'naming_score',
        'semantic_score',
        'communication_score',
        'total_score',
        'average_score',
        'risk_level',
        'analyzed_at',
    )

    list_filter = (
        'risk_level',
    )

    ordering = (
        '-analyzed_at',
    )

admin.site.register(CognitiveAnalysis, CognitiveAnalysisAdmin)


# AI 追問對話
class AiConversationAdmin(admin.ModelAdmin):
    list_display  = ('id', 'diary', 'round_count', 'is_finished', 'created_at', 'updated_at',)
    list_filter   = ('is_finished',)
    ordering      = ('-created_at',)

admin.site.register(AiConversation, AiConversationAdmin)
