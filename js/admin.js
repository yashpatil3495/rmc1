/* =============================================
   AUTHENTICATION
   Hardcoded credentials, sessionStorage session,
   5-attempt lockout (resets on page reload).
   ============================================= */

const ADMIN_USER = 'rmc_admin';
const ADMIN_PASS = 'RMC@2026';
let failedAttempts = 0;
const MAX_ATTEMPTS = 5;

function checkSession() {
    if (sessionStorage.getItem('rmc_admin_session') === 'active') {
        showDashboard();
    }
}

function attemptLogin() {
    if (failedAttempts >= MAX_ATTEMPTS) return;

    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('loginError');

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        sessionStorage.setItem('rmc_admin_session', 'active');
        showDashboard();
    } else {
        failedAttempts++;
        const remaining = MAX_ATTEMPTS - failedAttempts;

        if (failedAttempts >= MAX_ATTEMPTS) {
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('lockoutMsg').style.display = 'block';
        } else {
            errorEl.textContent = `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
            errorEl.classList.remove('shake');
            void errorEl.offsetWidth;
            errorEl.classList.add('shake');
        }
    }
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    refreshAll();
}

function logout() {
    sessionStorage.removeItem('rmc_admin_session');
    location.reload();
}

document.getElementById('loginPass').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') attemptLogin();
});
document.getElementById('loginUser').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('loginPass').focus();
});

/* =============================================
   TAB NAVIGATION
   ============================================= */

function switchTab(tabId) {
    document.querySelectorAll('.dash-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === 'panel-' + tabId);
    });

    if (tabId === 'csv') {
        populateEventDropdown();
        loadParticipantData();
    } else if (tabId === 'stats') {
        renderStats();
    } else if (tabId === 'announce') {
        loadAnnouncementForm();
    } else if (tabId === 'members') {
        renderMembersTable();
    } else if (tabId === 'cert') {
        loadCertConfig();
        renderCertPreview();
    }
}

/* =============================================
   EVENTS MANAGER (Tab A)
   ============================================= */

function getEvents() {
    try {
        return JSON.parse(localStorage.getItem('rmc_events')) || [];
    } catch {
        return [];
    }
}

function setEvents(events) {
    localStorage.setItem('rmc_events', JSON.stringify(events));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function saveEvent(e) {
    e.preventDefault();

    const eventObj = {
        id: document.getElementById('editingEventId').value || generateId(),
        name: document.getElementById('evName').value.trim(),
        date: document.getElementById('evDate').value,
        description: document.getElementById('evDesc').value.trim(),
        registrationLink: document.getElementById('evLink').value.trim(),
        deadline: document.getElementById('evDeadline').value,
        maxParticipants: document.getElementById('evMaxPart').value ? parseInt(document.getElementById('evMaxPart').value) : null,
        status: document.getElementById('evStatus').value,
        posterUrl: document.getElementById('evPoster').value.trim(),
        createdAt: new Date().toISOString()
    };

    const events = getEvents();
    const editId = document.getElementById('editingEventId').value;

    if (editId) {
        const idx = events.findIndex(ev => ev.id === editId);
        if (idx !== -1) {
            eventObj.createdAt = events[idx].createdAt;
            events[idx] = eventObj;
        }
        showToast('Event updated successfully!', 'success');
    } else {
        events.push(eventObj);
        showToast('Event created successfully!', 'success');
    }

    setEvents(events);
    resetEventForm();
    renderEventsTable();
}

function editEvent(id) {
    const events = getEvents();
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    document.getElementById('evName').value = ev.name;
    document.getElementById('evDate').value = ev.date;
    document.getElementById('evDesc').value = ev.description;
    document.getElementById('evLink').value = ev.registrationLink || '';
    document.getElementById('evDeadline').value = ev.deadline || '';
    document.getElementById('evMaxPart').value = ev.maxParticipants || '';
    document.getElementById('evStatus').value = ev.status;
    document.getElementById('evPoster').value = ev.posterUrl || '';
    document.getElementById('editingEventId').value = ev.id;

    document.getElementById('formTitle').textContent = 'EDIT EVENT';
    document.getElementById('saveEventBtn').innerHTML = '<i class="bx bx-save"></i> Update Event';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.getElementById('panel-events').scrollIntoView({ behavior: 'smooth' });
}

function deleteEvent(id) {
    showModal('Delete Event', 'Are you sure you want to delete this event? This cannot be undone.', () => {
        let events = getEvents();
        events = events.filter(ev => ev.id !== id);
        setEvents(events);
        renderEventsTable();
        showToast('Event deleted.', 'error');
    });
}

function cancelEdit() {
    resetEventForm();
}

function resetEventForm() {
    document.getElementById('eventForm').reset();
    document.getElementById('editingEventId').value = '';
    document.getElementById('formTitle').textContent = 'CREATE NEW EVENT';
    document.getElementById('saveEventBtn').innerHTML = '<i class="bx bx-plus"></i> Save Event';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

function renderEventsTable() {
    const events = getEvents();
    const tbody = document.getElementById('eventsTableBody');
    const emptyMsg = document.getElementById('noEventsMsg');

    if (events.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }

    emptyMsg.style.display = 'none';
    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = events.map(ev => {
        const statusClass = ev.status === 'Registration Open' ? 'open'
                          : ev.status === 'Registration Closed' ? 'closed'
                          : 'completed';
        const dateStr = ev.date ? new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        const deadlineStr = ev.deadline ? new Date(ev.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

        return `
            <tr>
                <td title="${escapeHtml(ev.name)}">${escapeHtml(ev.name)}</td>
                <td>${dateStr}</td>
                <td><span class="status-badge ${statusClass}">${ev.status}</span></td>
                <td>${deadlineStr}</td>
                <td>${ev.maxParticipants || '—'}</td>
                <td>
                    <div class="table-actions">
                        <button class="edit-btn" onclick="editEvent('${ev.id}')" title="Edit">
                            <i class='bx bx-edit-alt'></i> Edit
                        </button>
                        <button class="delete-btn" onclick="deleteEvent('${ev.id}')" title="Delete">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/* =============================================
   CSV UPLOAD & PARTICIPANT VIEWER (Tab B)
   ============================================= */

function populateEventDropdown() {
    const events = getEvents();
    const select = document.getElementById('csvEventSelect');
    const currentVal = select.value;

    select.innerHTML = '<option value="">— Select an Event —</option>';

    events.forEach(ev => {
        const opt = document.createElement('option');
        opt.value = ev.name;
        opt.textContent = `${ev.name} (${ev.date})`;
        select.appendChild(opt);
    });

    if (currentVal) select.value = currentVal;
}

function parseCSV(csvText) {
    const result = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;

    csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    while (i < csvText.length) {
        const char = csvText[i];

        if (insideQuotes) {
            if (char === '"') {
                if (i + 1 < csvText.length && csvText[i + 1] === '"') {
                    currentField += '"';
                    i += 2;
                } else {
                    insideQuotes = false;
                    i++;
                }
            } else {
                currentField += char;
                i++;
            }
        } else {
            if (char === '"') {
                insideQuotes = true;
                i++;
            } else if (char === ',') {
                currentRow.push(currentField.trim());
                currentField = '';
                i++;
            } else if (char === '\n') {
                currentRow.push(currentField.trim());
                if (currentRow.some(f => f !== '')) {
                    result.push(currentRow);
                }
                currentRow = [];
                currentField = '';
                i++;
            } else {
                currentField += char;
                i++;
            }
        }
    }

    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
        result.push(currentRow);
    }

    if (result.length === 0) return { headers: [], rows: [] };

    return {
        headers: result[0],
        rows: result.slice(1)
    };
}

function handleCSVUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const eventName = document.getElementById('csvEventSelect').value;
    if (!eventName) {
        showToast('Please select an event first!', 'error');
        input.value = '';
        return;
    }

    if (!file.name.endsWith('.csv')) {
        showToast('Please upload a .csv file.', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const csvText = e.target.result;
        const parsed = parseCSV(csvText);

        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
            showToast('CSV file is empty or invalid.', 'error');
            return;
        }

        const storageKey = 'rmc_participants_' + eventName;
        const dataObj = {
            headers: parsed.headers,
            rows: parsed.rows,
            uploadedAt: new Date().toISOString(),
            fileName: file.name
        };

        localStorage.setItem(storageKey, JSON.stringify(dataObj));
        showToast(`Uploaded ${parsed.rows.length} participants for "${eventName}"!`, 'success');
        loadParticipantData();
    };

    reader.readAsText(file);
    input.value = '';
}

