import math
import re


# ==============================
# 文字前處理
# ==============================
def normalize_text(text):
    """
    統一文字格式，避免空白、標點影響字數判斷。
    """
    text = text or ""
    text = text.strip()
    text = re.sub(r"\s+", "", text)
    return text


def get_content_length(text):
    """
    計算實際中文字、英文字母與數字數量，
    不把標點符號算進描述長度。
    """
    return len(re.findall(r"[一-鿿A-Za-z0-9]", text))


def collapse_repetitions(text):
    """
    壓縮連續重複的字元／短語，用於計算「有效內容長度」。

    中文有正常的疊字用法（謝謝、常常、剛剛、慢慢），
    因此單字要連續 3 次以上、短語需整段重複，才視為口吃／跳針，
    避免把正常疊字誤判成內容灌水。
    """
    text = re.sub(r"(.)\1{2,}", r"\1", text)           # 單字連續 3 次以上 → 收斂成 1
    text = re.sub(r"(.{2,6}?)\1{1,}", r"\1", text)     # 2~6 字短語連續重複 → 收斂成 1
    return text


def get_effective_length(text):
    """扣除重複跳針後的實際內容長度。"""
    return get_content_length(collapse_repetitions(text))


def count_sentence_markers(text):
    """
    粗略判斷有幾個句子或語意片段。
    Whisper 常會產生逗號、句號、問號。
    """
    markers = re.findall(r"[，。！？；,.!?;]", text)
    return len(markers)


# ==============================
# 樣本品質檢查
# ==============================
MIN_CONTENT_LENGTH = 15
MIN_AUDIO_SECONDS = 5

# Whisper 中文常見的幻覺輸出（多半來自訓練資料中的 YouTube 字幕片尾語）。
# 命中代表這段轉錄極可能不是使用者真正說的話，不該拿去做認知分析。
WHISPER_HALLUCINATION_PATTERNS = [
    "謝謝觀看", "謝謝大家", "請訂閱", "請點讚", "點讚訂閱",
    "字幕組", "中文字幕", "感謝收看", "下集再見",
    "不吝點贊", "轉發", "打賞", "訂閱頻道", "按讚分享",
]


def assess_sample_quality(raw_text, whisper_result=None, audio_seconds=None):
    """
    判斷這段轉錄文字是否適合拿去做認知分析。

    回傳 "ok" / "too_short" / "suspect_hallucination" / "low_confidence"。
    只有 "ok" 才應該呼叫 analyze_transcription 並寫入正常的 CognitiveAnalysis；
    其餘情況代表空錄音、雜音或 Whisper 幻覺，應該記錄為無效樣本，
    不能被當成「本週語言表達高風險」。
    """
    text = normalize_text(raw_text)

    if get_content_length(text) < MIN_CONTENT_LENGTH:
        return "too_short"

    for pattern in WHISPER_HALLUCINATION_PATTERNS:
        if pattern in text:
            return "suspect_hallucination"

    if audio_seconds is not None and audio_seconds < MIN_AUDIO_SECONDS:
        return "too_short"

    # Whisper 每個 segment 都帶有信心指標，可用來抓「辨識品質低」的樣本
    if whisper_result:
        segments = whisper_result.get("segments") or []
        if segments:
            avg_logprob = sum(s.get("avg_logprob", 0) for s in segments) / len(segments)
            no_speech = sum(s.get("no_speech_prob", 0) for s in segments) / len(segments)
            compression = max((s.get("compression_ratio", 0) for s in segments), default=0)

            if avg_logprob < -1.0:        # 辨識信心過低
                return "low_confidence"
            if no_speech > 0.6:           # 極可能是靜音／雜音
                return "low_confidence"
            if compression > 2.4:         # 重複迴圈，幻覺常見特徵
                return "suspect_hallucination"

    return "ok"


# ==============================
# 類別命中（單次掃描，避免跨類別重複計分）
# ==============================
# 字數相同時的命中優先序，數字越小優先權越高。
CATEGORY_PRIORITY = {
    "event": 0,
    "location": 1,
    "object": 2,
    "person": 3,
    "time": 4,
    "emotion": 5,
    "connector": 6,
}


