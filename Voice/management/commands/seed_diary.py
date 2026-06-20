from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

from Voice.models import DiaryEntry, CognitiveAnalysis
from Voice.utils import analyze_transcription


class Command(BaseCommand):
    help = "建立聲影日記假資料"

    def handle(self, *args, **kwargs):
        User = get_user_model()

        user = User.objects.first()

        if user is None:
            user = User.objects.create_user(
                username="demo_elder",
                password="demo123456"
            )

        fake_diaries = [
            {
                "days_ago": 1,
                "title": "公園散步",
                "photo": "diary/images/demo_park.jpg",
                "audio_file": "diary/audio/demo_park.mp3",
                "transcription": "今天我和孫子去公園散步，看到紅色的花開了，我們覺得很開心。",
                "ai_response": "聽起來是很溫暖的一天呢！和孫子一起散步一定很開心。",
            },
            {
                "days_ago": 7,
                "title": "和女兒吃午餐",
                "photo": "diary/images/demo_lunch.jpg",
                "audio_file": "diary/audio/demo_lunch.mp3",
                "transcription": "今天中午女兒回來陪我吃飯，我煮了青菜和魚，我們一邊吃飯一邊聊天。",
                "ai_response": "和家人一起吃飯真的很幸福呢！今天的午餐聽起來很豐盛。",
            },
            {
                "days_ago": 30,
                "title": "市場買水果",
                "photo": "diary/images/demo_market.jpg",
                "audio_file": "diary/audio/demo_market.mp3",
                "transcription": "早上我去市場買水果，買了蘋果和香蕉，還遇到以前的鄰居。",
                "ai_response": "去市場還遇到鄰居，感覺很有人情味呢！",
            },
            {
                "days_ago": 365,
                "title": "去年的家人晚餐",
                "photo": "diary/images/demo_family.jpg",
                "audio_file": "diary/audio/demo_family.mp3",
                "transcription": "去年的今天我們全家一起吃晚餐，大家坐在客廳聊天，感覺很熱鬧。",
                "ai_response": "這是一個很珍貴的回憶呢！家人一起聊天的時光很溫暖。",
            },
            {
                "days_ago": 2,
                "title": "簡短日記測試",
                "photo": "diary/images/demo_short.jpg",
                "audio_file": "diary/audio/demo_short.mp3",
                "transcription": "今天在家吃飯。",
                "ai_response": "簡單的一天也很值得記錄呢！",
            },
        ]

        for item in fake_diaries:
            text = item["transcription"]
            result = analyze_transcription(text)

            diary_data = {
                "user": user,
                "photo": item["photo"],
                "audio_file": item["audio_file"],
                "transcription": text,
                "diary_text": text,
                "ai_response": item["ai_response"],
                "status": "completed",
            }

            # 如果你的 DiaryEntry 有 title 欄位，就保留這行
            # 如果沒有 title 欄位，請把下一行刪掉
            diary_data["title"] = item["title"]

            diary = DiaryEntry.objects.create(**diary_data)

            target_date = timezone.now() - timedelta(days=item["days_ago"])
            diary.created_at = target_date
            diary.save(update_fields=["created_at"])

            CognitiveAnalysis.objects.create(
                diary=diary,
                fluency_score=result["fluency_score"],
                information_score=result["information_score"],
                sentence_score=result["sentence_score"],
                naming_score=result["naming_score"],
                semantic_score=result["semantic_score"],
                communication_score=result["communication_score"],
                total_score=result["total_score"],
                average_score=result["average_score"],
                risk_level=result["risk_level"],
                suggestion=result["suggestion"],
                ai_feedback=result["ai_feedback"],
            )

        self.stdout.write(self.style.SUCCESS("聲影日記假資料建立完成！"))