function loadParticipantData() {
    const eventName = document.getElementById('csvEventSelect').value;
    const dataPanel = document.getElementById('csvDataPanel');

    if (!eventName) {
        dataPanel.style.display = 'none';
        return;
    }

    const storageKey = 'rmc_participants_' + eventName;
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
        dataPanel.style.display = 'none';
        return;
    }

    try {
        const data = JSON.parse(raw);
        renderCSVTable(data.headers, data.rows);
        renderCSVSummary(data.headers, data.rows);
        dataPanel.style.display = 'block';
    } catch {
        dataPanel.style.display = 'none';
    }
}

function renderCSVTable(headers, rows) {
    const thead = document.getElementById('csvTableHead');
    const tbody = document.getElementById('csvTableBody');

    thead.innerHTML = '<tr>' + headers.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>';
    tbody.innerHTML = rows.map(row =>
        '<tr>' + row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('') + '</tr>'
    ).join('');
}

function renderCSVSummary(headers, rows) {
    const summary = document.getElementById('csvSummary');
    const total = rows.length;

    const mobileIdx = headers.findIndex(h =>
        /mobile|phone|contact|cell/i.test(h)
    );

    let uniqueCount = total;
    if (mobileIdx !== -1) {
        const uniqueNumbers = new Set(rows.map(r => (r[mobileIdx] || '').trim()).filter(Boolean));
        uniqueCount = uniqueNumbers.size;
    }

    summary.innerHTML = `
        <div class="csv-summary-item">
            <span class="value">${total}</span>
            <span class="label">Total Participants</span>
        </div>
        <div class="csv-summary-item">
            <span class="value">${uniqueCount}</span>
            <span class="label">Unique Entries${mobileIdx !== -1 ? ' (by Mobile)' : ''}</span>
        </div>
    `;
}

