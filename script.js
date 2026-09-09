// ==========================================================================
// 공통 시간 포맷팅 헬퍼
// ==========================================================================
function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? '오후' : '오전';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${ampm} ${hours}:${minutes}`;
}

// ==========================================================================
// [탭 전환]
// ==========================================================================
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-tab');

    tabButtons.forEach((b) => b.classList.remove('active'));
    tabContents.forEach((c) => c.classList.remove('active'));

    btn.classList.add('active');
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    if (targetId === 'weather-view' && !isWeatherLoaded) {
      loadWeatherData(false);
    }
  });
});

// ==========================================================================
// [울산 날씨 대시보드] 데이터 로드 및 렌더링
// ==========================================================================
const refreshWeatherBtn = document.getElementById('refresh-weather-btn');
const generateReportBtn = document.getElementById('generate-report-btn');
const openReportsBtn = document.getElementById('open-reports-btn');
const locName = document.getElementById('loc-name');
const updateTime = document.getElementById('update-time');
const currentTemp = document.getElementById('current-temp');
const currentCondition = document.getElementById('current-condition');
const weatherIcon = document.getElementById('weather-icon');
const statPop = document.getElementById('stat-pop');
const statReh = document.getElementById('stat-reh');
const statWsd = document.getElementById('stat-wsd');
const statPty = document.getElementById('stat-pty');
const hourlyList = document.getElementById('hourly-list');
const csvTbody = document.getElementById('csv-tbody');
const csvBadge = document.getElementById('csv-badge');

let isWeatherLoaded = false;

async function loadWeatherData(forceRefresh = false) {
  if (refreshWeatherBtn) {
    refreshWeatherBtn.disabled = true;
    refreshWeatherBtn.textContent = '⏳ 불러오는 중...';
  }

  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.get_weather) {
      const res = await window.pywebview.api.get_weather(forceRefresh);

      if (res && res.success) {
        renderWeatherDashboard(res);
        isWeatherLoaded = true;
      } else {
        alert(res.error || '날씨 데이터를 불러오지 못했습니다.');
      }
    } else {
      console.warn('pywebview API 대기 중...');
    }
  } catch (err) {
    console.error('날씨 로드 오류:', err);
    alert(`날씨 정보를 가져오는 중 오류가 발생했습니다: ${err.message}`);
  } finally {
    if (refreshWeatherBtn) {
      refreshWeatherBtn.disabled = false;
      refreshWeatherBtn.textContent = '🔄 새로고침';
    }
  }
}

function renderWeatherDashboard(data) {
  const sum = data.summary;

  locName.textContent = sum.location || '울산광역시 중구 반구1동';
  const baseH = sum.base_time ? `${sum.base_time.slice(0, 2)}:00` : '';
  updateTime.textContent = `기상청 ${sum.base_date} ${baseH} 발표 (갱신: ${data.updated_at})`;

  currentTemp.textContent = sum.temperature;
  currentCondition.textContent = sum.condition;

  if (sum.condition.includes('비')) {
    weatherIcon.textContent = '🌧️';
  } else if (sum.condition.includes('눈')) {
    weatherIcon.textContent = '❄️';
  } else if (sum.condition.includes('구름')) {
    weatherIcon.textContent = '⛅';
  } else if (sum.condition.includes('흐림')) {
    weatherIcon.textContent = '☁️';
  } else {
    weatherIcon.textContent = '☀️';
  }

  statPop.textContent = sum.rain_prob;
  statReh.textContent = sum.humidity;
  statWsd.textContent = sum.wind_speed;
  statPty.textContent = sum.pty_desc;

  // 시간별 예보
  hourlyList.innerHTML = '';
  if (data.hourly && data.hourly.length > 0) {
    data.hourly.forEach((h) => {
      const card = document.createElement('div');
      card.className = 'hourly-card';
      card.innerHTML = `
        <span class="hourly-time">${h.time}</span>
        <span class="hourly-cond">${h.condition}</span>
        <span class="hourly-temp">${h.temp}</span>
        <span class="hourly-pop">💧${h.pop}</span>
      `;
      hourlyList.appendChild(card);
    });
  }

  // CSV 테이블
  if (data.csv_path) {
    csvBadge.textContent = 'data/ulsan_weather.csv';
  }

  csvTbody.innerHTML = '';
  if (data.table_rows && data.table_rows.length > 0) {
    data.table_rows.forEach((row) => {
      const tr = document.createElement('tr');
      const fcstH = row.fcstTime ? `${row.fcstTime.slice(0, 2)}:00` : '';
      const baseH = row.baseTime ? `${row.baseTime.slice(0, 2)}:00` : '';

      tr.innerHTML = `
        <td>${row.fcstDate}</td>
        <td><b>${fcstH}</b></td>
        <td><span title="${row.category}">${row.categoryKor}</span></td>
        <td><b>${row.fcstValueKor}</b></td>
        <td>${row.baseDate} ${baseH}</td>
        <td>${row.nx}, ${row.ny}</td>
      `;
      csvTbody.appendChild(tr);
    });
  } else {
    csvTbody.innerHTML = '<tr><td colspan="6" class="loading-cell">표시할 CSV 데이터가 없습니다.</td></tr>';
  }
}

if (refreshWeatherBtn) {
  refreshWeatherBtn.addEventListener('click', () => loadWeatherData(true));
}

// ==========================================================================
// [우측 사이드바: 기상청 직원 전용 예보 지원 AI 챗봇]
// ==========================================================================
const weatherChatMessages = document.getElementById('weather-chat-messages');
const weatherChatForm = document.getElementById('weather-chat-form');
const weatherChatInput = document.getElementById('weather-chat-input');
const weatherSendBtn = document.getElementById('weather-send-btn');
const clearWeatherChatBtn = document.getElementById('clear-weather-chat-btn');
const wInitialTime = document.getElementById('w-initial-time');

if (wInitialTime) {
  wInitialTime.textContent = getCurrentTime();
}

function addWeatherChatMessage(text, type = 'outgoing', isError = false) {
  const msgEl = document.createElement('div');
  msgEl.className = `w-msg ${type} ${isError ? 'error' : ''}`;
  msgEl.innerHTML = `
    <div class="w-bubble"></div>
    <span class="w-time">${getCurrentTime()}</span>
  `;
  msgEl.querySelector('.w-bubble').textContent = text;
  weatherChatMessages.appendChild(msgEl);
  weatherChatMessages.scrollTop = weatherChatMessages.scrollHeight;
  return msgEl;
}

weatherChatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = weatherChatInput.value.trim();
  if (!text) return;

  addWeatherChatMessage(text, 'outgoing');
  weatherChatInput.value = '';
  weatherChatInput.disabled = true;
  weatherSendBtn.disabled = true;

  // 로딩 표시
  const loadingEl = document.createElement('div');
  loadingEl.className = 'w-msg incoming';
  loadingEl.id = 'w-typing';
  loadingEl.innerHTML = `
    <div class="w-bubble" style="color: #64748b;">✍️ 예보 특이사항 분석 및 반영 중...</div>
    <span class="w-time">${getCurrentTime()}</span>
  `;
  weatherChatMessages.appendChild(loadingEl);
  weatherChatMessages.scrollTop = weatherChatMessages.scrollHeight;

  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.send_weather_chat) {
      const res = await window.pywebview.api.send_weather_chat(text);
      const curLoading = document.getElementById('w-typing');
      if (curLoading) curLoading.remove();

      if (res.success) {
        addWeatherChatMessage(res.reply, 'incoming');
      } else {
        addWeatherChatMessage(res.error || '답변 실패', 'incoming', true);
      }
    }
  } catch (err) {
    const curLoading = document.getElementById('w-typing');
    if (curLoading) curLoading.remove();
    addWeatherChatMessage(`오류: ${err.message}`, 'incoming', true);
  } finally {
    weatherChatInput.disabled = false;
    weatherSendBtn.disabled = false;
    weatherChatInput.focus();
  }
});

clearWeatherChatBtn.addEventListener('click', async () => {
  if (confirm('예보관 챗봇 대화 기록을 초기화하시겠습니까?')) {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.clear_weather_chat) {
      await window.pywebview.api.clear_weather_chat();
    }
    weatherChatMessages.innerHTML = `
      <div class="w-msg incoming">
        <div class="w-bubble">대화 기록이 초기화되었습니다. 새로운 특이사항이나 전달사항을 입력해주세요. ✨</div>
        <span class="w-time">${getCurrentTime()}</span>
      </div>
    `;
  }
});

// ==========================================================================
// [보고서 생성 및 모달 팝업]
// ==========================================================================
const reportModal = document.getElementById('report-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalOkBtn = document.getElementById('modal-ok-btn');
const modalCopyBtn = document.getElementById('modal-copy-btn');
const modalOpenFolderBtn = document.getElementById('modal-open-folder-btn');
const modalFileBadge = document.getElementById('modal-file-badge');
const reportContentPre = document.getElementById('report-content-pre');

let currentReportText = '';

generateReportBtn.addEventListener('click', async () => {
  generateReportBtn.disabled = true;
  generateReportBtn.textContent = '⏳ AI 기상 보고서 작성 중...';

  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.generate_report) {
      const res = await window.pywebview.api.generate_report();

      if (res.success) {
        currentReportText = res.report_text;
        reportContentPre.textContent = res.report_text;
        modalFileBadge.textContent = `reports/${res.filename} (저장 완료)`;
        reportModal.classList.add('active');
      } else {
        alert(res.error || '보고서 생성에 실패했습니다.');
      }
    }
  } catch (err) {
    alert(`보고서 생성 오류: ${err.message}`);
  } finally {
    generateReportBtn.disabled = false;
    generateReportBtn.textContent = '📋 기상 보고서 생성 (.txt)';
  }
});

// 폴더 열기
openReportsBtn.addEventListener('click', async () => {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.open_reports_folder) {
    await window.pywebview.api.open_reports_folder();
  }
});

modalOpenFolderBtn.addEventListener('click', async () => {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.open_reports_folder) {
    await window.pywebview.api.open_reports_folder();
  }
});

// 클립보드 복사
modalCopyBtn.addEventListener('click', async () => {
  if (!currentReportText) return;
  try {
    await navigator.clipboard.writeText(currentReportText);
    alert('📋 보고서 전문이 클립보드에 복사되었습니다.');
  } catch (err) {
    // 대체 복사
    const textArea = document.createElement('textarea');
    textArea.value = currentReportText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('📋 보고서 전문이 복사되었습니다.');
  }
});

// 모달 닫기
modalCloseBtn.addEventListener('click', () => reportModal.classList.remove('active'));
modalOkBtn.addEventListener('click', () => reportModal.classList.remove('active'));

// ==========================================================================
// [일반 AI 메신저 로직]
// ==========================================================================
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const initialTime = document.getElementById('initial-time');

if (initialTime) initialTime.textContent = getCurrentTime();

function addMessage(text, type = 'outgoing', isError = false) {
  const el = document.createElement('div');
  el.className = `message ${type} ${isError ? 'error' : ''}`;
  el.innerHTML = `
    <div class="message-content">
      <div class="bubble"></div>
      <span class="timestamp">${getCurrentTime()}</span>
    </div>
  `;
  el.querySelector('.bubble').textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  addMessage(text, 'outgoing');
  messageInput.value = '';
  messageInput.disabled = true;
  sendBtn.disabled = true;

  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.send_message) {
      const res = await window.pywebview.api.send_message(text);
      if (res.success) {
        addMessage(res.reply, 'incoming');
      } else {
        addMessage(res.error || '오류 발생', 'incoming', true);
      }
    }
  } catch (err) {
    addMessage(`통신 오류: ${err.message}`, 'incoming', true);
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
});

clearBtn.addEventListener('click', async () => {
  if (confirm('일반 메신저 대화 기록을 초기화하시겠습니까?')) {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.clear_history) {
      await window.pywebview.api.clear_history();
    }
    chatMessages.innerHTML = `
      <div class="date-divider">오늘</div>
      <div class="message incoming">
        <div class="message-content">
          <div class="bubble">대화가 초기화되었습니다.</div>
          <span class="timestamp">${getCurrentTime()}</span>
        </div>
      </div>
    `;
  }
});

// ==========================================================================
// 앱 초기화 및 자동 날씨 로드
// ==========================================================================
window.addEventListener('pywebviewready', () => {
  console.log('pywebview 연결 완료');
  loadWeatherData(false);
});
