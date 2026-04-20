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

// ============================================================
// CLOCK
// ============================================================
function tickClock() {
  const now = new Date();
  const days = ['일','월','화','수','목','금','토'];
  document.getElementById('sClock').textContent =
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
    });
  });
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
    return `<div class="s-seat ${status}" title="${id}번 좌석 · ${title}" ${nameAttr}>${id}</div>`;
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
// NUMPAD
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
      `<i class="fas fa-info-circle"></i> <strong>${member.name}</strong> 회원은 현재 이용 중이지 않습니다.`);
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

  showOverlay('success',
    '<i class="fas fa-door-open"></i>',
    '퇴실 완료!',
    `<strong>${member.name}</strong> 회원<br>${seatId}번 좌석 퇴실 처리되었습니다.<br><small style="color:#94a3b8">이용 시간: ${usedMin}분</small>`
  );
  document.getElementById('checkoutPhone').value = '';
  hideResult('checkoutResult');
}

// ============================================================
// 내 정보 조회
// ============================================================
function doMyInfo() {
  loadSharedState();
  const phone4 = document.getElementById('myinfoPhone').value.trim();
  const resultEl = document.getElementById('myinfoResult');

  if (phone4.length !== 4) {
    resultEl.style.display = 'none';
    alert('연락처 뒷 4자리를 입력해주세요.');
    return;
  }

  const matches = findMemberByPhone4(phone4);
  if (!matches.length) {
    resultEl.innerHTML = `
      <div style="margin-top:16px;padding:14px 16px;background:#fee2e2;border-radius:10px;
                  border:2px solid #ef4444;color:#991b1b;font-size:13px;">
        <i class="fas fa-times-circle"></i> 해당하는 회원을 찾을 수 없습니다.<br>
        <small>연락처를 다시 확인해주세요.</small>
      </div>`;
    resultEl.style.display = 'block';
    return;
  }

  const member = matches[0];
  const seat = gState.seats.find(s => s.memberId === member.id);
  const days = daysDiff(member.expiry);
  const isActive = seat && seat.status === 'occupied';

  // 만료일 프로그레스
  let pct = 100, pclass = '';
  if (member.start && member.expiry) {
    const total = (new Date(member.expiry) - new Date(member.start)) / 86400000;
    const used  = (new Date() - new Date(member.start)) / 86400000;
    pct = Math.max(0, Math.min(100, Math.round((1 - used/total) * 100)));
  }
  if (days !== null && days <= 3) pclass = 'danger';
  else if (days !== null && days <= 7) pclass = 'warn';

  const daysLabel = days === null ? '-'
    : days < 0   ? `<span style="color:#f87171">만료됨</span>`
    : days === 0  ? `<span style="color:#fbbf24">오늘 만료</span>`
    : `D-${days}`;

  resultEl.innerHTML = `
    <div class="s-info-card">
      <div class="s-info-card-header">
        <div class="s-info-avatar"><i class="fas fa-user-graduate"></i></div>
        <div>
          <div class="s-info-name">${member.name}</div>
          <div class="s-info-phone">${member.phone || '-'}</div>
        </div>
      </div>
      <div class="s-info-grid">
        <div class="s-info-item">
          <div class="s-info-label">배정 좌석</div>
          <div class="s-info-val">${member.seatNo ? member.seatNo + '번' : '-'}</div>
        </div>
        <div class="s-info-item">
          <div class="s-info-label">현재 상태</div>
          <div class="s-info-val">${isActive ? '🟢 이용 중' : '⚪ 미입실'}</div>
        </div>
        <div class="s-info-item">
          <div class="s-info-label">이용권</div>
          <div class="s-info-val">${member.ticket || '-'}</div>
        </div>
        <div class="s-info-item">
          <div class="s-info-label">만료까지</div>
          <div class="s-info-val">${daysLabel}</div>
        </div>
      </div>
      <div class="s-expiry-bar">
        <div class="s-info-label">이용권 잔여</div>
        <div class="s-progress-track">
          <div class="s-progress-fill ${pclass}" style="width:${pct}%"></div>
        </div>
        <div class="s-expiry-days">만료일: ${formatDate(member.expiry)} &nbsp;·&nbsp; ${daysLabel}</div>
      </div>
      ${member.memo ? `<div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,.6)">메모: ${member.memo}</div>` : ''}
    </div>`;
  resultEl.style.display = 'block';
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
    const name = document.getElementById('studyRoomName'); // 없을 수 있음
    const storedName = localStorage.getItem('studyRoomName') || '열공 독서실';
    const storedAddr = localStorage.getItem('studyRoomAddress') || '서울시 강남구 테헤란로 123';
    const storedPhone = localStorage.getItem('studyRoomPhone') || '02-1234-5678';
    document.getElementById('roomName').textContent     = storedName;
    document.getElementById('footerName').textContent   = storedName;
    document.getElementById('footerAddr').textContent   = storedAddr;
    document.getElementById('footerPhone').textContent  = storedPhone;
  } catch(e) {}
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSharedState();
  tickClock();
  setInterval(tickClock, 1000);
  initTabs();
  renderStudentMap();
  applyRoomSettings();

  // 키보드 입력 지원 (입실/퇴실/내정보)
  ['checkinPhone','checkoutPhone','myinfoPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g,'').slice(0,4);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (id === 'checkinPhone')  doCheckin();
        if (id === 'checkoutPhone') doCheckout();
        if (id === 'myinfoPhone')   doMyInfo();
      }
    });
  });

  // 30초마다 좌석 현황 자동 갱신
  setInterval(() => {
    const activeTab = document.querySelector('.s-tab.active');
    if (activeTab && activeTab.dataset.tab === 'map') renderStudentMap();
  }, 30000);
});
