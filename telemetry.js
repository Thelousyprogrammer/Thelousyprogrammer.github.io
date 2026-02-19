/**
 * TELEMETRY CORE v2.0 - REFACTORED
 * Fixes: Merge conflicts, missing math, chart visibility, and duplicate declarations.
 */

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
    
    // 1. Unified Semantic Palette
    const THEME = {
        highest: style.getPropertyValue('--level-3').trim(),
        mid:     style.getPropertyValue('--level-2').trim(),
        low:     style.getPropertyValue('--level-1').trim(),
        empty:   style.getPropertyValue('--level-0').trim(),
        accent:  style.getPropertyValue('--accent').trim(),
        text:    style.getPropertyValue('--text').trim(),
        grid:    style.getPropertyValue('--chart-grid').trim(),
        fill:    style.getPropertyValue('--chart-fill').trim(),
        ideal:   style.getPropertyValue('--accent').trim(),

        getPerformanceColor: function(hrs) {
            if (hrs <= 0) return this.empty;
            if (hrs >= 10) return this.highest; 
            if (hrs >= 8)  return this.mid;     
            return this.low;                    
        }
    };

    Chart.defaults.color = THEME.text;
    Chart.defaults.font.family = themeFont;

    Object.values(charts).forEach(c => { if(c) c.destroy(); });
    charts = {};

    // 2. CORE MATH & TIME CALCULATIONS
    const totalActualHours = allLogs.reduce((sum, r) => sum + r.hours, 0);
    const remainingHours = Math.max(0, MASTER_GOAL - totalActualHours);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysElapsed = Math.max(1, Math.ceil((today - OJT_START_DATE) / msPerDay));
    const daysRemaining = Math.max(1, Math.ceil((TARGET_DEADLINE - today) / msPerDay));
    
    const overallPace = totalActualHours / daysElapsed; 
    const requiredRate = remainingHours / daysRemaining;

    const last7DayLogs = allLogs.slice(-7);
    const last7DayAvg = last7DayLogs.reduce((sum, r) => sum + r.hours, 0) / 7;

    const projectionPace = last7DayAvg > 0 ? last7DayAvg : (overallPace || 1);
    const daysToFinish = remainingHours / projectionPace;
    const projectedDate = new Date(today);
    projectedDate.setDate(projectedDate.getDate() + Math.ceil(daysToFinish));

    // Performance Metrics
    const totalWorkHours = logs.reduce((sum, r) => sum + r.hours, 0);
    const totalPersonal = logs.reduce((sum, r) => sum + (r.personalHours || 0), 0);
    const efficiency = totalWorkHours > 0 ? (totalWorkHours / (totalWorkHours + totalPersonal)) * 100 : 0;
    const momentum = overallPace > 0 ? ((last7DayAvg - overallPace) / overallPace) * 100 : 0;

    // 3. STREAK LOGIC
    let currentStreak = 0;
    let streakCheck = new Date(today);
    const dateStrToday = today.toISOString().split('T')[0];
    if (!allLogs.some(l => l.date === dateStrToday)) streakCheck.setDate(streakCheck.getDate() - 1);

    for (let i = 0; i < 365; i++) {
        const dStr = streakCheck.toISOString().split('T')[0];
        const log = allLogs.find(l => l.date === dStr);
        if (log && log.hours >= 8) {
            currentStreak++;
            streakCheck.setDate(streakCheck.getDate() - 1);
        } else { break; }
    }

    // 4. UI UPDATE BLOCK
    const safeUpdate = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    safeUpdate("remainingHoursText", `${remainingHours.toFixed(1)} hrs remaining`);
    safeUpdate("completionDateText", `Projected: ${projectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`);
    safeUpdate("reqPaceValue", `${requiredRate.toFixed(1)}h/day`);
    safeUpdate("last7DayPace", `${last7DayAvg.toFixed(1)}h/day`);
    safeUpdate("efficiencyValue", `${efficiency.toFixed(1)}%`);
    safeUpdate("momentumValue", `${momentum > 0 ? '+' : ''}${momentum.toFixed(1)}%`);
    safeUpdate("streakValue", `${currentStreak} Days`);

    const momentumEl = document.getElementById("momentumValue");
    if (momentumEl) momentumEl.style.color = momentum >= 0 ? THEME.mid : THEME.low;

    // 5. RISKS & HEALTH
    let fatigueRisk = 0; let consecutiveHigh = 0;
    allLogs.forEach(r => {
        if (r.hours > 8) consecutiveHigh++; else consecutiveHigh = 0;
        if (consecutiveHigh >= 3) fatigueRisk = 2;
    });

    let cogRisk = 0; let consecutiveCogHigh = 0;
    allLogs.forEach(r => {
        const load = r.hours + (r.personalHours || 0);
        if (load > 11) consecutiveCogHigh += 2; 
        else if (load > 10) consecutiveCogHigh++;
        else consecutiveCogHigh = 0;
        if (consecutiveCogHigh >= 6) cogRisk = 2; 
    });

    const updateLabel = (id, risk, statuses) => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = statuses[risk];
            el.style.color = [THEME.mid, THEME.highest, THEME.low][risk];
        }
    };
    updateLabel("fatigueLabel", fatigueRisk, ["Stable", "Accumulating", "Burnout Risk"]);
    updateLabel("cogLabel", cogRisk, ["Healthy", "High Load", "REDLINE"]);

    // 6. TRIGGER CHART RENDERING
    renderTrajectoryChart(allLogs, THEME);
    renderEnergyZoneChart(logs, THEME);
    renderIdentityChart(allLogs, THEME);
    renderContextualCharts(logs, selectedWeek, THEME);
}

