// State Management
let trail = JSON.parse(localStorage.getItem("mt_v17_history")) || [];
let reminders = JSON.parse(localStorage.getItem("mt_v17_reminders")) || [];
let cats = JSON.parse(localStorage.getItem("mt_v17_cats")) || ["Food", "Rent", "Salary", "Shopping", "Health"];
let charts = {};

/* ---------- INITIALIZATION ---------- */
function init() {
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
    populateCategories();
    updateUI();
}

/* ---------- CUSTOM UI POPUPS ---------- */
function toast(msg) {
    const container = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerText = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function confirmModal(title, msg) {
    return new Promise((resolve) => {
        const modal = document.getElementById("customModal");
        document.getElementById("modalTitle").innerText = title;
        document.getElementById("modalText").innerText = msg;
        modal.style.display = "flex";
        document.getElementById("modalConfirm").onclick = () => { modal.style.display = "none"; resolve(true); };
        document.getElementById("modalCancel").onclick = () => { modal.style.display = "none"; resolve(false); };
    });
}

/* ---------- SMART VOICE PARSER ---------- */
const voiceBtn = document.getElementById("voiceBtn");
let recognitionActive = false;

if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
        parseVoice(text);
    };
    recognition.onend = () => { if (recognitionActive) recognition.start(); };

    voiceBtn.onclick = function() {
        recognitionActive = !recognitionActive;
        this.classList.toggle("listening", recognitionActive);
        if (recognitionActive) { recognition.start(); toast("Voice Listening..."); }
        else { recognition.stop(); toast("Voice Off"); }
    };
}

function parseVoice(text) {
    const amount = text.match(/\d+/);
    if (amount) document.getElementById("amount").value = amount[0];

    if (["income", "salary", "earned"].some(k => text.includes(k))) {
        document.getElementById("type").value = "income";
        populateCategories(); // Refresh categories to show "None" option
    }
    if (["expense", "expenditure", "spent", "paid"].some(k => text.includes(k))) {
        document.getElementById("type").value = "expense";
        populateCategories();
    }

    const catMatch = cats.find(c => text.includes(c.toLowerCase()));
    if (catMatch) document.getElementById("category").value = catMatch;

    let d = new Date();
    if (text.includes("yesterday")) d.setDate(d.getDate() - 1);
    else {
        const dayMatch = text.match(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/);
        const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const monthIndex = months.findIndex(m => text.includes(m));
        if (dayMatch && monthIndex !== -1) d = new Date(new Date().getFullYear(), monthIndex, dayMatch[1]);
    }
    document.getElementById("date").value = d.toISOString().split('T')[0];
    toast("Updated via Voice");
}

/* ---------- REBUILT HEATMAP ENGINE ---------- */
function renderHeatmap() {
    const container = document.getElementById("heatmapContainer");
    container.innerHTML = "";
    
    // Create map for O(1) daily spending lookup
    const dailySpend = {};
    trail.filter(t => t.type === 'expense').forEach(t => {
        dailySpend[t.date] = (dailySpend[t.date] || 0) + t.amount;
    });

    // Generate grid for last 180 days (6 months approx)
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 180);

    for (let i = 0; i <= 180; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        
        // standard format YYYY-MM-DD
        const dateStr = d.toISOString().split('T')[0];
        const amt = dailySpend[dateStr] || 0;

        let level = 0;
        if (amt > 0) level = 1;
        if (amt > 1000) level = 2;
        if (amt > 5000) level = 3;

        const dayBox = document.createElement("div");
        dayBox.className = `heatmap-day level-${level}`;
        dayBox.title = `${dateStr}: ₹${amt.toLocaleString()}`;
        container.appendChild(dayBox);
    }
    
    document.getElementById("heatmapStatus").innerText = `Tracking ${trail.length} records`;
}

