from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

from Voice.models import DiaryEntry, CognitiveAnalysis
from Voice.utils import analyze_transcription


class Command(BaseCommand):
    help = "建立聲影日記前七天假資料"

    def handle(self, *args, **kwargs):
        User = get_user_model()

        user = User.objects.first()

        if user is None:
            user = User.objects.create_user(
                username="demo_elder",
                password="demo123456",
            )

        fake_diaries = [
            {
                "days_ago": 1,
                "title": "公園散步",
                "photo": "voiceDiary/media/photo/1.png",
                "audio_file": "voiceDiary/media/audio/1.mp3",
                "transcription": (
                    "今天我和孫子去公園散步，"
                    "看到紅色的花開了，我們覺得很開心。"
                ),
                "ai_response": (
                    "聽起來是很溫暖的一天呢！"
                    "和孫子一起散步一定很開心。"
                ),
            },
            {
                "days_ago": 2,
                "title": "在家吃飯",
                "photo": "voiceDiary/media/photo/2.png",
                "audio_file": "voiceDiary/media/audio/2.mp3",
                "transcription": "今天在家吃飯。",
                "ai_response": "簡單的一天也很值得記錄呢！",
            },
            {
                "days_ago": 3,
                "title": "社區活動",
                "photo": "voiceDiary/media/photo/3.png",
                "audio_file": "voiceDiary/media/audio/3.mp3",
                "transcription": (
                    "昨天下午我和朋友去社區活動中心參加唱歌活動，"
                    "大家一起唱了很多熟悉的歌曲，我覺得很開心。"
                ),
                "ai_response": (
                    "和朋友一起唱歌一定很熱鬧，"
                    "也是一段很開心的回憶呢！"
                ),
            },
            {
                "days_ago": 4,
                "title": "早上市場買菜",
                "photo": "voiceDiary/media/photo/4.png",
                "audio_file": "voiceDiary/media/audio/4.mp3",
                "transcription": (
                    "今天早上我去菜市場買菜，"
                    "買了高麗菜、番茄和雞蛋，"
                    "回家後準備煮午餐。"
                ),
                "ai_response": (
                    "今天買了不少新鮮食材，"
                    "自己準備午餐感覺很充實呢！"
                ),
            },
            {
                "days_ago": 5,
                "title": "陪孫女畫畫",
                "photo": "voiceDiary/media/photo/5.png",
                "audio_file": "voiceDiary/media/audio/5.mp3",
                "transcription": (
                    "下午孫女來家裡陪我，"
                    "她坐在客廳畫畫，畫了一棵大樹和很多漂亮的花，"
                    "我在旁邊陪她聊天。"
                ),
                "ai_response": (
                    "孫女畫的圖聽起來很可愛，"
                    "你們一起畫畫聊天的時光一定很溫馨。"
                ),
            },
            {
                "days_ago": 6,
                "title": "醫院定期回診",
                "photo": "voiceDiary/media/photo/6.png",
                "audio_file": "voiceDiary/media/audio/6.mp3",
                "transcription": (
                    "昨天早上女兒陪我去醫院回診，"
                    "醫生幫我量血壓，也提醒我要記得按時吃藥和多散步。"
                ),
                "ai_response": (
                    "有女兒陪你一起回診很安心，"
                    "也要記得照顧身體和按時吃藥喔！"
                ),
            },
            {
                "days_ago": 7,
                "title": "和女兒吃午餐",
                "photo": "voiceDiary/media/photo/7.png",
                "audio_file": "voiceDiary/media/audio/7.mp3",
                "transcription": (
                    "今天中午女兒回來陪我吃飯，"
                    "我煮了青菜和魚，"
                    "我們一邊吃飯一邊聊天。"
                ),
                "ai_response": (
                    "和家人一起吃飯真的很幸福呢！"
                    "今天的午餐聽起來很豐盛。"
                ),
            },
            {
                "days_ago": 15,
                "title": "和朋友喝下午茶",
                "photo": "voiceDiary/media/photo/15.png",
                "audio_file": "voiceDiary/media/audio/15.mp3",
                "transcription": "下午我和朋友在餐廳喝茶聊天，我們吃了蛋糕，也聊到以前一起工作的事情，心情很愉快。",
                "ai_response": "和老朋友一起喝茶聊天，一定是很輕鬆又珍貴的時光呢！",
            },
            {
                "days_ago": 30,
                "title": "市場買水果",
                "photo": "voiceDiary/media/photo/30.png",
                "audio_file": "diary/audio/30.mp3",
                "transcription": "早上我去市場買水果，買了蘋果和香蕉，還遇到以前的鄰居。",
                "ai_response": "去市場還遇到鄰居，感覺很有人情味呢！",
            },
            {
                "days_ago": 365,
                "title": "家人晚餐",
                "photo": "voiceDiary/media/photo/365.png",
                "audio_file": "diary/audio/365.mp3",
                "transcription": "我們全家一起吃晚餐，大家坐在客廳聊天，感覺很熱鬧。",
                "ai_response": "這是一個很珍貴的回憶呢！家人一起聊天的時光很溫暖。",
            },
        ]

        created_count = 0
        skipped_count = 0

        for item in fake_diaries:
            target_date = (
                timezone.localdate()
                - timedelta(days=item["days_ago"])
            )

            # 同一位使用者在同一天已經有資料，就不重複建立
            existing_diary = DiaryEntry.objects.filter(
                user=user,
                created_at__date=target_date,
            ).first()

            if existing_diary:
                skipped_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"略過 {target_date}："
                        f"已有日記「{existing_diary.title}」"
                    )
                )
                continue

            text = item["transcription"]
            result = analyze_transcription(text)

            diary_data = {
                "user": user,
                "title": item["title"],
                "photo": item["photo"],
                "audio_file": item["audio_file"],
                "transcription": text,
                "diary_text": text,
                "ai_response": item["ai_response"],
                "status": "completed",
            }

            diary = DiaryEntry.objects.create(**diary_data)

            # 設定假資料日期，時間固定為當天上午 10 點
            import datetime
            naive_datetime = datetime.datetime.combine(
                target_date,
                datetime.time(10, 0, 0)
            )
            target_datetime = timezone.make_aware(naive_datetime)

            # 使用 update，避免 auto_now_add 重新蓋掉日期
            DiaryEntry.objects.filter(
                pk=diary.pk
            ).update(
                created_at=target_datetime
            )

            # 重新取得更新日期後的 diary
            diary.refresh_from_db()

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

            created_count += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"新增 {target_date}：{item['title']}"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"假資料處理完成：新增 {created_count} 筆，"
                f"略過 {skipped_count} 筆。"
            )
        )