import os
import sys
from pathlib import Path
import webview

from desktop_app.api import ChatApi


def main() -> None:
    """pywebview 기반 AI 데스크톱 채팅 애플리케이션 메인 함수"""
    # 프로젝트 루트의 index.html 경로 탐색
    root_dir = Path(__file__).resolve().parent.parent.parent
    index_file = root_dir / "index.html"

    if not index_file.exists():
        print(f"[Error] UI 파일을 찾을 수 없습니다: {index_file}", file=sys.stderr)
        sys.exit(1)

    # JavaScript와 통신할 API 인스턴스 생성
    api = ChatApi()

    # 데스크톱 웹뷰 윈도우 생성
    window = webview.create_window(
        title="AI Chat App (gpt-5.6-luna)",
        url=str(index_file),
        js_api=api,
        width=460,
        height=760,
        min_size=(380, 520),
        resizable=True,
    )

    # 애플리케이션 시작 (Windows WebView2 사용)
    webview.start(debug=False)


if __name__ == "__main__":
    main()
