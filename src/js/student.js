/* ============================================================
   독서실 학생 이용 페이지 — student.js
   관리자(app.js)와 동일한 localStorage 'studyroom_state' 공유
   ============================================================ */

'use strict';

// ── 공유 SEAT_LAYOUT (app.js 와 동일한 구조) ──
const SEAT_LAYOUT = [
  { id: 'zone-top-right',   rows: [[45,46,47,48]] },
  { id: 'zone-top-left',    rows: [[3,2,1],[4,5,6,7],[10,9,8]] },
  { id: 'zone-mid-center',  rows: [[32],[31],[30],[29]] },
  { id: 'zone-mid-right',   rows: [[33,40],[34,39],[35,38],[36,37]] },
  { id: 'zone-far-right',   rows: [[41],[42],[43],[44]] },
  { id: 'zone-mid-left-a',  rows: [[11,12,13,14],[17,16,15]] },
  { id: 'zone-mid-left-b',  rows: [[18,19,20,21],[24,23,22]] },
  { id: 'zone-bottom-left', rows: [[25,26,27,28]] },
];

// ── State ──
let gState = null;

// ── 현재 로그인된 회원 (세션) ──
let gCurrentMember = null;

// 로그인 숫자패드 입력값
let loginPhoneDigits = '';

// ============================================================
// STORAGE HELPERS
// ============================================================
function loadSharedState() {
  try {
    const raw = localStorage.getItem('studyroom_state');
    if (raw) gState = JSON.parse(raw);
  } catch(e) { console.error(e); }
  if (!gState) gState = { seats: [], members: [], payments: [], lockers: [], totalSeats: 48 };
  if (!gState.seats || gState.seats.length !== 48) initDefaultSeats();
  if (!gState.members) gState.members = [];
  syncSeatsByMembers();
}

function saveSharedState() {
  localStorage.setItem('studyroom_state', JSON.stringify(gState));
}

function initDefaultSeats() {
  gState.seats = Array.from({ length: 48 }, (_, i) => ({
    id: i + 1, status: 'available', memberId: null, memberName: null, since: null
  }));
}

/** 회원 테이블의 seatNo 기준으로 좌석 상태를 맞춤 (단방향 동기화) */
function syncSeatsByMembers() {
  if (!gState.members) return;
  gState.members.forEach(m => {
    if (m.seatNo) {
      const seat = gState.seats.find(s => s.id === Number(m.seatNo));
      if (seat && seat.status === 'available') {
        seat.status = 'occupied';
        seat.memberId = m.id;
        seat.memberName = m.name;
      }
    }
  });
}

// ── 세션 저장/불러오기 ──
function saveSession(member) {
  sessionStorage.setItem('studyroom_login', JSON.stringify({ id: member.id, name: member.name }));
}
function loadSession() {
  try {
    const raw = sessionStorage.getItem('studyroom_login');
    if (!raw) return null;
    const sess = JSON.parse(raw);
    // 최신 state에서 회원 재조회
    loadSharedState();
    return gState.members.find(m => m.id === sess.id) || null;
  } catch(e) { return null; }
}
function clearSession() {
  sessionStorage.removeItem('studyroom_login');
}

