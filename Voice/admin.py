from django.contrib import admin
from .models import User,DiaryEntry, CognitiveAnalysis, AiConversation, GameSession,VoiceReply, Diarypost
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
        'is_valid',
        'invalid_reason',
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
        'is_valid',
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


# 大腦訓練遊戲紀錄
class GameSessionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'game_name',
        'score',
        'total_questions',
        'accuracy',
        'avg_reaction_time',
        'hesitation_count',
        'played_at',
    )

    list_filter = (
        'game_name',
        'played_at',
    )

    ordering = (
        '-played_at',
    )

admin.site.register(GameSession, GameSessionAdmin)


# 社群回復語音
class VoiceReplyAdmin(admin.ModelAdmin):
    list_display = (
        'diary',
        'audio_file',
        'transcribed_text',
        'sender_name',
        'created_at',
    )

    list_filter = (
        'diary',
        'created_at',
    )

    ordering = (
        'diary',
    )

admin.site.register(VoiceReply, VoiceReplyAdmin)


# AI 貼文
class DiarypostAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'diary_title',
        'category',
        'post',
        'created_at',
    )

    list_filter = (
        'category',
        'created_at',
    )

    ordering = (
        '-created_at',
    )

admin.site.register(Diarypost, DiarypostAdmin)
