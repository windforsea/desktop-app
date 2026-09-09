# Desktop AI Chat App & 울산 날씨 대시보드

`pywebview`와 OpenAI의 최신 `Responses API` (`gpt-5.6-luna`), 그리고 **기상청 단기예보 Open API**를 결합하여 제작된 경량 데스크톱 메신저 & 날씨 대시보드 프로그램입니다.

---

## 📸 프로그램 미리보기

<p align="center">
  <img src="docs/screenshot.png" alt="Desktop AI Chat App Preview" width="380" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
</p>

---

## 📱 주요 기능

### 1. 💬 AI 메신저 탭
- **데스크톱 네이티브 창 실행**: 브라우저 없이 독립된 Windows 네이티브 애플리케이션(pywebview)으로 실행
- **실제 AI 통신**: OpenAI 최신 Responses API (`gpt-5.6-luna`) 기반 스마트 답변 생성
- **멀티턴 대화 유지**: 질문-답변 히스토리를 기억하여 자연스러운 연속 대화 지원
- **실시간 로딩 인디케이터**: AI 답변 생성 중 점 바운스 애니메이션 노출
- **대화 초기화**: 상단 휴지통 아이콘을 통한 백엔드 컨텍스트 및 화면 메시지 동시 초기화

### 2. 🌤️ 울산 날씨 대시보드 탭
- **기상청 단기예보 Open API 연동**: 울산광역시 중구 반구1동 (격자 X: 102, Y: 84) 기준 최신 예보 자동 수집
- **실시간 날씨 요약 카드**: 현재 기온, 하늘상태/강수형태, 강수확률(POP), 습도(REH), 풍속(WSD) 직관적 시각화
- **시간대별 단기예보 타임라인**: 향후 시간대별 기온과 날씨 상태를 한눈에 볼 수 있는 가로 스크롤 카드
- **수집된 CSV 데이터 뷰어**: 기상청 응답 데이터를 실시간으로 `data/ulsan_weather.csv` 파일로 저장하고 테이블로 렌더링
- **원클릭 새로고침**: 🔄 버튼 클릭 시 기상청 최신 발표 데이터로 즉시 갱신 및 CSV 업데이트

---

## 📁 프로젝트 구조
- `src/desktop_app/`:
  - `__init__.py`: 데스크톱 앱 실행 메인 진입점 (`webview.create_window`)
  - `api.py`: JavaScript와 통신하는 `ChatApi` 통합 브리지 (AI 채팅 + 날씨 API)
  - `weather.py`: 기상청 단기예보 Open API 호출 및 `ulsan_weather.csv` 관리 서비스
- `data/`:
  - `ulsan_weather.csv`: 기상청 단기예보 실시간 수집 원본 CSV 데이터셋
- `index.html`: 메신저 및 날씨 대시보드 탭 UI 마크업
- `style.css`: 모던 데스크톱 탭 네비게이션, 날씨 카드 및 데이터 테이블 스타일링
- `script.js`: pywebview 비동기 API 통신, 탭 전환, 실시간 날씨 & CSV 렌더링
- `docs/screenshot.png`: 실제 프로그램 구동 스크린샷

---

## 🚀 데스크톱 앱 실행 방법

터미널에서 아래 명령어를 실행하면 데스크톱 프로그램이 열립니다:

```bash
uv run desktop-app
```
*(또는 `uv run python -m desktop_app`)*