// ============================================================
// CLOCK
// ============================================================
function tickClock() {
  const el = document.getElementById('sClock');
  if (!el) return;
  const now = new Date();
  const days = ['일','월','화','수','목','금','토'];
  el.textContent =
    `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} (${days[now.getDay()]}) ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
const pad = n => String(n).padStart(2,'0');

// ============================================================
// TABS
// ============================================================
function initTabs() {
  document.querySelectorAll('.s-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.s-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.s-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'map') renderStudentMap();
      if (btn.dataset.tab === 'myinfo') renderMyInfo();
    });
  });
}

// ============================================================
// ══════════════════════════════════════════════════════════
//   로그인 화면 관련 함수
// ══════════════════════════════════════════════════════════
// ============================================================

/** 이름 입력 자동완성 */
function initLoginNameInput() {
  const input = document.getElementById('loginNameInput');
  const suggest = document.getElementById('loginSuggest');
  const clearBtn = document.getElementById('loginNameClearBtn');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearBtn.style.display = val ? '' : 'none';
    // 자동완성 — 2자 이상 입력 시
    if (val.length >= 1) {
      loadSharedState();
      const matched = gState.members.filter(m =>
        m.name && m.name.includes(val)
      ).slice(0, 6);
      renderSuggest(matched);
    } else {
      suggest.innerHTML = '';
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

function renderSuggest(members) {
  const suggest = document.getElementById('loginSuggest');
  if (!members.length) { suggest.innerHTML = ''; return; }
  suggest.innerHTML = members.map(m => {
    const phone = m.phone ? m.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') : '';
    const last4 = m.phone ? m.phone.replace(/\D/g,'').slice(-4) : '';
    return `<li onclick="selectSuggest('${m.id}')">
      <i class="fas fa-user"></i>
      <span>${m.name}</span>
      <span class="sug-phone">${phone}</span>
    </li>`;
  }).join('');
}

/** 자동완성에서 이름 선택 시 */
function selectSuggest(memberId) {
  loadSharedState();
  const m = gState.members.find(x => x.id === memberId);
  if (!m) return;
  document.getElementById('loginNameInput').value = m.name;
  document.getElementById('loginSuggest').innerHTML = '';
  document.getElementById('loginNameClearBtn').style.display = '';
  // 포커스를 숫자패드로 유도
  updatePhoneDots();
}

/** 이름 지우기 */
function clearLoginName() {
  document.getElementById('loginNameInput').value = '';
  document.getElementById('loginSuggest').innerHTML = '';
  document.getElementById('loginNameClearBtn').style.display = 'none';
  loginPhoneDigits = '';
  updatePhoneDots();
}

/** 숫자 패드 입력 */
function loginNumpad(digit) {
  if (loginPhoneDigits.length >= 4) return;
  loginPhoneDigits += digit;
  updatePhoneDots();
  // 4자리 완성 시 자동 로그인 시도
  if (loginPhoneDigits.length === 4) {
    setTimeout(doLogin, 120);
  }
}

function loginNumpadBack() {
  loginPhoneDigits = loginPhoneDigits.slice(0, -1);
  updatePhoneDots();
}

function loginNumpadClear() {
  loginPhoneDigits = '';
  updatePhoneDots();
}

function updatePhoneDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pd${i}`);
    if (!dot) continue;
    dot.classList.toggle('filled', i < loginPhoneDigits.length);
  }
}

/** 로그인 에러 표시 */
function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  el.style.display = 'flex';
  // 진동 재트리거
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = '';
  // 2.5초 후 자동 숨김
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

function hideLoginError() {
  const el = document.getElementById('loginError');
  if (el) el.style.display = 'none';
}

/** 로그인 처리 메인 */
function doLogin() {
  loadSharedState();
  const name = document.getElementById('loginNameInput').value.trim();
  const phone4 = loginPhoneDigits;

  // 유효성 검사
  if (!name) {
    showLoginError('이름을 입력해주세요.');
    document.getElementById('loginNameInput').focus();
    return;
  }
  if (phone4.length !== 4) {
    showLoginError('전화번호 끝 4자리를 모두 입력해주세요.');
    return;
  }

  // 이름 + 전화번호 뒷4자리로 회원 조회
  const matched = gState.members.filter(m => {
    const nameMatch = m.name && m.name === name;
    const phoneMatch = m.phone && m.phone.replace(/\D/g,'').endsWith(phone4);
    return nameMatch && phoneMatch;
  });

  if (!matched.length) {
    // 이름만 맞고 전화번호가 다른 경우 구분 메시지
    const nameOnly = gState.members.filter(m => m.name === name);
    if (nameOnly.length) {
      showLoginError('전화번호가 일치하지 않습니다. 다시 확인해주세요.');
    } else {
      showLoginError('이름 또는 전화번호가 올바르지 않습니다.');
    }
    loginPhoneDigits = '';
    updatePhoneDots();
    return;
  }

  const member = matched[0];

  // 이용권 만료 확인
  const days = daysDiff(member.expiry);
  if (days !== null && days < 0) {
    showLoginError('이용권이 만료되었습니다. 관리자에게 문의하세요.');
    loginPhoneDigits = '';
    updatePhoneDots();
    return;
  }

  // 로그인 성공
  gCurrentMember = member;
  saveSession(member);
  hideLoginError();
  showAppScreen(member);
}

