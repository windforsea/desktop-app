import os
import csv
import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List
from dotenv import load_dotenv

# 기상청 코드 매핑 딕셔너리 (wepscraping 프로젝트 로직 준수)
CATEGORY_KOR_MAP = {
    "TMP": "1시간 기온(℃)",
    "UUU": "동서바람(m/s)",
    "VVV": "남북바람(m/s)",
    "VEC": "풍향(deg)",
    "WSD": "풍속(m/s)",
    "SKY": "하늘상태",
    "PTY": "강수형태",
    "POP": "강수확률(%)",
    "WAV": "파고(M)",
    "PCP": "1시간 강수량",
    "REH": "습도(%)",
    "SNO": "1시간 신적설",
    "TMN": "일 최저기온(℃)",
    "TMX": "일 최고기온(℃)",
    "T1H": "기온(℃)",
    "RN1": "1시간 강수량(mm)",
}


def format_fcst_value(category: str, value: Any) -> str:
    """기상청 코드값을 사람이 읽기 쉬운 한글 및 단위 표기로 변환"""
    val_str = str(value).strip() if value is not None else ""

    if category in ["SKY", "하늘상태"]:
        sky_map = {"1": "맑음 ☀️", "3": "구름많음 ⛅", "4": "흐림 ☁️"}
        return sky_map.get(val_str, val_str)

    if category in ["PTY", "강수형태"]:
        pty_map = {
            "0": "없음",
            "1": "비 🌧️",
            "2": "비/눈 🌨️",
            "3": "눈 ❄️",
            "4": "소나기 🌦️",
            "5": "빗방울 💧",
            "6": "빗방울눈날림 🌨️",
            "7": "눈날림 ❄️",
        }
        return pty_map.get(val_str, val_str)

    if category in ["VEC", "풍향", "풍향(deg)"]:
        try:
            deg = float(val_str)
            dirs = [
                "북(N)", "북북동(NNE)", "북동(NE)", "동북동(ENE)",
                "동(E)", "동남동(ESE)", "남동(SE)", "남남동(SSE)",
                "남(S)", "남남서(SSW)", "남서(SW)", "서남서(WSW)",
                "서(W)", "서북서(WNW)", "북서(NW)", "북북서(NNW)", "북(N)",
            ]
            idx = int((deg + 22.5 * 0.5) / 22.5) % 16
            return f"{dirs[idx]} ({deg}°)"
        except (ValueError, TypeError):
            return val_str

    if category in ["TMP", "1시간 기온(℃)", "T1H", "기온(℃)"]:
        return f"{val_str}℃"
    if category in ["POP", "강수확률(%)", "REH", "습도(%)"]:
        return f"{val_str}%"
    if category in ["WSD", "풍속(m/s)"]:
        return f"{val_str}m/s"
    if category in ["WAV", "파고(M)"]:
        return f"{val_str}M"

    return val_str


