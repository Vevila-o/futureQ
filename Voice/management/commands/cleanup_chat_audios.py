from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from Voice.models import ChatReplyAudio


class Command(BaseCommand):
    help = (
        "刪除超過 48 小時的聊天室第 2～4 輪暫存錄音（ChatReplyAudio）。"
        "finalize_diary 成功時會自己清掉當篇的暫存檔，"
        "這裡只處理「錄到一半就關掉頁面、永遠沒有按生成日記」留下的孤兒檔案。"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours", type=int, default=48,
            help="超過幾小時視為孤兒檔案（預設 48）",
        )

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=options["hours"])
        qs = ChatReplyAudio.objects.filter(created_at__lt=cutoff)
        count = qs.count()
        for ra in qs:
            ra.audio_file.delete(save=False)
            ra.delete()
        self.stdout.write(self.style.SUCCESS(f"已清除 {count} 筆超過 {options['hours']} 小時的孤兒暫存錄音"))