/** 앱 화면으로 전환 */
function showAppScreen(member) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = '';

  // 헤더 유저 표시
  document.getElementById('sUserName').textContent = member.name;

  // 독서실 이름 등 설정 반영
  applyRoomSettings();

  // 탭 초기화
  initTabs();

  // 초기 탭 렌더
  renderStudentMap();
  renderMyInfo();
  updateQuickActions();

  // 시계 시작
  tickClock();
  setInterval(tickClock, 1000);

  // 30초마다 좌석 현황 자동 갱신
  setInterval(() => {
    loadSharedState();
    const activeTab = document.querySelector('.s-tab.active');
    if (activeTab && activeTab.dataset.tab === 'map') renderStudentMap();
    // 현재 회원 정보 갱신
    if (gCurrentMember) {
      gCurrentMember = gState.members.find(m => m.id === gCurrentMember.id) || gCurrentMember;
      updateQuickActions();
    }
  }, 30000);
}

/** 로그아웃 */
function doLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  gCurrentMember = null;
  clearSession();

  // 로그인 화면으로 복귀
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = '';

  // 입력 초기화
  document.getElementById('loginNameInput').value = '';
  document.getElementById('loginSuggest').innerHTML = '';
  document.getElementById('loginNameClearBtn').style.display = 'none';
  loginPhoneDigits = '';
  updatePhoneDots();
  hideLoginError();
}

// ============================================================
// 빠른 입실/퇴실 (로그인 회원용)
// ============================================================
function updateQuickActions() {
  if (!gCurrentMember) return;
  loadSharedState();
  const m = gState.members.find(x => x.id === gCurrentMember.id) || gCurrentMember;
  gCurrentMember = m;

  const seatLabel = m.seatNo ? `${m.seatNo}번 좌석` : '좌석 미배정';
  const currentSeat = gState.seats.find(s => s.memberId === m.id && s.status === 'occupied');
  const isIn = !!currentSeat;

  // 입실 패널
  document.getElementById('quickCheckinName').textContent = m.name;
  document.getElementById('quickCheckinSeat').textContent = seatLabel;

  // 퇴실 패널
  document.getElementById('quickCheckoutName').textContent = m.name;
  document.getElementById('quickCheckoutSeat').textContent = isIn ? `${currentSeat.id}번 좌석 이용 중` : seatLabel;
}

/** 로그인 회원 본인 입실 */
function doSelfCheckin() {
  loadSharedState();
  if (!gCurrentMember) return;
  const m = gState.members.find(x => x.id === gCurrentMember.id);
  if (!m) { showOverlay('error', '<i class="fas fa-times-circle"></i>', '오류', '회원 정보를 찾을 수 없습니다.'); return; }

  // 이미 이용 중
  const existSeat = gState.seats.find(s => s.memberId === m.id && s.status === 'occupied');
  if (existSeat) {
    showOverlay('warning', '<i class="fas fa-info-circle"></i>', '이미 입실 중',
      `<strong>${m.name}</strong> 회원은 이미<br><strong>${existSeat.id}번 좌석</strong>을 이용 중입니다.`);
    return;
  }

  // 좌석 확인
  if (!m.seatNo) {
    showOverlay('warning', '<i class="fas fa-chair"></i>', '좌석 미배정',
      `배정된 좌석이 없습니다.<br><small>관리자에게 좌석 배정을 요청하세요.</small>`);
    return;
  }

  // 만료 확인
  const days = daysDiff(m.expiry);
  if (days !== null && days < 0) {
    showOverlay('error', '<i class="fas fa-calendar-times"></i>', '이용권 만료',
      `이용권이 만료되었습니다.<br><small>관리자에게 갱신을 요청하세요.</small>`);
    return;
  }

  const seat = gState.seats.find(s => s.id === Number(m.seatNo));
  if (!seat) { showOverlay('error', '<i class="fas fa-times-circle"></i>', '오류', '좌석 정보를 찾을 수 없습니다.'); return; }

  seat.status = 'occupied';
  seat.memberId = m.id;
  seat.memberName = m.name;
  seat.since = new Date().toISOString();
  saveSharedState();
  gCurrentMember = m;
  updateQuickActions();

  showOverlay('success', '<i class="fas fa-check-circle"></i>', '입실 완료!',
    `<strong>${m.name}</strong> 회원<br>${seat.id}번 좌석 입실 처리되었습니다.<br>
    <small style="color:#94a3b8">입실 시간: ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small>`);
}

