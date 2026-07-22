import json
import shutil
import tempfile
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from Voice.models import AiConversation, ChatReplyAudio, CognitiveAnalysis, DiaryEntry, Diarypost, Notification
from Voice.utils import (
    analyze_transcription,
    assess_sample_quality,
    calc_lvi,
    calc_lvi_trend,
    collapse_repetitions,
    get_risk_result,
    tag_all_categories,
)


def _fake_chat_response(text):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = text
    return resp


class AssessSampleQualityTest(TestCase):

    def test_empty_text_is_too_short(self):
        """空文字不該被拿去分析，更不該被判定成高風險。"""
        self.assertEqual(assess_sample_quality(""), "too_short")

    def test_short_text_is_too_short(self):
        self.assertEqual(assess_sample_quality("嗯嗯嗯"), "too_short")

    def test_whisper_hallucination_is_rejected(self):
        """Whisper 幻覺字幕片尾語必須被攔截，不能進入正常分析。"""
        text = "謝謝觀看謝謝大家記得訂閱點讚訂閱我的頻道字幕組製作"
        self.assertEqual(assess_sample_quality(text), "suspect_hallucination")

    def test_normal_text_is_ok(self):
        text = "我今天早上跟太太一起去菜市場買菜，還遇到鄰居聊天，心情很好。"
        self.assertEqual(assess_sample_quality(text), "ok")


class TagAllCategoriesTest(TestCase):

    def test_no_cross_category_double_count(self):
        """「家人」不該同時被算成人物與地點（「家」）。"""
        m = tag_all_categories(
            "我跟家人去吃飯",
            {"person": ["家人", "我"], "location": ["家"], "event": ["吃飯"]},
        )
        self.assertEqual(m["location"], [])
        self.assertIn("家人", m["person"])

    def test_no_single_char_false_positive_inside_longer_word(self):
        """「買菜」的「菜」不該被單字物品詞庫誤判成物品。"""
        m = tag_all_categories(
            "我今天去菜市場買菜",
            {"location": ["菜市場"], "event": ["買菜"], "object": ["菜"]},
        )
        self.assertEqual(m["object"], [])
        self.assertIn("菜市場", m["location"])
        self.assertIn("買菜", m["event"])


class CollapseRepetitionsTest(TestCase):

    def test_collapses_repeated_char(self):
        self.assertEqual(collapse_repetitions("水水水水水"), "水")

    def test_collapses_repeated_phrase(self):
        self.assertEqual(collapse_repetitions("出來了出來了出來了"), "出來了")

    def test_keeps_normal_reduplication(self):
        """正常疊字用法（謝謝、剛剛）不該被壓縮掉。"""
        self.assertEqual(collapse_repetitions("謝謝"), "謝謝")
        self.assertEqual(collapse_repetitions("剛剛"), "剛剛")


class AnalyzeTranscriptionTest(TestCase):

    def test_empty_text_all_zero(self):
        r = analyze_transcription("")
        self.assertEqual(r["fluency_score"], 0)
        self.assertEqual(r["total_score"], 0)

    def test_repetition_lowers_fluency(self):
        """重複話語跳針應該降低流暢度，而不是提高。"""
        repeated = "水水水水水滿滿滿滿出來了出來了出來了我我我不知道要幹嘛要幹嘛"
        normal = "水從水槽裡滿出來了，我趕快去關水龍頭，還好沒有弄濕地板。"
        self.assertLess(
            analyze_transcription(repeated)["fluency_score"],
            analyze_transcription(normal)["fluency_score"],
        )

    def test_total_score_excludes_communication_score(self):
        """總分只加總五個獨立維度，不重複計入 communication_score。"""
        r = analyze_transcription("今天早上我跟太太去菜市場買菜，還遇到鄰居聊天，心情很好。")
        self.assertEqual(
            r["total_score"],
            r["fluency_score"] + r["information_score"] + r["sentence_score"]
            + r["naming_score"] + r["semantic_score"],
        )
        self.assertLessEqual(r["total_score"], 20)

    def test_information_score_caps_at_four_dimensions(self):
        """命中 4 種類別以上都應該滿分，不是只有 5 種以上才滿分。"""
        # 人物 + 地點 + 事件 + 物品 + 時間 = 5 種
        text = "今天早上我跟太太去菜市場買菜看到小狗，還遇到鄰居聊天。"
        r = analyze_transcription(text)
        self.assertEqual(r["information_score"], 4)

    def test_generic_first_person_pronoun_not_counted_as_information(self):
        """只出現「我」不該被算成資訊量裡的「人物」維度。"""
        r = analyze_transcription("我我我我我我我我我我我我我我我我")
        self.assertEqual(r["information_score"], 0)