def tag_all_categories(text, category_words):
    """
    在同一次掃描中比對所有類別，確保同一段字只會被歸類到一個類別，
    避免「家人」同時被算進人物與地點（「家」）、
    「買菜」被拆成事件（「買」）+ 物品（「菜」）重複計分。

    比對順序：詞彙長度由長到短，長度相同時依 CATEGORY_PRIORITY 排序，
    確保結果是決定性的（不受 dict 插入順序影響）。
    """
    pairs = [
        (word, cat)
        for cat, words in category_words.items()
        for word in set(words)
        if word
    ]
    pairs.sort(key=lambda p: (-len(p[0]), CATEGORY_PRIORITY.get(p[1], 99), p[0]))

    remaining = text
    matches = {cat: [] for cat in category_words}

    for word, cat in pairs:
        if word in remaining:
            matches[cat].append(word)
            # 用等長佔位符取代，避免被更短的詞彙從中間再次命中
            remaining = remaining.replace(word, " " * len(word))

    return matches


# ==============================
# 結果等級
# ==============================
def get_risk_result(total_score):
    """
    五項獨立維度（流暢度／資訊量／句子結構／命名能力／語意完整性）加總，滿分 20。

    注意：
    risk_level 代表本次語言表達追蹤狀況，
    不代表失智症診斷結果。
    """
    if total_score >= 16:
        return {
            "risk_level": "low",
            "suggestion": (
                "本週語言表達狀況良好，內容具有一定完整性。"
                "建議持續維持日常對話、社交互動與規律生活。"
                "本結果僅供語言表達與健康趨勢追蹤參考，"
                "不能作為醫療診斷依據。"
            ),
        }

    elif total_score >= 11:
        return {
            "risk_level": "medium",
            "suggestion": (
                "本週語言表達部分項目較不完整，"
                "建議家屬持續觀察後續紀錄是否出現相同情形。"
                "若類似狀況持續發生或逐漸明顯，"
                "可諮詢醫師或相關專業人員。"
                "本結果僅供健康趨勢追蹤參考，不能作為醫療診斷依據。"
            ),
        }

    return {
        "risk_level": "high",
        "suggestion": (
            "本週描述內容較少或部分語言表達項目較弱，"
            "可能也受到錄音長度、環境聲音、語音辨識結果或當下狀態影響。"
            "建議家屬多加關心並持續觀察多次紀錄；"
            "若長期出現明顯下降，可考慮至醫院或專業門診進一步評估。"
            "本結果僅供健康趨勢追蹤參考，不能作為醫療診斷依據。"
        ),
    }


