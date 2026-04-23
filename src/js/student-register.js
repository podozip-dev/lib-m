/* ============================================================
   student-register.js
   학생 이용 페이지 — 회원 등록 모달 로직
   관리자(app.js)와 동일한 localStorage 'studyroom_state' 공유
   ============================================================ */

'use strict';

// ── 이용권 → 만료일 자동 계산 매핑 ──
const REG_TICKET_MAP = {
  '1일권': 1, '1주일권': 7, '1개월권': 30,
  '3개월권': 90, '6개월권': 180, '1년권': 365
};

// ============================================================
// 모달 열기
// ============================================================
function openRegisterModal() {
  // 폼 초기화
  const form = document.getElementById('regForm');
  if (form) form.reset();

  // 로그인 입력값으로 이름 자동 채우기
  const loginName = document.getElementById('loginNameInput');
  if (loginName && loginName.value.trim()) {
    const regName = document.getElementById('regName');
    if (regName) regName.value = loginName.value.trim();
  }

  // 시작일 오늘로 기본값
  const regStart = document.getElementById('regStart');
  if (regStart) regStart.value = todayStr();

  // 이용권 변경 시 만료일 자동 계산 이벤트 (중복 방지: once flag)
  const ticketSel = document.getElementById('regTicket');
  if (ticketSel && !ticketSel._regEvt) {
    ticketSel._regEvt = true;
    ticketSel.addEventListener('change', autoCalcExpiry);
  }
  const startInput = document.getElementById('regStart');
  if (startInput && !startInput._regEvt) {
    startInput._regEvt = true;
    startInput.addEventListener('change', autoCalcExpiry);
  }

  // 모달 body를 폼으로 복원 (성공 메시지 후 재열기 대비)
  restoreRegForm();

  // 오버레이 표시
  document.getElementById('regOverlay').style.display = 'flex';
  // 이름 필드 포커스
  setTimeout(() => {
    const nameEl = document.getElementById('regName');
    if (nameEl) nameEl.focus();
  }, 50);
}

// ============================================================
// 모달 닫기
// ============================================================
function closeRegisterModal(e) {
  // 오버레이 배경 클릭 시에만 닫기 (이벤트 있는 경우)
  if (e && e.target !== document.getElementById('regOverlay')) return;
  document.getElementById('regOverlay').style.display = 'none';
}

// ============================================================
// 이용권 → 만료일 자동 계산
// ============================================================
function autoCalcExpiry() {
  const ticket = document.getElementById('regTicket').value;
  const start  = document.getElementById('regStart').value;
  if (!ticket || !start || !REG_TICKET_MAP[ticket]) return;
  const d = new Date(start);
  d.setDate(d.getDate() + REG_TICKET_MAP[ticket]);
  // 만료일 필드는 없으므로 메모에 자동 입력하지 않음 (서버 저장 로직에서 계산)
}

// ============================================================
// DB API URL (student.js와 동일)
const REG_DB_API = 'http://admin.agunge.co.kr/studycafe/members.php';