function exportJSON() {
    const eventName = document.getElementById('csvEventSelect').value;
    if (!eventName) {
        showToast('No event selected.', 'error');
        return;
    }

    const storageKey = 'rmc_participants_' + eventName;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
        showToast('No participant data to export.', 'error');
        return;
    }

    try {
        const data = JSON.parse(raw);

        const participants = data.rows.map(row => {
            const obj = {};
            data.headers.forEach((header, i) => {
                obj[header] = row[i] || '';
            });
            return obj;
        });

        const exportObj = {
            event: eventName,
            exported_at: new Date().toISOString(),
            participants: participants
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rmc_${eventName.replace(/\s+/g, '_').toLowerCase()}_participants.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('JSON exported successfully!', 'success');
    } catch {
        showToast('Error exporting data.', 'error');
    }
}

function confirmClearParticipants() {
    const eventName = document.getElementById('csvEventSelect').value;
    if (!eventName) return;

    showModal('Clear Data', `Delete all participant data for "${eventName}"? This cannot be undone.`, () => {
        localStorage.removeItem('rmc_participants_' + eventName);
        loadParticipantData();
        showToast('Participant data cleared.', 'error');
    });
}

const dropZone = document.getElementById('csvDropZone');
if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const input = document.getElementById('csvFileInput');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            handleCSVUpload(input);
        }
    });
}

/* =============================================
   STATS OVERVIEW (Tab C)
   ============================================= */