// --- CHART RENDERERS ---

function renderTrajectoryChart(logs, colors) {
    const ctx = document.getElementById('trajectoryChart')?.getContext('2d');
    if (!ctx) return;
    const sorted = [...logs].sort((a,b) => new Date(a.date) - new Date(b.date));
    let currentSum = 0;
    const labels = [];
    const actual = [];
    const ideal = [];
    
    const start = new Date(OJT_START_DATE);
    const end = new Date();
    const map = {};
    sorted.forEach(l => map[l.date] = l.hours);

    let dayCount = 0;
    for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0];
        labels.push(dStr);
        currentSum += (map[dStr] || 0);
        actual.push(currentSum);
        dayCount++;
        ideal.push(dayCount * 8);
    }

    charts.trajectory = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Actual', data: actual, borderColor: colors.accent, backgroundColor: colors.fill, fill: true },
                { label: 'Ideal', data: ideal, borderColor: colors.text, borderDash: [5,5], pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderEnergyZoneChart(logs, colors) {
    const ctx = document.getElementById('energyZoneChart')?.getContext('2d');
    if (!ctx) return;
    const zones = { Elite: 0, Overdrive: 0, Solid: 0, Survival: 0, Recovery: 0 };
    logs.forEach(r => {
        const total = r.hours + (r.personalHours || 0);
        if (r.hours >= 8 && (r.personalHours || 0) >= 1) zones.Elite++;
        else if (total > 9) zones.Overdrive++;
        else if (r.hours >= 8) zones.Solid++;
        else if (r.hours >= 6) zones.Survival++;
        else zones.Recovery++;
    });

    charts.energy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ["Recovery", "Survival", "Solid", "Overdrive", "Elite"],
            datasets: [{
                data: [zones.Recovery, zones.Survival, zones.Solid, zones.Overdrive, zones.Elite],
                backgroundColor: [colors.empty, colors.low, colors.mid, colors.highest, colors.accent],
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function renderIdentityChart(logs, colors) {
    const ctx = document.getElementById('identityChart')?.getContext('2d');
    if (!ctx) return;
    const weekly = {};
    logs.forEach(r => {
        if (r.identityScore > 0) {
            const w = getWeekNumber(r.date);
            if (!weekly[w]) weekly[w] = { sum: 0, count: 0 };
            weekly[w].sum += r.identityScore;
            weekly[w].count++;
        }
    });

    const labels = Object.keys(weekly).sort((a,b) => a-b);
    const data = labels.map(w => weekly[w].sum / weekly[w].count);

    charts.identity = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(w => `Week ${w}`),
            datasets: [{
                label: 'Identity Alignment',
                data: data,
                borderColor: colors.highest, // White/Gold for pop
                backgroundColor: colors.fill,
                fill: true,
                tension: 0.4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 5 } }
        }
    });
}

function renderContextualCharts(logs, selectedWeek, colors) {
    const weeklyCtx = document.getElementById('weeklyTrendChart')?.getContext('2d');
    if (!weeklyCtx) return;

    if (selectedWeek !== "all") {
        charts.velocity = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: logs.map(r => r.date),
                datasets: [{
                    label: 'Daily Hours',
                    data: logs.map(r => r.hours),
                    backgroundColor: logs.map(r => colors.getPerformanceColor(r.hours)),
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } else {
        const weeklyVel = {};
        logs.forEach(r => {
            const w = getWeekNumber(r.date);
            weeklyVel[w] = (weeklyVel[w] || 0) + r.hours;
        });
        const labels = Object.keys(weeklyVel).sort((a,b) => a-b);
        charts.velocity = new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: labels.map(w => `Week ${w}`),
                datasets: [{
                    label: 'Weekly Velocity',
                    data: labels.map(w => weeklyVel[w]),
                    borderColor: colors.accent,
                    fill: false,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
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