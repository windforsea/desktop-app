import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from openai import OpenAI


class WeatherReportGenerator:
    """기상청 날씨 데이터와 예보관 대화 내역을 종합하여 공식 기상 브리핑 보고서(.txt)를 생성하고 저장하는 클래스"""

    def __init__(self, client: OpenAI, model_name: str = "gpt-5.6-luna") -> None:
        self.client = client
        self.model_name = model_name

        # 보고서 저장 디렉터리 설정 (프로젝트 루트 / reports)
        project_root = Path(__file__).resolve().parent.parent.parent
        self.reports_dir = project_root / "reports"
        self.reports_dir.mkdir(parents=True, exist_ok=True)

    def generate_and_save_report(
        self,
        weather_summary: Dict[str, Any],
        hourly_forecast: List[Dict[str, Any]],
        chat_history: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """날씨 데이터와 챗봇 대화 내역을 종합하여 기상청 보고서를 생성하고 .txt 파일로 저장"""
        now_dt = datetime.now()
        timestamp_str = now_dt.strftime("%Y%m%d_%H%M%S")
        date_display = now_dt.strftime("%Y년 %m월 %d일 %H시 %M분")

        # 1. 기상청 관측 및 예보 데이터 텍스트 정제
        weather_context = f"""
[기상청 실시간 예보 관측치]
- 대상 지역: {weather_summary.get('location', '울산광역시')}
- 발표 기준일시: {weather_summary.get('base_date', '')} {weather_summary.get('base_time', '')}
- 현재 기온: {weather_summary.get('temperature', '-')}
- 날씨 상태: {weather_summary.get('condition', '-')}
- 강수확률: {weather_summary.get('rain_prob', '-')} (강수형태: {weather_summary.get('pty_desc', '없음')})
- 습도: {weather_summary.get('humidity', '-')}
- 풍속: {weather_summary.get('wind_speed', '-')}

[향후 시간대별 단기예보 요약]
"""
        for h in hourly_forecast[:8]:
            weather_context += f"- {h.get('date')} {h.get('time')}: 기온 {h.get('temp')}, 날씨 {h.get('condition')}, 강수확률 {h.get('pop')}, 습도 {h.get('reh')}\n"

        # 2. 기상청 직원이 챗봇에게 입력한 특이사항 및 지시사항 종합
        staff_notes = ""
        if chat_history:
            staff_notes = "\n[기상청 실무 직원 및 예보관 실시간 전달/추가사항]:\n"
            for msg in chat_history:
                role_kr = "기상청 직원" if msg.get("role") == "user" else "예보관 AI 보조"
                staff_notes += f"- {role_kr}: {msg.get('content')}\n"
        else:
            staff_notes = "\n[기상청 실무 직원 추가사항]: 별도 추가 전달사항 없음 (기상청 표준 기상 개황 및 정제 데이터 기준 작성)\n"

        # 3. LLM 프롬프트 구성 (공식 기상 통보문 스타일)
        system_instructions = (
            "당신은 기상청의 수석 기상예보관입니다. "
            "제공된 기상청 실시간 예보 데이터와 기상청 실무 직원의 추가 전달사항(특이사항, 방재 대책, 현장 지시 등)을 "
            "모두 종합하여, 공공기관 및 대민 브리핑에 적합한 공식 '기상 통보문(일일 기상 브리핑 보고서)' 텍스트 문서를 작성하세요.\n\n"
            "작성 가이드라인:\n"
            "1. 문서는 마크다운 서식이나 특수 기호 대신, 텍스트(.txt) 파일로 읽기 좋은 깔끔한 구분선(===, ---)과 번호 체계를 사용하세요.\n"
            "2. 필수 포함 항목:\n"
            "   - 문서 제목 (기상청 일일 기상 통보서 - 울산광역시)\n"
            "   - 발령 및 작성 일시\n"
            "   - [1. 기상 개황 및 종합 평가]\n"
            "   - [2. 주요 기상 요소별 상세 분석 (기온, 강수, 바람, 습도)]\n"
            "   - [3. 시간대별 단기예보 및 변화 추이]\n"
            "   - [4. 예보관 특이사항 및 직원 지시사항 반영 (중요)] -> 직원이 챗봇에게 말한 내용이 있으면 상세히 자연스럽게 녹여내고, 없으면 일반 기상 유의사항으로 정리\n"
            "   - [5. 방재 및 시민 생활 권고사항]\n"
            "3. 어조는 기상청 공식 발표문답게 신뢰감 있고 명확하며 전문적인 한국어 경어체(~합니다, ~바랍니다)를 사용하세요."
        )

        user_prompt = f"""작성 기준일시: {date_display}
다음 기상 데이터와 예보관 추가사항을 바탕으로 완성도 높은 공식 기상 보고서를 작성해 주세요:

{weather_context}
{staff_notes}
"""

        try:
            # 4. OpenAI Responses API 호출
            response = self.client.responses.create(
                model=self.model_name,
                instructions=system_instructions,
                input=user_prompt,
            )
            report_content = response.output_text.strip()

            # 5. .txt 파일로 저장
            filename = f"기상보고서_울산_{timestamp_str}.txt"
            file_path = self.reports_dir / filename

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(report_content)

            return {
                "success": True,
                "report_text": report_content,
                "file_path": str(file_path),
                "filename": filename,
                "created_at": date_display,
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"보고서 생성 실패: {str(e)}",
            }