// 등록 제출
// ============================================================
async function submitRegister(e) {
  e.preventDefault();

  const name   = (document.getElementById('regName').value   || '').trim();
  const phone  = (document.getElementById('regPhone').value  || '').trim();
  const ticket = (document.getElementById('regTicket').value || '').trim();
  const start  = (document.getElementById('regStart').value  || '').trim();
  const memo   = (document.getElementById('regMemo').value   || '').trim();

  // 필수 검증
  if (!name)  { shakeInput('regName');  return; }
  if (!phone) { shakeInput('regPhone'); return; }

  // 전화번호 형식 정규화
  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm) {
    shakeInput('regPhone');
    showRegError('연락처 형식을 확인해주세요. (예: 010-1234-5678)');
    return;
  }

  // 만료일 계산
  let expiry = '';
  if (ticket && start && REG_TICKET_MAP[ticket]) {
    const d = new Date(start);
    d.setDate(d.getDate() + REG_TICKET_MAP[ticket]);
    expiry = d.toISOString().slice(0, 10);
  }

  const id = Date.now().toString();

  // ── DB에 먼저 저장 시도 ──
  let dbSaved = false;
  try {
    const res = await fetch(REG_DB_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        phone:       phoneNorm,
        ticket:      ticket || null,
        start_date:  start  || todayStr(),
        expiry_date: expiry || null,
        memo:        memo   || '학생 페이지 직접 등록',
        status:      'active',
      }),
    });
    const json = await res.json();
    if (json.success) {
      dbSaved = true;
    } else {
      // DB 중복 오류 등
      showRegError(json.message || '등록에 실패했습니다.');
      return;
    }
  } catch(err) {
    // 네트워크 오류 시 localStorage 폴백
    console.warn('DB 저장 실패, localStorage 폴백:', err);
  }

  // ── localStorage에도 저장 (오프라인 폴백 / 관리자 페이지 즉시 반영) ──
  const newMember = {
    id,
    name,
    phone:  phoneNorm,
    seatNo: null,
    ticket: ticket || '',
    start:  start  || todayStr(),
    expiry: expiry || '',
    memo:   memo   || '학생 페이지 직접 등록',
    status: 'active',
  };

  let st = null;
  try { st = JSON.parse(localStorage.getItem('studyroom_state')); } catch(err2) {}
  if (!st) st = { members: [], seats: [], payments: [], lockers: [], totalSeats: 48 };
  if (!st.members) st.members = [];

  // DB 저장 실패 시에만 중복 체크 (DB가 거절했으면 이미 return됨)
  if (!dbSaved) {
    const dup = st.members.find(m =>
      m.name === name && m.phone && m.phone.replace(/\D/g,'') === phoneNorm.replace(/\D/g,'')
    );
    if (dup) { showRegError('이미 등록된 회원입니다. 관리자에게 문의해주세요.'); return; }
  }

  st.members.push(newMember);
  localStorage.setItem('studyroom_state', JSON.stringify(st));
  if (typeof gState !== 'undefined' && gState) gState.members = st.members;

  // 성공 화면 표시
  showRegSuccess(name, ticket, expiry);
}

// ============================================================
// 성공 화면
// ============================================================
function showRegSuccess(name, ticket, expiry) {
  const body = document.querySelector('.reg-modal-body');
  if (!body) return;

  const ticketLine = ticket
    ? `<div style="margin:4px 0;font-size:13px;color:#64748b">이용권: <strong style="color:#1e293b">${ticket}</strong></div>`
    : '';
  const expiryLine = expiry
    ? `<div style="font-size:13px;color:#64748b">만료일: <strong style="color:#1e293b">${formatRegDate(expiry)}</strong></div>`
    : '';

  body.innerHTML = `
    <div class="reg-success-box">
      <div class="reg-success-icon"><i class="fas fa-check-circle"></i></div>
      <div class="reg-success-title">등록 신청 완료!</div>
      <div class="reg-success-sub">
        <strong>${name}</strong> 님의 회원 등록 신청이 완료되었습니다.<br>
        ${ticketLine}
        ${expiryLine}
        <br>
        관리자 확인 후 로그인하실 수 있습니다.
      </div>
      <button class="reg-success-close" onclick="afterRegSuccess()">확인</button>
    </div>`;
}

function afterRegSuccess() {
  document.getElementById('regOverlay').style.display = 'none';
  // 로그인 입력 초기화 (새로 등록한 이름으로 채워두기)
  restoreRegForm();
  // 로그인 에러·등록 버튼 숨기기
  if (typeof hideLoginError === 'function') hideLoginError();
  // 자동완성 업데이트 위해 input 이벤트 트리거
  const nameInput = document.getElementById('loginNameInput');
  if (nameInput) {
    nameInput.dispatchEvent(new Event('input'));
  }
}

