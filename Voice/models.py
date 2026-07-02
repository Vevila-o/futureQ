from django.db import models
from django.contrib.auth.models import AbstractUser

"""
目前的資料庫是沒有關聯的
"""


# 使用者(Django 內建擴充)
class User(AbstractUser):
    """
    Django 內建已經有這些table，根據此表加上性別、生日
    
    username	帳號
    password	密碼（自動加密）
    email	信箱
    first_name / last_name	名字
    is_staff	能否進後台
    is_active	帳號是否啟用
    date_joined	註冊時間
    """
    gender = models.CharField("性別", max_length=10, blank=True)
    userbirth = models.DateField("生日", null=True, blank=True)



# 聲影日記主表
class DiaryEntry(models.Model):
    class Status(models.TextChoices):
        PENDING    = "pending",    "等待分析"
        PROCESSING = "processing", "分析中"
        DONE       = "done",       "完成"
        FAILED     = "failed",     "失敗"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="使用者"
    )

    title = models.CharField(
        "日記標題",
        max_length=50,
        blank=True,
        default=""
    )

    audio_file = models.FileField(
        "語音檔案",
        upload_to="audio",
        blank=True,
        null=True,
        help_text="支援 m4a / mp3 / wav，上限 3 分鐘",
    )

    photo = models.ImageField(
        "照片",
        upload_to="photo",
        blank=True,
        null=True,
    )

    transcription = models.TextField(
        "Whisper 語音轉文字",
        blank=True
    )

    diary_text = models.TextField(
        "日記文字",
        blank=True
    )

    photo_description = models.TextField(
        "照片 AI 描述",
        blank=True
    )

    ai_response = models.TextField(
        "AI 溫暖回應",
        blank=True
    )

    status = models.CharField(
        "分析狀態",
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(
        "建立時間",
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        "更新時間",
        auto_now=True
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "聲影日記"
        verbose_name_plural = "聲影日記"

    def __str__(self):
        date = self.created_at.strftime("%Y/%m/%d") if self.created_at else "未建立日期"

        if self.title:
            return f"{date}｜{self.title}"

        short_text = self.transcription[:15] if self.transcription else "尚無轉文字"
        return f"{date}｜{short_text}"


# 認知分析結果
class CognitiveAnalysis(models.Model):
    RISK_LEVEL_CHOICES = [
        ("low", "低風險"),
        ("medium", "中風險"),
        ("high", "高風險"),
    ]

    diary = models.OneToOneField(
        DiaryEntry,
        on_delete=models.CASCADE,
        related_name="cognitive_analysis"
    )

    fluency_score = models.IntegerField("流暢度", default=0)          # 流暢度
    information_score = models.IntegerField("資訊量", default=0)      # 資訊量
    sentence_score = models.IntegerField("句子結構", default=0)         # 句子結構
    naming_score = models.IntegerField("命名能力", default=0)           # 命名能力
    semantic_score = models.IntegerField("語意正確性", default=0)         # 語意正確性
    communication_score = models.IntegerField("整體溝通能力", default=0)    # 整體溝通能力

    total_score = models.IntegerField("總分", default=0)            # 總分
    average_score = models.DecimalField(
        "平均分數",
        max_digits=4,
        decimal_places=2,
        default=0
    )                                                       # 平均分數

    risk_level = models.CharField(
        "風險等級",
        max_length=10,
        choices=RISK_LEVEL_CHOICES,
        default="low"
    )

    suggestion = models.TextField("建議內容", blank=True, default="")   # 給使用者看的提醒
    ai_feedback = models.TextField("AI 回饋內容", blank=True, default="")

    analyzed_at = models.DateTimeField("分析時間", auto_now_add=True)

    class Meta:
        verbose_name = "認知分析結果"
        verbose_name_plural = "認知分析結果"

    def __str__(self):
        return f"日記 {self.diary.id} 的認知分析"


# AI 追問對話
class AiConversation(models.Model):
    MAX_ROUNDS = 3

    diary = models.OneToOneField(
        DiaryEntry,
        on_delete=models.CASCADE,
        related_name="ai_conversation",
        null=True,
        blank=True,
        verbose_name="對應日記"
    )

    messages    = models.JSONField("對話訊息", default=list)
    round_count = models.IntegerField("目前輪數", default=0)
    is_finished = models.BooleanField("對話結束", default=False)
    created_at  = models.DateTimeField("建立時間", auto_now_add=True)
    updated_at  = models.DateTimeField("更新時間", auto_now=True)

    class Meta:
        verbose_name = "AI 追問對話"
        verbose_name_plural = "AI 追問對話"

    def __str__(self):
        return f"對話（第 {self.round_count} 輪）{self.pk}"

    def can_continue(self) -> bool:
        return not self.is_finished and self.round_count < self.MAX_ROUNDS

    def add_message(self, role: str, content: str) -> None:
        self.messages.append({"role": role, "content": content})
        if role == "assistant":
            self.round_count += 1
            if self.round_count >= self.MAX_ROUNDS:
                self.is_finished = True
        self.save(update_fields=["messages", "round_count", "is_finished", "updated_at"])


# 大腦訓練遊戲紀錄（例如：整理菜籃）
class GameSession(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name="使用者"
    )

    game_name = models.CharField("遊戲名稱", max_length=50, default="菜市場")

    score = models.IntegerField("總分", default=0)
    total_questions = models.IntegerField("總題數", default=0)
    accuracy = models.DecimalField("正確率(%)", max_digits=5, decimal_places=2, default=0)
    avg_reaction_time = models.DecimalField("平均反應時間(秒)", max_digits=6, decimal_places=2, default=0)
    hesitation_count = models.IntegerField("猶豫次數", default=0)

    played_at = models.DateTimeField("遊玩時間", auto_now_add=True)

    class Meta:
        ordering = ["-played_at"]
        verbose_name = "遊戲紀錄"
        verbose_name_plural = "遊戲紀錄"

    def __str__(self):
        date = self.played_at.strftime("%Y/%m/%d") if self.played_at else "未建立日期"
        return f"{date}｜{self.game_name}｜{self.score} 分"
    
class VoiceReply(models.Model):
    diary = models.ForeignKey(
        DiaryEntry, on_delete=models.CASCADE, related_name="voice_replies", verbose_name="對應日記"
    )
    audio_file = models.FileField("語音加油檔案", upload_to="voice_replies")
    sender_name = models.CharField("送出者暱稱", max_length=30, blank=True, default="匿名朋友")
    created_at = models.DateTimeField("送出時間", auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "語音加油"
        verbose_name_plural = "語音加油"

    def __str__(self):
        return f"日記 {self.diary_id} 的語音加油（{self.sender_name}）"
