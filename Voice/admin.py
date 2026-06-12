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
    list_display  = ('id', 'status', 'created_at', 'updated_at')  # 後台列表顯示的欄位
    list_filter   = ('status',)                                    # 右側篩選器
    ordering      = ('-created_at',)                               # 預設排序（最新在前）

admin.site.register(DiaryEntry, DiaryEntryAdmin)


# 認知分析結果
class CognitiveAnalysisAdmin(admin.ModelAdmin):
    list_display  = ('id', 'risk_level', 'word_count', 'hesitation_count', 'analyzed_at')
    list_filter   = ('risk_level',)
    ordering      = ('-analyzed_at',)

admin.site.register(CognitiveAnalysis, CognitiveAnalysisAdmin)


# AI 追問對話
class AiConversationAdmin(admin.ModelAdmin):
    list_display  = ('id', 'round_count', 'is_finished', 'created_at')
    list_filter   = ('is_finished',)
    ordering      = ('-created_at',)

admin.site.register(AiConversation, AiConversationAdmin)