class GetRiskResultTest(TestCase):

    def test_thresholds_match_20_point_scale(self):
        """total_score 滿分改成 20 分後，門檻應同步調整為 16 / 11。"""
        self.assertEqual(get_risk_result(20)["risk_level"], "low")
        self.assertEqual(get_risk_result(16)["risk_level"], "low")
        self.assertEqual(get_risk_result(15)["risk_level"], "medium")
        self.assertEqual(get_risk_result(11)["risk_level"], "medium")
        self.assertEqual(get_risk_result(10)["risk_level"], "high")
        self.assertEqual(get_risk_result(0)["risk_level"], "high")


class LVITest(TestCase):

    def test_lvi_linear_mapping(self):
        """總分 20 對到 100，10 對到 50。"""
        self.assertEqual(calc_lvi(20), 100)
        self.assertEqual(calc_lvi(10), 50)
        self.assertEqual(calc_lvi(0), 0)

    def test_lvi_none_when_no_data(self):
        """無資料回傳 None，不硬湊數字。"""
        self.assertIsNone(calc_lvi(None))

    def test_trend_needs_min_baseline(self):
        """基線不足 5 筆時不判定趨勢。"""
        trend, delta = calc_lvi_trend(15, [14, 15, 16])   # 只有 3 筆
        self.assertIsNone(trend)
        self.assertIsNone(delta)

    def test_trend_flat_within_threshold(self):
        """小幅波動視為持平，不誤報。"""
        baseline = [15, 15, 15, 15, 15]        # baseline_lvi = 75
        trend, delta = calc_lvi_trend(15.5, baseline)   # current_lvi ≈ 78，delta 3 < 5
        self.assertEqual(trend, "flat")

    def test_trend_up_beyond_threshold(self):
        trend, delta = calc_lvi_trend(18, [14, 14, 14, 14, 14])  # 70 -> 90
        self.assertEqual(trend, "up")
        self.assertGreaterEqual(delta, 5)

    def test_trend_down_beyond_threshold(self):
        """明確下降時要報下降。"""
        baseline = [16, 16, 16, 16, 16]        # baseline_lvi = 80
        trend, delta = calc_lvi_trend(13, baseline)  # current_lvi = 65，delta -15
        self.assertEqual(trend, "down")


class DashboardLVIViewTest(TestCase):
    """dashboard view 不該再回傳 brain_age，且要依資料量呈現正確的 LVI 狀態。"""

    def setUp(self):
        from django.contrib.auth import get_user_model
        self.User = get_user_model()
        self.user = self.User.objects.create_user(username="demo_elder", password="x")

    def _create_diary_with_score(self, total_score, days_ago=0):
        from datetime import timedelta
        from django.utils import timezone
        from Voice.models import DiaryEntry, CognitiveAnalysis

        diary = DiaryEntry.objects.create(user=self.user, status="done")
        DiaryEntry.objects.filter(pk=diary.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago)
        )
        diary.refresh_from_db()
        CognitiveAnalysis.objects.create(
            diary=diary,
            is_valid=True,
            fluency_score=1, information_score=1, sentence_score=1,
            naming_score=1, semantic_score=max(0, total_score - 4),
            communication_score=1,
            total_score=total_score,
            average_score=total_score / 5,
            risk_level="low",
        )
        return diary

    def test_empty_state_has_no_fake_number(self):
        self.client.force_login(self.user)
        response = self.client.get("/dashboard/")
        self.assertEqual(response.context["lvi_state"], "empty")
        self.assertIsNone(response.context["lvi"])
        self.assertNotIn("brain_age", response.context)

    def test_ok_state_with_recent_data(self):
        self._create_diary_with_score(16, days_ago=1)
        self.client.force_login(self.user)
        response = self.client.get("/dashboard/")
        self.assertEqual(response.context["lvi_state"], "ok")
        self.assertEqual(response.context["lvi"], 80)
        self.assertNotIn("brain_age", response.context)

    def test_invalid_samples_excluded_from_lvi(self):
        from datetime import timedelta
        from django.utils import timezone
        from Voice.models import DiaryEntry, CognitiveAnalysis

        diary = DiaryEntry.objects.create(user=self.user, status="done")
        DiaryEntry.objects.filter(pk=diary.pk).update(
            created_at=timezone.now() - timedelta(days=1)
        )
        diary.refresh_from_db()
        CognitiveAnalysis.objects.create(diary=diary, is_valid=False, invalid_reason="too_short")

        self.client.force_login(self.user)
        response = self.client.get("/dashboard/")
        self.assertEqual(response.context["lvi_state"], "empty")


