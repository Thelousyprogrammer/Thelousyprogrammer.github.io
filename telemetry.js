const MASTER_GOAL = 500;
const OJT_START_DATE = new Date(2026, 0, 26); // Jan 26
const TARGET_DEADLINE = new Date(2026, 3, 25); // April 25

let allLogs = [];
let charts = {};

document.addEventListener("DOMContentLoaded", async () => {
    const loader = document.getElementById("loadingOverlay");
    if (loader) loader.style.display = "flex";

    try {
        allLogs = await fetchTelemetryData();
        populateWeekSelector(allLogs);
        renderTelemetry(allLogs);
    } catch (err) {
        console.error("Telemetry Sync Failed:", err);
    } finally {
        if (loader) setTimeout(() => { loader.style.display = "none"; }, 800);
    }
});

// --- DATA FETCHING HELPERS ---

function fetchTelemetryData() {
    return new Promise((resolve) => {
        const raw = localStorage.getItem("dtr");
        const logs = JSON.parse(raw) || [];
        // Ensure hours are numbers
        const cleaned = logs.map(l => ({
            ...l,
            hours: parseFloat(l.hours) || 0,
            personalHours: parseFloat(l.personalHours) || 0,
            identityScore: parseInt(l.identityScore) || 0
        }));
        setTimeout(() => resolve(cleaned), 300);
    });
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = d.getTime() - OJT_START_DATE.getTime();
    if (diff < 0) return 1;
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// --- RENDERING CORE ---

function renderTelemetry(logs, selectedWeek = "all") {
    const style = getComputedStyle(document.documentElement);
    const themeFont = getComputedStyle(document.body).fontFamily;
    
    // Unified Semantic Palette - FETCHED FROM CSS
    const THEME = {
        highest: style.getPropertyValue('--level-3').trim() || '#FF00FF',
        mid:     style.getPropertyValue('--level-2').trim() || '#00FF00',
        low:     style.getPropertyValue('--level-1').trim() || '#FFF000',
        empty:   style.getPropertyValue('--level-0').trim() || '#333333',
        
        text:    style.getPropertyValue('--text').trim() || '#ffffff',
        grid:    style.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.05)',
        accent:  style.getPropertyValue('--accent').trim() || '#e8b01e',
        fill:    style.getPropertyValue('--chart-fill').trim() || 'rgba(232, 176, 30, 0.1)',
        ideal:   style.getPropertyValue('--chart-ideal').trim() || 'rgba(255,255,255,0.2)',

getPerformanceColor: function(hrs) {
        if (hrs <= 0) return this.empty;
        if (hrs >= 8) return this.highest;
        if (hrs >= 4)  return this.mid;
        return this.low;
    }
};

    Chart.defaults.color = THEME.text;
    Chart.defaults.font.family = themeFont;

    Object.values(charts).forEach(c => { if(c) c.destroy(); });
    charts = {};

    // 2. --- CORE MATH & TIME CALCULATIONS ---
    const totalActualHours = allLogs.reduce((sum, r) => sum + r.hours, 0);
    const remainingHours = Math.max(0, MASTER_GOAL - totalActualHours);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysElapsed = Math.max(1, Math.ceil((today - OJT_START_DATE) / msPerDay));
    const daysRemaining = Math.max(1, Math.ceil((TARGET_DEADLINE - today) / msPerDay));
    
    const overallPace = totalActualHours / daysElapsed; 
    const requiredRate = remainingHours / daysRemaining;

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7DayLogs = allLogs.filter(r => new Date(r.date) >= sevenDaysAgo);
    const last7DayTotal = last7DayLogs.reduce((sum, r) => sum + r.hours, 0);
    const last7DayAvg = last7DayTotal / 7;

    const projectionPace = last7DayAvg > 0 ? last7DayAvg : (overallPace || 1);
    const daysToFinish = remainingHours / projectionPace;
    const projectedDate = new Date(today);
    projectedDate.setDate(projectedDate.getDate() + Math.ceil(daysToFinish));

    // 3. --- UI UPDATE BLOCK ---
    const safeUpdate = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    safeUpdate("remainingHoursText", `${remainingHours.toFixed(1)} hrs remaining`);
    safeUpdate("completionDateText", `Projected: ${projectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`);
    safeUpdate("reqPaceValue", `${requiredRate.toFixed(1)}h/day`);
    safeUpdate("last7DayPace", `${last7DayAvg.toFixed(1)}h/day`);
    safeUpdate("remHoursPace", `${remainingHours.toFixed(1)}h`);
    safeUpdate("remDaysPace", `${daysRemaining}d`);

    const paceMsg = document.getElementById("paceStatusMsg");
    if (paceMsg) {
        if (remainingHours <= 0) {
            paceMsg.innerText = "Goal Reached!";
            paceMsg.style.color = THEME.highest; // Gold in Cadillac
        } else {
            paceMsg.innerText = last7DayAvg >= requiredRate ? "On Track" : "Behind Schedule";
            paceMsg.style.color = last7DayAvg >= requiredRate ? THEME.mid : THEME.low;
        }
    }

    // 4. --- STREAK LOGIC ---
    let currentStreak = 0;
    let streakCheck = new Date(today);
    if (!allLogs.some(l => l.date === today.toISOString().split('T')[0])) streakCheck.setDate(streakCheck.getDate() - 1);

    for (let i = 0; i < 365; i++) {
        const dateStr = streakCheck.toISOString().split('T')[0];
        const log = allLogs.find(l => l.date === dateStr);
        if (log && log.hours >= 8) {
            currentStreak++;
            streakCheck.setDate(streakCheck.getDate() - 1);
        } else { break; }
    }
    safeUpdate("streakValue", `${currentStreak} Days`);

    // 5. --- RISKS & HEALTH (L2) ---
    const sortedAll = [...allLogs].sort((a,b) => new Date(a.date) - new Date(b.date));
    let fatigueRisk = 0; let consecutiveHigh = 0;
    for (const r of sortedAll) {
        if (r.hours > 8) consecutiveHigh++; else consecutiveHigh = 0;
        if (consecutiveHigh >= 3) { fatigueRisk = 2; break; }
    }

    let cogRisk = 0; let consecutiveCogHigh = 0;
    for (const r of sortedAll) {
        const totalLoad = r.hours + (r.personalHours || 0);
        if (totalLoad > 11) consecutiveCogHigh += 2; 
        else if (totalLoad > 10) consecutiveCogHigh++;
        else consecutiveCogHigh = 0;
        if (consecutiveCogHigh >= 6) cogRisk = 2; 
        else if (consecutiveCogHigh >= 3) cogRisk = Math.max(cogRisk, 1);
    }

    const updateLabel = (id, riskLevel, statuses) => {
        const el = document.getElementById(id);
        if (el) {
            const colors = [THEME.mid, THEME.highest, THEME.low];
            el.innerText = statuses[riskLevel];
            el.style.color = colors[riskLevel];
        }
    };
    updateLabel("fatigueLabel", fatigueRisk, ["Stable", "Accumulating", "Burnout Risk"]);
    updateLabel("cogLabel", cogRisk, ["Healthy", "High Load", "REDLINE"]);

    // 6. --- TRIGGER CHART RENDERING ---
    // Pass the THEME object which now contains 'highest', 'mid', 'low', 'empty'
    renderTrajectoryChart(allLogs, THEME);
    renderEnergyZoneChart(logs, THEME);
    renderIdentityChart(allLogs, THEME);
    renderContextualCharts(logs, selectedWeek, THEME);
}

