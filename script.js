// DOM 요소 참조 - 메신저
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const initialTime = document.getElementById('initial-time');

// DOM 요소 참조 - 탭 & 날씨 대시보드
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const weatherTabBtn = document.getElementById('weather-tab-btn');
const refreshWeatherBtn = document.getElementById('refresh-weather-btn');
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

let isPywebviewReady = false;
let isWeatherLoaded = false;

// 현재 시간 포맷팅 함수 (오전/오후 HH:MM)
function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? '오후' : '오전';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${ampm} ${hours}:${minutes}`;
}

if (initialTime) {
  initialTime.textContent = getCurrentTime();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================================================
// 탭 전환 처리
// ==========================================================================
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

    // 날씨 탭 첫 진입 시 데이터 자동 로드
    if (targetId === 'weather-view' && !isWeatherLoaded) {
      loadWeatherData(false);
    }
  });
});

// ==========================================================================
// 울산 날씨 대시보드 데이터 로드 및 렌더링
// ==========================================================================
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
      console.warn('pywebview API가 아직 준비되지 않았습니다.');
      csvTbody.innerHTML = '<tr><td colspan="6" class="loading-cell">pywebview API 연결 대기 중...</td></tr>';
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

  // 1. 헤더 요약 정보
  locName.textContent = sum.location || '울산광역시 중구 반구1동';
  const baseH = sum.base_time ? `${sum.base_time.slice(0, 2)}:00` : '';
  updateTime.textContent = `기상청 ${sum.base_date} ${baseH} 발표 (갱신: ${data.updated_at})`;

  // 2. 메인 날씨 카드
  currentTemp.textContent = sum.temperature;
  currentCondition.textContent = sum.condition;

  // 날씨 이모지 결정
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

  // 3. 시간대별 단기예보 리스트
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

  // 4. 원본 CSV 데이터 테이블 렌더링
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
  refreshWeatherBtn.addEventListener('click', () => {
    loadWeatherData(true);
  });
}

// ==========================================================================
// [탭 1] AI 메신저 로직
// ==========================================================================
function addMessage(text, type = 'outgoing', isError = false) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', type);
  if (isError) messageElement.classList.add('error');

  const timeString = getCurrentTime();

  if (type === 'incoming') {
    messageElement.innerHTML = `
      <div class="avatar-small">✨</div>
      <div class="message-content">
        <div class="bubble"></div>
        <span class="timestamp">${timeString}</span>
      </div>
    `;
    messageElement.querySelector('.bubble').textContent = text;
  } else {
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="bubble"></div>
        <span class="timestamp">${timeString}</span>
      </div>
    `;
    messageElement.querySelector('.bubble').textContent = text;
  }

  chatMessages.appendChild(messageElement);
  scrollToBottom();
  return messageElement;
}

function showTypingIndicator() {
  const loadingElement = document.createElement('div');
  loadingElement.classList.add('message', 'incoming');
  loadingElement.id = 'typing-indicator';
  loadingElement.innerHTML = `
    <div class="avatar-small">✨</div>
    <div class="message-content">
      <div class="bubble">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  chatMessages.appendChild(loadingElement);
  scrollToBottom();
  return loadingElement;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

window.addEventListener('pywebviewready', () => {
  isPywebviewReady = true;
  console.log('pywebview 연결 완료');
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  addMessage(text, 'outgoing');

  messageInput.value = '';
  messageInput.disabled = true;
  sendBtn.disabled = true;

  showTypingIndicator();

  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.send_message) {
      const result = await window.pywebview.api.send_message(text);
      removeTypingIndicator();

      if (result.success) {
        addMessage(result.reply, 'incoming');
      } else {
        addMessage(result.error || '답변을 불러오지 못했습니다.', 'incoming', true);
      }
    } else {
      removeTypingIndicator();
      addMessage(
        '데스크톱 앱(pywebview) 환경에서 실행해주세요. (명령어: uv run desktop-app)',
        'incoming',
        true
      );
    }
  } catch (error) {
    removeTypingIndicator();
    addMessage(`통신 오류가 발생했습니다: ${error.message}`, 'incoming', true);
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
});

clearBtn.addEventListener('click', async () => {
  if (confirm('모든 대화 기록을 초기화하시겠습니까?')) {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.clear_history) {
      try {
        await window.pywebview.api.clear_history();
      } catch (err) {
        console.error('대화 초기화 실패:', err);
      }
    }

    chatMessages.innerHTML = `
      <div class="date-divider">오늘</div>
      <div class="message incoming">
        <div class="avatar-small">✨</div>
        <div class="message-content">
          <div class="bubble">대화가 초기화되었습니다. 새로운 질문을 남겨보세요! ✨</div>
          <span class="timestamp">${getCurrentTime()}</span>
        </div>
      </div>
    `;
  }
});