class ChatFlowTest(TestCase):
    """聊天室 4 輪流程：照片首問 → 3 次追問 → 生成日記，外部服務（Whisper／OpenAI）全部 mock 掉。

    這裡的 photo/audio 都是假檔案，FileField 的實際寫入不受 TestCase 的
    DB rollback 保護，所以把 MEDIA_ROOT 導到一個測試用的暫存資料夾，
    避免每次跑測試都在真正的 media/audio、media/photo 底下留垃圾檔案。
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._media_root = tempfile.mkdtemp(prefix="voicediary_test_media_")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls):
        cls._media_override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="demo_elder", password="x")
        photo = SimpleUploadedFile("photo.jpg", b"fake-image-bytes", content_type="image/jpeg")
        self.diary = DiaryEntry.objects.create(
            user=self.user, photo=photo, status=DiaryEntry.Status.PENDING
        )

    def _tiny_audio(self, name="a.webm"):
        return SimpleUploadedFile(name, b"fake-audio-bytes", content_type="audio/webm")

    @patch("Voice.views._describe_photo")
    def test_vision_seeds_first_question(self, mock_describe):
        """上傳照片後呼叫首問 API，AiConversation 應該只有一句 assistant 開場白。"""
        mock_describe.return_value = ("一位長輩在公園散步", "這是在哪裡拍的呢？")

        response = self.client.post(
            "/api/vision-first-question/",
            data=json.dumps({"diary_id": self.diary.id}),
            content_type="application/json",
        )
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["question"], "這是在哪裡拍的呢？")

        self.diary.refresh_from_db()
        self.assertEqual(self.diary.photo_description, "一位長輩在公園散步")

        conv = self.diary.ai_conversation
        self.assertEqual(len(conv.messages), 1)
        self.assertEqual(conv.messages[0]["role"], "assistant")

    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    @patch("Voice.utils.transcribe_audio")
    @patch("Voice.views._generate_followup")
    @patch("Voice.views._describe_photo")
    def test_four_user_replies_then_done(
        self, mock_describe, mock_followup, mock_transcribe, mock_mp3
    ):
        """第 4 次回覆後應該標記 done，且不再生成下一句追問。"""
        mock_describe.return_value = ("照片描述", "第一個問題")
        mock_followup.side_effect = ["追問二", "追問三", "追問四"]
        mock_transcribe.side_effect = [
            ("回覆一內容", {}),
            ("回覆二內容", {}),
            ("回覆三內容", {}),
            ("回覆四內容", {}),
        ]

        self.client.post(
            "/api/vision-first-question/",
            data=json.dumps({"diary_id": self.diary.id}),
            content_type="application/json",
        )

        # 第 1 輪：update_diary_audio
        r1 = self.client.post(
            "/updateDiaryAudio/",
            {"diary_id": self.diary.id, "audio_file": self._tiny_audio()},
        )
        d1 = r1.json()
        self.assertTrue(d1["success"])
        self.assertEqual(d1["question"], "追問二")
        self.assertFalse(d1["done"])

        # 第 2～3 輪：upload_chat_voice，應該繼續生成追問
        for expected_reply in ["追問三", "追問四"]:
            r = self.client.post(
                "/api/upload-chat-voice/",
                {"diary_id": self.diary.id, "audio_data": self._tiny_audio()},
            )
            d = r.json()
            self.assertEqual(d["reply"], expected_reply)
            self.assertFalse(d["done"])

        # 第 4 輪：達到上限，不再生成追問
        r4 = self.client.post(
            "/api/upload-chat-voice/",
            {"diary_id": self.diary.id, "audio_data": self._tiny_audio()},
        )
        d4 = r4.json()
        self.assertTrue(d4["done"])
        self.assertIsNone(d4["reply"])

        conv = AiConversation.objects.get(diary=self.diary)
        self.assertTrue(conv.is_finished)
        user_msgs = [m for m in conv.messages if m["role"] == "user"]
        self.assertEqual(len(user_msgs), 4)

    @patch("Voice.views.OpenAI")
    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    @patch("Voice.utils.transcribe_audio")
    @patch("Voice.views._generate_followup")
    @patch("Voice.views._describe_photo")
    def test_finalize_generates_title_analysis_and_share_content(
        self, mock_describe, mock_followup, mock_transcribe, mock_mp3, mock_openai_cls
    ):
        """按下生成日記後：認知分析、標題、分享貼文都要一次到位；finish 頁不再重打 OpenAI。"""
        mock_describe.return_value = ("照片描述", "第一個問題")
        mock_followup.side_effect = ["追問二", "追問三", "追問四"]
        # 四段合併後要夠長，才能通過 assess_sample_quality 的品質門檻
        mock_transcribe.side_effect = [
            ("今天早上我跟太太一起去附近的公園散步", {}),
            ("還遇到隔壁的鄰居，我們聊了一下天氣", {}),
            ("後來我們一起去市場買菜，買了一些青菜", {}),
            ("回家後我煮了一頓簡單的午餐，心情很好", {}),
        ]

        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.side_effect = [
            _fake_chat_response("溫馨的一天🌿"),                      # finalize: 標題
            _fake_chat_response("聽起來今天過得很充實！"),              # finalize: 溫暖回應
            _fake_chat_response("今天跟太太去公園散步，心情很好。"),      # 分享內容: 第一人稱短文
            _fake_chat_response("#散步日常 #公園時光 #長者生活"),       # 分享內容: hashtags
            _fake_chat_response("樂"),                               # 分享內容: 分類
        ]

        self.client.post(
            "/api/vision-first-question/",
            data=json.dumps({"diary_id": self.diary.id}),
            content_type="application/json",
        )
        self.client.post(
            "/updateDiaryAudio/",
            {"diary_id": self.diary.id, "audio_file": self._tiny_audio()},
        )
        for _ in range(3):
            self.client.post(
                "/api/upload-chat-voice/",
                {"diary_id": self.diary.id, "audio_data": self._tiny_audio()},
            )

        response = self.client.post("/api/finalize-diary/", {"diary_id": self.diary.id})
        data = response.json()
        self.assertEqual(data["status"], "success")

        self.diary.refresh_from_db()
        self.assertEqual(self.diary.status, DiaryEntry.Status.DONE)
        self.assertEqual(self.diary.title, "溫馨的一天🌿")
        self.assertIn("公園散步", self.diary.transcription)
        self.assertIn("買菜", self.diary.transcription)

        analysis = CognitiveAnalysis.objects.get(diary=self.diary)
        self.assertTrue(analysis.is_valid)

        post = Diarypost.objects.get(diary_title=self.diary)
        self.assertEqual(post.post, "今天跟太太去公園散步，心情很好。")
        self.assertEqual(post.hashtags, ["#散步日常", "#公園時光", "#長者生活"])

        # finish 頁應該直接讀已生成好的 Diarypost，不再重打 OpenAI
        call_count_before = mock_client.chat.completions.create.call_count
        finish_response = self.client.get(f"/finish/?diary_id={self.diary.id}")
        self.assertEqual(finish_response.status_code, 200)
        self.assertEqual(mock_client.chat.completions.create.call_count, call_count_before)
        self.assertEqual(finish_response.context["first_person_text"], "今天跟太太去公園散步，心情很好。")

    @patch("Voice.views._get_audio_duration_seconds", return_value=8.0)
    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    @patch("Voice.utils.transcribe_audio", return_value=("嗯", {}))
    @patch("Voice.views._describe_photo")
    def test_first_reply_under_15s_rejected(self, mock_describe, mock_transcribe, mock_mp3, mock_duration):
        """第 1 次回覆音檔太短（ffprobe 量到 8 秒）應該被擋下，不進對話串。"""
        mock_describe.return_value = ("照片描述", "第一個問題")
        self.client.post(
            "/api/vision-first-question/",
            data=json.dumps({"diary_id": self.diary.id}),
            content_type="application/json",
        )

        response = self.client.post(
            "/updateDiaryAudio/",
            {"diary_id": self.diary.id, "audio_file": self._tiny_audio()},
        )
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["error"], "too_short")

        conv = AiConversation.objects.get(diary=self.diary)
        user_msgs = [m for m in conv.messages if m["role"] == "user"]
        self.assertEqual(len(user_msgs), 0)

    @patch("Voice.views._get_audio_duration_seconds", return_value=8.0)
    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    @patch("Voice.utils.transcribe_audio", return_value=("我今天早上跟太太一起去附近的公園散步", {}))
    @patch("Voice.views._describe_photo")
    def test_force_flag_bypasses_15s_threshold(self, mock_describe, mock_transcribe, mock_mp3, mock_duration):
        """連續 3 次都不足 15 秒後，前端會帶 force=1 放行，不能一直卡住講不了那麼久的長輩。"""
        mock_describe.return_value = ("照片描述", "第一個問題")
        self.client.post(
            "/api/vision-first-question/",
            data=json.dumps({"diary_id": self.diary.id}),
            content_type="application/json",
        )

        response = self.client.post(
            "/updateDiaryAudio/",
            {"diary_id": self.diary.id, "audio_file": self._tiny_audio(), "force": "1"},
        )
        data = response.json()
        self.assertTrue(data["success"])

    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    @patch("Voice.utils.transcribe_audio")
    @patch("Voice.views._generate_followup")
    @patch("Voice.views._describe_photo")
    def test_skip_requires_two_replies(self, mock_describe, mock_followup, mock_transcribe, mock_mp3):
        """只回覆 1 次就打 skip 應該被拒絕（第 1、2 輪不可跳過）。"""
        mock_describe.return_value = ("照片描述", "第一個問題")
        mock_followup.return_value = "追問二"
        mock_transcribe.return_value = ("回覆一內容", {})

        self.client.post(
            "/api/vision-first-question/",
            data=json.dumps({"diary_id": self.diary.id}),
            content_type="application/json",
        )
        self.client.post(
            "/updateDiaryAudio/",
            {"diary_id": self.diary.id, "audio_file": self._tiny_audio()},
        )

        response = self.client.post("/api/skip-chat-round/", {"diary_id": self.diary.id})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], "min_replies_not_met")

    @patch("Voice.views.OpenAI")
    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    @patch("Voice.utils.transcribe_audio")
    @patch("Voice.views._generate_followup")
    @patch("Voice.views._describe_photo")
    def test_finalize_after_two_replies_with_skips(
        self, mock_describe, mock_followup, mock_transcribe, mock_mp3, mock_openai_cls
    ):
        """2 次真實回覆 + 2 次跳過：允許 finalize、跳過佔位不進合併語料、暫存錄音 finalize 後清空、建議回覆句有生成。"""
        mock_describe.return_value = ("照片描述", "第一個問題")
        mock_followup.side_effect = ["追問二", "追問三", "追問四"]
        mock_transcribe.side_effect = [
            ("今天早上我跟太太一起去附近的公園散步", {}),
            ("還遇到隔壁的鄰居，我們聊了一下天氣", {}),
        ]

        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.side_effect = [
            _fake_chat_response("溫馨的一天🌿"),                                          # finalize: 標題
            _fake_chat_response("聽起來今天過得很充實！"),                                  # finalize: 溫暖回應
            _fake_chat_response("今天跟太太去公園散步，心情很好。"),                          # 分享內容: 第一人稱短文
            _fake_chat_response("#散步日常 #公園時光 #長者生活"),                            # 分享內容: hashtags
            _fake_chat_response("樂"),                                                    # 分享內容: 分類
            _fake_chat_response('["聽你這麼說我也開心！", "辛苦了，要多注意身體喔！", "下次見面再聊～"]'),  # 建議回覆句
        ]

        self.client.post(
            "/api/vision-first-question/",
            data=json.dumps({"diary_id": self.diary.id}),
            content_type="application/json",
        )
        self.client.post(
            "/updateDiaryAudio/",
            {"diary_id": self.diary.id, "audio_file": self._tiny_audio()},
        )
        self.client.post(
            "/api/upload-chat-voice/",
            {"diary_id": self.diary.id, "audio_data": self._tiny_audio()},
        )

        conv = AiConversation.objects.get(diary=self.diary)
        self.assertEqual(ChatReplyAudio.objects.filter(conversation=conv).count(), 1)

        r3 = self.client.post("/api/skip-chat-round/", {"diary_id": self.diary.id})
        self.assertEqual(r3.json()["status"], "success")
        self.assertFalse(r3.json()["done"])

        r4 = self.client.post("/api/skip-chat-round/", {"diary_id": self.diary.id})
        self.assertTrue(r4.json()["done"])

        response = self.client.post("/api/finalize-diary/", {"diary_id": self.diary.id})
        self.assertEqual(response.json()["status"], "success")

        self.diary.refresh_from_db()
        self.assertIn("公園散步", self.diary.transcription)
        self.assertIn("鄰居", self.diary.transcription)
        self.assertNotIn("使用者選擇跳過此題", self.diary.transcription)

        post = Diarypost.objects.get(diary_title=self.diary)
        self.assertEqual(len(post.suggested_replies), 3)

        # finalize 後，第 2～4 輪的暫存錄音都該清空
        self.assertEqual(ChatReplyAudio.objects.filter(conversation=conv).count(), 0)

    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    def test_notification_created_on_voice_reply(self, mock_mp3):
        """親友上傳語音加油後，日記主人有一筆未讀通知。"""
        audio = self._tiny_audio("reply.webm")
        response = self.client.post("/api/voice-reply/", {
            "diary_id": self.diary.id,
            "audio_file": audio,
            "sender_name": "小明",
        })
        self.assertEqual(response.json()["status"], "ok")

        note = Notification.objects.get(user=self.user, kind="voice_reply")
        self.assertFalse(note.is_read)
        self.assertIn("小明", note.message)

    @patch("Voice.views._convert_audio_to_mp3", return_value=None)
    def test_notifications_clear_deletes_all(self, mock_mp3):
        """按「清除全部」要把通知直接刪掉，不是只標記已讀（標記已讀通知還會留在清單裡）。"""
        self.client.force_login(self.user)
        for i in range(3):
            self.client.post("/api/voice-reply/", {
                "diary_id": self.diary.id,
                "audio_file": self._tiny_audio(f"reply{i}.webm"),
                "sender_name": f"朋友{i}",
            })
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 3)

        response = self.client.post(
            "/api/notifications/clear/",
            data=json.dumps({"all": True}),
            content_type="application/json",
        )
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 0)

        # mark-read 只改 is_read，不該刪除通知
        self.client.post("/api/voice-reply/", {
            "diary_id": self.diary.id,
            "audio_file": self._tiny_audio("reply_after.webm"),
            "sender_name": "朋友",
        })
        self.client.post(
            "/api/notifications/mark-read/",
            data=json.dumps({"all": True}),
            content_type="application/json",
        )
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)
        self.assertTrue(Notification.objects.get(user=self.user).is_read)