// --- CHART RENDERERS ---

function renderTrajectoryChart(logs, colors) {
    const ctx = document.getElementById('trajectoryChart')?.getContext('2d');
    if (!ctx) return;

    const sortedLogs = [...logs].sort((a,b) => new Date(a.date) - new Date(b.date));
    const labels = [];
    const actualCumulative = [];
    const idealCumulative = [];
    let currentSum = 0;
    
    const start = new Date(OJT_START_DATE);
    const end = new Date();
    const logMap = {};
    sortedLogs.forEach(l => logMap[l.date] = l.hours);

    let dayCounter = 0;
    for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        labels.push(dateStr);
        currentSum += (logMap[dateStr] || 0);
        actualCumulative.push(currentSum);
        dayCounter++;
        idealCumulative.push(dayCounter * 8);
    }

    charts.trajectory = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Actual', data: actualCumulative, borderColor: colors.accent, backgroundColor: colors.fill, fill: true },
                { label: 'Ideal', data: idealCumulative, borderColor: colors.ideal, borderDash: [5,5], pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: colors.grid } } } }
    });
}

function renderEnergyZoneChart(logs, colors) {
    const ctx = document.getElementById('energyZoneChart')?.getContext('2d');
    if (!ctx) return;

    // 1. Calculate the data counts for each zone
    const zoneOrder = ["Recovery", "Survival", "Solid", "Overdrive", "Elite"];
    const zones = { Elite: 0, Overdrive: 0, Solid: 0, Survival: 0, Recovery: 0 };

    logs.forEach(r => {
        const total = r.hours + (r.personalHours || 0);
        if (r.hours >= 8 && (r.personalHours || 0) >= 1) zones["Elite"]++;
        else if (total > 9) zones["Overdrive"]++;
        else if (r.hours >= 8) zones["Solid"]++;
        else if (r.hours >= 6) zones["Survival"]++;
        else zones["Recovery"]++;
    });

    // 2. Map colors to the CSS levels
    charts.energy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: zoneOrder,
            datasets: [{
                data: zoneOrder.map(z => zones[z]),
                // These pull from the THEME object which pulls from theme.css
                backgroundColor: [
                    colors.empty,   // Recovery (Level 0)
                    colors.low,     // Survival (Level 1)
                    colors.mid,     // Solid (Level 2)
                    colors.highest, // Overdrive (Level 3)
                    colors.accent   // Elite (Branding Accent)
                ],
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: colors.grid }, ticks: { color: colors.text } },
                y: { grid: { display: false }, ticks: { color: colors.text } }
            }
        }
    });
}

