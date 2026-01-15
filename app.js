// Zen Den Tracker - Main Application Logic

// ============================================
// State & Constants
// ============================================
const EMOTIONS = ['Angry', 'Sad', 'Anxious/Worried', 'Frustrated', 'Overwhelmed', 'Tired', 'Other'];
const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
const RECENT_STAFF_KEY = 'zenDenRecentStaff';
const MAX_RECENT_STAFF = 10;

let currentTab = 'checkin';
let activeVisits = [];
let durationUpdateInterval = null;
let pendingCheckoutId = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase connection
    try {
        initSupabase();
        hideConnectionError();
    } catch (error) {
        showConnectionError();
        console.error('Failed to initialize Supabase:', error);
        return;
    }

    // Set up event listeners
    setupTabNavigation();
    setupCheckinForm();
    setupCurrentView();
    setupDashboard();
    setupHistory();
    setupModal();

    // Initialize form defaults
    setFormDefaults();

    // Load initial data
    loadActiveVisitsCount();
});

// ============================================
// Tab Navigation
// ============================================
function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabId}-tab`);
    });

    currentTab = tabId;

    // Load data for the selected tab
    switch (tabId) {
        case 'current':
            loadCurrentStudents();
            startDurationUpdates();
            break;
        case 'dashboard':
            loadDashboard();
            break;
        case 'history':
            loadHistory();
            break;
        default:
            stopDurationUpdates();
    }
}

// ============================================
// Check-In Form
// ============================================
function setupCheckinForm() {
    const form = document.getElementById('checkinForm');
    const emotionButtons = document.querySelectorAll('.emotion-btn');

    // Emotion button selection
    emotionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            emotionButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('selectedEmotion').value = btn.dataset.emotion;
        });
    });

    // Form submission
    form.addEventListener('submit', handleCheckin);

    // Today/Now buttons
    document.getElementById('setTodayBtn').addEventListener('click', () => {
        document.getElementById('visitDate').value = formatDateForInput(new Date());
    });

    document.getElementById('setNowBtn').addEventListener('click', () => {
        document.getElementById('timeIn').value = formatTimeForInput(new Date());
    });

    // Load recent staff names
    populateRecentStaff();
}

function setFormDefaults() {
    const now = new Date();

    // Set default date to today
    const dateInput = document.getElementById('visitDate');
    dateInput.value = formatDateForInput(now);

    // Set default time to current time
    const timeInput = document.getElementById('timeIn');
    timeInput.value = formatTimeForInput(now);
}

async function handleCheckin(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = document.getElementById('checkinSubmitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    // Validate emotion selection
    const emotion = document.getElementById('selectedEmotion').value;
    if (!emotion) {
        showCheckinError('Please select how the student is feeling.');
        return;
    }

    // Disable button and show loading state
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
        // Gather form data
        const visitData = {
            studentName: document.getElementById('studentName').value.trim(),
            gradeLevel: document.getElementById('gradeLevel').value,
            staffName: document.getElementById('staffName').value.trim(),
            date: document.getElementById('visitDate').value,
            timeIn: combineDateTime(
                document.getElementById('visitDate').value,
                document.getElementById('timeIn').value
            ),
            reason: document.getElementById('reason').value.trim(),
            emotion: emotion
        };

        // Create the visit
        await createVisit(visitData);

        // Save staff name to recent list
        saveRecentStaff(visitData.staffName);

        // Show success and reset form
        showCheckinSuccess();
        resetCheckinForm();

        // Update active visits count
        loadActiveVisitsCount();

    } catch (error) {
        showCheckinError(error.message);
    } finally {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
    }
}

function resetCheckinForm() {
    document.getElementById('checkinForm').reset();
    document.querySelectorAll('.emotion-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('selectedEmotion').value = '';
    setFormDefaults();
}

function showCheckinSuccess() {
    const successEl = document.getElementById('checkinSuccess');
    const errorEl = document.getElementById('checkinError');

    errorEl.classList.add('hidden');
    successEl.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        successEl.classList.add('hidden');
    }, 5000);
}

function showCheckinError(message) {
    const successEl = document.getElementById('checkinSuccess');
    const errorEl = document.getElementById('checkinError');

    successEl.classList.add('hidden');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

// Recent Staff Names (localStorage)
function getRecentStaff() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_STAFF_KEY)) || [];
    } catch {
        return [];
    }
}

function saveRecentStaff(name) {
    let recent = getRecentStaff();

    // Remove if already exists (to move to front)
    recent = recent.filter(n => n.toLowerCase() !== name.toLowerCase());

    // Add to front
    recent.unshift(name);

    // Keep only MAX_RECENT_STAFF
    recent = recent.slice(0, MAX_RECENT_STAFF);

    localStorage.setItem(RECENT_STAFF_KEY, JSON.stringify(recent));
    populateRecentStaff();
}

function populateRecentStaff() {
    const datalist = document.getElementById('recentStaff');
    const recent = getRecentStaff();

    datalist.innerHTML = recent.map(name =>
        `<option value="${escapeHtml(name)}">`
    ).join('');
}

// ============================================
// Currently Here View
// ============================================
function setupCurrentView() {
    document.getElementById('refreshCurrentBtn').addEventListener('click', loadCurrentStudents);
}

async function loadCurrentStudents() {
    const loadingEl = document.getElementById('currentLoading');
    const errorEl = document.getElementById('currentError');
    const emptyEl = document.getElementById('currentEmpty');
    const gridEl = document.getElementById('currentStudentsGrid');

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    gridEl.innerHTML = '';

    try {
        activeVisits = await getActiveVisits();

        loadingEl.classList.add('hidden');

        if (activeVisits.length === 0) {
            emptyEl.classList.remove('hidden');
        } else {
            renderStudentCards(activeVisits);
        }

        updateActiveVisitsBadge(activeVisits.length);

    } catch (error) {
        loadingEl.classList.add('hidden');
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

function renderStudentCards(visits) {
    const gridEl = document.getElementById('currentStudentsGrid');

    gridEl.innerHTML = visits.map(visit => `
        <div class="student-card" data-visit-id="${visit.id}">
            <div class="student-name">${escapeHtml(visit.student_name)}</div>
            <div class="student-grade">Grade ${visit.grade_level === 'K' ? 'K' : visit.grade_level}</div>
            <div class="student-details">
                <div>Checked in: ${formatTime(visit.time_in)}</div>
                <div class="student-duration" data-time-in="${visit.time_in}">
                    ${calculateDuration(visit.time_in)}
                </div>
            </div>
            <button class="checkout-btn" onclick="openCheckoutModal('${visit.id}', '${escapeHtml(visit.student_name)}')">
                Check Out
            </button>
        </div>
    `).join('');
}

function calculateDuration(timeIn) {
    const start = new Date(timeIn);
    const now = new Date();
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
        return 'Just arrived';
    } else if (diffMins === 1) {
        return '1 minute';
    } else if (diffMins < 60) {
        return `${diffMins} minutes`;
    } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
    }
}

function startDurationUpdates() {
    stopDurationUpdates();
    durationUpdateInterval = setInterval(updateDurations, 60000); // Every minute
}

function stopDurationUpdates() {
    if (durationUpdateInterval) {
        clearInterval(durationUpdateInterval);
        durationUpdateInterval = null;
    }
}

function updateDurations() {
    document.querySelectorAll('.student-duration[data-time-in]').forEach(el => {
        const timeIn = el.dataset.timeIn;
        el.textContent = calculateDuration(timeIn);
    });
}

async function loadActiveVisitsCount() {
    try {
        const visits = await getActiveVisits();
        updateActiveVisitsBadge(visits.length);
    } catch (error) {
        console.error('Failed to load active visits count:', error);
    }
}

function updateActiveVisitsBadge(count) {
    const badge = document.getElementById('currentCountBadge');
    badge.textContent = count;
    badge.setAttribute('data-count', count);
}

// ============================================
// Checkout Modal
// ============================================
function setupModal() {
    document.getElementById('checkoutCancel').addEventListener('click', closeCheckoutModal);
    document.getElementById('checkoutConfirm').addEventListener('click', confirmCheckout);

    // Close on backdrop click
    document.getElementById('checkoutModal').addEventListener('click', (e) => {
        if (e.target.id === 'checkoutModal') {
            closeCheckoutModal();
        }
    });
}

function openCheckoutModal(visitId, studentName) {
    pendingCheckoutId = visitId;
    document.getElementById('checkoutStudentName').textContent = studentName;
    document.getElementById('checkoutModal').classList.remove('hidden');
}

function closeCheckoutModal() {
    pendingCheckoutId = null;
    document.getElementById('checkoutModal').classList.add('hidden');
}

async function confirmCheckout() {
    if (!pendingCheckoutId) return;

    const confirmBtn = document.getElementById('checkoutConfirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Checking out...';

    try {
        await checkOutVisit(pendingCheckoutId);
        closeCheckoutModal();
        loadCurrentStudents();
    } catch (error) {
        alert('Failed to check out student: ' + error.message);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Check Out';
    }
}

// ============================================
// Dashboard
// ============================================
function setupDashboard() {
    document.getElementById('applyDashboardFilter').addEventListener('click', loadDashboard);
    document.getElementById('clearDashboardFilter').addEventListener('click', () => {
        document.getElementById('dashboardStartDate').value = '';
        document.getElementById('dashboardEndDate').value = '';
        loadDashboard();
    });
}

async function loadDashboard() {
    const loadingEl = document.getElementById('dashboardLoading');
    const errorEl = document.getElementById('dashboardError');

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
        const startDate = document.getElementById('dashboardStartDate').value || null;
        const endDate = document.getElementById('dashboardEndDate').value || null;

        const stats = await getDashboardStats(startDate, endDate);

        loadingEl.classList.add('hidden');
        renderDashboard(stats);

    } catch (error) {
        loadingEl.classList.add('hidden');
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

function renderDashboard(stats) {
    // Summary stats
    document.getElementById('statToday').textContent = stats.todayCount;
    document.getElementById('statWeek').textContent = stats.weekCount;
    document.getElementById('statMonth').textContent = stats.monthCount;

    // Grade breakdown
    renderBreakdownChart('gradeBreakdown', stats.gradeBreakdown, GRADES.map(g => g === 'K' ? 'Kindergarten' : `Grade ${g}`));

    // Emotion breakdown
    renderBreakdownChart('emotionBreakdown', stats.emotionBreakdown, EMOTIONS);

    // Time of day breakdown
    renderBreakdownChart('timeBreakdown', stats.timeOfDayBreakdown, ['Morning (before 12pm)', 'Afternoon (12pm+)']);

    // Frequent visitors
    renderFrequentVisitors(stats.frequentVisitors);
}

function renderBreakdownChart(containerId, data, labels) {
    const container = document.getElementById(containerId);
    const values = Object.values(data);
    const keys = Object.keys(data);
    const maxValue = Math.max(...values, 1);

    // Map labels to keys if provided
    const labelMap = {};
    if (labels) {
        keys.forEach((key, i) => {
            labelMap[key] = labels[i] || key;
        });
    }

    container.innerHTML = keys.map(key => {
        const value = data[key];
        const percentage = (value / maxValue) * 100;
        const label = labelMap[key] || key;

        return `
            <div class="breakdown-row">
                <span class="breakdown-label">${escapeHtml(label)}</span>
                <div class="breakdown-bar-container">
                    <div class="breakdown-bar" style="width: ${percentage}%"></div>
                </div>
                <span class="breakdown-value">${value}</span>
            </div>
        `;
    }).join('');
}

function renderFrequentVisitors(visitors) {
    const container = document.getElementById('frequentVisitors');

    if (visitors.length === 0) {
        container.innerHTML = '<p class="no-frequent">No frequent visitors in the past 30 days.</p>';
        return;
    }

    container.innerHTML = visitors.map((visitor, index) => `
        <div class="frequent-item">
            <span class="frequent-rank">${index + 1}.</span>
            <span class="frequent-name">${escapeHtml(visitor.student_name)}</span>
            <span class="frequent-grade">Grade ${visitor.grade_level}</span>
            <span class="frequent-count">${visitor.visit_count} visits</span>
        </div>
    `).join('');
}

// ============================================
// History
// ============================================
function setupHistory() {
    document.getElementById('applyHistoryFilter').addEventListener('click', loadHistory);
    document.getElementById('clearHistoryFilter').addEventListener('click', clearHistoryFilters);
    document.getElementById('exportCsvBtn').addEventListener('click', exportToCsv);

    // Enter key in search box
    document.getElementById('historySearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loadHistory();
        }
    });
}

function clearHistoryFilters() {
    document.getElementById('historyStartDate').value = '';
    document.getElementById('historyEndDate').value = '';
    document.getElementById('historyGrade').value = 'all';
    document.getElementById('historyEmotion').value = 'all';
    document.getElementById('historySearch').value = '';
    loadHistory();
}

async function loadHistory() {
    const loadingEl = document.getElementById('historyLoading');
    const errorEl = document.getElementById('historyError');
    const emptyEl = document.getElementById('historyEmpty');
    const tableContainer = document.querySelector('.table-container');
    const resultsCountEl = document.getElementById('historyResultsCount');

    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    tableContainer.style.display = 'none';

    try {
        const filters = {
            startDate: document.getElementById('historyStartDate').value || null,
            endDate: document.getElementById('historyEndDate').value || null,
            gradeLevel: document.getElementById('historyGrade').value,
            emotion: document.getElementById('historyEmotion').value,
            studentName: document.getElementById('historySearch').value.trim() || null
        };

        const visits = await getAllVisits(filters);

        loadingEl.classList.add('hidden');

        if (visits.length === 0) {
            emptyEl.classList.remove('hidden');
            resultsCountEl.textContent = '';
        } else {
            renderHistoryTable(visits);
            tableContainer.style.display = 'block';
            resultsCountEl.textContent = `Showing ${visits.length} visit${visits.length !== 1 ? 's' : ''}`;
        }

    } catch (error) {
        loadingEl.classList.add('hidden');
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    }
}

function renderHistoryTable(visits) {
    const tbody = document.getElementById('historyTableBody');

    tbody.innerHTML = visits.map(visit => {
        const duration = visit.time_out
            ? calculateDurationMinutes(visit.time_in, visit.time_out)
            : 'Still here';

        return `
            <tr>
                <td>${formatDate(visit.date)}</td>
                <td>${escapeHtml(visit.student_name)}</td>
                <td>${visit.grade_level}</td>
                <td>${escapeHtml(visit.staff_name)}</td>
                <td>${formatTime(visit.time_in)}</td>
                <td class="${!visit.time_out ? 'still-here' : ''}">${visit.time_out ? formatTime(visit.time_out) : 'Still here'}</td>
                <td>${duration}${typeof duration === 'number' ? ' min' : ''}</td>
                <td>${visit.emotion}</td>
                <td class="reason-cell" title="${escapeHtml(visit.reason)}">${escapeHtml(visit.reason)}</td>
            </tr>
        `;
    }).join('');
}

function calculateDurationMinutes(timeIn, timeOut) {
    const start = new Date(timeIn);
    const end = new Date(timeOut);
    const diff = Math.round((end - start) / 60000);
    // Return absolute value to handle any timezone quirks
    return Math.abs(diff);
}

// ============================================
// CSV Export
// ============================================
async function exportToCsv() {
    const btn = document.getElementById('exportCsvBtn');
    btn.disabled = true;
    btn.textContent = 'Exporting...';

    try {
        const filters = {
            startDate: document.getElementById('historyStartDate').value || null,
            endDate: document.getElementById('historyEndDate').value || null,
            gradeLevel: document.getElementById('historyGrade').value,
            emotion: document.getElementById('historyEmotion').value,
            studentName: document.getElementById('historySearch').value.trim() || null
        };

        const visits = await getAllVisits(filters);

        if (visits.length === 0) {
            alert('No data to export.');
            return;
        }

        // Build CSV
        const headers = ['Date', 'Student Name', 'Grade', 'Staff Name', 'Time In', 'Time Out', 'Duration (minutes)', 'Emotion', 'Reason'];
        const rows = visits.map(visit => {
            const duration = visit.time_out
                ? calculateDurationMinutes(visit.time_in, visit.time_out)
                : '';

            return [
                visit.date,
                visit.student_name,
                visit.grade_level,
                visit.staff_name,
                formatTime(visit.time_in),
                visit.time_out ? formatTime(visit.time_out) : '',
                duration,
                visit.emotion,
                visit.reason
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `zen-den-visits-${formatDateForInput(new Date())}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        alert('Failed to export: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128190; Export CSV';
    }
}

// ============================================
// Connection Error
// ============================================
function showConnectionError() {
    document.getElementById('connectionError').classList.remove('hidden');
}

function hideConnectionError() {
    document.getElementById('connectionError').classList.add('hidden');
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeForInput(date) {
    return date.toTimeString().slice(0, 5);
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function combineDateTime(dateStr, timeStr) {
    return new Date(`${dateStr}T${timeStr}`).toISOString();
}
