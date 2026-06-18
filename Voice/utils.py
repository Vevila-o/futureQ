def get_risk_result(total_score):
    if total_score >= 19:
        return {
            "risk_level": "low",
            "suggestion": "本次語言表達狀況良好，請持續保持日常互動與規律生活。本結果僅供健康追蹤參考，不能作為醫療診斷依據，實際狀況仍請以醫師或醫院檢查為準。"
        }
    elif total_score >= 12:
        return {
            "risk_level": "medium",
            "suggestion": "本次語言表達有部分項目中等，建議家屬持續觀察。若類似情形持續出現，建議諮詢專業醫師。本結果僅供健康追蹤參考，不能作為醫療診斷依據。"
        }
    else:
        return {
            "risk_level": "high",
            "suggestion": "本次語言表達分數較弱，建議家屬多加關心，並可考慮安排至醫院或專業門診進一步評估。本結果僅供健康追蹤參考，不能作為醫療診斷依據。"
        }


def analyze_transcription(text):
    text = text or ""

    person_words = ["我", "孫子", "女兒", "兒子", "家人", "朋友", "鄰居", "媽媽", "爸爸"]
    location_words = ["公園", "市場", "家", "客廳", "餐廳", "醫院", "學校"]
    event_words = ["散步", "吃飯", "聊天", "買", "煮", "看到", "遇到", "玩", "拍照", "愛"]
    object_words = ["花", "狗", "貓", "樹", "水果", "蘋果", "香蕉", "飯", "菜", "餅乾", "椅子", "水槽"]
    emotion_words = ["開心", "高興", "幸福", "溫暖", "熱鬧", "難過", "孤單", "生氣", "累"]
    time_words = ["今天", "昨天", "早上", "中午", "晚上", "去年", "下午"]

    has_person = any(word in text for word in person_words)
    has_location = any(word in text for word in location_words)
    has_event = any(word in text for word in event_words)
    has_object = any(word in text for word in object_words)
    has_emotion = any(word in text for word in emotion_words)
    has_time = any(word in text for word in time_words)

    # 1. 流暢度
    if len(text) >= 30:
        fluency_score = 4
    elif len(text) >= 20:
        fluency_score = 3
    elif len(text) >= 10:
        fluency_score = 2
    elif len(text) > 0:
        fluency_score = 1
    else:
        fluency_score = 0

    # 2. 資訊量
    info_count = sum([
        has_person,
        has_location,
        has_event,
        has_object,
        has_emotion,
        has_time,
    ])

    if info_count >= 5:
        information_score = 4
    elif info_count >= 4:
        information_score = 3
    elif info_count >= 2:
        information_score = 2
    elif info_count >= 1:
        information_score = 1
    else:
        information_score = 0

    # 3. 句子結構
    if has_person and has_event and len(text) >= 20:
        sentence_score = 4
    elif has_event and len(text) >= 15:
        sentence_score = 3
    elif has_event:
        sentence_score = 2
    elif len(text) > 0:
        sentence_score = 1
    else:
        sentence_score = 0

    # 4. 命名能力
    naming_words = person_words + location_words + object_words
    name_count = sum(1 for word in naming_words if word in text)

    if name_count >= 4:
        naming_score = 4
    elif name_count == 3:
        naming_score = 3
    elif name_count == 2:
        naming_score = 2
    elif name_count == 1:
        naming_score = 1
    else:
        naming_score = 0

    # 5. 語意正確性
    if has_person and has_event and has_object:
        semantic_score = 4
    elif has_event and (has_person or has_object):
        semantic_score = 3
    elif has_event:
        semantic_score = 2
    elif len(text) > 0:
        semantic_score = 1
    else:
        semantic_score = 0

    # 6. 整體溝通能力
    communication_score = round(
        (
            fluency_score
            + information_score
            + sentence_score
            + naming_score
            + semantic_score
        ) / 5
    )

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
        "ai_feedback": "本次描述已完成六項語言表達分析，可作為健康儀表板趨勢追蹤參考。"
    }

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
                "label": "語意正確性",
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
        }
    }