// ============================================================
// HELPERS
// ============================================================
function restoreRegForm() {
  const body = document.querySelector('.reg-modal-body');
  if (!body || body.querySelector('#regForm')) return; // 이미 폼 있으면 스킵
  // 폼이 사라진 경우(성공 화면 후) 재삽입
  body.innerHTML = `
    <p class="reg-modal-desc">
      정보를 입력하시면 관리자가 확인 후 이용권을 등록해드립니다.
    </p>
    <form id="regForm" onsubmit="submitRegister(event)">
      <div class="reg-form-row">
        <div class="reg-form-group">
          <label>이름 <span class="reg-required">*</span></label>
          <div class="reg-input-wrap">
            <i class="fas fa-user"></i>
            <input type="text" id="regName" placeholder="홍길동"
              maxlength="10" autocomplete="off" required />
          </div>
        </div>
        <div class="reg-form-group">
          <label>연락처 <span class="reg-required">*</span></label>
          <div class="reg-input-wrap">
            <i class="fas fa-phone-alt"></i>
            <input type="tel" id="regPhone" placeholder="010-0000-0000"
              autocomplete="off" required />
          </div>
        </div>
      </div>
      <div class="reg-form-row">
        <div class="reg-form-group">
          <label>이용권</label>
          <div class="reg-input-wrap">
            <i class="fas fa-ticket-alt"></i>
            <select id="regTicket">
              <option value="">선택 (선택사항)</option>
              <option value="1일권">1일권</option>
              <option value="1주일권">1주일권</option>
              <option value="1개월권">1개월권</option>
              <option value="3개월권">3개월권</option>
              <option value="6개월권">6개월권</option>
              <option value="1년권">1년권</option>
            </select>
          </div>
        </div>
        <div class="reg-form-group">
          <label>시작일</label>
          <div class="reg-input-wrap">
            <i class="fas fa-calendar-alt"></i>
            <input type="date" id="regStart" />
          </div>
        </div>
      </div>
      <div class="reg-form-group">
        <label>메모 <span class="reg-hint">(요청사항 등)</span></label>
        <div class="reg-input-wrap textarea">
          <i class="fas fa-comment-alt"></i>
          <textarea id="regMemo" rows="2"
            placeholder="요청사항이나 특이사항을 입력해주세요."></textarea>
        </div>
      </div>
      <div class="reg-form-notice" id="regErrorNotice" style="display:none">
        <i class="fas fa-exclamation-triangle"></i>
        <span id="regErrorMsg"></span>
      </div>
      <div class="reg-form-notice">
        <i class="fas fa-info-circle"></i>
        등록 후 관리자 승인이 완료되면 로그인하실 수 있습니다.
      </div>
      <div class="reg-form-actions">
        <button type="button" class="reg-btn-cancel" onclick="closeRegisterModal()">취소</button>
        <button type="submit" class="reg-btn-submit">
          <i class="fas fa-check"></i> 등록 신청
        </button>
      </div>
    </form>`;

  // 이벤트 재연결
  const ticketSel  = document.getElementById('regTicket');
  const startInput = document.getElementById('regStart');
  if (ticketSel)  ticketSel.addEventListener('change', autoCalcExpiry);
  if (startInput) startInput.addEventListener('change', autoCalcExpiry);
  if (startInput) startInput.value = todayStr();

  // 로그인 이름 자동 채우기
  const loginName = document.getElementById('loginNameInput');
  const regName   = document.getElementById('regName');
  if (loginName && regName && loginName.value.trim()) {
    regName.value = loginName.value.trim();
  }
}

function showRegError(msg) {
  let notice = document.getElementById('regErrorNotice');
  let msgEl  = document.getElementById('regErrorMsg');
  if (!notice) {
    // 동적으로 생성
    const actions = document.querySelector('.reg-form-actions');
    if (!actions) return;
    notice = document.createElement('div');
    notice.className = 'reg-form-notice';
    notice.id = 'regErrorNotice';
    notice.style.background = '#fee2e2';
    notice.style.borderColor = '#fca5a5';
    notice.style.color = '#991b1b';
    notice.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#ef4444"></i><span id="regErrorMsg"></span>`;
    actions.parentNode.insertBefore(notice, actions);
    msgEl = document.getElementById('regErrorMsg');
  }
  if (msgEl) msgEl.textContent = msg;
  notice.style.display = 'flex';
  setTimeout(() => { if (notice) notice.style.display = 'none'; }, 3000);
}

function shakeInput(id) {
  const wrap = document.getElementById(id)?.closest('.reg-input-wrap');
  if (!wrap) return;
  wrap.style.borderColor = '#ef4444';
  wrap.style.animation = 'none';
  wrap.offsetHeight;
  wrap.style.animation = 'shakeX .4s ease';
  setTimeout(() => { wrap.style.borderColor = ''; wrap.style.animation = ''; }, 800);
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  return null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatRegDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
