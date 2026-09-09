import os
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv
from openai import OpenAI

from desktop_app.weather import UlsanWeatherService
from desktop_app.report import WeatherReportGenerator


class ChatApi:
    """pywebview의 JavaScript와 통신하는 통합 백엔드 API 브리지 클래스"""

    def __init__(self) -> None:
        # 1. 환경 변수 로드 (.env의 OPENAI_API_KEY, DATA_GO_KR_API_KEY)
        load_dotenv()

        # 2. OpenAI 클라이언트 초기화
        self.client = OpenAI()

        # 3. 메인 탭 AI 메신저 설정
        self.model_name = "gpt-5.6-luna"
        self.instructions = (
            "당신은 데스크톱 메신저에서 사용자와 대화하는 친절하고 유능한 AI 어시스턴트입니다. "
            "간결하고 가독성 좋은 한국어로 명확하게 답변하세요."
        )
        self.history: List[Dict[str, str]] = []

        # 4. 울산 날씨 서비스 초기화
        self.weather_service = UlsanWeatherService()

        # 5. 기상청 직원용 예보관 AI 어시스턴트 설정 및 보고서 생성기 초기화
        self.weather_chat_history: List[Dict[str, str]] = []
        self.report_generator = WeatherReportGenerator(self.client, self.model_name)

    # --------------------------------------------------------------------------
    # [탭 1] 일반 AI 메신저 API
    # --------------------------------------------------------------------------
    def send_message(self, user_text: str) -> Dict[str, Any]:
        """일반 AI 메신저 대화 처리"""
        text = user_text.strip() if user_text else ""
        if not text:
            return {"success": False, "error": "메시지가 비어 있습니다."}

        try:
            self.history.append({"role": "user", "content": text})

            response = self.client.responses.create(
                model=self.model_name,
                instructions=self.instructions,
                input=self.history,
            )

            reply_text = response.output_text
            self.history.append({"role": "assistant", "content": reply_text})

            return {
                "success": True,
                "reply": reply_text,
                "model": self.model_name,
            }
        except Exception as e:
            if self.history and self.history[-1].get("role") == "user":
                self.history.pop()
            return {"success": False, "error": f"AI 응답 생성 실패: {str(e)}"}

    def clear_history(self) -> Dict[str, bool]:
        """일반 메신저 대화 히스토리 초기화"""
        self.history.clear()
        return {"success": True}

    # --------------------------------------------------------------------------
    # [탭 2] 기상청 단기예보 & 날씨 대시보드 API
    # --------------------------------------------------------------------------
    def get_weather(self, force_refresh: bool = False) -> Dict[str, Any]:
        """기상청 단기예보 Open API 기반 울산 날씨 대시보드 데이터 및 CSV 데이터 반환"""
        try:
            return self.weather_service.get_dashboard_data(force_refresh=force_refresh)
        except Exception as e:
            return {"success": False, "error": str(e)}

    # --------------------------------------------------------------------------
    # [탭 2] 기상청 직원 전용 날씨 챗봇 & 실시간 보고서 생성 API
    # --------------------------------------------------------------------------
    def send_weather_chat(self, user_text: str) -> Dict[str, Any]:
        """기상청 직원이 입력한 특이사항 및 지시사항을 접수하고 답변하는 예보관 전문 챗봇"""
        text = user_text.strip() if user_text else ""
        if not text:
            return {"success": False, "error": "내용을 입력해주세요."}

        try:
            # 현재 기상 상황 요약 정보 확보
            w_data = self.weather_service.get_dashboard_data(force_refresh=False)
            sum_info = w_data.get("summary", {}) if w_data.get("success") else {}

            system_instructions = (
                "당신은 기상청 실무 직원을 보조하는 '예보 지원 수석 AI 어시스턴트'입니다. "
                "직원이 전달하는 현장 관측 정보, 기상 특보 검토 의견, 방재 전달사항, 특이사항 등을 정확히 이해하고 수용하세요.\n"
                "수용된 모든 내용은 추후 '기상 보고서' 생성 시 공식 문서에 직접 반영됩니다. "
                "기상청 직원에게 전달사항이 어떻게 보고서에 반영될 것인지 명확하고 전문적인 어조(경어체)로 짧고 깔끔하게 피드백하세요.\n"
                f"[현재 울산 기상 상황 요약]: 기온 {sum_info.get('temperature', '-')}, 날씨 {sum_info.get('condition', '-')}, "
                f"강수확률 {sum_info.get('rain_prob', '-')}, 습도 {sum_info.get('humidity', '-')}, 풍속 {sum_info.get('wind_speed', '-')}"
            )

            # 히스토리에 사용자 메시지 추가
            self.weather_chat_history.append({"role": "user", "content": text})

            response = self.client.responses.create(
                model=self.model_name,
                instructions=system_instructions,
                input=self.weather_chat_history,
            )

            reply_text = response.output_text
            self.weather_chat_history.append({"role": "assistant", "content": reply_text})

            return {
                "success": True,
                "reply": reply_text,
                "history_count": len(self.weather_chat_history),
            }

        except Exception as e:
            if self.weather_chat_history and self.weather_chat_history[-1].get("role") == "user":
                self.weather_chat_history.pop()
            return {"success": False, "error": f"예보관 AI 응답 오류: {str(e)}"}

    def clear_weather_chat(self) -> Dict[str, bool]:
        """예보관 챗봇 대화 히스토리 초기화"""
        self.weather_chat_history.clear()
        return {"success": True}

    def generate_report(self) -> Dict[str, Any]:
        """현재까지의 기상 데이터와 직원과의 대화 내역을 반영하여 공식 기상 보고서(.txt) 생성 및 저장"""
        try:
            # 1. 최신 기상청 데이터 로드
            w_data = self.weather_service.get_dashboard_data(force_refresh=False)
            if not w_data.get("success"):
                return {"success": False, "error": w_data.get("error", "날씨 데이터를 읽어오지 못했습니다.")}

            summary = w_data.get("summary", {})
            hourly = w_data.get("hourly", [])

            # 2. 보고서 생성 및 파일 저장
            res = self.report_generator.generate_and_save_report(
                weather_summary=summary,
                hourly_forecast=hourly,
                chat_history=self.weather_chat_history,
            )
            return res

        except Exception as e:
            return {"success": False, "error": f"보고서 생성 중 예외 발생: {str(e)}"}

    def open_reports_folder(self) -> Dict[str, Any]:
        """저장된 보고서 폴더(reports)를 윈도우 탐색기로 열기"""
        try:
            reports_dir = str(self.report_generator.reports_dir)
            if os.name == "nt":
                os.startfile(reports_dir)
            return {"success": True, "path": reports_dir}
        except Exception as e:
            return {"success": False, "error": str(e)}
