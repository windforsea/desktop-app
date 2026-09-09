// DOM 요소 참조
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const initialTime = document.getElementById('initial-time');

// pywebview 준비 여부 플래그
let isPywebviewReady = false;

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

// 초기 환영 메시지 시간 설정
if (initialTime) {
  initialTime.textContent = getCurrentTime();
}

// 항상 최신 메시지로 스크롤
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 메시지 요소 생성 및 추가
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

// 답변 대기 중 로딩 인디케이터(점 애니메이션) 추가
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

// 로딩 인디케이터 제거
function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// pywebview 준비 완료 이벤트 리스너
window.addEventListener('pywebviewready', () => {
  isPywebviewReady = true;
  console.log('pywebview API 연결 완료');
});

// 메시지 전송 처리
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  // 1. 사용자 메시지 화면에 추가
  addMessage(text, 'outgoing');

  // 2. 입력창 비우기 및 UI 잠금
  messageInput.value = '';
  messageInput.disabled = true;
  sendBtn.disabled = true;

  // 3. 로딩 인디케이터 표시
  showTypingIndicator();

  try {
    // pywebview 환경인지 확인
    if (window.pywebview && window.pywebview.api) {
      // 파이썬 백엔드(ChatApi.send_message) 호출
      const result = await window.pywebview.api.send_message(text);
      removeTypingIndicator();

      if (result.success) {
        addMessage(result.reply, 'incoming');
      } else {
        addMessage(result.error || '답변을 불러오지 못했습니다.', 'incoming', true);
      }
    } else {
      // 브라우저에서 직접 열었을 때 안내
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
    // 4. UI 잠금 해제 및 포커스 복원
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
});

// 대화 내용 지우기
clearBtn.addEventListener('click', async () => {
  if (confirm('모든 대화 기록을 초기화하시겠습니까?')) {
    if (window.pywebview && window.pywebview.api) {
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