function renderStats() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('rmc_participants_')) {
            keys.push(key);
        }
    }

    const statsCards = document.getElementById('statsCards');
    const breakdownBody = document.getElementById('breakdownBody');
    const noStatsMsg = document.getElementById('noStatsMsg');
    const breakdownTable = document.getElementById('breakdownTable');

    if (keys.length === 0) {
        statsCards.innerHTML = '';
        breakdownBody.innerHTML = '';
        noStatsMsg.style.display = 'block';
        breakdownTable.style.display = 'none';
        return;
    }

    noStatsMsg.style.display = 'none';
    breakdownTable.style.display = '';

    let totalEvents = 0;
    let totalParticipants = 0;
    const breakdownRows = [];

    keys.forEach(key => {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            const eventName = key.replace('rmc_participants_', '');
            const count = data.rows ? data.rows.length : 0;
            const uploadDate = data.uploadedAt
                ? new Date(data.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';

            totalEvents++;
            totalParticipants += count;
            breakdownRows.push({ name: eventName, count, uploadDate });
        } catch {
            // Skip corrupt data
        }
    });

    statsCards.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon"><i class='bx bx-calendar-check'></i></div>
            <div class="stat-value">${totalEvents}</div>
            <div class="stat-title">Events with Data</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon"><i class='bx bx-group'></i></div>
            <div class="stat-value">${totalParticipants}</div>
            <div class="stat-title">Total Participants</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon"><i class='bx bx-calculator'></i></div>
            <div class="stat-value">${totalEvents > 0 ? Math.round(totalParticipants / totalEvents) : 0}</div>
            <div class="stat-title">Avg per Event</div>
        </div>
    `;

    breakdownBody.innerHTML = breakdownRows.map(r => `
        <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${r.count}</td>
            <td>${r.uploadDate}</td>
        </tr>
    `).join('');
}

/* =============================================
   UTILITY FUNCTIONS
   ============================================= */

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showModal(title, message, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('active');

    const confirmBtn = document.getElementById('modalConfirmBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.id = 'modalConfirmBtn';
    newBtn.onclick = () => {
        onConfirm();
        closeModal();
    };
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function refreshAll() {
    renderEventsTable();
    populateEventDropdown();
    renderStats();
    renderMembersTable();
}

/* =============================================
   ANNOUNCEMENTS (Tab D)
   ============================================= */

let currentAnnColor = '#c9a84c';

function updateAnnCharCount() {
    const msg = document.getElementById('annMsg').value;
    document.getElementById('annCharCount').textContent = msg.length;
}

function selectAnnColor(color, btn) {
    currentAnnColor = color;
    document.querySelectorAll('#annColorPresets .color-swatch').forEach(s => s.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateAnnPreview();
}

function updateAnnPreview() {
    const msg = document.getElementById('annMsg').value || 'Your announcement will appear here...';
    const textColor = document.getElementById('annTextColor').value;
    const scrolling = document.getElementById('annScrolling').checked;
    const active = document.getElementById('annActive').checked;
    const box = document.getElementById('annPreviewBox');
    const textEl = document.getElementById('annPreviewText');

    document.getElementById('annScrollLabel').textContent = scrolling ? 'ON' : 'OFF';
    document.getElementById('annActiveLabel').textContent = active ? 'ON' : 'OFF';

    box.style.background = currentAnnColor;
    box.style.opacity = active ? '1' : '0.4';
    textEl.textContent = msg;
    textEl.style.color = textColor;
    textEl.className = scrolling ? 'ann-scroll-text' : '';
}

function saveAnnouncement() {
    const msg = document.getElementById('annMsg').value.trim();
    if (!msg) { showToast('Please enter a banner message.', 'error'); return; }

    const data = {
        message: msg,
        color: currentAnnColor,
        textColor: document.getElementById('annTextColor').value,
        scrolling: document.getElementById('annScrolling').checked,
        active: document.getElementById('annActive').checked,
        updatedAt: new Date().toISOString()
    };
    localStorage.setItem('rmc_announcement', JSON.stringify(data));
    showToast('Banner saved successfully!', 'success');
}

function clearAnnouncement() {
    showModal('Clear Banner', 'Remove the announcement banner? It will disappear from the public site.', () => {
        localStorage.removeItem('rmc_announcement');
        document.getElementById('annMsg').value = '';
        currentAnnColor = '#c9a84c';
        updateAnnCharCount();
        updateAnnPreview();
        showToast('Banner cleared.', 'error');
    });
}

function loadAnnouncementForm() {
    try {
        const data = JSON.parse(localStorage.getItem('rmc_announcement'));
        if (!data) return;
        document.getElementById('annMsg').value = data.message || '';
        document.getElementById('annTextColor').value = data.textColor || '#000000';
        document.getElementById('annScrolling').checked = data.scrolling !== false;
        document.getElementById('annActive').checked = data.active !== false;
        currentAnnColor = data.color || '#c9a84c';

        document.querySelectorAll('#annColorPresets .color-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.color === currentAnnColor);
        });

        updateAnnCharCount();
        updateAnnPreview();
    } catch { /* no data yet */ }
}

/* =============================================
   MEMBER MANAGEMENT (Tab E)
   ============================================= */

let currentMemberPhotoBase64 = '';

function getMembers() {
    try { return JSON.parse(localStorage.getItem('rmc_members')) || []; }
    catch { return []; }
}

function setMembers(members) {
    localStorage.setItem('rmc_members', JSON.stringify(members));
}

function toggleYearField() {
    const memberType = document.getElementById('memType').value;
    const yearFieldGroup = document.getElementById('yearFieldGroup');
    const yearRequired = document.getElementById('yearRequired');
    const memYear = document.getElementById('memYear');
    const qualRequired = document.getElementById('qualRequired');
    const memQualification = document.getElementById('memQualification');

    if (memberType === 'Faculty Advisor') {
        yearRequired.style.display = 'none';
        qualRequired.innerHTML = '<span style="color: #c9a84c;">*</span>';
        memYear.required = false;
        memQualification.required = true;
    } else if (memberType === 'Core Committee' || memberType === 'General Member') {
        yearRequired.style.display = 'inline';
        qualRequired.innerHTML = '';
        memYear.required = true;
        memQualification.required = false;
    }
}

function handleMemberPhotoUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please upload a valid image file.', 'error');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        currentMemberPhotoBase64 = e.target.result;
        document.getElementById('memPhotoData').value = currentMemberPhotoBase64;
        showPhotoPreview(currentMemberPhotoBase64);
        showToast('Photo uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function showPhotoPreview(photoBase64) {
    const previewDiv = document.getElementById('photoPreview');
    const previewImg = document.getElementById('photoPreviewImg');
    previewImg.src = photoBase64;
    previewDiv.style.display = 'block';
}

function removeMemberPhoto() {
    currentMemberPhotoBase64 = '';
    document.getElementById('memPhotoData').value = '';
    document.getElementById('memPhotoFileInput').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    showToast('Photo removed.', 'success');
}

function getMemberPhoto(m) {
    if (m.photoData && m.photoData.trim()) return m.photoData;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=c9a84c&color=0a0a0a&size=128&bold=true`;
}