class UlsanWeatherService:
    """울산광역시 기상청 단기예보 Open API 조회 및 CSV 데이터 관리 서비스"""

    def __init__(self, data_dir: Path | None = None) -> None:
        load_dotenv()
        self.api_key = os.getenv("DATA_GO_KR_API_KEY", "")
        # 키 디코딩 처리 (requests/urllib 이중 인코딩 방지)
        if self.api_key:
            self.api_key = urllib.parse.unquote(self.api_key.strip())

        # 프로젝트 루트 기준 data 디렉터리 설정
        if data_dir is None:
            project_root = Path(__file__).resolve().parent.parent.parent
            self.data_dir = project_root / "data"
        else:
            self.data_dir = data_dir

        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.csv_path = self.data_dir / "ulsan_weather.csv"

        # 울산광역시 중구 반구1동 격자 좌표 (wepscraping 프로젝트 실습 기준)
        self.location_name = "울산광역시 중구 반구1동"
        self.nx = 102
        self.ny = 84

    def get_base_date_time(self) -> tuple[str, str]:
        """현재 시각 기준 가장 최신의 기상청 단기예보 발표일시 자동 계산"""
        now = datetime.now()
        avail_hours = [2, 5, 8, 11, 14, 17, 20, 23]
        check_dt = now - timedelta(minutes=10)
        past_hours = [h for h in avail_hours if h <= check_dt.hour]

        if past_hours:
            selected_h = max(past_hours)
            base_date = check_dt.strftime("%Y%m%d")
        else:
            # 자정~02시 사이인 경우 전날 23시 발표 사용
            selected_h = 23
            base_date = (check_dt - timedelta(days=1)).strftime("%Y%m%d")

        base_time = f"{selected_h:02d}00"
        return base_date, base_time

    def fetch_weather_api(self, num_of_rows: int = 120) -> List[Dict[str, Any]]:
        """기상청 단기예보 API 호출"""
        if not self.api_key:
            raise ValueError("기상청 API 키(DATA_GO_KR_API_KEY)가 설정되지 않았습니다.")

        base_date, base_time = self.get_base_date_time()
        base_url = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"

        params = {
            "serviceKey": self.api_key,
            "pageNo": "1",
            "numOfRows": str(num_of_rows),
            "dataType": "JSON",
            "base_date": base_date,
            "base_time": base_time,
            "nx": str(self.nx),
            "ny": str(self.ny),
        }

        query = urllib.parse.urlencode(params)
        full_url = f"{base_url}?{query}"

        req = urllib.request.Request(full_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as response:
            res_data = json.loads(response.read().decode("utf-8"))

        header = res_data.get("response", {}).get("header", {})
        result_code = header.get("resultCode")
        result_msg = header.get("resultMsg")

        if result_code != "00":
            raise RuntimeError(f"기상청 API 응답 오류: {result_msg} (코드: {result_code})")

        items = res_data["response"]["body"]["items"]["item"]
        return items

    def save_to_csv(self, items: List[Dict[str, Any]]) -> str:
        """수신된 날씨 예보 원본 컬럼 구조를 그대로 유지하여 CSV 파일로 저장"""
        # 데이터프레임 규칙 준수: 원본 컬럼명 보존
        fieldnames = ["baseDate", "baseTime", "category", "fcstDate", "fcstTime", "fcstValue", "nx", "ny"]

        with open(self.csv_path, mode="w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for item in items:
                row = {col: item.get(col, "") for col in fieldnames}
                writer.writerow(row)

        return str(self.csv_path)

    def load_from_csv(self) -> List[Dict[str, Any]]:
        """저장된 CSV 파일에서 데이터 읽기"""
        if not self.csv_path.exists():
            return []

        rows: List[Dict[str, Any]] = []
        with open(self.csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for r in reader:
                rows.append(r)
        return rows

    def get_dashboard_data(self, force_refresh: bool = False) -> Dict[str, Any]:
        """프론트엔드 대시보드용 구조화된 날씨 데이터 및 원본 CSV 행 데이터 생성"""
        items: List[Dict[str, Any]] = []

        # 캐시된 CSV가 있고 강제 새로고침이 아닌 경우 CSV 사용, 없으면 API 호출
        if force_refresh or not self.csv_path.exists():
            try:
                items = self.fetch_weather_api()
                self.save_to_csv(items)
            except Exception as e:
                # API 호출 실패 시 기존 CSV가 있으면 폴백
                if self.csv_path.exists():
                    items = self.load_from_csv()
                else:
                    return {
                        "success": False,
                        "error": f"날씨 데이터 수집 실패: {str(e)}",
                    }
        else:
            items = self.load_from_csv()

        if not items:
            return {"success": False, "error": "표시할 날씨 데이터가 없습니다."}

        # 시간대별 카테고리 그룹화
        # time_key: (fcstDate, fcstTime) -> dict of category: fcstValue
        grouped_by_time: Dict[str, Dict[str, str]] = {}
        for it in items:
            date_str = str(it.get("fcstDate", ""))
            time_str = str(it.get("fcstTime", ""))
            key = f"{date_str}_{time_str}"
            if key not in grouped_by_time:
                grouped_by_time[key] = {
                    "fcstDate": date_str,
                    "fcstTime": time_str,
                }
            grouped_by_time[key][str(it.get("category", ""))] = str(it.get("fcstValue", ""))

        # 시간순 정렬
        sorted_times = sorted(grouped_by_time.keys())
        first_time_key = sorted_times[0] if sorted_times else ""
        current_data = grouped_by_time.get(first_time_key, {})

        # 현재 최근접 예보 요약 정보 추출
        tmp_val = current_data.get("TMP", "-")
        sky_val = current_data.get("SKY", "1")
        pty_val = current_data.get("PTY", "0")
        pop_val = current_data.get("POP", "0")
        reh_val = current_data.get("REH", "-")
        wsd_val = current_data.get("WSD", "-")

        sky_desc = format_fcst_value("SKY", sky_val)
        pty_desc = format_fcst_value("PTY", pty_val)
        weather_condition = pty_desc if pty_val != "0" else sky_desc

        summary = {
            "location": self.location_name,
            "base_date": items[0].get("baseDate", ""),
            "base_time": items[0].get("baseTime", ""),
            "fcst_date": current_data.get("fcstDate", ""),
            "fcst_time": current_data.get("fcstTime", ""),
            "temperature": f"{tmp_val}℃" if tmp_val != "-" else "-",
            "sky_desc": sky_desc,
            "pty_desc": pty_desc,
            "condition": weather_condition,
            "rain_prob": f"{pop_val}%",
            "humidity": f"{reh_val}%",
            "wind_speed": f"{wsd_val}m/s",
        }

        # 시간별 예보 리스트 (최대 12개 시간대)
        hourly_list = []
        for tk in sorted_times[:12]:
            d = grouped_by_time[tk]
            t_str = d.get("fcstTime", "")
            hour_label = f"{t_str[:2]}:{t_str[2:]}" if len(t_str) == 4 else t_str
            date_label = f"{d.get('fcstDate', '')[-4:-2]}/{d.get('fcstDate', '')[-2:]}"

            h_sky = d.get("SKY", "1")
            h_pty = d.get("PTY", "0")
            h_cond = format_fcst_value("PTY", h_pty) if h_pty != "0" else format_fcst_value("SKY", h_sky)

            hourly_list.append({
                "date": date_label,
                "time": hour_label,
                "temp": f"{d.get('TMP', '-') }℃",
                "condition": h_cond,
                "pop": f"{d.get('POP', '0')}%",
                "reh": f"{d.get('REH', '-')}%",
            })

        # 원본 CSV 행 리스트 (한글 명칭 및 단위 치환 버전 포함)
        formatted_table_rows = []
        for it in items:
            cat = it.get("category", "")
            val = it.get("fcstValue", "")
            formatted_table_rows.append({
                "baseDate": it.get("baseDate", ""),
                "baseTime": it.get("baseTime", ""),
                "category": cat,
                "categoryKor": CATEGORY_KOR_MAP.get(cat, cat),
                "fcstDate": it.get("fcstDate", ""),
                "fcstTime": it.get("fcstTime", ""),
                "fcstValue": val,
                "fcstValueKor": format_fcst_value(cat, val),
                "nx": it.get("nx", ""),
                "ny": it.get("ny", ""),
            })

        return {
            "success": True,
            "summary": summary,
            "hourly": hourly_list,
            "table_rows": formatted_table_rows,
            "csv_path": str(self.csv_path),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
