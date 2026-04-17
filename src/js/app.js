/* ============================================================
   독서실 관리 시스템 - Main Application Logic
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
let state = {
  totalSeats: 60,
  seatsPerRow: 10,
  totalLockers: 30,
  members: [],
  payments: [],
  seats: [],      // { id, status: 'available'|'occupied'|'reserved', memberId, memberName, since }
  lockers: [],    // { id, status: 'available'|'occupied', memberId, memberName, since }
  currentFilter: 'all',
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('ko-KR');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(dateStr);
  return Math.ceil((target - now) / 86400000);
}

function statusBadge(days) {
  if (days === null) return `<span class="badge badge-default">-</span>`;
  if (days < 0) return `<span class="badge badge-danger">만료됨</span>`;
  if (days <= 7) return `<span class="badge badge-warning">D-${days}</span>`;
  return `<span class="badge badge-success">이용 중</span>`;
}

function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-circle', info:'fa-info-circle' };
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i>${msg}`;
  $('toastContainer').appendChild(el);
  setTimeout(() => { el.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => el.remove(), 300); }, 2800);
}

// ============================================================
// LOCAL STORAGE
// ============================================================
function saveState() {
  localStorage.setItem('studyroom_state', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('studyroom_state');
  if (raw) {
    try { Object.assign(state, JSON.parse(raw)); }
    catch(e) { console.error('State load error', e); }
  }
  if (!state.seats.length) initSeats();
  if (!state.lockers.length) initLockers();
}

// ============================================================
// INIT SEATS / LOCKERS
// ============================================================
function initSeats() {
  state.seats = Array.from({ length: state.totalSeats }, (_, i) => ({
    id: i + 1,
    status: 'available',
    memberId: null,
    memberName: null,
    since: null,
  }));
}

function initLockers() {
  state.lockers = Array.from({ length: state.totalLockers }, (_, i) => ({
    id: i + 1,
    status: 'available',
    memberId: null,
    memberName: null,
    since: null,
  }));
}

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  const now = new Date();
  const days = ['일','월','화','수','목','금','토'];
  const str = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${days[now.getDay()]}) ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  $('currentTime').textContent = str;
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  const pageEl = $(`page-${page}`);
  if (navItem) navItem.classList.add('active');
  if (pageEl) pageEl.classList.add('active');
  const titles = { dashboard:'대시보드', seats:'좌석 현황', members:'회원 관리', payment:'수납 관리', locker:'락커 관리', settings:'설정' };
  $('pageTitle').textContent = titles[page] || page;

  if (page === 'dashboard') renderDashboard();
  if (page === 'seats') renderSeatMap();
  if (page === 'members') renderMemberTable();
  if (page === 'payment') renderPaymentTable();
  if (page === 'locker') renderLockerGrid();
  if (page === 'settings') renderSettings();
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const occupied = state.seats.filter(s => s.status === 'occupied').length;
  const pct = state.totalSeats > 0 ? Math.round(occupied / state.totalSeats * 100) : 0;
  $('stat-occupied').textContent = occupied;
  $('stat-occupied-pct').textContent = pct + '%';
  $('stat-members').textContent = state.members.length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const monthRev = state.payments.filter(p => p.date >= monthStart).reduce((a, p) => a + (p.amount || 0), 0);
  $('stat-revenue').textContent = fmt(monthRev);

  const expiring = state.members.filter(m => {
    const d = daysDiff(m.expiry);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  $('stat-expiring').textContent = expiring;

  // Mini seat map
  const mini = $('miniSeatMap');
  mini.innerHTML = state.seats.map(s =>
    `<div class="mini-seat ${s.status}" title="${s.id}번 좌석${s.memberName ? ' - '+s.memberName : ''}"></div>`
  ).join('');

  // Notifications
  const nl = $('notificationList');
  const expItems = state.members
    .filter(m => { const d = daysDiff(m.expiry); return d !== null && d >= 0 && d <= 7; })
    .map(m => {
      const d = daysDiff(m.expiry);
      return `<li>
        <div class="notif-icon warn"><i class="fas fa-clock"></i></div>
        <div class="notif-text">
          <div class="title">${m.name} 회원 이용권 만료 임박</div>
          <div class="sub">D-${d} · ${formatDate(m.expiry)}</div>
        </div>
      </li>`;
    });
  if (!expItems.length) {
    nl.innerHTML = `<li style="color:var(--text-muted);font-size:13px;padding:20px 0;text-align:center;">현재 만료 임박 회원이 없습니다.</li>`;
  } else {
    nl.innerHTML = expItems.join('');
  }

  // Recent Activity
  const tbody = $('recentActivity');
  const recent = [...state.seats].filter(s => s.status === 'occupied').slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">현재 이용 중인 좌석이 없습니다.</td></tr>`;
  } else {
    tbody.innerHTML = recent.map(s => `
      <tr>
        <td><strong>${s.memberName || '-'}</strong></td>
        <td><span class="badge badge-info">${s.id}번</span></td>
        <td>${s.since ? new Date(s.since).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'}) : '-'}</td>
        <td><span class="badge badge-success">이용 중</span></td>
      </tr>`
    ).join('');
  }
}

// ============================================================
// SEAT MAP
// ============================================================
function renderSeatMap() {
  const map = $('seatMap');
  const filter = state.currentFilter;
  const seats = filter === 'all' ? state.seats : state.seats.filter(s => s.status === filter);

  map.innerHTML = state.seats.map(s => {
    const show = filter === 'all' || s.status === filter;
    if (!show) return `<div class="seat-btn" style="visibility:hidden;pointer-events:none">${s.id}</div>`;
    return `<button class="seat-btn ${s.status}" onclick="openSeatModal(${s.id})" title="${s.memberName ? s.memberName : ''}">
      ${s.id}
    </button>`;
  }).join('');

  const occ = state.seats.filter(s => s.status === 'occupied').length;
  const avail = state.seats.filter(s => s.status === 'available').length;
  const res = state.seats.filter(s => s.status === 'reserved').length;
  $('seatSummary').textContent = `전체 ${state.totalSeats}석 | 이용 중 ${occ} | 이용 가능 ${avail} | 예약 ${res}`;
}

// ============================================================
// SEAT MODAL
// ============================================================
function openSeatModal(seatId) {
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;

  const stMap = { available: ['이용 가능', 'success'], occupied: ['이용 중', 'info'], reserved: ['예약', 'warning'] };
  const [stLabel, stClass] = stMap[seat.status];

  let actionsHtml = '';
  if (seat.status === 'available') {
    actionsHtml = `
      <button class="btn btn-primary" onclick="assignSeat(${seatId})"><i class="fas fa-user-check"></i> 회원 배정</button>
    `;
  } else if (seat.status === 'occupied') {
    actionsHtml = `
      <button class="btn btn-danger" onclick="vacateSeat(${seatId})"><i class="fas fa-sign-out-alt"></i> 퇴실 처리</button>
      <button class="btn btn-warning" onclick="reserveSeat(${seatId})"><i class="fas fa-bookmark"></i> 예약으로 변경</button>
    `;
  } else {
    actionsHtml = `
      <button class="btn btn-success" onclick="occupySeat(${seatId})"><i class="fas fa-sign-in-alt"></i> 입실 처리</button>
      <button class="btn btn-ghost" onclick="vacateSeat(${seatId})"><i class="fas fa-times"></i> 취소</button>
    `;
  }

  $('seatModalTitle').textContent = `${seatId}번 좌석`;
  $('seatModalBody').innerHTML = `
    <div class="seat-detail">
      <div class="seat-number-big">${seatId}</div>
      <div class="seat-status-badge badge-${stClass}"><i class="fas fa-circle" style="font-size:8px"></i> ${stLabel}</div>
      <div class="seat-info-grid">
        <div class="seat-info-item">
          <div class="label">회원명</div>
          <div class="value">${seat.memberName || '-'}</div>
        </div>
        <div class="seat-info-item">
          <div class="label">입실 시간</div>
          <div class="value">${seat.since ? new Date(seat.since).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'}) : '-'}</div>
        </div>
      </div>
      <div class="seat-modal-actions">${actionsHtml}</div>
    </div>
  `;
  openModal('seatModal');
}

function assignSeat(seatId) {
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;
  const availableMembers = state.members.filter(m => !state.seats.find(s => s.memberId === m.id && s.status !== 'available'));
  if (!availableMembers.length) {
    showToast('배정 가능한 회원이 없습니다.', 'warning');
    return;
  }
  const select = availableMembers.map(m => `<option value="${m.id}">${m.name} (${m.phone})</option>`).join('');
  $('seatModalBody').innerHTML = `
    <div class="form-group">
      <label>배정할 회원 선택</label>
      <select class="form-control" id="assignMemberSelect"><option value="">선택</option>${select}</select>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="openSeatModal(${seatId})">취소</button>
      <button class="btn btn-primary" onclick="confirmAssignSeat(${seatId})">배정</button>
    </div>
  `;
}

function confirmAssignSeat(seatId) {
  const memberId = $('assignMemberSelect')?.value;
  if (!memberId) { showToast('회원을 선택하세요.', 'warning'); return; }
  const member = state.members.find(m => m.id == memberId);
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat || !member) return;
  // free previous seat if any
  const prevSeat = state.seats.find(s => s.memberId == memberId && s.status !== 'available');
  if (prevSeat) { prevSeat.status = 'available'; prevSeat.memberId = null; prevSeat.memberName = null; prevSeat.since = null; }
  seat.status = 'occupied';
  seat.memberId = member.id;
  seat.memberName = member.name;
  seat.since = new Date().toISOString();
  member.seatNo = seatId;
  saveState();
  showToast(`${seatId}번 좌석에 ${member.name} 회원이 배정되었습니다.`);
  closeModal('seatModal');
  renderSeatMap();
  renderDashboard();
}

function vacateSeat(seatId) {
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;
  const m = state.members.find(m => m.id === seat.memberId);
  if (m) m.seatNo = null;
  seat.status = 'available';
  seat.memberId = null;
  seat.memberName = null;
  seat.since = null;
  saveState();
  showToast(`${seatId}번 좌석이 퇴실 처리되었습니다.`);
  closeModal('seatModal');
  renderSeatMap();
  renderDashboard();
}

function reserveSeat(seatId) {
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;
  seat.status = 'reserved';
  saveState();
  showToast(`${seatId}번 좌석이 예약 상태로 변경되었습니다.`, 'info');
  closeModal('seatModal');
  renderSeatMap();
}

function occupySeat(seatId) {
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;
  seat.status = 'occupied';
  seat.since = new Date().toISOString();
  saveState();
  showToast(`${seatId}번 좌석 입실 처리 완료`);
  closeModal('seatModal');
  renderSeatMap();
}

// Quick Seat
function assignQuickSeat() {
  const memberId = $('quickMember').value;
  const seatNo = parseInt($('quickSeatNumber').value);
  if (!memberId || !seatNo) { showToast('회원과 좌석번호를 입력하세요.', 'warning'); return; }
  if (seatNo < 1 || seatNo > state.totalSeats) { showToast(`좌석번호는 1~${state.totalSeats} 사이여야 합니다.`, 'warning'); return; }
  const seat = state.seats.find(s => s.id === seatNo);
  if (seat.status !== 'available') { showToast('해당 좌석은 이미 사용 중입니다.', 'error'); return; }
  const member = state.members.find(m => m.id == memberId);
  const prevSeat = state.seats.find(s => s.memberId == memberId && s.status !== 'available');
  if (prevSeat) { prevSeat.status = 'available'; prevSeat.memberId = null; prevSeat.memberName = null; prevSeat.since = null; }
  seat.status = 'occupied';
  seat.memberId = member.id;
  seat.memberName = member.name;
  seat.since = new Date().toISOString();
  member.seatNo = seatNo;
  saveState();
  showToast(`${member.name} 회원 → ${seatNo}번 좌석 배정 완료`);
  closeModal('quickSeatModal');
  renderDashboard();
}

// ============================================================
// MEMBER TABLE
// ============================================================
function renderMemberTable(filter = '') {
  const tbody = $('memberTableBody');
  let members = state.members;
  if (filter) {
    const q = filter.toLowerCase();
    members = members.filter(m => m.name.includes(q) || m.phone.includes(q));
  }
  $('memberCount').textContent = `${members.length}명`;
  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">등록된 회원이 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = members.map(m => {
    const days = daysDiff(m.expiry);
    return `
    <tr>
      <td><strong>${m.name}</strong></td>
      <td>${m.phone}</td>
      <td>${m.seatNo ? `<span class="badge badge-info">${m.seatNo}번</span>` : '-'}</td>
      <td>${m.ticket || '-'}</td>
      <td>${formatDate(m.expiry)}</td>
      <td>${statusBadge(days)}</td>
      <td>
        <div class="action-group">
          <button class="action-btn edit" onclick="editMember('${m.id}')" title="수정"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete" onclick="deleteMember('${m.id}')" title="삭제"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ============================================================
// MEMBER FORM
// ============================================================
function openAddMember() {
  $('memberModalTitle').textContent = '회원 등록';
  $('memberForm').reset();
  $('memberId').value = '';
  $('memberStart').value = today();
  openModal('memberModal');
}

function editMember(id) {
  const m = state.members.find(m => m.id === id);
  if (!m) return;
  $('memberModalTitle').textContent = '회원 수정';
  $('memberId').value = m.id;
  $('memberName').value = m.name;
  $('memberPhone').value = m.phone;
  $('memberSeat').value = m.seatNo || '';
  $('memberTicket').value = m.ticket || '';
  $('memberStart').value = m.start || '';
  $('memberExpiry').value = m.expiry || '';
  $('memberMemo').value = m.memo || '';
  openModal('memberModal');
}

function saveMember(e) {
  e.preventDefault();
  const id = $('memberId').value || Date.now().toString();
  const name = $('memberName').value.trim();
  const phone = $('memberPhone').value.trim();
  const seatNo = $('memberSeat').value ? parseInt($('memberSeat').value) : null;
  const ticket = $('memberTicket').value;
  const start = $('memberStart').value;
  const expiry = $('memberExpiry').value;
  const memo = $('memberMemo').value.trim();

  if (!name || !phone) { showToast('이름과 연락처를 입력하세요.', 'warning'); return; }

  const existing = state.members.find(m => m.id === id);
  if (existing) {
    Object.assign(existing, { name, phone, seatNo, ticket, start, expiry, memo });
    showToast('회원 정보가 수정되었습니다.', 'info');
  } else {
    state.members.push({ id, name, phone, seatNo, ticket, start, expiry, memo });
    showToast(`${name} 회원이 등록되었습니다.`);
  }
  saveState();
  closeModal('memberModal');
  renderMemberTable($('memberSearch').value);
  updateMemberSelects();
}

function deleteMember(id) {
  const m = state.members.find(m => m.id === id);
  if (!m) return;
  $('confirmTitle').textContent = '회원 삭제';
  $('confirmMessage').textContent = `${m.name} 회원을 삭제하시겠습니까?`;
  $('confirmBtn').onclick = () => {
    // free seat
    const seat = state.seats.find(s => s.memberId === id);
    if (seat) { seat.status = 'available'; seat.memberId = null; seat.memberName = null; seat.since = null; }
    state.members = state.members.filter(m => m.id !== id);
    saveState();
    showToast('회원이 삭제되었습니다.', 'warning');
    closeModal('confirmModal');
    renderMemberTable($('memberSearch').value);
    updateMemberSelects();
  };
  openModal('confirmModal');
}

// ============================================================
// PAYMENT TABLE
// ============================================================
function renderPaymentTable(filter = '') {
  const tbody = $('paymentTableBody');
  let payments = [...state.payments].sort((a,b) => b.date.localeCompare(a.date));
  if (filter) {
    payments = payments.filter(p => p.memberName.includes(filter));
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const weekStartStr = weekStart.toISOString().slice(0,10);

  $('pay-today').textContent = fmt(payments.filter(p => p.date === todayStr).reduce((a,p) => a+p.amount, 0));
  $('pay-week').textContent = fmt(payments.filter(p => p.date >= weekStartStr).reduce((a,p) => a+p.amount, 0));
  $('pay-month').textContent = fmt(payments.filter(p => p.date >= monthStart).reduce((a,p) => a+p.amount, 0));

  if (!payments.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">수납 내역이 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${formatDate(p.date)}</td>
      <td><strong>${p.memberName}</strong></td>
      <td>${p.ticket}</td>
      <td><strong style="color:var(--success)">${fmt(p.amount)}원</strong></td>
      <td><span class="badge badge-default">${p.method}</span></td>
      <td style="color:var(--text-muted)">${p.memo || '-'}</td>
      <td>
        <div class="action-group">
          <button class="action-btn delete" onclick="deletePayment('${p.id}')" title="삭제"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`
  ).join('');
}

function openAddPayment() {
  $('paymentModalTitle').textContent = '수납 등록';
  $('paymentForm').reset();
  $('paymentId').value = '';
  $('paymentDate').value = today();
  updateMemberSelects();
  openModal('paymentModal');
}

function savePayment(e) {
  e.preventDefault();
  const memberId = $('paymentMember').value;
  const ticket = $('paymentTicket').value;
  const amount = parseInt($('paymentAmount').value);
  const method = $('paymentMethod').value;
  const date = $('paymentDate').value || today();
  const memo = $('paymentMemo').value;

  if (!memberId || !ticket || !amount) { showToast('필수 항목을 입력하세요.', 'warning'); return; }
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  const id = Date.now().toString();
  state.payments.push({ id, memberId, memberName: member.name, ticket, amount, method, date, memo });
  saveState();
  showToast(`${member.name} 회원 수납이 등록되었습니다.`);
  closeModal('paymentModal');
  renderPaymentTable($('paymentSearch').value);
}

function deletePayment(id) {
  $('confirmTitle').textContent = '수납 삭제';
  $('confirmMessage').textContent = '이 수납 내역을 삭제하시겠습니까?';
  $('confirmBtn').onclick = () => {
    state.payments = state.payments.filter(p => p.id !== id);
    saveState();
    showToast('수납 내역이 삭제되었습니다.', 'warning');
    closeModal('confirmModal');
    renderPaymentTable($('paymentSearch').value);
  };
  openModal('confirmModal');
}

// ============================================================
// LOCKER
// ============================================================
function renderLockerGrid() {
  const grid = $('lockerGrid');
  grid.innerHTML = state.lockers.map(l => `
    <button class="locker-btn ${l.status}" onclick="openLockerModal(${l.id})">
      <i class="fas fa-lock${l.status === 'available' ? '-open' : ''}"></i>
      ${l.id}
    </button>`
  ).join('');
  const occ = state.lockers.filter(l => l.status === 'occupied').length;
  $('lockerSummary').textContent = `전체 ${state.totalLockers}개 | 사용 중 ${occ} | 사용 가능 ${state.totalLockers - occ}`;
}

function openLockerModal(lockerId) {
  const locker = state.lockers.find(l => l.id === lockerId);
  if (!locker) return;
  $('lockerModalTitle').textContent = `락커 ${lockerId}번`;

  let actionsHtml = '';
  if (locker.status === 'available') {
    const sel = state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    actionsHtml = `
      <div class="form-group">
        <label>배정할 회원</label>
        <select class="form-control" id="lockerMemberSel"><option value="">선택</option>${sel}</select>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="closeModal('lockerModal')">취소</button>
        <button class="btn btn-primary" onclick="assignLocker(${lockerId})">배정</button>
      </div>`;
  } else {
    actionsHtml = `
      <div class="seat-info-grid">
        <div class="seat-info-item">
          <div class="label">사용자</div><div class="value">${locker.memberName || '-'}</div>
        </div>
        <div class="seat-info-item">
          <div class="label">배정일</div><div class="value">${locker.since ? formatDate(locker.since) : '-'}</div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-danger" onclick="releaseLocker(${lockerId})"><i class="fas fa-unlock"></i> 반납 처리</button>
      </div>`;
  }

  $('lockerModalBody').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:48px;font-weight:800;color:var(--primary)">${lockerId}</div>
      <span class="badge ${locker.status === 'available' ? 'badge-success' : 'badge-danger'}">${locker.status === 'available' ? '사용 가능' : '사용 중'}</span>
    </div>
    ${actionsHtml}
  `;
  openModal('lockerModal');
}

function assignLocker(lockerId) {
  const memberId = $('lockerMemberSel')?.value;
  if (!memberId) { showToast('회원을 선택하세요.', 'warning'); return; }
  const member = state.members.find(m => m.id === memberId);
  const locker = state.lockers.find(l => l.id === lockerId);
  locker.status = 'occupied';
  locker.memberId = member.id;
  locker.memberName = member.name;
  locker.since = today();
  saveState();
  showToast(`락커 ${lockerId}번 → ${member.name} 배정 완료`);
  closeModal('lockerModal');
  renderLockerGrid();
}

function releaseLocker(lockerId) {
  const locker = state.lockers.find(l => l.id === lockerId);
  if (!locker) return;
  locker.status = 'available';
  locker.memberId = null;
  locker.memberName = null;
  locker.since = null;
  saveState();
  showToast(`락커 ${lockerId}번 반납 처리 완료`);
  closeModal('lockerModal');
  renderLockerGrid();
}

// ============================================================
// SETTINGS
// ============================================================
const defaultTickets = [
  { name: '1일권', price: 3000 },
  { name: '1주일권', price: 15000 },
  { name: '1개월권', price: 50000 },
  { name: '3개월권', price: 130000 },
  { name: '6개월권', price: 240000 },
  { name: '1년권', price: 430000 },
];
let tickets = JSON.parse(localStorage.getItem('studyroom_tickets') || 'null') || [...defaultTickets];

function renderSettings() {
  $('totalSeats').value = state.totalSeats;
  $('seatsPerRow').value = state.seatsPerRow;
  $('totalLockers').value = state.totalLockers;
  renderTicketPrices();
}

function renderTicketPrices() {
  $('ticketPriceList').innerHTML = tickets.map((t, i) => `
    <div class="ticket-row">
      <input type="text" class="form-control" value="${t.name}" placeholder="이용권명" oninput="tickets[${i}].name=this.value"/>
      <input type="number" class="form-control" value="${t.price}" placeholder="금액(원)" oninput="tickets[${i}].price=parseInt(this.value)||0"/>
      <button class="remove-btn" onclick="removeTicket(${i})"><i class="fas fa-times"></i></button>
    </div>`
  ).join('');
}

function addTicketRow() {
  tickets.push({ name: '', price: 0 });
  renderTicketPrices();
}

function removeTicket(i) {
  tickets.splice(i, 1);
  renderTicketPrices();
}

function applySeatsSettings() {
  const total = parseInt($('totalSeats').value);
  const perRow = parseInt($('seatsPerRow').value);
  if (!total || !perRow) return;
  const confirm = window.confirm(`좌석 수를 ${total}석으로 변경하시겠습니까? 기존 좌석 현황이 초기화됩니다.`);
  if (!confirm) return;
  state.totalSeats = total;
  state.seatsPerRow = perRow;
  initSeats();
  saveState();
  showToast('좌석 설정이 적용되었습니다.');
}

function applyLockerSettings() {
  const total = parseInt($('totalLockers').value);
  if (!total) return;
  const confirm = window.confirm(`락커 수를 ${total}개로 변경하시겠습니까? 기존 락커 현황이 초기화됩니다.`);
  if (!confirm) return;
  state.totalLockers = total;
  initLockers();
  saveState();
  showToast('락커 설정이 적용되었습니다.');
}

// ============================================================
// MEMBER SELECTS (in modals)
// ============================================================
function updateMemberSelects() {
  const opts = state.members.map(m => `<option value="${m.id}">${m.name} (${m.phone})</option>`).join('');
  const addOpt = `<option value="">회원 선택</option>`;
  ['paymentMember', 'quickMember'].forEach(id => {
    const el = $(id);
    if (el) { el.innerHTML = addOpt + opts; }
  });
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  const el = $(id);
  if (el) { el.classList.add('open'); el.style.display = 'flex'; }
}

function closeModal(id) {
  const el = $(id);
  if (el) { el.classList.remove('open'); el.style.display = 'none'; }
}

// Close on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    e.target.style.display = 'none';
  }
});

// ============================================================
// DEMO DATA
// ============================================================
function seedDemoData() {
  if (state.members.length > 0) return;
  const names = ['김민준','이서연','박지호','최수아','정현우','윤지은','임도현','한예린','오승민','신채원','류준혁','강나연','조민서','백태양','문소희'];
  const tickets = ['1개월권','3개월권','6개월권','1년권','1주일권'];
  const today = new Date();

  names.forEach((name, i) => {
    const id = `demo_${i+1}`;
    const ticketType = tickets[i % tickets.length];
    const daysAgo = Math.floor(Math.random() * 60);
    const start = new Date(today);
    start.setDate(today.getDate() - daysAgo);
    const months = ticketType === '1주일권' ? 0 : ticketType === '1개월권' ? 1 : ticketType === '3개월권' ? 3 : ticketType === '6개월권' ? 6 : 12;
    const expiry = new Date(start);
    if (months > 0) expiry.setMonth(expiry.getMonth() + months);
    else expiry.setDate(expiry.getDate() + 7);

    const member = {
      id,
      name,
      phone: `010-${String(Math.floor(1000+Math.random()*9000))}-${String(Math.floor(1000+Math.random()*9000))}`,
      seatNo: null,
      ticket: ticketType,
      start: start.toISOString().slice(0,10),
      expiry: expiry.toISOString().slice(0,10),
      memo: '',
    };
    state.members.push(member);

    // Assign some seats
    if (i < 10 && state.seats[i]) {
      state.seats[i].status = i < 7 ? 'occupied' : 'reserved';
      state.seats[i].memberId = id;
      state.seats[i].memberName = name;
      state.seats[i].since = new Date().toISOString();
      member.seatNo = i + 1;
    }

    // Add payment records
    const amount = ticketType === '1일권' ? 3000 : ticketType === '1주일권' ? 15000 : ticketType === '1개월권' ? 50000 : ticketType === '3개월권' ? 130000 : ticketType === '6개월권' ? 240000 : 430000;
    state.payments.push({
      id: `pay_${i+1}`,
      memberId: id,
      memberName: name,
      ticket: ticketType,
      amount,
      method: ['현금','카드','계좌이체'][i % 3],
      date: start.toISOString().slice(0,10),
      memo: '',
    });
  });

  saveState();
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  seedDemoData();

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
    });
  });

  // Data-nav buttons
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
  });

  // Sidebar toggle
  $('sidebarToggle').addEventListener('click', () => {
    const sidebar = $('sidebar');
    const main = $('mainContent');
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('collapsed');
  });

  // Mobile toggle
  $('mobileToggle')?.addEventListener('click', () => {
    $('sidebar').classList.toggle('collapsed');
    $('mainContent').classList.toggle('collapsed');
  });

  // Quick Seat button
  $('quickSeatBtn').addEventListener('click', () => {
    updateMemberSelects();
    $('quickSeatNumber').value = '';
    openModal('quickSeatModal');
  });

  // Member form submit
  $('memberForm').addEventListener('submit', saveMember);
  $('addMemberBtn').addEventListener('click', openAddMember);
  $('memberSearch').addEventListener('input', () => renderMemberTable($('memberSearch').value));

  // Payment form submit
  $('paymentForm').addEventListener('submit', savePayment);
  $('addPaymentBtn').addEventListener('click', openAddPayment);
  $('paymentSearch').addEventListener('input', () => renderPaymentTable($('paymentSearch').value));

  // Seat filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      renderSeatMap();
    });
  });

  // Locker assign
  $('assignLockerBtn')?.addEventListener('click', () => {
    const firstAvail = state.lockers.find(l => l.status === 'available');
    if (firstAvail) openLockerModal(firstAvail.id);
    else showToast('사용 가능한 락커가 없습니다.', 'warning');
  });

  // Ticket auto price fill
  $('paymentTicket').addEventListener('change', function() {
    const prices = { '1일권':3000,'1주일권':15000,'1개월권':50000,'3개월권':130000,'6개월권':240000,'1년권':430000 };
    $('paymentAmount').value = prices[this.value] || '';
  });

  // Member ticket → auto expiry
  $('memberTicket').addEventListener('change', function() {
    const start = $('memberStart').value;
    if (!start) return;
    const d = new Date(start);
    const map = {'1일권':1,'1주일권':7,'1개월권':30,'3개월권':90,'6개월권':180,'1년권':365};
    if (map[this.value]) {
      d.setDate(d.getDate() + map[this.value]);
      $('memberExpiry').value = d.toISOString().slice(0,10);
    }
  });

  // Initial render
  renderDashboard();
  updateMemberSelects();
});
