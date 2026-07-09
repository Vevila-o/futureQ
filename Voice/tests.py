from django.test import TestCase

from Voice.utils import (
    analyze_transcription,
    assess_sample_quality,
    calc_lvi,
    calc_lvi_trend,
    collapse_repetitions,
    get_risk_result,
    tag_all_categories,
)


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
