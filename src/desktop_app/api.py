import os
from typing import Any, Dict, List
from dotenv import load_dotenv
from openai import OpenAI


class ChatApi:
    """pywebview의 JavaScript와 통신하는 백엔드 API 브리지 클래스"""

    def __init__(self) -> None:
        # 1. 환경 변수 로드 (.env의 OPENAI_API_KEY)
        load_dotenv()

        # 2. OpenAI 클라이언트 초기화
        self.client = OpenAI()

        # 3. 멀티턴 대화 히스토리 및 모델 설정
        self.model_name = "gpt-5.6-luna"
        self.instructions = (
            "당신은 데스크톱 메신저에서 사용자와 대화하는 친절하고 유능한 AI 어시스턴트입니다. "
            "간결하고 가독성 좋은 한국어로 명확하게 답변하세요."
        )
        self.history: List[Dict[str, str]] = []

    def send_message(self, user_text: str) -> Dict[str, Any]:
        """JavaScript로부터 전달받은 사용자 메시지를 OpenAI Responses API로 전달하고 답변을 반환합니다."""
        text = user_text.strip() if user_text else ""
        if not text:
            return {"success": False, "error": "메시지가 비어 있습니다."}

        try:
            # 1. 사용자 입력을 대화 히스토리에 추가
            self.history.append({"role": "user", "content": text})

            # 2. 최신 Responses API 호출 (멀티턴 히스토리 전달)
            response = self.client.responses.create(
                model=self.model_name,
                instructions=self.instructions,
                input=self.history,
            )

            # 3. 모델 응답 텍스트 추출 (Responses SDK helper: output_text)
            reply_text = response.output_text

            # 4. 모델 응답을 히스토리에 추가하여 다음 대화 컨텍스트 유지
            self.history.append({"role": "assistant", "content": reply_text})

            return {
                "success": True,
                "reply": reply_text,
                "model": self.model_name,
            }

        except Exception as e:
            # 실패 시 히스토리에서 마지막 사용자 메시지 롤백
            if self.history and self.history[-1].get("role") == "user":
                self.history.pop()

            return {
                "success": False,
                "error": f"AI 응답 생성 실패: {str(e)}",
            }

    def clear_history(self) -> Dict[str, bool]:
        """대화 히스토리를 초기화합니다."""
        self.history.clear()
        return {"success": True}