function saveMember(e) {
    e.preventDefault();
    
    const memberType = document.getElementById('memType').value;
    const memYear = document.getElementById('memYear').value;

    if ((memberType === 'Core Committee' || memberType === 'General Member') && !memYear) {
        showToast('Year is required for student members.', 'error');
        return;
    }
    if (memberType === 'Faculty Advisor' && !document.getElementById('memQualification').value.trim()) {
        showToast('Qualification is required for faculty members.', 'error');
        return;
    }

    const member = {
        id: document.getElementById('editingMemberId').value || generateId(),
        name: document.getElementById('memName').value.trim(),
        role: document.getElementById('memRole').value.trim(),
        year: memYear,
        department: document.getElementById('memDept').value.trim(),
        qualification: document.getElementById('memQualification').value.trim(),
        photoData: document.getElementById('memPhotoData').value,
        linkedin: document.getElementById('memLinkedin').value.trim(),
        email: document.getElementById('memEmail').value.trim(),
        memberType: memberType,
        joiningYear: document.getElementById('memJoinYear').value ? parseInt(document.getElementById('memJoinYear').value) : null,
        status: document.getElementById('memStatus').value,
        createdAt: new Date().toISOString()
    };

    const members = getMembers();
    const editId = document.getElementById('editingMemberId').value;

    if (editId) {
        const idx = members.findIndex(m => m.id === editId);
        if (idx !== -1) { member.createdAt = members[idx].createdAt; members[idx] = member; }
        showToast('Member updated!', 'success');
    } else {
        members.push(member);
        showToast('Member added!', 'success');
    }

    setMembers(members);
    resetMemberForm();
    renderMembersTable();
}

function editMember(id) {
    const m = getMembers().find(m => m.id === id);
    if (!m) return;
    document.getElementById('memName').value = m.name;
    document.getElementById('memRole').value = m.role;
    document.getElementById('memYear').value = m.year || '';
    document.getElementById('memDept').value = m.department || '';
    document.getElementById('memQualification').value = m.qualification || '';
    document.getElementById('memType').value = m.memberType;
    toggleYearField();
    document.getElementById('memLinkedin').value = m.linkedin || '';
    document.getElementById('memEmail').value = m.email || '';
    document.getElementById('memJoinYear').value = m.joiningYear || '';
    document.getElementById('memStatus').value = m.status || 'Active';
    document.getElementById('editingMemberId').value = m.id;

    if (m.photoData) {
        currentMemberPhotoBase64 = m.photoData;
        document.getElementById('memPhotoData').value = currentMemberPhotoBase64;
        showPhotoPreview(currentMemberPhotoBase64);
    } else {
        currentMemberPhotoBase64 = '';
        document.getElementById('memPhotoData').value = '';
        document.getElementById('photoPreview').style.display = 'none';
    }

    document.getElementById('memberFormTitle').textContent = 'EDIT MEMBER';
    document.getElementById('saveMemberBtn').innerHTML = '<i class="bx bx-save"></i> Update Member';
    document.getElementById('cancelMemberEditBtn').style.display = 'inline-block';
    document.getElementById('panel-members').scrollIntoView({ behavior: 'smooth' });
}