/** 로그인 회원 본인 퇴실 */
function doSelfCheckout() {
  loadSharedState();
  if (!gCurrentMember) return;
  const m = gState.members.find(x => x.id === gCurrentMember.id);
  if (!m) return;

  const seat = gState.seats.find(s => s.memberId === m.id && s.status === 'occupied');
  if (!seat) {
    showOverlay('warning', '<i class="fas fa-info-circle"></i>', '미입실 상태',
      `<strong>${m.name}</strong> 회원은 현재 이용 중이 아닙니다.`);
    return;
  }

  const usedMin = seat.since
    ? Math.round((Date.now() - new Date(seat.since).getTime()) / 60000)
    : 0;
  const seatId = seat.id;

  seat.status = 'available';
  seat.memberId = null;
  seat.memberName = null;
  seat.since = null;
  saveSharedState();
  gCurrentMember = m;
  updateQuickActions();

  showOverlay('success', '<i class="fas fa-door-open"></i>', '퇴실 완료!',
    `<strong>${m.name}</strong> 회원<br>${seatId}번 좌석 퇴실 처리되었습니다.<br>
    <small style="color:#94a3b8">이용 시간: ${usedMin}분</small>`);
}

// ============================================================
// SEAT MAP RENDER
// ============================================================
function renderStudentMap() {
  loadSharedState();
  const seats = gState.seats;
  const members = gState.members;

  // 요약 카운트
  const avail = seats.filter(s => s.status === 'available').length;
  const occ   = seats.filter(s => s.status === 'occupied').length;
  const res   = seats.filter(s => s.status === 'reserved').length;
  document.getElementById('s-avail-cnt').textContent = avail;
  document.getElementById('s-occ-cnt').textContent   = occ;
  document.getElementById('s-res-cnt').textContent   = res;
  document.getElementById('s-total-cnt').textContent = 48;

  function seatBtn(id) {
    const s = seats.find(s => s.id === id) || { id, status: 'available', memberName: '' };
    const member = members.find(m => Number(m.seatNo) === id);
    const status = member
      ? (s.status !== 'available' ? s.status : 'occupied')
      : s.status;
    const nameAttr = (s.memberName || (member ? member.name : ''))
      ? `data-name="${s.memberName || member.name}"`
      : '';
    const title = status === 'occupied'
      ? `이용 중` : status === 'reserved'
      ? `예약` : `이용 가능`;
    // 본인 좌석 강조
    const isMine = gCurrentMember && member && member.id === gCurrentMember.id;
    const mineClass = isMine ? ' mine' : '';
    return `<div class="s-seat ${status}${mineClass}" title="${id}번 좌석 · ${title}" ${nameAttr}>${id}</div>`;
  }

  let html = '<div class="s-layout">';

  // 상단 행
  html += '<div class="s-row-top">';
  html += '<div class="s-zone">';
  SEAT_LAYOUT.find(z => z.id === 'zone-top-left').rows.forEach(row => {
    html += '<div class="s-seat-row">' + row.map(seatBtn).join('') + '</div>';
  });
  html += '</div><div class="s-spacer"></div>';
  html += '<div class="s-zone">';
  SEAT_LAYOUT.find(z => z.id === 'zone-top-right').rows.forEach(row => {
    html += '<div class="s-seat-row">' + row.map(seatBtn).join('') + '</div>';
  });
  html += '</div></div>'; // row-top

  // 중단 행
  html += '<div class="s-row-mid">';
  html += '<div class="s-col-left">';
  ['zone-mid-left-a','zone-mid-left-b'].forEach(zid => {
    html += '<div class="s-zone">';
    SEAT_LAYOUT.find(z => z.id === zid).rows.forEach(row => {
      html += '<div class="s-seat-row">' + row.map(seatBtn).join('') + '</div>';
    });
    html += '</div>';
  });
  html += '</div>'; // col-left
  ['zone-mid-center','zone-mid-right','zone-far-right'].forEach(zid => {
    html += '<div class="s-zone">';
    SEAT_LAYOUT.find(z => z.id === zid).rows.forEach(row => {
      html += '<div class="s-seat-row">' + row.map(seatBtn).join('') + '</div>';
    });
    html += '</div>';
  });
  html += '</div>'; // row-mid

  // 하단 행
  html += '<div class="s-row-bottom"><div class="s-zone">';
  SEAT_LAYOUT.find(z => z.id === 'zone-bottom-left').rows.forEach(row => {
    html += '<div class="s-seat-row">' + row.map(seatBtn).join('') + '</div>';
  });
  html += '</div></div>'; // row-bottom

  html += '</div>'; // layout
  document.getElementById('sStudentMap').innerHTML = html;
}

