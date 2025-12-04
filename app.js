let currentPage = "hoje";
const STORAGE_KEY = "AppInfo";
let activeTimer = null;
let currentActivityId = null;
let currentNoteId = null;
let currentPrayerId = null;

function createId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function parseTimeToMinutes(time) {
    if (!time) return null;
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function formatSeconds(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateTimerUI(seconds) {
    const bigValue = document.getElementById("details-timer-value");
    const compactValue = document.getElementById("activity-compact-time");
    const formatted = formatSeconds(seconds);
    if (bigValue) bigValue.textContent = formatted;
    if (compactValue) compactValue.textContent = formatted;
}

function updateTimerVisual(totalSeconds, remainingSeconds) {
    const progressCircle = document.querySelector(".timer-progress");
    const dot = document.querySelector(".timer-dot");
    if (!progressCircle || !totalSeconds || totalSeconds <= 0) return;
    const safeRemaining = Math.max(0, remainingSeconds);
    const elapsed = Math.max(0, totalSeconds - safeRemaining);
    const fraction = Math.min(1, elapsed / totalSeconds);
    const angle = fraction * 360;
    const radius = progressCircle.r?.baseVal?.value || 50;
    const circumference = 2 * Math.PI * radius;
    progressCircle.style.strokeDasharray = `${circumference}`;
    const offset = circumference * (1 - fraction);
    progressCircle.style.strokeDashoffset = `${offset}`;
    const cx = progressCircle.cx?.baseVal?.value ?? 0;
    const cy = progressCircle.cy?.baseVal?.value ?? 0;
    progressCircle.setAttribute("transform", `rotate(${angle} ${cx} ${cy})`);
    if (dot) {
        dot.setAttribute("transform", `rotate(${angle} ${cx} ${cy})`);
    }
}

function updateDetailsCloseButton(isRunning) {
    const detailsClose = document.getElementById("activity-details-close");
    if (!detailsClose) return;
    // detailsClose.textContent = isRunning ? "−" : "✕";
    detailsClose.textContent = "✕";
}

function formatDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const dateStr = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short"
    });
    const timeStr = d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
    return `${dateStr} · ${timeStr}`;
}

const DEFAULT_APP_INFO = {
    activities: [],
    prayers: [],
    notes: []
};

function getAppInfo() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_APP_INFO));
            return JSON.parse(JSON.stringify(DEFAULT_APP_INFO));
        }
        const parsed = JSON.parse(raw);
        return {
            activities: Array.isArray(parsed.activities) ? parsed.activities : [],
            prayers: Array.isArray(parsed.prayers) ? parsed.prayers : [],
            notes: Array.isArray(parsed.notes) ? parsed.notes : []
        };
    } catch (error) {
        console.error("Erro ao ler AppInfo, resetando.", error);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_APP_INFO));
        return JSON.parse(JSON.stringify(DEFAULT_APP_INFO));
    }
}

function saveAppInfo(appInfo) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appInfo));
}

function addActivity(data) {
    const appInfo = getAppInfo();
    const newActivity = {
        id: createId("act"),
        title: data.title,
        time: data.time,
        hasTimer: Boolean(data.hasTimer),
        timerMinutes: data.hasTimer ? Number(data.timerMinutes ?? 0) : null,
        repeat: {
            enabled: data.repeat?.enabled ?? false,
            daysOfWeek: Array.isArray(data.repeat?.daysOfWeek)
                ? data.repeat.daysOfWeek
                : []
        },
        prayerIds: Array.isArray(data.prayerIds) ? data.prayerIds : []
    };
    appInfo.activities.push(newActivity);
    saveAppInfo(appInfo);
    return newActivity;
}

function updateActivity(id, partialData) {
    const appInfo = getAppInfo();
    const index = appInfo.activities.findIndex(a => a.id === id);
    if (index === -1) return null;
    const current = appInfo.activities[index];
    const updated = {
        ...current,
        ...partialData,
        hasTimer:
            partialData.hasTimer !== undefined
                ? Boolean(partialData.hasTimer)
                : current.hasTimer,
        timerMinutes:
            partialData.timerMinutes !== undefined
                ? (partialData.hasTimer === false
                    ? null
                    : Number(partialData.timerMinutes))
                : current.timerMinutes,
        repeat: partialData.repeat
            ? { ...current.repeat, ...partialData.repeat }
            : current.repeat
    };
    appInfo.activities[index] = updated;
    saveAppInfo(appInfo);
    return updated;
}

function deleteActivity(id) {
    const appInfo = getAppInfo();
    appInfo.activities = appInfo.activities.filter(a => a.id !== id);
    saveAppInfo(appInfo);
}