/* ---------- ANALYTICS (MoM) ---------- */
function runMoM() {
    const thisMonth = new Date().getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const getExp = (m) => trail.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === m).reduce((s,t) => s + t.amount, 0);
    
    const cur = getExp(thisMonth), prev = getExp(lastMonth);
    const statEl = document.getElementById("comparisonStat");
    
    if (prev > 0) {
        const diff = ((cur - prev) / prev) * 100;
        statEl.textContent = `${diff > 0 ? '+' : ''}${Math.round(diff)}%`;
        statEl.style.color = diff > 0 ? 'var(--expense)' : 'var(--income)';
    } else statEl.textContent = "0%";
}

/* ---------- CORE UI ENGINE ---------- */
function updateUI() {
    const filtered = filterData();
    const inc = trail.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const exp = trail.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    
    document.getElementById("balance").textContent = `₹${(inc - exp).toLocaleString()}`;
    document.getElementById("income").textContent = `₹${inc.toLocaleString()}`;
    document.getElementById("expense").textContent = `₹${exp.toLocaleString()}`;
    
    document.getElementById("transactionList").innerHTML = filtered.slice(0, 20).map(t => `
        <li class="${t.type}">
            <div>${t.category || 'Income Entry'}<br><small style="color:var(--text-muted); font-size:0.7rem">${t.date}</small></div>
            <div style="display:flex; align-items:center; gap:10px;">
                ₹${t.amount.toLocaleString()}
                <button onclick="delEntry(${t.id}, 'trail')" class="cat-del-btn"><i class="fas fa-trash"></i></button>
            </div>
        </li>`).join('');

    document.getElementById("reminderList").innerHTML = reminders.map(r => `
        <li style="border-left-color: var(--primary)">
            <span>${r.date}: ${r.category} (₹${r.amount})</span>
            <div>
                <button onclick="payRem(${r.id})" style="color:var(--income); border:none; background:none; cursor:pointer; font-size:1.2rem; margin-right:10px;"><i class="fas fa-check-circle"></i></button>
                <button onclick="delEntry(${r.id}, 'rem')" class="cat-del-btn"><i class="fas fa-trash"></i></button>
            </div>
        </li>`).join('') || "<li>No pending reminders</li>";

    initCharts(filtered);
    renderHeatmap();
    runMoM();
}

function filterData() {
    let data = [...trail];
    const search = document.getElementById("searchInput").value.toLowerCase();
    const typeF = document.getElementById("filterType").value;
    const catF = document.getElementById("filterCategory").value;
    if (typeF !== 'all') data = data.filter(t => t.type === typeF);
    if (catF !== 'all') data = data.filter(t => t.category === catF);
    data = data.filter(t => (t.category || "").toLowerCase().includes(search) || (t.description || "").toLowerCase().includes(search));
    return data.sort((a,b) => b.id - a.id);
}

/* ---------- CAT MANAGEMENT ---------- */
function populateCategories() {
    const type = document.getElementById("type").value;
    const sorted = [...cats].sort();
    
    // Income doesn't need a category (adds 'None' option)
    document.getElementById("category").innerHTML = (type === 'income' ? '<option value="">None (General Income)</option>' : '') + 
        sorted.map(c => `<option value="${c}">${c}</option>`).join('') + `<option value="custom">+ New Category</option>`;
    
    document.getElementById("filterCategory").innerHTML = `<option value="all">All Categories</option>` + sorted.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById("manageCatsList").innerHTML = sorted.map(c => `<li class="cat-item"><span>${c}</span><button onclick="delCat('${c}')" class="cat-del-btn"><i class="fas fa-trash-can"></i></button></li>`).join('');
}

async function delCat(name) {
    if (await confirmModal("Delete Category?", `Remove "${name}"?`)) {
        cats = cats.filter(c => c !== name); save(); populateCategories(); updateUI();
    }
}

/* ---------- STORAGE & CORE ACTIONS ---------- */
function save() {
    localStorage.setItem("mt_v17_history", JSON.stringify(trail));
    localStorage.setItem("mt_v17_reminders", JSON.stringify(reminders));
    localStorage.setItem("mt_v17_cats", JSON.stringify(cats));
}