function renderIdentityChart(logs, colors) {
    const canvas = document.getElementById('identityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Group by week and get average identity score
    const weeklyIdentity = {};
    logs.forEach(r => {
        // Only count if identityScore is 1-5 (ignore null/0)
        if (r.identityScore && r.identityScore > 0) {
            const w = getWeekNumber(new Date(r.date));
            if (!weeklyIdentity[w]) weeklyIdentity[w] = { sum: 0, count: 0 };
            weeklyIdentity[w].sum += r.identityScore;
            weeklyIdentity[w].count++;
        }
    });

    const labels = Object.keys(weeklyIdentity).sort((a,b) => a - b);
    const data = labels.map(w => {
        const avg = weeklyIdentity[w].sum / weeklyIdentity[w].count;
        return isNaN(avg) ? 0 : avg;
    });

    charts.identity = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(w => `Week ${w}`),
            datasets: [{
                label: 'Alignment Score (1-5)',
                data: data,
                borderColor: colors.excellent,
                backgroundColor: colors.fill,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 5, grid: { color: colors.grid } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderContextualCharts(logs, selectedWeek, colors) {
    // --- Delta History ---
    const deltaCtx = document.getElementById('deltaChart')?.getContext('2d');
    if (deltaCtx) {
        charts.delta = new Chart(deltaCtx, {
            type: 'line',
            data: {
                labels: logs.map(r => r.date),
                datasets: [{
                    label: 'Session Delta (hrs)',
                    data: logs.map(r => r.hours - 8),
                    borderColor: colors.accent,
                    backgroundColor: colors.fill,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: colors.accent
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: colors.grid }, title: { display: true, text: 'Hours vs Target (8h)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // --- Hour Distribution ---
    const hourCounts = {};
    logs.forEach(r => {
        const h = Math.round(r.hours * 2) / 2;
        hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const sortedHours = Object.keys(hourCounts).sort((a, b) => a - b);
    const hourCtx = document.getElementById('hourDistChart')?.getContext('2d');
    if (hourCtx) {
        charts.hour = new Chart(hourCtx, {
            type: 'bar',
            data: {
                labels: sortedHours.map(h => `${h}h`),
                datasets: [{
                    label: 'Frequency',
                    data: sortedHours.map(h => hourCounts[h]),
                    backgroundColor: colors.fill,
                    borderColor: colors.accent,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: colors.grid }, title: { display: true, text: 'Days' }, ticks: { stepSize: 1 } },
                    x: { grid: { display: false }, title: { display: true, text: 'Hours per Day' } }
                }
            }
        });
    }

    // --- Weekly Velocity ---
const weeklyCtx = document.getElementById('weeklyTrendChart')?.getContext('2d');
    if (!weeklyCtx) return;
    const getPointColor = (hrs) => colors.getPerformanceColor(hrs);

    if (selectedWeek !== "all") {
        // DAILY PERFORMANCE GRAPH
        charts.velocity = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: logs.map(r => r.date),
                datasets: [{
                    label: 'Daily Hours',
                    data: logs.map(r => r.hours),
                    backgroundColor: logs.map(r => getPointColor(r.hours)),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: colors.grid } },
                    x: { grid: { display: false } }
                }
            }
        });
    } else {
        // WEEKLY SUMMARY GRAPH - Aggregated by Week
        const weeklyVelocity = {};
        logs.forEach(r => {
            const w = getWeekNumber(new Date(r.date));
            weeklyVelocity[w] = (weeklyVelocity[w] || 0) + r.hours;
        });

        const sortedWeeks = Object.keys(weeklyVelocity).sort((a,b) => a-b);

        charts.velocity = new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: sortedWeeks.map(w => `Week ${w}`),
                datasets: [{
                    label: 'Total Weekly Hours',
                    data: sortedWeeks.map(w => weeklyVelocity[w]),
                    borderColor: colors.good, // Use 'Good' color for positive trend
                    backgroundColor: colors.fill,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 5,
                    pointBackgroundColor: colors.good
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: colors.grid }, title: { display: true, text: 'Total Hours' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

function populateWeekSelector(logs) {
    const select = document.getElementById("weekSelect");
    if (!select) return;
    const weeks = [...new Set(logs.map(r => getWeekNumber(new Date(r.date))))].sort((a,b) => b-a);
    weeks.forEach(w => {
        const opt = document.createElement("option");
        opt.value = w;
        opt.innerText = `Week ${w}`;
        select.appendChild(opt);
    });
}

function setTelemetryTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('user-theme', themeName);
    setTimeout(() => renderTelemetry(allLogs), 50);
}

(function syncTheme() {
    const savedTheme = localStorage.getItem('user-theme') || 'f1';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();