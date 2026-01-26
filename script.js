// === CONFIG ===
const MASTER_TARGET_HOURS = 500;   // Total OJT goal
const DAILY_TARGET_HOURS = 8;      // Reference time per day
const GREAT_DELTA_THRESHOLD = 2;  // 2 hours or more is "great"

// === DAILY RECORD MODEL ===
class DailyRecord {
  constructor(date, hours, reflection, accomplishments, tools, images = []) {
    this.date = date;
    this.hours = hours;
    this.delta = hours - DAILY_TARGET_HOURS;
    this.reflection = reflection;
    this.accomplishments = accomplishments;
    this.tools = tools;
    this.images = images;
  }
}

// === STORAGE ===
let dailyRecords = JSON.parse(localStorage.getItem("dtr")) || [];

// === HELPER FUNCTIONS ===
function getWeekNumber(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date - start;
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function getTotalHours() {
  return dailyRecords.reduce((sum, r) => sum + r.hours, 0);
}

function getOverallDelta() {
  return getTotalHours() - MASTER_TARGET_HOURS;
}

function getWeekHours(weekNumber) {
  return dailyRecords
    .filter(r => getWeekNumber(new Date(r.date)) === weekNumber)
    .reduce((sum, r) => sum + r.hours, 0);
}

function getTodayFileName(prefix, ext) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${prefix}_${yyyy}-${mm}-${dd}.${ext}`;
}

// === THEME SYSTEM ===
function setTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem("theme", name);
}
setTheme(localStorage.getItem("theme") || "f1");

// === SAVE DAILY RECORD ===
function saveDailyRecord(record) {
  dailyRecords.push(record);
  localStorage.setItem("dtr", JSON.stringify(dailyRecords));

  loadReflectionViewer();
  showSummary(record);
  updateWeeklyCounter(record.date);
}

// === DELETE LAST RECORD ===
function deleteLastRecord() {
  if (!dailyRecords.length) return alert("No records to delete.");
  if (!confirm("Delete the most recent DTR entry?")) return;

  dailyRecords.pop();
  localStorage.setItem("dtr", JSON.stringify(dailyRecords));

  loadReflectionViewer();
  if (dailyRecords.length) {
    showSummary(dailyRecords[dailyRecords.length - 1]);
    updateWeeklyCounter(dailyRecords[dailyRecords.length - 1].date);
  } else {
    showSummary({});
    updateWeeklyCounter();
  }
  alert("Last DTR entry deleted.");
}

// === CLEAR ALL RECORDS ===
function clearAllRecords() {
  if (!confirm("This will delete ALL DTR records. Continue?")) return;

  dailyRecords = [];
  localStorage.removeItem("dtr");

  loadReflectionViewer();
  showSummary({});
  updateWeeklyCounter();
  alert("All DTR records cleared.");
}

// === SUBMIT DTR ===
function submitDTR() {
  const date = document.getElementById("date").value;
  const hours = parseFloat(document.getElementById("hours").value);
  const reflection = document.getElementById("reflection").value;

  if (!date || isNaN(hours)) {
    alert("Please enter a valid date and number of hours.");
    return;
  }

  const accomplishments = document.getElementById("accomplishments").value
    .split("\n")
    .filter(a => a.trim() !== "");

  const tools = document.getElementById("tools").value
    .split(",")
    .map(t => t.trim())
    .filter(t => t !== "");

  const files = Array.from(document.getElementById("images").files);
  const images = [];

  if (files.length > 0) {
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        images.push(e.target.result);
        loaded++;
        if (loaded === files.length) {
          saveRecord(date, hours, reflection, accomplishments, tools, images);
        }
      };
      reader.readAsDataURL(file);
    });
  } else {
    saveRecord(date, hours, reflection, accomplishments, tools, images);
  }
}

// === CHECK DATE INTEGRITY ===
function checkDateIntegrity(record) {
  const existingRecords = dailyRecords.filter(r => r.date === record.date);

  if (existingRecords.length === 0) {
    // No conflict, safe to save
    saveDailyRecord(record);
    showSummary(record);
    alert("Daily DTR saved!");
    return;
  }

  if (existingRecords.length === 1) {
    const choice = confirm(
      `There is already a DTR entry for ${record.date}.\n` +
      `Press OK to replace the original entry, or Cancel to keep it.`
    );

    if (choice) {
      // Replace original
      const index = dailyRecords.findIndex(r => r.date === record.date);
      dailyRecords[index] = record;
      localStorage.setItem("dtr", JSON.stringify(dailyRecords));
      loadReflectionViewer();
      showSummary(record);
      alert("Original DTR replaced with new entry.");
    } else {
      // Keep original
      alert("Original DTR kept. No changes made.");
    }
    return;
  }

  if (existingRecords.length > 1) {
    let keepIndex = prompt(
      `Multiple DTR entries found for ${record.date}.\n` +
      `Enter the number (1-${existingRecords.length}) of the entry you want to keep:`
    );

    keepIndex = parseInt(keepIndex) - 1;
    if (keepIndex >= 0 && keepIndex < existingRecords.length) {
      // Remove others, keep selected
      dailyRecords = dailyRecords.filter(r => !(r.date === record.date));
      dailyRecords.push(existingRecords[keepIndex]); // keep selected
      dailyRecords.push(record); // add new
      dailyRecords.sort((a, b) => new Date(a.date) - new Date(b.date)); // keep order
      localStorage.setItem("dtr", JSON.stringify(dailyRecords));
      loadReflectionViewer();
      showSummary(record);
      alert("Duplicate entries resolved and new DTR saved.");
    } else {
      alert("Invalid selection. No changes made.");
    }
  }
}

// Separate function to save
function saveRecord(date, hours, reflection, accomplishments, tools, images) {
  const record = new DailyRecord(date, hours, reflection, accomplishments, tools, images);

  dailyRecords.push(record);
  localStorage.setItem("dtr", JSON.stringify(dailyRecords));

  loadReflectionViewer();
  showSummary(record);
  updateWeeklyCounter(record.date);

  clearDTRForm(); // 🔥 reset input after save
  alert("Daily DTR saved and form cleared!");
}

// === CLEAR INPUT FORM ===
function clearDTRForm() {
  document.getElementById("date").value = "";
  document.getElementById("hours").value = "";
  document.getElementById("reflection").value = "";
  document.getElementById("accomplishments").value = "";
  document.getElementById("tools").value = "";

  const imgInput = document.getElementById("images");
  if (imgInput) imgInput.value = "";

  const preview = document.getElementById("imagePreview");
  if (preview) preview.innerHTML = "";

  const weeklyCounter = document.getElementById("weeklyCounter");
  if (weeklyCounter) weeklyCounter.innerHTML = "";
}

// === UPDATE WEEKLY COUNTER ===
function updateWeeklyCounter(dateInput) {
  const weekNum = dateInput ? getWeekNumber(new Date(dateInput)) : null;
  const weekHours = weekNum ? getWeekHours(weekNum) : 0;
  const maxWeeklyHours = DAILY_TARGET_HOURS * 7;

  let color = "#FFFFFF"; // default normal
  if (weekHours < maxWeeklyHours * 0.5) color = "#FFFF00"; // lowest
  else if (weekHours < maxWeeklyHours) color = "#00FF00"; // personal highest
  else color = "#FF00FF"; // highest overall

  const counterEl = document.getElementById("weeklyCounter");
  if (counterEl) {
    counterEl.innerHTML = weekNum
      ? `Week ${weekNum} Hours: <span style="color:${color}; font-weight:bold;">${weekHours} / ${maxWeeklyHours}</span>`
      : "";
  }
}

// === SHOW SUMMARY ===
function showSummary(record) {
  const s = document.getElementById("summary");
  s.style.display = "block";

  if (!record || !record.date) {
    s.innerHTML = `<h2>Session Delta Summary</h2><p>No record selected.</p>`;
    return;
  }

  const previousDelta = dailyRecords.length > 1
    ? dailyRecords[dailyRecords.length - 2].delta
    : 0;

  // Delta color
  let deltaColor = "#FFFFFF"; // normal
  if (record.delta <= 0) deltaColor = "#FFFF00"; // lowest
  else if (record.delta > GREAT_DELTA_THRESHOLD) deltaColor = "#00FF00"; // personal highest

  // Delta trend
  let trendLabel = "No previous record", trendColor = "#FFFFFF";
  if (dailyRecords.length > 1) {
    if (record.delta > previousDelta) { trendLabel = "Improved"; trendColor = "#00FF00"; }
    else if (record.delta < previousDelta) { trendLabel = "Declined"; trendColor = "#FFFF00"; }
    else { trendLabel = "Same as before"; trendColor = "#FFFFFF"; }
  }

  // Overall progress
  const totalHours = getTotalHours();
  let overallStatus = totalHours > MASTER_TARGET_HOURS
    ? "OVER 500 HOURS LIMIT!" 
    : `${totalHours} / ${MASTER_TARGET_HOURS} hours completed`;
  let overallColor = (totalHours >= MASTER_TARGET_HOURS) ? "#FF00FF" : "#00FF00"; // highest vs personal

  // Weekly hours
  const weekNum = record.date ? getWeekNumber(new Date(record.date)) : null;
  const weekHours = weekNum ? getWeekHours(weekNum) : 0;
  const maxWeeklyHours = DAILY_TARGET_HOURS * 7;

  let weekColor = "#FFFFFF"; // normal
  if (weekHours < maxWeeklyHours * 0.5) weekColor = "#FFFF00"; // lowest
  else if (weekHours < maxWeeklyHours) weekColor = "#00FF00"; // personal highest
  else weekColor = "#FF00FF"; // highest overall

  s.innerHTML = `
    <h2>Session Delta Summary</h2>

    <p><strong>Date:</strong> ${record.date || "-"}</p>
    <p><strong>Hours Worked:</strong> ${record.hours || "-"}</p>

    <p><strong>Delta:</strong>
      <span style="color:${deltaColor}; font-weight:bold;">
        ${record.delta >= 0 ? "+" : ""}${record.delta?.toFixed(2) || "-"} hours
      </span>
    </p>

    <p><strong>Trend vs Previous:</strong>
      <span style="color:${trendColor}; font-weight:bold;">${trendLabel}</span>
    </p>

    <p><strong>Overall Progress:</strong>
      <span style="color:${overallColor}; font-weight:bold;">${overallStatus}</span>
    </p>

    <p><strong>Weekly Hours:</strong>
      <span style="color:${weekColor}; font-weight:bold;">${weekHours} / ${maxWeeklyHours}</span>
    </p>

    <p><strong>Reflection:</strong></p>
    <p>${record.reflection || ""}</p>

    <p><strong>Accomplishments:</strong></p>
    <ul>${record.accomplishments?.map(a => `<li>${a}</li>`).join("") || ""}</ul>

    <p><strong>Tools Used:</strong> ${record.tools?.join(", ") || ""}</p>
  `;
}

// === UPDATE REFLECTION VIEWER WITH WEEKLY HOURS COUNTER ===
function loadReflectionViewer() {
  const viewer = document.getElementById("reflectionViewer");
  viewer.innerHTML = "";

  if (dailyRecords.length === 0) {
    viewer.innerHTML = `<p class="empty">No reflections saved yet.</p>`;
    return;
  }

  // Current week
  const latestDate = dailyRecords[dailyRecords.length - 1].date;
  const currentWeek = getWeekNumber(new Date(latestDate));
  const maxWeeklyHours = DAILY_TARGET_HOURS * 7;

  const currentWeekHours = dailyRecords
    .filter(r => getWeekNumber(new Date(r.date)) === currentWeek)
    .reduce((sum, r) => sum + r.hours, 0);

  let weekColor = "#FFFFFF";
  if (currentWeekHours < maxWeeklyHours * 0.5) weekColor = "#FFFF00";
  else if (currentWeekHours < maxWeeklyHours) weekColor = "#00FF00";
  else weekColor = "#FF00FF";

  const counterDiv = document.createElement("div");
  counterDiv.id = "weeklyCounterViewer";
  counterDiv.style.marginBottom = "10px";
  counterDiv.innerHTML = `
    <strong>Week ${currentWeek} Hours:</strong>
    <span style="color:${weekColor}; font-weight:bold;">
      ${currentWeekHours} / ${maxWeeklyHours}
    </span>
  `;
  viewer.appendChild(counterDiv);

  // Reflection items
  dailyRecords.forEach((r, i) => {
    let deltaColor = "#FFFFFF";
    if (r.delta <= 0) deltaColor = "#FFFF00";
    else if (r.delta > GREAT_DELTA_THRESHOLD) deltaColor = "#00FF00";

    let trendLabel = "No previous record";
    let trendColor = "#FFFFFF";
    if (i > 0) {
      const prevDelta = dailyRecords[i - 1].delta;
      if (r.delta > prevDelta) { trendLabel = "Improved"; trendColor = "#00FF00"; }
      else if (r.delta < prevDelta) { trendLabel = "Declined"; trendColor = "#FFFF00"; }
      else { trendLabel = "Same as before"; trendColor = "#FFFFFF"; }
    }

    const div = document.createElement("div");
    div.className = "reflection-item";
    div.innerHTML = `
      <strong>${i + 1}. ${r.date}</strong>
      <p>${r.reflection}</p>
      <small>
        Hours: ${r.hours} | 
        Delta: <span style="color:${deltaColor}">${r.delta.toFixed(2)}</span> |
        Trend: <span style="color:${trendColor}">${trendLabel}</span>
      </small>
      <hr>
    `;
    viewer.appendChild(div);
  });

  // Activity visualizer
  const visualizer = document.createElement("div");
  visualizer.id = "activityVisualizer";
  visualizer.style.display = "flex";
  visualizer.style.flexWrap = "wrap";
  visualizer.style.marginTop = "10px";
  viewer.appendChild(visualizer);

  dailyRecords.forEach(r => {
    const daySquare = document.createElement("div");
    daySquare.style.width = "14px";
    daySquare.style.height = "14px";
    daySquare.style.margin = "2px";
    daySquare.style.borderRadius = "3px";

    if (r.delta > GREAT_DELTA_THRESHOLD) daySquare.style.backgroundColor = "#00FF00";
    else if (r.delta > 0) daySquare.style.backgroundColor = "#FFFF00";
    else daySquare.style.backgroundColor = "#FFFFFF";

    daySquare.title = `${r.date} — ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)} hrs`;
    visualizer.appendChild(daySquare);
  });
}

// Display reflections with images
dailyRecords.forEach((r, i) => {
  const div = document.createElement("div");
  div.className = "reflection-item";
  div.innerHTML = `
    <strong>${i + 1}. ${r.date}</strong>
    <p>${r.reflection}</p>
    <small>
      Hours: ${r.hours} | Delta: <span style="color:${deltaColor}">${r.delta.toFixed(2)}</span>
    </small>
    <div class="dtr-images" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:5px;"></div>
    <hr>
  `;
  
  const imagesDiv = div.querySelector(".dtr-images");
  r.images.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.style.width = "80px";
    img.style.height = "80px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "5px";
    imagesDiv.appendChild(img);
  });

  viewer.appendChild(div);
});


// === EXPORT PDF FUNCTIONS ===
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  let y = 15;

  doc.setFontSize(16);
  doc.text("Daily DTR Report", 105, y, { align: "center" });
  y += 10;

  dailyRecords.forEach(r => {
    doc.setFontSize(12);
    doc.text(`Date: ${r.date}`, 10, y); y += 6;
    doc.text(`Hours Worked: ${r.hours}`, 10, y); y += 6;
    doc.text(`Delta: ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)} hours`, 10, y); y += 6;

    doc.text("Reflection:", 10, y); y += 6;
    const lines = doc.splitTextToSize(r.reflection, 180);
    lines.forEach(line => { doc.text(line, 10, y); y += 6; });

    if (r.accomplishments.length) {
      doc.text("Accomplishments:", 10, y); y += 6;
      r.accomplishments.forEach(a => { 
        doc.text("• " + a, 12, y); y += 6;
      });
    }

    if (r.tools.length) {
      doc.text("Tools Used: " + r.tools.join(", "), 10, y); y += 6;
    }

    y += 5;
    if (y > 270) { doc.addPage(); y = 15; }
  });

  doc.save(getTodayFileName("Daily_DTR_Report", "pdf"));
}

// === WEEKLY DTR COMPILER ===
function getWeeklyDTR() {
  const weeks = {};

  dailyRecords.forEach(r => {
    const d = new Date(r.date);
    const week = getWeekNumber(d);

    if (!weeks[week]) {
      weeks[week] = {
        week,
        dateRange: r.date,
        totalHours: 0,
        accomplishments: [],
        tools: new Set()
      };
    }

    weeks[week].totalHours += r.hours;
    r.accomplishments.forEach(a => weeks[week].accomplishments.push({ date: r.date, text: a }));
    r.tools.forEach(t => weeks[week].tools.add(t));
  });

  return Object.values(weeks).map(w => ({ ...w, tools: [...w.tools] }));
}

// === WEEKLY EXPORT PDF ===
function exportWeeklyPDF() {
  if (!dailyRecords.length) return alert("No records to export.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  let y = 15;

  doc.setFontSize(16);
  doc.text("Weekly DTR Report", 105, y, { align: "center" });
  y += 10;

  const weeks = getWeeklyDTR();
  weeks.forEach(w => {
    doc.setFontSize(12);
    doc.text(`Week ${w.week} | Total Hours: ${w.totalHours}`, 10, y); y += 6;
    doc.text("Accomplishments & Tools:", 10, y); y += 6;

    w.accomplishments.forEach(a => {
      doc.splitTextToSize(`• ${a.text}`, 180).forEach(line => { doc.text(line, 12, y); y += 6; });
    });

    if (w.tools.length) {
      doc.text("Tools Used: " + w.tools.join(", "), 12, y); y += 6;
    }

    y += 5;
    if (y > 270) { doc.addPage(); y = 15; }
  });

  doc.save(getTodayFileName("Weekly_DTR_Report", "pdf"));
}

// === PAGE LOAD ===
window.onload = () => {
  dailyRecords = JSON.parse(localStorage.getItem("dtr")) || [];
  loadReflectionViewer();
  if (dailyRecords.length) {
    showSummary(dailyRecords[dailyRecords.length - 1]);
    updateWeeklyCounter(dailyRecords[dailyRecords.length - 1].date);
  } else {
    showSummary({});
    updateWeeklyCounter();
  }
};

// Preview selected images
document.getElementById("images").addEventListener("change", function () {
  const preview = document.getElementById("imagePreview");
  preview.innerHTML = "";
  const files = Array.from(this.files);

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.width = "80px";
      img.style.height = "80px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "5px";
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
});
