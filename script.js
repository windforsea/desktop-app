// DOM 요소 참조
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const clearBtn = document.getElementById('clear-btn');
const initialTime = document.getElementById('initial-time');

// 현재 시간 포맷팅 함수 (예: 오전 09:30)
function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? '오후' : '오전';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0시는 12시로 표기
  
  return `${ampm} ${hours}:${minutes}`;
}

// 초기 환영 메시지 시간 설정
if (initialTime) {
  initialTime.textContent = getCurrentTime();
}

// 스크롤을 항상 최신 메시지(하단)로 이동
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 메시지 요소 생성 및 화면에 추가
function addMessage(text, type = 'outgoing') {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', type);

  const timeString = getCurrentTime();

  if (type === 'incoming') {
    messageElement.innerHTML = `
      <div class="avatar-small">🤖</div>
      <div class="message-content">
        <div class="bubble"></div>
        <span class="timestamp">${timeString}</span>
      </div>
    `;
    // XSS 방지를 위해 textContent로 내용 삽입
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
}

// 봇 자동 응답 시뮬레이션
function botReply(userText) {
  const replies = [
    `"${userText}" 메시지를 잘 받았습니다! 😊`,
    '궁금한 점이 있으시면 언제든지 말씀해주세요!',
    '반갑습니다! 좋은 하루 보내세요 ✨',
    'HTML, CSS, JS로 만든 깔끔한 채팅 UI입니다 🚀'
  ];

  const randomReply = replies[Math.floor(Math.random() * replies.length)];

  setTimeout(() => {
    addMessage(randomReply, 'incoming');
  }, 600);
}

// 메시지 전송 이벤트 리스너
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  // 1. 사용자 메시지 추가
  addMessage(text, 'outgoing');

  // 2. 입력창 비우기 및 포커스
  messageInput.value = '';
  messageInput.focus();

  // 3. 봇 응답 시뮬레이션 실행
  botReply(text);
});

// 대화 내용 지우기
clearBtn.addEventListener('click', () => {
  if (confirm('채팅 기록을 모두 지우시겠습니까?')) {
    chatMessages.innerHTML = `
      <div class="date-divider">오늘</div>
      <div class="message incoming">
        <div class="avatar-small">🤖</div>
        <div class="message-content">
          <div class="bubble">대화가 초기화되었습니다. 새로운 메시지를 보내보세요! ✨</div>
          <span class="timestamp">${getCurrentTime()}</span>
        </div>
      </div>
    `;
  }
});
