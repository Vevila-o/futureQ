from django.db import models
import uuid
from django.conf import settings
# Create your models here.
"""
家屬端的內容沒有加進來喔，只有單純長者端的內容，資料庫是參考專題計畫書修改
"""


# 使用者
class User(models.Model):
    userID    = models.AutoField(primary_key=True)
    username  = models.CharField(max_length=50, blank=True, null=True, verbose_name='姓名')
    gender    = models.CharField(max_length=10, blank=True, null=True, verbose_name='性別')
    userbirth = models.DateField(blank=True, null=True, verbose_name='生日')
    joinday   = models.DateField(blank=True, null=True, verbose_name='加入日期')

    class Meta:
        db_table = 'user'
        verbose_name = '使用者'
        verbose_name_plural = '使用者'
        


# 聲影日記主表
class DiaryEntry(models.Model):
    class Status(models.TextChoices):
        PENDING    = "pending",    "等待分析"
        PROCESSING = "processing", "分析中"
        DONE       = "done",       "完成"
        FAILED     = "failed",     "失敗"

    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="diary_entries",
        verbose_name="用戶",
    )
    audio_file = models.FileField(
        "語音檔案", upload_to="voiceDiary/media/audio",
        blank=True, null=True,
        help_text="支援 m4a / mp3 / wav，上限 3 分鐘",
    )
    photo = models.ImageField(
        "照片", upload_to="voiceDiary/media/photo",
        blank=True, null=True,
    )
    transcription     = models.TextField("Whisper 語音轉文字", blank=True)
    photo_description = models.TextField("照片 AI 描述",       blank=True)
    ai_response       = models.TextField("AI 溫暖回應",        blank=True)
    status = models.CharField(
        "分析狀態", max_length=20,
        choices=Status.choices, default=Status.PENDING,
    )
    created_at = models.DateTimeField("建立時間", auto_now_add=True)
    updated_at = models.DateTimeField("更新時間", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "聲影日記"
        verbose_name_plural = "聲影日記"

    def __str__(self):
        return f"{self.user.name} ｜ {self.created_at:%Y/%m/%d}"

# 認知分析結果
class CognitiveAnalysis(models.Model):
    class RiskLevel(models.TextChoices):
        LOW    = "low",    "低風險"
        MEDIUM = "medium", "中風險"
        HIGH   = "high",   "高風險"

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    diary_entry = models.OneToOneField(
        DiaryEntry, on_delete=models.CASCADE,
        related_name="analysis", verbose_name="聲影日記",
    )
    vocabulary_richness = models.FloatField("詞彙豐富度", null=True, blank=True)
    sentence_fluency    = models.FloatField("語句流暢度", null=True, blank=True)
    topic_coherence     = models.FloatField("話題連貫性", null=True, blank=True)
    word_count          = models.IntegerField("總字數",   null=True, blank=True)
    hesitation_count    = models.IntegerField("停頓次數", null=True, blank=True)
    risk_level     = models.CharField(
        "風險等級", max_length=10,
        choices=RiskLevel.choices, default=RiskLevel.LOW,
    )
    summary        = models.TextField("AI 分析摘要", blank=True)
    raw_llm_output = models.JSONField("LLM 原始輸出", default=dict)
    analyzed_at    = models.DateTimeField("分析時間", auto_now_add=True)

    class Meta:
        verbose_name = "認知分析"
        verbose_name_plural = "認知分析"

    def __str__(self):
        return f"分析｜{self.diary_entry}"

# ai 追問對話
class AiConversation(models.Model):
    """
    AI 追問對話（計畫書規格：最多 3 來回）
    messages 格式：[{"role": "assistant"|"user", "content": "..."}, ...]
    """
    MAX_ROUNDS = 3

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    diary_entry = models.OneToOneField(
        DiaryEntry, on_delete=models.CASCADE,
        related_name="conversation", verbose_name="聲影日記",
    )
    messages    = models.JSONField("對話訊息", default=list)
    round_count = models.IntegerField("目前輪數", default=0)
    is_finished = models.BooleanField("對話結束", default=False)
    created_at  = models.DateTimeField("建立時間", auto_now_add=True)
    updated_at  = models.DateTimeField("更新時間", auto_now=True)

    class Meta:
        verbose_name = "AI 對話"
        verbose_name_plural = "AI 對話"

    def __str__(self):
        return f"對話（第 {self.round_count} 輪）｜{self.diary_entry}"

    def can_continue(self) -> bool:
        return not self.is_finished and self.round_count < self.MAX_ROUNDS

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})
        if role == "assistant":
            self.round_count += 1
            if self.round_count >= self.MAX_ROUNDS:
                self.is_finished = True
        self.save(update_fields=["messages", "round_count", "is_finished", "updated_at"])