# ==============================
# 主分析函式
# ==============================
def analyze_transcription(text):
    original_text = text or ""
    text = normalize_text(original_text)
    content_length = get_content_length(text)
    effective_length = get_effective_length(text)

    repetition_ratio = 0.0
    if content_length > 0:
        repetition_ratio = 1 - (effective_length / content_length)

    # ------------------------------
    # 關鍵詞庫
    # 實際使用時可以移到 constants.py
    # ------------------------------
    person_words = [
        "我們", "自己", "大家", "本人", "我",
        "孫子", "孫女", "女兒", "兒子", "孩子",
        "家人", "先生", "太太", "老公", "老婆",
        "朋友", "鄰居", "同學", "同事",
        "媽媽", "爸爸", "阿公", "阿嬤",
        "哥哥", "弟弟", "姐姐", "妹妹",
        "老師", "醫生", "護士", "店員", "老闆",
    ]

    location_words = [
        "菜市場", "活動中心", "火車站", "公車站",
        "捷運站", "百貨公司", "便利商店",
        "公園", "市場", "家裡", "家",
        "客廳", "房間", "廚房", "餐廳",
        "醫院", "診所", "學校", "教室",
        "社區", "超市", "夜市", "商店",
        "海邊", "山上", "河邊", "花園",
        "車站", "路上", "街上",
    ]

    # 移除單字動詞（送、拿、放、買、煮、玩）：這些字太短，
    # 常常只是別的詞（放假、買單、拿手…）裡的一部分，會被誤判成事件。
    event_words = [
        "搭公車", "搭捷運", "搭火車", "看醫生",
        "吃早餐", "吃午餐", "吃晚餐",
        "散步", "吃飯", "聊天", "買菜", "購物",
        "煮飯", "煮菜", "看到", "遇到", "玩耍", "拍照", "運動",
        "走路", "旅行", "上課", "唱歌",
        "跳舞", "看電視", "看書", "喝茶",
        "喝咖啡", "打電話", "聚餐", "賞花",
        "照顧", "幫忙", "拜訪", "拜拜",
        "回家", "睡覺", "打掃", "洗衣服",
        "掃地", "拖地", "澆水", "種花",
        "泡茶", "看診", "復健", "按摩",
        "做早操", "打太極", "曬太陽",
        "逛街", "逛夜市", "去市場",
        "帶孫子", "接孫子", "看孫子",
        "打牌", "下棋", "打麻將",
    ]

    # 移除單字物品（花、狗、貓、樹、飯、菜、藥）：改用多字詞，
    # 避免「買菜」的「菜」、「吃飯」的「飯」被重複算成物品。
    object_words = [
        "腳踏車", "自行車", "公車", "汽車",
        "手機", "電視", "照片", "相簿",
        "花朵", "鮮花", "小狗", "小貓",
        "大樹", "樹木", "水果", "蘋果", "香蕉", "橘子",
        "白飯", "青菜", "餅乾", "蛋糕",
        "椅子", "桌子", "水槽", "杯子",
        "雨傘", "帽子", "衣服", "鞋子",
        "錢包", "鑰匙", "眼鏡", "藥品", "藥物",
    ]

    # 移除單字「累」：「疲累」已涵蓋，單字「累」太容易誤中其他詞。
    emotion_words = [
        "很開心", "不開心", "很高興", "很幸福",
        "開心", "高興", "快樂", "幸福",
        "溫暖", "熱鬧", "感動", "安心",
        "輕鬆", "舒服", "期待", "驚喜",
        "難過", "傷心", "孤單", "寂寞",
        "生氣", "擔心", "緊張", "害怕",
        "疲倦", "疲累", "好累", "很累", "想念",
    ]

    time_words = [
        "大前天", "前幾天", "上個星期", "下個星期",
        "這個星期", "上個月", "下個月",
        "今天", "昨天", "前天", "明天",
        "早上", "上午", "中午", "下午",
        "傍晚", "晚上", "半夜",
        "今年", "去年", "前年", "明年",
        "星期一", "星期二", "星期三", "星期四",
        "星期五", "星期六", "星期日", "星期天",
        "週末", "最近", "剛才", "剛剛",
        "以前", "小時候",
    ]

    # 連接詞可協助判斷敘述結構
    connector_words = [
        "然後", "後來", "接著", "因為", "所以",
        "但是", "不過", "而且", "還有",
        "之後", "首先", "最後", "同時",
    ]

    # Whisper 可能辨識出的猶豫與填充語
    hesitation_words = [
        "嗯", "呃", "那個", "這個", "就是",
        "怎麼說", "想一下", "我不知道",
        "想不起來", "忘記了",
    ]

    # ------------------------------
    # 找出實際命中詞（單次掃描，跨類別互斥）
    # ------------------------------
    category_words = {
        "person": person_words,
        "location": location_words,
        "event": event_words,
        "object": object_words,
        "emotion": emotion_words,
        "time": time_words,
        "connector": connector_words,
    }
    matches = tag_all_categories(text, category_words)

    person_matches = matches["person"]
    location_matches = matches["location"]
    event_matches = matches["event"]
    object_matches = matches["object"]
    emotion_matches = matches["emotion"]
    time_matches = matches["time"]
    connector_matches = matches["connector"]

    hesitation_count = sum(text.count(word) for word in hesitation_words)
    sentence_marker_count = count_sentence_markers(original_text)

    # 「我／自己／本人」只是第一人稱泛稱，不算真正提到具體人物，
    # 資訊量維度只看有實質內容的人物提及。
    substantive_person_matches = [
        w for w in person_matches if w not in {"我", "自己", "本人"}
    ]

    has_person = len(person_matches) > 0
    has_person_substantive = len(substantive_person_matches) > 0
    has_location = len(location_matches) > 0
    has_event = len(event_matches) > 0
    has_object = len(object_matches) > 0
    has_emotion = len(emotion_matches) > 0
    has_time = len(time_matches) > 0
    has_connector = len(connector_matches) > 0

    # ==============================
    # 1. 流暢度
    # 用扣除重複跳針後的「有效長度」判斷，避免覆誦/口吃被誤判成內容豐富。
    # ==============================
    if effective_length == 0:
        fluency_score = 0

    elif effective_length < 10:
        fluency_score = 1

    elif effective_length < 20:
        fluency_score = 2

    elif effective_length < 35:
        if hesitation_count >= 4:
            fluency_score = 2
        else:
            fluency_score = 3

    else:
        if hesitation_count >= 6:
            fluency_score = 2
        elif hesitation_count >= 3:
            fluency_score = 3
        else:
            fluency_score = 4

    # 重複比例過高（跳針／覆誦）額外扣分，最低扣到 0
    if repetition_ratio >= 0.30:
        fluency_score = max(0, fluency_score - 1)

    # ==============================
    # 2. 資訊量
    # 看人物、地點、事件、物品、情緒、時間
    # 出現了多少種類，不是單純計算總詞數
    # ==============================
    information_dimensions = [
        has_person_substantive,
        has_location,
        has_event,
        has_object,
        has_emotion,
        has_time,
    ]

    info_count = sum(information_dimensions)

    # 命中種類越多，分數提升的邊際效益遞減；滿 4 種即滿分
    INFO_SCORE_MAP = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 4}
    information_score = INFO_SCORE_MAP[info_count]

    # ==============================
    # 3. 句子結構
    # 判斷是否有人物、動作、補充資訊與連接詞
    # ==============================
    if content_length == 0:
        sentence_score = 0

    elif has_person and has_event:
        detail_count = sum([
            has_location,
            has_object,
            has_time,
            has_emotion,
        ])

        if (
            content_length >= 30
            and detail_count >= 2
            and (has_connector or sentence_marker_count >= 2)
        ):
            sentence_score = 4

        elif content_length >= 20 and detail_count >= 1:
            sentence_score = 3

        else:
            sentence_score = 2

    elif has_event:
        sentence_score = 2

    else:
        sentence_score = 1

    # ==============================
    # 4. 命名能力
    # 只計算不同的人物、地點與物品名稱
    # ==============================
    naming_matches = set(
        person_matches
        + location_matches
        + object_matches
    )

    naming_count = len(naming_matches)

    if naming_count >= 5:
        naming_score = 4
    elif naming_count >= 3:
        naming_score = 3
    elif naming_count == 2:
        naming_score = 2
    elif naming_count == 1:
        naming_score = 1
    else:
        naming_score = 0

    # ==============================
    # 5. 語意完整性
    #
    # 目前只有文字，無法真正判斷照片是否描述正確，
    # 因此建議名稱使用「語意完整性」，
    # 不要直接稱為「語意正確性」。
    # ==============================
    core_elements = sum([
        has_person,
        has_event,
        has_object,
    ])

    context_elements = sum([
        has_location,
        has_time,
        has_emotion,
    ])

    if content_length == 0:
        semantic_score = 0

    elif core_elements == 3 and context_elements >= 2:
        semantic_score = 4

    elif core_elements >= 2 and context_elements >= 1:
        semantic_score = 3

    elif has_event and (has_person or has_object):
        semantic_score = 2

    elif has_event or has_person or has_object:
        semantic_score = 1

    else:
        semantic_score = 0

    # ==============================
    # 6. 整體溝通能力
    # 使用加權平均，屬於衍生的總結性指標，不重複計入總分。
    # ==============================
    weighted_score = (
        fluency_score * 0.20
        + information_score * 0.20
        + sentence_score * 0.20
        + naming_score * 0.15
        + semantic_score * 0.25
    )

    # 用四捨五入（非銀行家捨入）取整數，避免 .5 的分數忽上忽下不一致
    communication_score = int(math.floor(weighted_score + 0.5))
    communication_score = max(0, min(4, communication_score))

    # 空白文字一定是 0
    if content_length == 0:
        communication_score = 0

    # ==============================
    # 總分
    # 五項獨立維度加總，滿分 20；communication_score 是由這五項
    # 加權平均出來的衍生指標，不再重複計入總分。
    # ==============================
    total_score = (
        fluency_score
        + information_score
        + sentence_score
        + naming_score
        + semantic_score
    )

    average_score = round(total_score / 5, 2)
    risk_result = get_risk_result(total_score)

    return {
        "fluency_score": fluency_score,
        "information_score": information_score,
        "sentence_score": sentence_score,
        "naming_score": naming_score,
        "semantic_score": semantic_score,
        "communication_score": communication_score,

        "total_score": total_score,
        "average_score": average_score,
        "risk_level": risk_result["risk_level"],
        "suggestion": risk_result["suggestion"],

        "ai_feedback": (
            "本次描述已完成六項語言表達分析。"
            "建議以多次紀錄的變化趨勢作為主要觀察依據，"
            "單次結果僅供參考。"
        ),

        # 建議保留這些資料，方便開發時查看為什麼得分
        "analysis_details": {
            "content_length": content_length,
            "effective_length": effective_length,
            "repetition_ratio": round(repetition_ratio, 2),
            "hesitation_count": hesitation_count,
            "sentence_marker_count": sentence_marker_count,
            "person_matches": person_matches,
            "location_matches": location_matches,
            "event_matches": event_matches,
            "object_matches": object_matches,
            "emotion_matches": emotion_matches,
            "time_matches": time_matches,
            "connector_matches": connector_matches,
            "information_dimension_count": info_count,
            "naming_count": naming_count,
        },
    }