function deleteMember(id) {
    showModal('Delete Member', 'Remove this member? This cannot be undone.', () => {
        let members = getMembers().filter(m => m.id !== id);
        setMembers(members);
        renderMembersTable();
        showToast('Member deleted.', 'error');
    });
}

function cancelMemberEdit() { resetMemberForm(); }

function resetMemberForm() {
    document.getElementById('memberForm').reset();
    document.getElementById('editingMemberId').value = '';
    currentMemberPhotoBase64 = '';
    document.getElementById('memPhotoData').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('memPhotoFileInput').value = '';
    document.getElementById('memberFormTitle').textContent = 'ADD NEW MEMBER';
    document.getElementById('saveMemberBtn').innerHTML = '<i class="bx bx-plus"></i> Add Member';
    document.getElementById('cancelMemberEditBtn').style.display = 'none';
    document.getElementById('memType').value = '';
    document.getElementById('yearFieldGroup').style.display = 'block';
    document.getElementById('yearRequired').style.display = 'inline';
    document.getElementById('qualRequired').innerHTML = '';
}

function renderMembersTable() {
    const members = getMembers();
    const tbody = document.getElementById('membersTableBody');
    const emptyMsg = document.getElementById('noMembersMsg');

    if (members.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    emptyMsg.style.display = 'none';

    tbody.innerHTML = members.map(m => {
        const photo = getMemberPhoto(m);
        const statusBadge = m.status === 'Alumni'
            ? '<span class="status-badge closed">Alumni</span>'
            : '<span class="status-badge open">Active</span>';
        return `<tr>
            <td><img src="${escapeHtml(photo)}" class="member-thumb" alt="${escapeHtml(m.name)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=c9a84c&color=0a0a0a&size=128'"></td>
            <td>${escapeHtml(m.name)}</td>
            <td>${escapeHtml(m.role)}</td>
            <td>${escapeHtml(m.qualification || '—')}</td>
            <td>${escapeHtml(m.memberType)}</td>
            <td>${statusBadge}</td>
            <td><div class="table-actions">
                <button class="edit-btn" onclick="editMember('${m.id}')"><i class='bx bx-edit-alt'></i> Edit</button>
                <button class="delete-btn" onclick="deleteMember('${m.id}')"><i class='bx bx-trash'></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

function exportMembersJSON() {
    const members = getMembers();
    if (members.length === 0) { showToast('No members to export.', 'error'); return; }
    const blob = new Blob([JSON.stringify(members, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rmc_members.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Members exported!', 'success');
}

function importMembersJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('Not an array');
            localStorage.setItem('rmc_members', JSON.stringify(data));
            renderMembersTable();
            showToast(`Imported ${data.length} members!`, 'success');
        } catch {
            showToast('Invalid JSON file.', 'error');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

const memPhotoDropZone = document.getElementById('memPhotoDropZone');
if (memPhotoDropZone) {
    memPhotoDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        memPhotoDropZone.classList.add('dragover');
    });
    memPhotoDropZone.addEventListener('dragleave', () => {
        memPhotoDropZone.classList.remove('dragover');
    });
    memPhotoDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        memPhotoDropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const input = document.getElementById('memPhotoFileInput');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            handleMemberPhotoUpload(input);
        }
    });
}

/* =============================================
   CERTIFICATE PREVIEW (Tab F)
   ============================================= */

let certTemplateImg = null;

function handleCertUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Please upload a PNG or JPG image.', 'error');
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        localStorage.setItem('rmc_cert_template', e.target.result);
        certTemplateImg = new Image();
        certTemplateImg.onload = () => renderCertPreview();
        certTemplateImg.src = e.target.result;
        showToast('Certificate template uploaded!', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function clearCertTemplate() {
    showModal('Clear Template', 'Remove the certificate template image?', () => {
        localStorage.removeItem('rmc_cert_template');
        certTemplateImg = null;
        renderCertPreview();
        showToast('Template cleared.', 'error');
    });
}

function loadCertConfig() {
    const tplData = localStorage.getItem('rmc_cert_template');
    if (tplData && !certTemplateImg) {
        certTemplateImg = new Image();
        certTemplateImg.onload = () => renderCertPreview();
        certTemplateImg.src = tplData;
    }

    try {
        const cfg = JSON.parse(localStorage.getItem('rmc_cert_config'));
        if (!cfg) return;
        document.getElementById('certFont').value = cfg.font || 'Cinzel';
        document.getElementById('certFontSize').value = cfg.fontSize || 36;
        document.getElementById('certFontSizeVal').textContent = cfg.fontSize || 36;
        document.getElementById('certFontColor').value = cfg.fontColor || '#000000';
        document.getElementById('certXPos').value = cfg.xPercent || 50;
        document.getElementById('certXVal').textContent = cfg.xPercent || 50;
        document.getElementById('certYPos').value = cfg.yPercent || 70;
        document.getElementById('certYVal').textContent = cfg.yPercent || 70;
        document.getElementById('certBold').checked = cfg.bold || false;
        document.getElementById('certItalic').checked = cfg.italic || false;
    } catch { /* no config */ }
}

function renderCertPreview() {
    const canvas = document.getElementById('certCanvas');
    const ctx = canvas.getContext('2d');

    if (certTemplateImg && certTemplateImg.complete && certTemplateImg.naturalWidth > 0) {
        canvas.width = certTemplateImg.naturalWidth;
        canvas.height = certTemplateImg.naturalHeight;
        ctx.drawImage(certTemplateImg, 0, 0);
    } else {
        canvas.width = 800;
        canvas.height = 566;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 800, 566);
        ctx.strokeStyle = 'rgba(201,168,76,0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(20, 20, 760, 526);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(201,168,76,0.3)';
        ctx.font = '18px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText('Upload a certificate template to preview', 400, 283);
    }

    const name = document.getElementById('certSampleName').value || 'Sample Participant';
    const font = document.getElementById('certFont').value;
    const fontSize = parseInt(document.getElementById('certFontSize').value);
    const fontColor = document.getElementById('certFontColor').value;
    const xPct = parseInt(document.getElementById('certXPos').value);
    const yPct = parseInt(document.getElementById('certYPos').value);
    const bold = document.getElementById('certBold').checked;
    const italic = document.getElementById('certItalic').checked;

    const weight = bold ? 'bold ' : '';
    const style = italic ? 'italic ' : '';
    ctx.font = `${style}${weight}${fontSize}px ${font}`;
    ctx.fillStyle = fontColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, canvas.width * xPct / 100, canvas.height * yPct / 100);

    const cx = canvas.width * xPct / 100;
    const cy = canvas.height * yPct / 100;
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(cb => {
        const label = cb.parentElement.querySelector('.toggle-label');
        if (label) label.textContent = cb.checked ? 'ON' : 'OFF';
    });
}

function saveCertConfig() {
    const cfg = {
        font: document.getElementById('certFont').value,
        fontSize: parseInt(document.getElementById('certFontSize').value),
        fontColor: document.getElementById('certFontColor').value,
        xPercent: parseInt(document.getElementById('certXPos').value),
        yPercent: parseInt(document.getElementById('certYPos').value),
        bold: document.getElementById('certBold').checked,
        italic: document.getElementById('certItalic').checked,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem('rmc_cert_config', JSON.stringify(cfg));
    showToast('Configuration saved!', 'success');
}

function downloadCertPreview() {
    const canvas = document.getElementById('certCanvas');
    const link = document.createElement('a');
    link.download = 'certificate_preview.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Preview downloaded!', 'success');
}

function exportCertConfig() {
    const raw = localStorage.getItem('rmc_cert_config');
    if (!raw) { showToast('Save the configuration first.', 'error'); return; }
    const blob = new Blob([raw], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cert_config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Config exported!', 'success');
}

/* =============================================
   INITIALIZATION
   ============================================= */
checkSession();
