import os
from dotenv import load_dotenv
from openai import OpenAI


def main():
    # 1. .env 파일로부터 환경 변수 로드 (OPENAI_API_KEY)
    load_dotenv()

    # 2. OpenAI 클라이언트 초기화
    # 환경 변수 OPENAI_API_KEY를 자동으로 참조합니다.
    client = OpenAI()

    # 3. 최신 Responses API 요청 (gpt-5.6-luna)
    response = client.responses.create(
        model="gpt-5.6-luna",
        instructions="친절하고 명확하게 답변하는 한국어 어시스턴트입니다.",
        input="안녕하세요! 간단하게 한 줄로 자기소개해 주세요.",
    )

    # 4. 응답 텍스트 출력 (최신 Responses SDK 전용 output_text 헬퍼)
    print(response.output_text)


if __name__ == "__main__":
    main()
