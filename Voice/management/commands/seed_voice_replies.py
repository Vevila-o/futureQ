from django.core.management.base import BaseCommand
from Voice.models import DiaryEntry, VoiceReply

FAKE_REPLIES = [
    {"sender": "王大明", "audio": "voice_replies/demo_reply_1.webm"},
    {"sender": "陳小花", "audio": "voice_replies/demo_reply_2.webm"},
    {"sender": "林奶奶的朋友", "audio": "voice_replies/demo_reply_3.webm"},
    {"sender": "匿名朋友", "audio": "voice_replies/demo_reply_4.webm"},
    {"sender": "孫女小玲", "audio": "voice_replies/demo_reply_5.webm"},
]


class Command(BaseCommand):
    help = "為前幾篇日記建立假語音加油資料（demo 用）"

    def handle(self, *args, **kwargs):
        diaries = list(DiaryEntry.objects.filter(status="done").order_by("-created_at")[:5])

        if not diaries:
            self.stdout.write(self.style.WARNING(
                "沒有 status=done 的日記，請先執行 seed_diary 或錄製一篇日記"
            ))
            return

        # 每篇給的留言數：第1篇3則、第2篇2則、其餘1則
        reply_counts = [3, 2, 1, 1, 1]
        created = 0

        for i, diary in enumerate(diaries):
            count = reply_counts[i] if i < len(reply_counts) else 1
            for j in range(count):
                fake = FAKE_REPLIES[(i + j) % len(FAKE_REPLIES)]
                exists = VoiceReply.objects.filter(
                    diary=diary, sender_name=fake["sender"]
                ).exists()
                if not exists:
                    VoiceReply.objects.create(
                        diary=diary,
                        audio_file=fake["audio"],
                        sender_name=fake["sender"],
                    )
                    created += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"  新增：「{diary.title or diary.id}」← {fake['sender']}"
                    ))

        self.stdout.write(self.style.SUCCESS(
            f"\n假語音加油建立完成：共 {created} 筆\n"
            "提示：請將實際音檔放到 media/voice_replies/demo_reply_1.webm 等路徑以完整播放"
        ))