// ============================================================
// 내 정보 탭 — 로그인 회원 자동 표시
// ============================================================
function renderMyInfo() {
  if (!gCurrentMember) return;
  loadSharedState();
  const m = gState.members.find(x => x.id === gCurrentMember.id) || gCurrentMember;
  gCurrentMember = m;

  const resultEl = document.getElementById('myinfoResult');
  const seat = gState.seats.find(s => s.memberId === m.id);
  const days = daysDiff(m.expiry);
  const isActive = seat && seat.status === 'occupied';

  // 만료일 프로그레스
  let pct = 100, pclass = '';
  if (m.start && m.expiry) {
    const total = (new Date(m.expiry) - new Date(m.start)) / 86400000;
    const used  = (new Date() - new Date(m.start)) / 86400000;
    pct = Math.max(0, Math.min(100, Math.round((1 - used/total) * 100)));
  }
  if (days !== null && days <= 3) pclass = 'danger';
  else if (days !== null && days <= 7) pclass = 'warn';

  const daysLabel = days === null ? '-'
    : days < 0   ? `<span style="color:#f87171">만료됨</span>`
    : days === 0  ? `<span style="color:#fbbf24">오늘 만료</span>`
    : `D-${days}`;

  // 입실 시간
  let sinceLabel = '';
  if (isActive && seat.since) {
    const since = new Date(seat.since);
    const usedMin = Math.round((Date.now() - since.getTime()) / 60000);
    sinceLabel = `<div class="s-info-item" style="grid-column:1/-1">
      <div class="s-info-label">입실 시간</div>
      <div class="s-info-val">${since.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} · ${usedMin}분 이용 중</div>
    </div>`;
  }

  resultEl.innerHTML = `
    <div class="s-info-card">
      <div class="s-info-card-header">
        <div class="s-info-avatar"><i class="fas fa-user-graduate"></i></div>
        <div>
          <div class="s-info-name">${m.name}</div>
          <div class="s-info-phone">${m.phone || '-'}</div>
        </div>
      </div>
      <div class="s-info-grid">
        <div class="s-info-item">
          <div class="s-info-label">배정 좌석</div>
          <div class="s-info-val">${m.seatNo ? m.seatNo + '번' : '-'}</div>
        </div>
        <div class="s-info-item">
          <div class="s-info-label">현재 상태</div>
          <div class="s-info-val">${isActive ? '🟢 이용 중' : '⚪ 미입실'}</div>
        </div>
        <div class="s-info-item">
          <div class="s-info-label">이용권</div>
          <div class="s-info-val">${m.ticket || '-'}</div>
        </div>
        <div class="s-info-item">
          <div class="s-info-label">만료까지</div>
          <div class="s-info-val">${daysLabel}</div>
        </div>
        ${sinceLabel}
      </div>
      <div class="s-expiry-bar">
        <div class="s-info-label">이용권 잔여</div>
        <div class="s-progress-track">
          <div class="s-progress-fill ${pclass}" style="width:${pct}%"></div>
        </div>
        <div class="s-expiry-days">만료일: ${formatDate(m.expiry)} &nbsp;·&nbsp; ${daysLabel}</div>
      </div>
      ${m.memo ? `<div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,.6)">메모: ${m.memo}</div>` : ''}
    </div>`;
  resultEl.style.display = 'block';
}

// ============================================================
// NUMPAD (입실/퇴실 탭용)
// ============================================================
function numpad(inputId, val) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (el.value.length < 4) el.value += val;
}
function numpadBack(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.value = el.value.slice(0, -1);
}
function numpadClear(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.value = '';
}

// ============================================================
// MODE SWITCH (입실/퇴실)
// ============================================================
function setMode(mode) {
  const checkinForm  = document.getElementById('checkinForm');
  const checkoutForm = document.getElementById('checkoutForm');
  const btnIn  = document.getElementById('modeCheckinBtn');
  const btnOut = document.getElementById('modeCheckoutBtn');
  if (mode === 'checkin') {
    checkinForm.style.display  = '';
    checkoutForm.style.display = 'none';
    btnIn.classList.add('active');
    btnOut.classList.remove('active');
    document.getElementById('checkinPhone').value = '';
    hideResult('checkinResult');
  } else {
    checkinForm.style.display  = 'none';
    checkoutForm.style.display = '';
    btnOut.classList.add('active');
    btnIn.classList.remove('active');
    document.getElementById('checkoutPhone').value = '';
    hideResult('checkoutResult');
  }
}

function hideResult(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'none'; el.className = 's-result-box'; }
}

// ============================================================
// 회원 검색 (연락처 뒷 4자리)
// ============================================================
function findMemberByPhone4(phone4) {
  if (!phone4 || phone4.length !== 4) return [];
  return gState.members.filter(m => m.phone && m.phone.replace(/-/g,'').endsWith(phone4));
}

// ============================================================
// 입실 처리
// ============================================================
function doCheckin() {
  loadSharedState();
  const phone4 = document.getElementById('checkinPhone').value.trim();
  const resultEl = document.getElementById('checkinResult');
  resultEl.style.display = 'block';

  if (phone4.length !== 4) {
    showResult(resultEl, 'notfound', '<i class="fas fa-exclamation-circle"></i> 연락처 뒷 4자리를 정확히 입력해주세요.');
    return;
  }

  const matches = findMemberByPhone4(phone4);
  if (!matches.length) {
    showResult(resultEl, 'notfound', '<i class="fas fa-times-circle"></i> 해당하는 회원을 찾을 수 없습니다.<br><small>연락처를 다시 확인해주세요.</small>');
    return;
  }

  // 이미 이용 중인지 확인
  const member = matches[0];
  const existSeat = gState.seats.find(s => s.memberId === member.id && s.status === 'occupied');
  if (existSeat) {
    showResult(resultEl, 'warn',
      `<i class="fas fa-info-circle"></i> <strong>${member.name}</strong> 회원은 이미 <strong>${existSeat.id}번 좌석</strong>을 이용 중입니다.`);
    return;
  }

  // 배정 좌석 확인
  const seatId = member.seatNo ? Number(member.seatNo) : null;
  if (!seatId) {
    showResult(resultEl, 'warn',
      `<i class="fas fa-chair"></i> <strong>${member.name}</strong> 회원에게 배정된 좌석이 없습니다.<br><small>관리자에게 좌석 배정을 요청하세요.</small>`);
    return;
  }

  const seat = gState.seats.find(s => s.id === seatId);
  if (!seat) {
    showResult(resultEl, 'notfound', '<i class="fas fa-times-circle"></i> 좌석 정보를 찾을 수 없습니다.');
    return;
  }

  // 이용권 만료 확인
  const days = daysDiff(member.expiry);
  if (days !== null && days < 0) {
    showResult(resultEl, 'notfound',
      `<i class="fas fa-calendar-times"></i> <strong>${member.name}</strong> 회원의 이용권이 만료되었습니다.<br><small>관리자에게 이용권 갱신을 요청하세요.</small>`);
    return;
  }

  // 입실 처리
  seat.status = 'occupied';
  seat.memberId = member.id;
  seat.memberName = member.name;
  seat.since = new Date().toISOString();
  member.seatNo = seatId;
  saveSharedState();

  // 본인 좌석이면 Quick Action 갱신
  if (gCurrentMember && member.id === gCurrentMember.id) updateQuickActions();

  showOverlay('success',
    '<i class="fas fa-check-circle"></i>',
    '입실 완료!',
    `<strong>${member.name}</strong> 회원<br>${seatId}번 좌석 입실 처리되었습니다.<br><small style="color:#94a3b8">입실 시간: ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small>`
  );
  document.getElementById('checkinPhone').value = '';
  hideResult('checkinResult');
}

// ============================================================
// 퇴실 처리
// ============================================================
function doCheckout() {
  loadSharedState();
  const phone4 = document.getElementById('checkoutPhone').value.trim();
  const resultEl = document.getElementById('checkoutResult');
  resultEl.style.display = 'block';

  if (phone4.length !== 4) {
    showResult(resultEl, 'notfound', '<i class="fas fa-exclamation-circle"></i> 연락처 뒷 4자리를 정확히 입력해주세요.');
    return;
  }

  const matches = findMemberByPhone4(phone4);
  if (!matches.length) {
    showResult(resultEl, 'notfound', '<i class="fas fa-times-circle"></i> 해당하는 회원을 찾을 수 없습니다.');
    return;
  }

  const member = matches[0];
  const seat = gState.seats.find(s => s.memberId === member.id && s.status === 'occupied');
  if (!seat) {
    showResult(resultEl, 'warn',
      `<i class="fas fa-info-circle"></i> <strong>${member.name}</strong> 회원은 현재 이용 중이 아닙니다.`);
    return;
  }

  const usedMin = seat.since
    ? Math.round((Date.now() - new Date(seat.since).getTime()) / 60000)
    : 0;
  const seatId = seat.id;

  seat.status = 'available';
  seat.memberId = null;
  seat.memberName = null;
  seat.since = null;
  saveSharedState();

  // 본인 좌석이면 Quick Action 갱신
  if (gCurrentMember && member.id === gCurrentMember.id) updateQuickActions();

  showOverlay('success',
    '<i class="fas fa-door-open"></i>',
    '퇴실 완료!',
    `<strong>${member.name}</strong> 회원<br>${seatId}번 좌석 퇴실 처리되었습니다.<br><small style="color:#94a3b8">이용 시간: ${usedMin}분</small>`
  );
  document.getElementById('checkoutPhone').value = '';
  hideResult('checkoutResult');
}

// ============================================================
// HELPERS
// ============================================================
function daysDiff(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.ceil((new Date(dateStr) - now) / 86400000);
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });
}
function showResult(el, cls, html) {
  el.className = `s-result-box ${cls}`;
  el.innerHTML = html;
  el.style.display = 'block';
}

// ============================================================
// OVERLAY
// ============================================================
function showOverlay(type, icon, title, sub) {
  document.getElementById('sOverlayIcon').className = `s-overlay-icon ${type}`;
  document.getElementById('sOverlayIcon').innerHTML = icon;
  document.getElementById('sOverlayTitle').textContent = title;
  document.getElementById('sOverlaySub').innerHTML = sub;
  document.getElementById('sOverlay').style.display = 'flex';
  // 3초 후 자동 닫기
  setTimeout(closeOverlay, 3200);
}
function closeOverlay() {
  document.getElementById('sOverlay').style.display = 'none';
  renderStudentMap(); // 좌석 현황 갱신
}

// ============================================================
// 관리자 설정 반영 (독서실 이름, 주소 등)
// ============================================================
function applyRoomSettings() {
  try {
    const storedName  = localStorage.getItem('studyRoomName')    || '스터디카페 길';
    const storedAddr  = localStorage.getItem('studyRoomAddress') || '서울시 강남구 테헤란로 123';
    const storedPhone = localStorage.getItem('studyRoomPhone')   || '02-1234-5678';
    const storedHours = localStorage.getItem('studyRoomHours')   || '06:00 ~ 23:59';

    // 로그인 화면
    const loginRoomName = document.getElementById('loginRoomName');
    if (loginRoomName) loginRoomName.textContent = storedName;

    // 앱 화면 헤더
    const roomNameEl = document.getElementById('roomName');
    if (roomNameEl) roomNameEl.textContent = storedName;

    // 푸터
    const footerName  = document.getElementById('footerName');
    const footerAddr  = document.getElementById('footerAddr');
    const footerPhone = document.getElementById('footerPhone');
    const footerHours = document.getElementById('footerHours');
    if (footerName)  footerName.textContent  = storedName;
    if (footerAddr)  footerAddr.textContent  = storedAddr;
    if (footerPhone) footerPhone.textContent = storedPhone;
    if (footerHours) footerHours.textContent = storedHours;
  } catch(e) { console.error(e); }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSharedState();
  applyRoomSettings();

  // 로그인 이름 입력 초기화
  initLoginNameInput();

  // 이전 세션 확인 → 자동 로그인
  const savedMember = loadSession();
  if (savedMember) {
    gCurrentMember = savedMember;
    showAppScreen(savedMember);
  } else {
    // 로그인 화면 표시 (기본 상태)
    document.getElementById('loginScreen').style.display = '';
    document.getElementById('appScreen').style.display = 'none';
  }

  // 키보드 입력 지원 (입실/퇴실)
  ['checkinPhone','checkoutPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g,'').slice(0,4);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (id === 'checkinPhone')  doCheckin();
        if (id === 'checkoutPhone') doCheckout();
      }
    });
  });
});