# ==============================
# 語言活力指數（Language Vitality Index, LVI）
# 取代原本的「腦年齡」估算，避免用一段沒有腦影像/訓練資料依據的
# 年齡數字（+8/-5/+2）暗示醫學意義。
# ==============================
MIN_ENTRIES_FOR_BASELINE = 5    # 少於 5 筆歷史資料不做趨勢比較
LVI_TREND_UP = "up"
LVI_TREND_FLAT = "flat"
LVI_TREND_DOWN = "down"


def calc_lvi(avg_total_score, max_total=20):
    """
    語言活力指數（0～100）。

    這不是年齡、不是醫學指標，只是把五項維度總分線性換算到 0～100，
    方便使用者一眼看出「這週表達狀況大概落在哪裡」。

    max_total 預設 20（對應 analyze_transcription 五項獨立維度加總後的滿分）。
    """
    if avg_total_score is None:
        return None
    lvi = round((avg_total_score / max_total) * 100)
    return max(0, min(100, lvi))


def calc_lvi_trend(current_avg, baseline_avgs, max_total=20):
    """
    跟個人歷史基線比較，回傳 (trend, delta)。

    baseline_avgs：該使用者「更早之前」每篇日記的 total_score 清單
                   （不含本次計算窗口內的資料）。
    資料不足時回傳 (None, None)，前端應顯示「還在認識你的說話習慣」，
    不要硬湊一個趨勢出來。

    門檻：LVI 差距 >= 5 才算變化，避免每天的自然波動被當成趨勢。
    """
    if current_avg is None:
        return (None, None)
    if len(baseline_avgs) < MIN_ENTRIES_FOR_BASELINE:
        return (None, None)

    baseline_mean = sum(baseline_avgs) / len(baseline_avgs)
    current_lvi = calc_lvi(current_avg, max_total)
    baseline_lvi = calc_lvi(baseline_mean, max_total)
    delta = current_lvi - baseline_lvi

    if delta >= 5:
        return (LVI_TREND_UP, delta)
    elif delta <= -5:
        return (LVI_TREND_DOWN, delta)
    else:
        return (LVI_TREND_FLAT, delta)


# ==============================
# 雷達圖格式
# ==============================
def format_analysis_for_radar(analysis_result):
    return {
        "radar_data": [
            {
                "label": "流暢度",
                "key": "fluency_score",
                "value": analysis_result["fluency_score"],
            },
            {
                "label": "資訊量",
                "key": "information_score",
                "value": analysis_result["information_score"],
            },
            {
                "label": "句子結構",
                "key": "sentence_score",
                "value": analysis_result["sentence_score"],
            },
            {
                "label": "命名能力",
                "key": "naming_score",
                "value": analysis_result["naming_score"],
            },
            {
                # 只有文字時，建議改叫語意完整性
                "label": "語意完整性",
                "key": "semantic_score",
                "value": analysis_result["semantic_score"],
            },
            {
                "label": "整體溝通能力",
                "key": "communication_score",
                "value": analysis_result["communication_score"],
            },
        ],
        "summary": {
            "total_score": analysis_result["total_score"],
            "average_score": analysis_result["average_score"],
            "risk_level": analysis_result["risk_level"],
            "suggestion": analysis_result["suggestion"],
            "ai_feedback": analysis_result["ai_feedback"],
        },
    }