function renderActivities() {
    const container = document.getElementById("activities-list");
    if (!container) return;
    const appInfo = getAppInfo();
    let activities = [...appInfo.activities];
    activities.sort((a, b) => {
        const ma = parseTimeToMinutes(a.time) ?? 0;
        const mb = parseTimeToMinutes(b.time) ?? 0;
        return ma - mb;
    });
    container.innerHTML = "";
    if (activities.length === 0) {
        container.innerHTML = `<p class="empty-state">Nenhuma atividade cadastrada!</p>`;
        return;
    }
    const nowMinutes = 12 * 60;
    let nextIndex = activities.findIndex(act => {
        const m = parseTimeToMinutes(act.time);
        return m !== null && m >= nowMinutes;
    });
    if (nextIndex === -1) nextIndex = null;
    let lastHourLabel = null;
    activities.forEach((act, index) => {
        const t = act.time || "";
        const mins = parseTimeToMinutes(t);
        let stateClass = "card--scheduled";
        if (mins != null) {
            if (nextIndex !== null && index === nextIndex) {
                stateClass = "card--next";
            } else if (mins < nowMinutes) {
                stateClass = "card--past";
            }
        }
        let hourLabel = null;
        if (mins != null) {
            const hour = Math.floor(mins / 60);
            const hourStr = String(hour).padStart(2, "0");
            hourLabel = `${hourStr}:00`;
        }
        if (hourLabel && hourLabel !== lastHourLabel) {
            const divider = document.createElement("div");
            divider.className = "time-divider";
            divider.innerHTML = `
                <span class="time-label">${hourLabel}</span>
                <div class="line"></div>
            `;
            container.appendChild(divider);
            lastHourLabel = hourLabel;
        }
        const hasPrayer =
            Array.isArray(act.prayerIds) && act.prayerIds.length > 0;
        const hasTimer = !!act.hasTimer;
        const hasRepeat =
            !!act.repeat?.enabled &&
            Array.isArray(act.repeat.daysOfWeek) &&
            act.repeat.daysOfWeek.length > 0;
        let iconsHTML = "";
        if (hasPrayer) {
            iconsHTML = `
                <svg class="icon" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd"
                        d="M7.30769 6.00098H2.69231C2.48 6.00098 2.30769 6.16895 2.30769 6.37592C2.30769 6.58326 2.48 6.75086 2.69231 6.75086H7.30769C7.52 6.75086 7.69231 6.58326 7.69231 6.37592C7.69231 6.16895 7.52 6.00098 7.30769 6.00098ZM7.30769 8.25061H2.69231C2.48 8.25061 2.30769 8.41821 2.30769 8.62555C2.30769 8.83289 2.48 9.00049 2.69231 9.00049H7.30769C7.52 9.00049 7.69231 8.83289 7.69231 8.62555C7.69231 8.41821 7.52 8.25061 7.30769 8.25061ZM7.69231 3.00147C7.26769 3.00147 6.92308 2.66553 6.92308 2.25159V0.751839L9.23077 3.00147H7.69231ZM9.23077 10.5002C9.23077 10.9142 8.88615 11.2501 8.46154 11.2501H1.53846C1.11385 11.2501 0.769231 10.9142 0.769231 10.5002V1.50172C0.769231 1.08778 1.11385 0.751839 1.53846 0.751839H6.14308C6.13615 1.64982 6.15385 2.25159 6.15385 2.25159C6.15385 3.07983 6.84269 3.75135 7.69231 3.75135H9.23077V10.5002ZM6.92308 0.00196162V0.0124599C6.87385 0.0124599 6.66846 -0.00591209 6.15385 0.00196162H1.53846C0.688846 0.00196162 0 0.673477 0 1.50172V10.5002C0 11.3285 0.688846 12 1.53846 12H8.46154C9.31115 12 10 11.3285 10 10.5002V3.00147L6.92308 0.00196162Z"
                        fill="currentColor" />
                </svg>
            `;
        } else {
            if (hasTimer) {
                iconsHTML += `
                    <svg class="icon" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M5.5 7.83333V5.83333M5.5 2.5C2.73857 2.5 0.5 4.73857 0.5 7.5C0.5 10.2614 2.73857 12.5 5.5 12.5C8.2614 12.5 10.5 10.2614 10.5 7.5C10.5 6.20407 10.007 5.02329 9.19827 4.135M5.5 2.5C6.96547 2.5 8.28373 3.13048 9.19827 4.135M5.5 2.5V0.5M9.19827 4.135L10.5 2.83333M5.5 0.5H3.5M5.5 0.5H7.5"
                            stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                `;
            }
            if (hasRepeat) {
                iconsHTML += `
                    <svg class="icon" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M10.6682 7.39282C10.7931 7.14654 10.6947 6.84564 10.4484 6.72074C10.2021 6.59583 9.9012 6.69423 9.77629 6.94051L10.2222 7.16667L10.6682 7.39282ZM0.995842 5.99121C0.960304 5.71736 0.709499 5.52418 0.435653 5.55971C0.161807 5.59525 -0.03138 5.84606 0.00415783 6.1199L0.5 6.05556L0.995842 5.99121ZM0.315993 3.64162C0.210111 3.89666 0.331026 4.18924 0.586063 4.29512C0.8411 4.401 1.13368 4.28008 1.23956 4.02505L0.777778 3.83333L0.315993 3.64162ZM10.004 5.00787C10.0391 5.28178 10.2895 5.47544 10.5634 5.4404C10.8373 5.40537 11.031 5.15493 10.996 4.88102L10.5 4.94444L10.004 5.00787ZM10 10.5C10 10.7761 10.2239 11 10.5 11C10.7761 11 11 10.7761 11 10.5H10.5H10ZM7.16667 6.66667C6.89052 6.66667 6.66667 6.89052 6.66667 7.16667C6.66667 7.44281 6.89052 7.66667 7.16667 7.66667V7.16667V6.66667ZM3.83333 4.33333C4.10948 4.33333 4.33333 4.10948 4.33333 3.83333C4.33333 3.55719 4.10948 3.33333 3.83333 3.33333V3.83333V4.33333ZM1 0.5C1 0.223858 0.776142 0 0.5 0C0.223858 0 0 0.223858 0 0.5H0.5H1ZM10.2222 7.16667L9.77629 6.94051C8.96423 8.5417 7.32818 10 5.5 10V10.5V11C7.85205 11 9.76443 9.17474 10.6682 7.39282L10.2222 7.16667ZM5.5 10.5V10C3.07309 10 1.29097 8.26541 0.995842 5.99121L0.5 6.05556L0.00415783 6.1199C0.35935 8.85693 2.53553 11 5.5 11V10.5ZM0.777778 3.83333L1.23956 4.02505C1.9505 2.3126 3.55365 1 5.5 1V0.5V0C3.0738 0 1.15067 1.63111 0.315993 3.64162L0.777778 3.83333ZM5.5 0.5V1C7.89098 1 9.7137 2.73771 10.004 5.00787L10.5 4.94444L10.996 4.88102C10.6454 2.13999 8.42224 0 5.5 0V0.5ZM10.5 10.5H11V7.5H10.5H10V10.5H10.5ZM10.5 7.5H11C11 7.03975 10.6269 6.66667 10.1667 6.66667V7.16667V7.66667C10.0746 7.66667 10 7.59203 10 7.5H10.5ZM10.1667 7.16667V6.66667H7.16667V7.16667V7.66667H10.1667V7.16667ZM3.83333 3.83333V3.33333H0.833333V3.83333V4.33333H3.83333V3.83333ZM0.833333 3.83333V3.33333C0.925382 3.33333 1 3.40795 1 3.5H0.5H0C0 3.96024 0.373096 4.33333 0.833333 4.33333V3.83333ZM0.5 3.5H1V0.5H0.5H0V3.5H0.5Z"
                            fill="currentColor" />
                    </svg>
                `;
            }
        }
        const card = document.createElement("div");
        card.className = `card ${stateClass}`;
        card.dataset.activityId = act.id;
        card.innerHTML = `
            <div class="card-title">${act.title}</div>
            <div class="card-footer">
                <span class="card-time">${act.time}</span>
                <div class="card-icons">
                    ${iconsHTML}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function addPrayer(data) {
    const appInfo = getAppInfo();
    const newPrayer = {
        id: createId("pry"),
        title: data.title,
        text: data.text,
        createdAt: new Date().toISOString()
    };
    appInfo.prayers.push(newPrayer);
    saveAppInfo(appInfo);
    return newPrayer;
}

function updatePrayer(id, partial) {
    const appInfo = getAppInfo();
    const index = appInfo.prayers.findIndex(p => p.id === id);
    if (index === -1) return null;
    const updated = {
        ...appInfo.prayers[index],
        ...partial
    };
    appInfo.prayers[index] = updated;
    saveAppInfo(appInfo);
    return updated;
}

function renderPrayers() {
    const container = document.getElementById("prayers-list");
    if (!container) return;
    const appInfo = getAppInfo();
    const prayers = [...appInfo.prayers].sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return db - da;
    });
    container.innerHTML = "";
    if (prayers.length === 0) {
        container.innerHTML = `<p class="empty-state">Nenhuma oração cadastrada!</p>`;
        return;
    }
    prayers.forEach(pr => {
        const card = document.createElement("div");
        card.className = "card note-card";
        card.dataset.prayerId = pr.id;
        card.innerHTML = `
            <span class="note-card-title">
                ${pr.title || "Oração sem título"}
            </span>
        `;
        container.appendChild(card);
    });
}

function renderPrayerSelectOptions() {
    const select = document.getElementById("activity-prayer-ids");
    if (!select) return;
    const appInfo = getAppInfo();
    select.innerHTML = "";
    appInfo.prayers.forEach(pr => {
        const opt = document.createElement("option");
        opt.value = pr.id;
        opt.textContent = pr.title || "Oração sem título";
        select.appendChild(opt);
    });
}

function addNote(data) {
    const appInfo = getAppInfo();
    const newNote = {
        id: createId("note"),
        title: data.title,
        text: data.text,
        createdAt: new Date().toISOString(),
        activityId: data.activityId || null
    };
    appInfo.notes.push(newNote);
    saveAppInfo(appInfo);
    return newNote;
}

function updateNote(id, partial) {
    const appInfo = getAppInfo();
    const index = appInfo.notes.findIndex(n => n.id === id);
    if (index === -1) return null;
    const updated = {
        ...appInfo.notes[index],
        ...partial
    };
    appInfo.notes[index] = updated;
    saveAppInfo(appInfo);
    return updated;
}

function renderNotes() {
    const container = document.getElementById("notes-list");
    if (!container) return;
    const appInfo = getAppInfo();
    const notes = [...appInfo.notes].sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return db - da;
    });
    container.innerHTML = "";
    if (notes.length === 0) {
        container.innerHTML = `<p class="empty-state">Nenhuma anotação cadastrada!</p>`;
        return;
    }
    notes.forEach(note => {
        let activityTitle = null;
        if (note.activityId) {
            const act = appInfo.activities.find(a => a.id === note.activityId);
            if (act) activityTitle = act.title;
        }
        const card = document.createElement("div");
        card.className = "card note-card";
        card.dataset.noteId = note.id;
        card.innerHTML = `
            <span class="note-card-title">
                ${note.title || "Anotação sem título"}
            </span>
            <span class="note-card-meta">
                ${formatDateTime(note.createdAt)}
            </span>
        `;
        container.appendChild(card);
    });
}

function openActivityDetails(activityId) {
    const appInfo = getAppInfo();
    const activity = appInfo.activities.find(a => a.id === activityId);
    if (!activity) return;
    currentActivityId = activity.id;
    const overlay = document.getElementById("activity-details-modal");
    const titleEl = document.getElementById("details-title");
    const timerWrapper = document.getElementById("details-timer");
    const timerValueEl = document.getElementById("details-timer-value");
    const prayersContainer = document.getElementById("details-prayers");
    const compactTitleEl = document.getElementById("activity-compact-title");
    const startBtn = document.getElementById("details-start");
    const runningActions = document.getElementById("details-running-actions");
    if (!overlay || !titleEl || !timerWrapper || !timerValueEl || !prayersContainer || !compactTitleEl) {
        return;
    }
    overlay.classList.add("is-open");
    overlay.classList.remove("is-compact");
    titleEl.textContent = activity.title;
    compactTitleEl.textContent = activity.title;
    const hasPrayer =
        Array.isArray(activity.prayerIds) && activity.prayerIds.length > 0;
    const hasTimer = !!activity.hasTimer && !!activity.timerMinutes;
    const baseSeconds = hasTimer ? Number(activity.timerMinutes) * 60 : 0;
    if (hasTimer) {
        timerWrapper.classList.remove("is-hidden");
        let secondsToShow = baseSeconds;
        if (activeTimer && activeTimer.activityId === activity.id) {
            secondsToShow = activeTimer.remainingSeconds;
            updateDetailsCloseButton(!!activeTimer.intervalId);
            if (activeTimer.intervalId) {
                if (startBtn) startBtn.classList.add("is-hidden");
                if (runningActions) runningActions.classList.remove("is-hidden");
            } else {
                if (startBtn) startBtn.classList.remove("is-hidden");
                if (runningActions) runningActions.classList.add("is-hidden");
            }
        } else {
            updateDetailsCloseButton(false);
            if (startBtn) startBtn.classList.remove("is-hidden");
            if (runningActions) runningActions.classList.add("is-hidden");
        }
        updateTimerUI(secondsToShow);
        updateTimerVisual(baseSeconds, secondsToShow);
    } else {
        timerWrapper.classList.add("is-hidden");
        if (startBtn) startBtn.classList.add("is-hidden");
        if (runningActions) runningActions.classList.remove("is-hidden");
        updateDetailsCloseButton(false);
    }
    const activeModal = document.getElementById("activity-details-modal");
    if (!hasPrayer && !hasTimer) {
        activeModal.classList.add("compact");
    } else {
        activeModal.classList.remove("compact");
    }
    prayersContainer.innerHTML = "";
    const prayerIds = Array.isArray(activity.prayerIds) ? activity.prayerIds : [];
    if (prayerIds.length > 0) {
        const prayers = appInfo.prayers.filter(p => prayerIds.includes(p.id));
        const block = document.createElement("div");
        block.className = "prayer-block";
        block.innerHTML = `
        <h3 class="prayer-title"><strong>Orações</strong></h3>
    `;
        prayers.forEach((prayer) => {
            const pEl = document.createElement("p");
            pEl.className = "prayer-text";
            pEl.innerHTML = `<br><strong>${prayer.title}</strong><br>${prayer.text}<br>`;
            block.appendChild(pEl);
        });
        prayersContainer.appendChild(block);
        prayersContainer.classList.remove("is-hidden");
    } else {
        prayersContainer.classList.add("is-hidden");
    }
}

function closeActivityDetails() {
    const overlay = document.getElementById("activity-details-modal");
    if (overlay) {
        overlay.classList.remove("is-open");
        overlay.classList.remove("is-compact");
    }
    updateDetailsCloseButton(false);
    if (activeTimer && activeTimer.intervalId) {
        clearInterval(activeTimer.intervalId);
    }
    activeTimer = null;
    currentActivityId = null;
}

function collapseActivityDetails() {
    const overlay = document.getElementById("activity-details-modal");
    if (!overlay) return;
    if (!activeTimer || !activeTimer.intervalId) return;
    overlay.classList.add("is-compact");
}

function expandActivityDetails() {
    const overlay = document.getElementById("activity-details-modal");
    if (!overlay) return;
    overlay.classList.remove("is-compact");
}

function startActivityTimer(activity) {
    if (!activity.hasTimer || !activity.timerMinutes) return;
    if (activeTimer && activeTimer.intervalId) {
        clearInterval(activeTimer.intervalId);
    }
    const totalSeconds = Number(activity.timerMinutes) * 60;
    activeTimer = {
        activityId: activity.id,
        remainingSeconds: totalSeconds,
        intervalId: null
    };
    updateTimerUI(totalSeconds);
    updateTimerVisual(totalSeconds, totalSeconds);
    updateDetailsCloseButton(true);
    activeTimer.intervalId = setInterval(() => {
        if (!activeTimer) return;
        activeTimer.remainingSeconds = Math.max(0, activeTimer.remainingSeconds - 1);
        updateTimerUI(activeTimer.remainingSeconds);
        updateTimerVisual(totalSeconds, activeTimer.remainingSeconds);
        if (activeTimer.remainingSeconds <= 0) {
            clearInterval(activeTimer.intervalId);
            activeTimer.intervalId = null;
            updateDetailsCloseButton(false);
        }
    }, 1000);
    const startBtn = document.getElementById("details-start");
    const runningActions = document.getElementById("details-running-actions");
    if (startBtn) startBtn.classList.add("is-hidden");
    if (runningActions) runningActions.classList.remove("is-hidden");
}

function completeCurrentActivity() {
    if (!currentActivityId) return;
    const appInfo = getAppInfo();
    appInfo.activities = appInfo.activities.filter(a => a.id !== currentActivityId);
    saveAppInfo(appInfo);
    if (activeTimer && activeTimer.intervalId) {
        clearInterval(activeTimer.intervalId);
    }
    activeTimer = null;
    const overlay = document.getElementById("activity-details-modal");
    if (overlay) {
        overlay.classList.remove("is-open");
        overlay.classList.remove("is-compact");
    }
    currentActivityId = null;
    renderActivities();
    const completedModal = document.getElementById("activity-completed-modal");
    if (completedModal) {
        completedModal.classList.add("is-open");
    }
}

function openNoteDetails(noteId) {
    const appInfo = getAppInfo();
    const note = appInfo.notes.find(n => n.id === noteId);
    if (!note) return;
    currentNoteId = note.id;
    const overlay = document.getElementById("note-details-modal");
    const titleIconLabel = document.getElementById("note-details-icon-label");
    const titleTextEl = document.getElementById("note-details-title-text");
    const textEl = document.getElementById("note-details-text");
    const viewContainer = document.getElementById("note-details-view");
    const editForm = document.getElementById("note-details-edit-form");
    const editBtn = document.getElementById("note-details-edit-btn");
    const tagEl = document.getElementById("note-details-activity-tag");
    if (!overlay || !titleTextEl || !textEl || !viewContainer || !editForm || !editBtn) return;
    overlay.classList.add("is-open");
    if (titleIconLabel) {
        titleIconLabel.classList.add("is-hidden");
    }
    titleTextEl.textContent = note.title || "Anotação";
    titleTextEl.classList.remove("is-hidden");
    const safeText = (note.text || "").replace(/\n/g, "<br>");
    textEl.innerHTML = safeText;
    viewContainer.classList.remove("is-hidden");
    editForm.classList.add("is-hidden");
    editBtn.classList.remove("is-hidden");
    if (tagEl) {
        if (note.activityId) {
            const act = appInfo.activities.find(a => a.id === note.activityId);
            if (act) {
                tagEl.textContent = `${act.title}`;
                tagEl.classList.remove("is-hidden");
            } else {
                tagEl.textContent = "";
                tagEl.classList.add("is-hidden");
            }
        } else {
            tagEl.textContent = "";
            tagEl.classList.add("is-hidden");
        }
    }
}

function closeNoteDetails() {
    const overlay = document.getElementById("note-details-modal");
    if (overlay) {
        overlay.classList.remove("is-open");
    }
    currentNoteId = null;
}

function openOrCreateNoteForActivity(activityId) {
    if (!activityId) return;
    const appInfo = getAppInfo();
    const activity = appInfo.activities.find(a => a.id === activityId);
    if (!activity) return;
    let note = appInfo.notes.find(n => n.activityId === activityId);
    if (!note) {
        note = {
            id: createId("note"),
            title: "",
            text: "",
            createdAt: new Date().toISOString(),
            activityId: activityId
        };
        appInfo.notes.push(note);
        saveAppInfo(appInfo);
    }
    currentNoteId = note.id;
    const overlay = document.getElementById("note-details-modal");
    const titleIconLabel = document.getElementById("note-details-icon-label");
    const titleTextEl = document.getElementById("note-details-title-text");
    const textEl = document.getElementById("note-details-text");
    const viewContainer = document.getElementById("note-details-view");
    const editForm = document.getElementById("note-details-edit-form");
    const editTitle = document.getElementById("note-edit-title");
    const editText = document.getElementById("note-edit-text");
    const editBtn = document.getElementById("note-details-edit-btn");
    const tagEl = document.getElementById("note-details-activity-tag");
    if (!overlay || !titleIconLabel || !titleTextEl || !textEl || !viewContainer || !editForm || !editTitle || !editText || !editBtn) return;
    overlay.classList.add("is-open");
    titleIconLabel.classList.remove("is-hidden");
    titleTextEl.textContent = "";
    titleTextEl.classList.add("is-hidden");
    if (tagEl) {
        tagEl.textContent = `${activity.title}`;
        tagEl.classList.remove("is-hidden");
    }
    viewContainer.classList.add("is-hidden");
    editForm.classList.remove("is-hidden");
    editBtn.classList.add("is-hidden");
    editTitle.value = note.title || "";
    editText.value = note.text || "";
}

function openPrayerDetails(prayerId) {
    const appInfo = getAppInfo();
    const prayer = appInfo.prayers.find(p => p.id === prayerId);
    if (!prayer) return;
    currentPrayerId = prayer.id;
    const overlay = document.getElementById("prayer-details-modal");
    const titleIconLabel = document.getElementById("prayer-details-icon-label");
    const titleTextEl = document.getElementById("prayer-details-title-text");
    const textEl = document.getElementById("prayer-details-text");
    const viewContainer = document.getElementById("prayer-details-view");
    const editForm = document.getElementById("prayer-details-edit-form");
    const editBtn = document.getElementById("prayer-details-edit-btn");
    if (!overlay || !titleTextEl || !textEl || !viewContainer || !editForm || !editBtn) return;
    overlay.classList.add("is-open");
    if (titleIconLabel) {
        titleIconLabel.classList.add("is-hidden");
    }
    titleTextEl.textContent = prayer.title || "Oração";
    titleTextEl.classList.remove("is-hidden");
    viewContainer.classList.remove("is-hidden");
    editForm.classList.add("is-hidden");
    editBtn.classList.remove("is-hidden");
    textEl.textContent = prayer.text || "";
}

function closePrayerDetails() {
    const overlay = document.getElementById("prayer-details-modal");
    if (overlay) {
        overlay.classList.remove("is-open");
    }
    currentPrayerId = null;
}

function setPage(page) {
    currentPage = page;
    const pages = {
        hoje: document.getElementById("page-hoje"),
        caderno: document.getElementById("page-caderno"),
        oracoes: document.getElementById("page-oracoes")
    };
    Object.entries(pages).forEach(([key, el]) => {
        if (!el) return;
        if (key === page) {
            el.classList.add("page--active");
        } else {
            el.classList.remove("page--active");
        }
    });
    const btnHoje = document.getElementById("btn-hoje");
    const btnCaderno = document.getElementById("btn-caderno");
    const btnOracoes = document.getElementById("btn-oracoes");
    const primary = "btn-primary";
    const secondary = "btn-secondary";
    function setPrimary(btn, isPrimary) {
        if (!btn) return;
        if (isPrimary) {
            btn.classList.add(primary);
            btn.classList.remove(secondary);
        } else {
            btn.classList.add(secondary);
            btn.classList.remove(primary);
        }
    }
    setPrimary(btnHoje, page === "hoje");
    setPrimary(btnCaderno, page === "caderno");
    setPrimary(btnOracoes, page === "oracoes");
    const pageTitle = document.querySelector(".page-title");
    const headerButton = document.getElementById("btn-criar-atividade");
    if (pageTitle) {
        if (page === "hoje") {
            pageTitle.innerHTML = 'Hoje <span>19 nov</span>';
        } else if (page === "caderno") {
            pageTitle.textContent = "Caderno";
        } else if (page === "oracoes") {
            pageTitle.textContent = "Orações";
        }
    }
    if (headerButton) {
        if (page === "hoje") {
            headerButton.innerHTML = `
                <svg class="icon" fill="none" viewBox="0 0 19 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0.5 9.51374H9.5M9.5 9.51374H18.5M9.5 9.51374V18.5275M9.5 9.51374V0.5"
                        stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Criar
            `;
        } else if (page === "caderno") {
            headerButton.innerHTML = `
                <svg width="14" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M8.40351 4.0428L0.5 11.9463V15.898H4.45175L12.3553 7.99454M8.40351 4.0428L11.2375 1.20874L11.2393 1.20706C11.6293 0.816945 11.8247 0.621541 12.05 0.548355C12.2485 0.483882 12.4622 0.483882 12.6606 0.548355C12.8857 0.621492 13.0809 0.816669 13.4704 1.20623L15.1893 2.92505C15.5805 3.31629 15.7762 3.512 15.8495 3.73758C15.914 3.936 15.9139 4.14973 15.8495 4.34815C15.7763 4.57356 15.5809 4.76898 15.1902 5.15966L15.1893 5.1605L12.3553 7.99454M8.40351 4.0428L12.3553 7.99454"
                        stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Anotar
            `;
        } else {
            headerButton.innerHTML = `
                <svg class="icon" fill="none" viewBox="0 0 19 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0.5 9.51374H9.5M9.5 9.51374H18.5M9.5 9.51374V18.5275M9.5 9.51374V0.5"
                        stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                Criar
            `;
        }
    }
    if (page === "hoje") {
        renderActivities();
    } else if (page === "caderno") {
        renderNotes();
    } else if (page === "oracoes") {
        renderPrayers();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btnHoje = document.getElementById("btn-hoje");
    const btnCaderno = document.getElementById("btn-caderno");
    const btnOracoes = document.getElementById("btn-oracoes");
    const headerButton = document.getElementById("btn-criar-atividade");
    if (btnHoje) {
        btnHoje.addEventListener("click", () => setPage("hoje"));
    }
    if (btnCaderno) {
        btnCaderno.addEventListener("click", () => setPage("caderno"));
    }
    if (btnOracoes) {
        btnOracoes.addEventListener("click", () => setPage("oracoes"));
    }
    const activityModal = document.getElementById("activity-modal");
    const activityForm = document.getElementById("activity-form");
    const activityClose = document.getElementById("activity-modal-close");
    const activityCancel = document.getElementById("activity-cancel");
    const activityPrayerSelect = document.getElementById("activity-prayer-ids");
    const inlinePrayerForm = document.getElementById("inline-prayer-form");
    const inlinePrayerTitle = document.getElementById("inline-prayer-title");
    const inlinePrayerText = document.getElementById("inline-prayer-text");
    const inlinePrayerSave = document.getElementById("inline-prayer-save");
    const inlinePrayerCancel = document.getElementById("inline-prayer-cancel");
    const btnAddPrayerInline = document.getElementById("btn-add-prayer-inline");
    function openInlinePrayerForm() {
        if (!inlinePrayerForm) return;
        inlinePrayerForm.classList.remove("is-hidden");
        if (inlinePrayerTitle) inlinePrayerTitle.focus();
    }
    function closeInlinePrayerForm() {
        if (!inlinePrayerForm) return;
        inlinePrayerForm.classList.add("is-hidden");
        if (inlinePrayerTitle) inlinePrayerTitle.value = "";
        if (inlinePrayerText) inlinePrayerText.value = "";
    }
    function openActivityModal() {
        if (!activityModal) return;
        activityModal.classList.add("is-open");
        renderPrayerSelectOptions();
    }
    function closeActivityModal() {
        if (!activityModal) return;
        activityModal.classList.remove("is-open");
        if (activityForm) activityForm.reset();
        closeInlinePrayerForm();
    }
    if (activityClose) activityClose.addEventListener("click", closeActivityModal);
    if (activityCancel) activityCancel.addEventListener("click", closeActivityModal);
    // Desativado: clicar fora para fechar activityModal
    // if (activityModal) {
    //     activityModal.addEventListener("click", (event) => {
    //         if (event.target === activityModal) {
    //             closeActivityModal();
    //         }
    //     });
    // }
    if (activityPrayerSelect) {
        activityPrayerSelect.addEventListener("mousedown", (event) => {
            const option = event.target;
            if (!option || option.tagName !== "OPTION") return;
            event.preventDefault();
            option.selected = !option.selected;
            activityPrayerSelect.dispatchEvent(new Event("change"));
        });
    }
    if (btnAddPrayerInline) {
        btnAddPrayerInline.addEventListener("click", openInlinePrayerForm);
    }
    if (inlinePrayerCancel) {
        inlinePrayerCancel.addEventListener("click", closeInlinePrayerForm);
    }
    if (inlinePrayerSave) {
        inlinePrayerSave.addEventListener("click", () => {
            const title = inlinePrayerTitle?.value.trim() || "";
            const text = inlinePrayerText?.value.trim() || "";
            if (!title || !text) {
                alert("Preencha título e texto da oração.");
                return;
            }
            const newPrayer = addPrayer({ title, text });
            renderPrayerSelectOptions();
            const select = document.getElementById("activity-prayer-ids");
            if (select) {
                Array.from(select.options).forEach((opt) => {
                    opt.selected = opt.value === newPrayer.id;
                });
            }
            closeInlinePrayerForm();
        });
    }
    if (activityForm) {
        activityForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const titleInput = document.getElementById("activity-title");
            const timeInput = document.getElementById("activity-time");
            const hasTimerInput = document.getElementById("activity-has-timer");
            const timerMinutesInput = document.getElementById("activity-timer-minutes");
            const prayerSelect = document.getElementById("activity-prayer-ids");
            const title = titleInput?.value.trim() || "";
            const time = timeInput?.value || "";
            const hasTimer = hasTimerInput?.checked || false;
            const timerMinutes = timerMinutesInput?.value
                ? Number(timerMinutesInput.value)
                : null;
            const daysChecked = Array.from(
                activityForm.querySelectorAll('input[name="daysOfWeek"]:checked')
            ).map((input) => input.value);
            const selectedPrayerIds = prayerSelect
                ? Array.from(prayerSelect.options)
                    .filter((opt) => opt.selected)
                    .map((opt) => opt.value)
                : [];
            addActivity({
                title,
                time,
                hasTimer,
                timerMinutes,
                repeat: {
                    enabled: daysChecked.length > 0,
                    daysOfWeek: daysChecked
                },
                prayerIds: selectedPrayerIds
            });
            closeActivityModal();
            renderActivities();
        });
    }
    const detailsModalOverlay = document.getElementById("activity-details-modal");
    const detailsClose = document.getElementById("activity-details-close");
    const detailsStart = document.getElementById("details-start");
    const compactExpand = document.getElementById("activity-compact-expand");
    const btnNote = document.getElementById("details-note");
    const btnComplete = document.getElementById("details-complete");
    const completedModal = document.getElementById("activity-completed-modal");
    const completedClose = document.getElementById("activity-completed-close");
    if (detailsClose) {
        detailsClose.addEventListener("click", () => {
            const overlay = document.getElementById("activity-details-modal");
            const isOpen = overlay?.classList.contains("is-open");
            if (!isOpen) return;
            // if (
            //     activeTimer &&
            //     activeTimer.activityId === currentActivityId &&
            //     activeTimer.intervalId
            // ) {
            //     collapseActivityDetails();
            // } else {
            //     closeActivityDetails();
            // }
            closeActivityDetails();
        });
    }
    // Desativado: clicar fora para fechar detalhes de atividade
    // if (detailsModalOverlay) {
    //     detailsModalOverlay.addEventListener("click", (event) => {
    //         if (event.target === detailsModalOverlay && !detailsModalOverlay.classList.contains("is-compact")) {
    //             closeActivityDetails();
    //         }
    //     });
    // }
    if (detailsStart) {
        detailsStart.addEventListener("click", () => {
            if (!currentActivityId) return;
            const appInfo = getAppInfo();
            const activity = appInfo.activities.find(a => a.id === currentActivityId);
            if (!activity) return;
            startActivityTimer(activity);
        });
    }
    if (compactExpand) {
        compactExpand.addEventListener("click", () => {
            expandActivityDetails();
        });
    }
    if (btnComplete) {
        btnComplete.addEventListener("click", () => {
            completeCurrentActivity();
        });
    }
    if (btnNote) {
        btnNote.addEventListener("click", () => {
            if (!currentActivityId) return;
            openOrCreateNoteForActivity(currentActivityId);
        });
    }
    if (completedClose) {
        completedClose.addEventListener("click", () => {
            if (completedModal) {
                completedModal.classList.remove("is-open");
            }
        });
    }
    // Desativado: clicar fora para fechar modal de atividade concluída
    // if (completedModal) {
    //     completedModal.addEventListener("click", (event) => {
    //         if (event.target === completedModal) {
    //             completedModal.classList.remove("is-open");
    //         }
    //     });
    // }
    const activitiesList = document.getElementById("activities-list");
    if (activitiesList) {
        activitiesList.addEventListener("click", (event) => {
            const card = event.target.closest(".card");
            if (!card) return;
            const activityId = card.dataset.activityId;
            if (!activityId) return;
            openActivityDetails(activityId);
        });
    }
    const noteModal = document.getElementById("note-modal");
    const noteForm = document.getElementById("note-form");
    const noteClose = document.getElementById("note-modal-close");
    const noteCancel = document.getElementById("note-cancel");
    function openNoteModal() {
        if (!noteModal) return;
        noteModal.classList.add("is-open");
    }
    function closeNoteModal() {
        if (!noteModal) return;
        noteModal.classList.remove("is-open");
        if (noteForm) noteForm.reset();
    }
    if (noteClose) noteClose.addEventListener("click", closeNoteModal);
    if (noteCancel) noteCancel.addEventListener("click", closeNoteModal);
    // Desativado: clicar fora para fechar noteModal
    // if (noteModal) {
    //     noteModal.addEventListener("click", (event) => {
    //         if (event.target === noteModal) {
    //             closeNoteModal();
    //         }
    //     });
    // }
    if (noteForm) {
        noteForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const titleInput = document.getElementById("note-title");
            const textInput = document.getElementById("note-text");
            const title = titleInput?.value.trim() || "";
            const text = textInput?.value.trim() || "";
            addNote({ title, text });
            closeNoteModal();
            renderNotes();
        });
    }
    const noteDetailsOverlay = document.getElementById("note-details-modal");
    const noteDetailsClose = document.getElementById("note-details-close");
    const noteDetailsEditBtn = document.getElementById("note-details-edit-btn");
    const noteDetailsEditForm = document.getElementById("note-details-edit-form");
    const noteEditCancel = document.getElementById("note-edit-cancel");
    if (noteDetailsClose) {
        noteDetailsClose.addEventListener("click", () => {
            closeNoteDetails();
            if (currentActivityId) {
                openActivityDetails(currentActivityId);
            }
        });
    }
    // Desativado: clicar fora para fechar detalhes de nota
    // if (noteDetailsOverlay) {
    //     noteDetailsOverlay.addEventListener("click", (event) => {
    //         if (event.target === noteDetailsOverlay) {
    //             closeNoteDetails();
    //         }
    //     });
    // }
    if (noteDetailsEditBtn) {
        noteDetailsEditBtn.addEventListener("click", () => {
            if (!currentNoteId) return;
            const appInfo = getAppInfo();
            const note = appInfo.notes.find(n => n.id === currentNoteId);
            if (!note) return;
            const viewContainer = document.getElementById("note-details-view");
            const editForm = document.getElementById("note-details-edit-form");
            const editTitle = document.getElementById("note-edit-title");
            const editText = document.getElementById("note-edit-text");
            const titleIconLabel = document.getElementById("note-details-icon-label");
            const titleTextEl = document.getElementById("note-details-title-text");
            if (!viewContainer || !editForm || !editTitle || !editText) return;
            if (titleIconLabel) titleIconLabel.classList.remove("is-hidden");
            if (titleTextEl) {
                titleTextEl.textContent = "";
                titleTextEl.classList.add("is-hidden");
            }
            viewContainer.classList.add("is-hidden");
            editForm.classList.remove("is-hidden");
            noteDetailsEditBtn.classList.add("is-hidden");
            editTitle.value = note.title || "";
            editText.value = note.text || "";
        });
    }
    if (noteEditCancel) {
        noteEditCancel.addEventListener("click", () => {
            if (currentActivityId) {
                closeNoteDetails();
                openActivityDetails(currentActivityId);
                return;
            }
            const viewContainer = document.getElementById("note-details-view");
            const editForm = document.getElementById("note-details-edit-form");
            const titleIconLabel = document.getElementById("note-details-icon-label");
            const titleTextEl = document.getElementById("note-details-title-text");
            if (viewContainer && editForm) {
                viewContainer.classList.remove("is-hidden");
                editForm.classList.add("is-hidden");
            }
            if (noteDetailsEditBtn) {
                noteDetailsEditBtn.classList.remove("is-hidden");
            }
            const appInfo = getAppInfo();
            const note = appInfo.notes.find(n => n.id === currentNoteId);
            if (titleIconLabel) titleIconLabel.classList.add("is-hidden");
            if (titleTextEl) {
                titleTextEl.textContent = note?.title || "Anotação";
                titleTextEl.classList.remove("is-hidden");
            }
        });
    }
    if (noteDetailsEditForm) {
        noteDetailsEditForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!currentNoteId) return;
            const editTitle = document.getElementById("note-edit-title");
            const editText = document.getElementById("note-edit-text");
            const newTitle = editTitle?.value.trim() || "";
            const newText = editText?.value.trim() || "";
            updateNote(currentNoteId, {
                title: newTitle,
                text: newText
            });
            renderNotes();
            closeNoteDetails();
            if (currentActivityId) {
                openActivityDetails(currentActivityId);
            }
        });
    }
    const notesList = document.getElementById("notes-list");
    if (notesList) {
        notesList.addEventListener("click", (event) => {
            const card = event.target.closest(".card");
            if (!card) return;
            const noteId = card.dataset.noteId;
            if (!noteId) return;
            openNoteDetails(noteId);
        });
    }
    const prayerModal = document.getElementById("prayer-modal");
    const prayerForm = document.getElementById("prayer-form");
    const prayerClose = document.getElementById("prayer-modal-close");
    const prayerCancel = document.getElementById("prayer-cancel");
    function openPrayerModal() {
        if (!prayerModal) return;
        prayerModal.classList.add("is-open");
    }
    function closePrayerModal() {
        if (!prayerModal) return;
        prayerModal.classList.remove("is-open");
        if (prayerForm) prayerForm.reset();
    }
    if (prayerClose) prayerClose.addEventListener("click", closePrayerModal);
    if (prayerCancel) prayerCancel.addEventListener("click", closePrayerModal);
    // Desativado: clicar fora para fechar prayerModal
    // if (prayerModal) {
    //     prayerModal.addEventListener("click", (event) => {
    //         if (event.target === prayerModal) {
    //             closePrayerModal();
    //         }
    //     });
    // }
    if (prayerForm) {
        prayerForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const titleInput = document.getElementById("prayer-title");
            const textInput = document.getElementById("prayer-text");
            const title = titleInput?.value.trim() || "";
            const text = textInput?.value.trim() || "";
            addPrayer({ title, text });
            closePrayerModal();
            renderPrayers();
            renderPrayerSelectOptions();
        });
    }
    const prayerDetailsOverlay = document.getElementById("prayer-details-modal");
    const prayerDetailsClose = document.getElementById("prayer-details-close");
    const prayerDetailsEditBtn = document.getElementById("prayer-details-edit-btn");
    const prayerDetailsEditForm = document.getElementById("prayer-details-edit-form");
    const prayerEditCancel = document.getElementById("prayer-edit-cancel");
    if (prayerDetailsClose) {
        prayerDetailsClose.addEventListener("click", () => {
            closePrayerDetails();
        });
    }
    // Desativado: clicar fora para fechar detalhes de oração
    // if (prayerDetailsOverlay) {
    //     prayerDetailsOverlay.addEventListener("click", (event) => {
    //         if (event.target === prayerDetailsOverlay) {
    //             closePrayerDetails();
    //         }
    //     });
    // }
    if (prayerDetailsEditBtn) {
        prayerDetailsEditBtn.addEventListener("click", () => {
            if (!currentPrayerId) return;
            const appInfo = getAppInfo();
            const prayer = appInfo.prayers.find(p => p.id === currentPrayerId);
            if (!prayer) return;
            const viewContainer = document.getElementById("prayer-details-view");
            const editForm = document.getElementById("prayer-details-edit-form");
            const editTitle = document.getElementById("prayer-edit-title");
            const editText = document.getElementById("prayer-edit-text");
            const titleIconLabel = document.getElementById("prayer-details-icon-label");
            const titleTextEl = document.getElementById("prayer-details-title-text");
            if (!viewContainer || !editForm || !editTitle || !editText) return;
            if (titleIconLabel) titleIconLabel.classList.remove("is-hidden");
            if (titleTextEl) {
                titleTextEl.textContent = "";
                titleTextEl.classList.add("is-hidden");
            }
            viewContainer.classList.add("is-hidden");
            editForm.classList.remove("is-hidden");
            prayerDetailsEditBtn.classList.add("is-hidden");
            editTitle.value = prayer.title || "";
            editText.value = prayer.text || "";
        });
    }
    if (prayerEditCancel) {
        prayerEditCancel.addEventListener("click", () => {
            const viewContainer = document.getElementById("prayer-details-view");
            const editForm = document.getElementById("prayer-details-edit-form");
            const titleIconLabel = document.getElementById("prayer-details-icon-label");
            const titleTextEl = document.getElementById("prayer-details-title-text");
            if (viewContainer && editForm) {
                viewContainer.classList.remove("is-hidden");
                editForm.classList.add("is-hidden");
            }
            if (prayerDetailsEditBtn) {
                prayerDetailsEditBtn.classList.remove("is-hidden");
            }
            const appInfo = getAppInfo();
            const prayer = appInfo.prayers.find(p => p.id === currentPrayerId);
            if (titleIconLabel) titleIconLabel.classList.add("is-hidden");
            if (titleTextEl) {
                titleTextEl.textContent = prayer?.title || "Oração";
                titleTextEl.classList.remove("is-hidden");
            }
        });
    }
    if (prayerDetailsEditForm) {
        prayerDetailsEditForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!currentPrayerId) return;
            const editTitle = document.getElementById("prayer-edit-title");
            const editText = document.getElementById("prayer-edit-text");
            const newTitle = editTitle?.value.trim() || "";
            const newText = editText?.value.trim() || "";
            const updated = updatePrayer(currentPrayerId, {
                title: newTitle,
                text: newText
            });
            const titleIconLabel = document.getElementById("prayer-details-icon-label");
            const titleTextEl = document.getElementById("prayer-details-title-text");
            const textEl = document.getElementById("prayer-details-text");
            if (updated) {
                if (titleTextEl) {
                    titleTextEl.textContent = updated.title || "Oração";
                }
                if (textEl) {
                    textEl.innerHTML = (updated.text || "").replace(/\n/g, "<br>");
                }
            }
            renderPrayers();
            renderPrayerSelectOptions();
            const viewContainer = document.getElementById("prayer-details-view");
            const editForm = document.getElementById("prayer-details-edit-form");
            if (viewContainer && editForm) {
                viewContainer.classList.remove("is-hidden");
                editForm.classList.add("is-hidden");
            }
            if (prayerDetailsEditBtn) {
                prayerDetailsEditBtn.classList.remove("is-hidden");
            }
            if (titleIconLabel) titleIconLabel.classList.add("is-hidden");
            if (titleTextEl) titleTextEl.classList.remove("is-hidden");
        });
    }
    const prayersList = document.getElementById("prayers-list");
    if (prayersList) {
        prayersList.addEventListener("click", (event) => {
            const card = event.target.closest(".card");
            if (!card) return;
            const prayerId = card.dataset.prayerId;
            if (!prayerId) return;
            openPrayerDetails(prayerId);
        });
    }
    if (headerButton) {
        headerButton.addEventListener("click", () => {
            if (currentPage === "hoje") {
                openActivityModal();
            } else if (currentPage === "caderno") {
                openNoteModal();
            } else if (currentPage === "oracoes") {
                openPrayerModal();
            }
        });
    }
    setPage("hoje");
    renderNotes();
    renderPrayers();
    renderPrayerSelectOptions();
});