document.getElementById("transactionForm").onsubmit = (e) => {
    e.preventDefault();
    const type = document.getElementById("type").value;
    const catVal = document.getElementById("category").value;
    const finalCat = (catVal === 'custom') ? document.getElementById("customCategory").value : catVal;

    if (catVal === 'custom' && finalCat && !cats.includes(finalCat)) { cats.push(finalCat); populateCategories(); }

    const entry = {
        id: Date.now(),
        type: type,
        amount: parseFloat(document.getElementById("amount").value),
        date: document.getElementById("date").value,
        category: (type === 'income' && !finalCat) ? "" : (finalCat || "General"),
        description: document.getElementById("description").value
    };

    if (document.getElementById("isReminder").checked) reminders.push(entry);
    else trail.push(entry);

    save(); updateUI(); e.target.reset();
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
    toast("Trail Saved!");
};

async function delEntry(id, pool) {
    if (await confirmModal("Delete?", "Remove permanently?")) {
        if (pool === 'trail') trail = trail.filter(t => t.id !== id);
        else reminders = reminders.filter(r => r.id !== id);
        save(); updateUI(); toast("Deleted");
    }
}

function payRem(id) {
    const idx = reminders.findIndex(r => r.id === id);
    const item = reminders.splice(idx, 1)[0];
    trail.push({ ...item, id: Date.now(), date: new Date().toISOString().split('T')[0] });
    save(); updateUI(); toast("Paid!");
}

/* ---------- CHARTS (VIBRANT COLORS) ---------- */
function initCharts(data) {
    Object.values(charts).forEach(c => c && c.destroy());
    const expData = data.filter(t => t.type === 'expense');
    const catMap = {}; expData.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);

    charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const weekly = new Array(7).fill(0); expData.forEach(t => weekly[new Date(t.date).getDay()] += t.amount);
    charts.weekly = new Chart(document.getElementById('weeklyChart'), {
        type: 'line', data: { labels: ['S','M','T','W','T','F','S'], datasets: [{ label:'Spent', data: weekly, borderColor:'#6366f1', tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const monthly = {}; trail.forEach(t => { const m = t.date.slice(0, 7); if(!monthly[m]) monthly[m] = {i:0, e:0}; t.type === 'income' ? monthly[m].i += t.amount : monthly[m].e += t.amount; });
    const mLabels = Object.keys(monthly).sort();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar', data: { labels: mLabels, datasets: [ 
            { label:'Income', data: mLabels.map(m=>monthly[m].i), backgroundColor:'#22c55e' }, 
            { label:'Expenditure', data: mLabels.map(m=>monthly[m].e), backgroundColor:'#ef4444' } 
        ]},
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ---------- BACKUP SYSTEM ---------- */
document.getElementById("backupBtn").onclick = () => {
    const data = { trail, reminders, cats };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MoneyTrail_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
};

document.getElementById("restoreInput").onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imp = JSON.parse(ev.target.result);
            trail = imp.trail || []; reminders = imp.reminders || []; cats = imp.cats || cats;
            save(); updateUI(); populateCategories(); toast("Restored!");
        } catch { toast("Invalid Backup File"); }
    };
    reader.readAsText(e.target.files[0]);
};

document.getElementById("type").onchange = populateCategories;
document.getElementById("category").onchange = e => document.getElementById("customCategoryGroup").style.display = e.target.value === 'custom' ? 'block' : 'none';
document.getElementById("darkModeToggle").onclick = () => document.body.classList.toggle("dark");
document.getElementById("resetAppBtn").onclick = async () => { if (await confirmModal("Wipe Everything?", "This is permanent!")) { trail=[]; reminders=[]; save(); updateUI(); } };
["searchInput", "filterType", "filterCategory"].forEach(id => document.getElementById(id).addEventListener("input", updateUI));

init();