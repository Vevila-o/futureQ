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
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))


def find_matched_words(text, word_list):
    """
    找出實際命中的不同關鍵詞。

    較長詞優先，例如先匹配「我們」，
    再匹配「我」，降低重複命中的情況。
    """
    matched_words = []
    remaining_text = text

    for word in sorted(set(word_list), key=len, reverse=True):
        if word in remaining_text:
            matched_words.append(word)
            remaining_text = remaining_text.replace(word, " ")

    return matched_words


def count_sentence_markers(text):
    """
    粗略判斷有幾個句子或語意片段。
    Whisper 常會產生逗號、句號、問號。
    """
    markers = re.findall(r"[，。！？；,.!?;]", text)
    return len(markers)


# ==============================
# 結果等級
# ==============================
def get_risk_result(total_score):
    """
    六項分數最高 24 分。

    注意：
    risk_level 代表本次語言表達追蹤狀況，
    不代表失智症診斷結果。
    """
    if total_score >= 19:
        return {
            "risk_level": "low",
            "suggestion": (
                "本週語言表達狀況良好，內容具有一定完整性。"
                "建議持續維持日常對話、社交互動與規律生活。"
                "本結果僅供語言表達與健康趨勢追蹤參考，"
                "不能作為醫療診斷依據。"
            ),
        }

    elif total_score >= 13:
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

    event_words = [
        "搭公車", "搭捷運", "搭火車", "看醫生",
        "吃早餐", "吃午餐", "吃晚餐",
        "散步", "吃飯", "聊天", "買菜",
        "購物", "煮飯", "煮菜", "看到",
        "遇到", "玩耍", "拍照", "運動",
        "走路", "旅行", "上課", "唱歌",
        "跳舞", "看電視", "看書", "喝茶",
        "喝咖啡", "打電話", "聚餐", "賞花",
        "照顧", "幫忙", "送", "拿", "放",
        "買", "煮", "玩",
    ]

    object_words = [
        "腳踏車", "自行車", "公車", "汽車",
        "手機", "電視", "照片", "相簿",
        "花", "小狗", "狗", "小貓", "貓",
        "樹", "水果", "蘋果", "香蕉", "橘子",
        "飯", "青菜", "菜", "餅乾", "蛋糕",
        "椅子", "桌子", "水槽", "杯子",
        "雨傘", "帽子", "衣服", "鞋子",
        "錢包", "鑰匙", "眼鏡", "藥",
    ]

    emotion_words = [
        "很開心", "不開心", "很高興", "很幸福",
        "開心", "高興", "快樂", "幸福",
        "溫暖", "熱鬧", "感動", "安心",
        "輕鬆", "舒服", "期待", "驚喜",
        "難過", "傷心", "孤單", "寂寞",
        "生氣", "擔心", "緊張", "害怕",
        "疲倦", "疲累", "累", "想念",
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
    # 找出實際命中詞
    # ------------------------------
    person_matches = find_matched_words(text, person_words)
    location_matches = find_matched_words(text, location_words)
    event_matches = find_matched_words(text, event_words)
    object_matches = find_matched_words(text, object_words)
    emotion_matches = find_matched_words(text, emotion_words)
    time_matches = find_matched_words(text, time_words)
    connector_matches = find_matched_words(text, connector_words)

    hesitation_count = sum(text.count(word) for word in hesitation_words)
    sentence_marker_count = count_sentence_markers(original_text)

    has_person = len(person_matches) > 0
    has_location = len(location_matches) > 0
    has_event = len(event_matches) > 0
    has_object = len(object_matches) > 0
    has_emotion = len(emotion_matches) > 0
    has_time = len(time_matches) > 0
    has_connector = len(connector_matches) > 0

    # ==============================
    # 1. 流暢度
    # 綜合描述長度與猶豫語數量
    # ==============================
    if content_length == 0:
        fluency_score = 0

    elif content_length < 10:
        fluency_score = 1

    elif content_length < 20:
        fluency_score = 2

    elif content_length < 35:
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

    # ==============================
    # 2. 資訊量
    # 看人物、地點、事件、物品、情緒、時間
    # 出現了多少種類，不是單純計算總詞數
    # ==============================
    information_dimensions = [
        has_person,
        has_location,
        has_event,
        has_object,
        has_emotion,
        has_time,
    ]

    info_count = sum(information_dimensions)

    if info_count >= 5:
        information_score = 4
    elif info_count >= 4:
        information_score = 3
    elif info_count >= 2:
        information_score = 2
    elif info_count == 1:
        information_score = 1
    else:
        information_score = 0

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
    # 使用加權平均，資訊與語意稍微重要一些
    # ==============================
    weighted_score = (
        fluency_score * 0.20
        + information_score * 0.20
        + sentence_score * 0.20
        + naming_score * 0.15
        + semantic_score * 0.25
    )

    communication_score = round(weighted_score)
    communication_score = max(0, min(4, communication_score))

    # 空白文字一定是 0
    if content_length == 0:
        communication_score = 0

    # ==============================
    # 總分
    # ==============================
    total_score = (
        fluency_score
        + information_score
        + sentence_score
        + naming_score
        + semantic_score
        + communication_score
    )

    average_score = round(total_score / 6, 2)
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