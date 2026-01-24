// Data State
let trail = JSON.parse(localStorage.getItem("trail_pro_v22")) || [];
let reminders = JSON.parse(localStorage.getItem("rem_pro_v22")) || [];
let categories = JSON.parse(localStorage.getItem("cats_pro_v22")) || ["Food", "Rent", "Salary", "Shopping", "Health"];
let charts = {};

/* ---------- INITIALIZATION ---------- */
function init() {
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
    populateCategories();
    updateUI();
    checkMonthlyRecurring(); // Fixed naming inconsistency
}

/* ---------- UI ACTIONS ---------- */
function toast(msg, type = "success") {
    const container = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = "toast";
    const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";
    el.innerHTML = `<i class="fas ${icon}" style="color: ${type === 'success' ? 'var(--income)' : 'var(--expense)'}"></i><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateX(50px)";
        setTimeout(() => el.remove(), 500);
    }, 3000);
}

function askConfirm(title, msg) {
    return new Promise((resolve) => {
        const modal = document.getElementById("customModal");
        document.getElementById("modalTitle").innerText = title;
        document.getElementById("modalText").innerText = msg;
        modal.style.display = "flex";
        document.getElementById("modalConfirm").onclick = () => { modal.style.display="none"; resolve(true); };
        document.getElementById("modalCancel").onclick = () => { modal.style.display="none"; resolve(false); };
    });
}

/* ---------- GLOBAL ATTACHMENTS ---------- */
window.delEntry = async function(id, pool) {
    const ok = await askConfirm("Delete Record?", "This will be removed permanently.");
    if (ok) {
        if (pool === 'trail') trail = trail.filter(t => t.id !== id);
        else reminders = reminders.filter(r => r.id !== id);
        save(); updateUI(); toast("Deleted", "error");
    }
};

window.payRem = function(id) {
    const idx = reminders.findIndex(r => r.id === id);
    const item = reminders.splice(idx, 1)[0];
    trail.push({ ...item, id: Date.now(), date: new Date().toISOString().split('T')[0] });
    save(); updateUI(); toast("Bill Recorded!", "success");
};

window.delCat = async function(name) {
    if (await askConfirm("Delete Category?", `Remove "${name}" from shortcuts?`)) {
        categories = categories.filter(c => c !== name);
        save(); populateCategories(); updateUI(); toast("Category Deleted", "error");
    }
};

/* ---------- SMART VOICE PARSER ---------- */
const voiceBtn = document.getElementById("voiceBtn");
let isListening = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
        parseVoice(text);
    };
    recognition.onend = () => { if (isListening) recognition.start(); };

    voiceBtn.onclick = () => {
        isListening = !isListening;
        voiceBtn.classList.toggle("listening", isListening);
        if (isListening) { recognition.start(); toast("Voice Listening...", "success"); }
        else { recognition.stop(); toast("Voice OFF"); }
    };
}

function parseVoice(text) {
    const amount = text.match(/\d+/);
    if (amount) document.getElementById("amount").value = amount[0];
    if (["income", "salary"].some(k => text.includes(k))) { document.getElementById("type").value = "income"; populateCategories(); }
    if (["expense", "spent"].some(k => text.includes(k))) { document.getElementById("type").value = "expense"; populateCategories(); }
    const match = categories.find(c => text.includes(c.toLowerCase()));
    if (match) document.getElementById("category").value = match;

    let d = new Date();
    if (text.includes("yesterday")) d.setDate(d.getDate() - 1);
    else {
        const dayMatch = text.match(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/);
        const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const mIndex = months.findIndex(m => text.includes(m));
        if (dayMatch && mIndex !== -1) d = new Date(new Date().getFullYear(), mIndex, dayMatch[1]);
    }
    document.getElementById("date").value = d.toISOString().split('T')[0];
    toast("Voice Match Applied");
}

/* ---------- CORE ENGINE ---------- */
function updateUI() {
    const filtered = filterData();
    const inc = trail.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const exp = trail.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    
    document.getElementById("balance").textContent = `₹${(inc - exp).toLocaleString()}`;
    document.getElementById("income").textContent = `₹${inc.toLocaleString()}`;
    document.getElementById("expense").textContent = `₹${exp.toLocaleString()}`;
    
    document.getElementById("transactionList").innerHTML = filtered.slice(0, 15).map(t => `
        <li class="${t.type}-item">
            <div>${t.category || 'Income'}<br><small style="color:var(--text-dim); font-size:0.7rem">${t.date}</small></div>
            <div style="display:flex; align-items:center; gap:12px;">
                ₹${t.amount.toLocaleString()}
                <button onclick="delEntry(${t.id}, 'trail')" class="cat-del-btn"><i class="fas fa-trash-can"></i></button>
            </div>
        </li>`).join('');

    document.getElementById("reminderList").innerHTML = reminders.map(r => `
        <li style="border-left-color: var(--primary)">
            <span>${r.date}: ${r.category} (₹${r.amount})</span>
            <div style="display:flex; align-items:center;">
                <button onclick="payRem(${r.id})" style="color:var(--income); border:none; background:none; cursor:pointer; font-size:1.4rem; margin-right:10px;"><i class="fas fa-circle-check"></i></button>
                <button onclick="delEntry(${r.id}, 'rem')" class="cat-del-btn"><i class="fas fa-trash-can"></i></button>
            </div>
        </li>`).join('') || "<li>No pending reminders</li>";

    initCharts(filtered);
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

function runMoM() {
    const thisMonthStr = new Date().toISOString().slice(5, 7);
    const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().slice(5, 7);
    const getExp = (m) => trail.filter(t => t.type === 'expense' && t.date.slice(5, 7) === m).reduce((s,t) => s + t.amount, 0);
    const cur = getExp(thisMonthStr), prev = getExp(lastMonthStr);
    const statEl = document.getElementById("comparisonStat");
    if (prev > 0) {
        const diff = ((cur - prev) / prev) * 100;
        statEl.textContent = `${diff > 0 ? '+' : ''}${Math.round(diff)}%`;
        statEl.style.color = diff > 0 ? 'var(--expense)' : 'var(--income)';
    } else statEl.textContent = "0%";
}

/* ---------- CHART LOGIC ---------- */
function initCharts(data) {
    Object.values(charts).forEach(c => { if(c && c.canvas.id !== 'historyBarChart') c.destroy(); });
    const curMonth = new Date().toISOString().slice(0, 7);
    document.getElementById("currentMonthLabel").innerText = `Summary: ${new Date().toLocaleString('default', { month: 'long' })}`;

    const expData = data.filter(t => t.type === 'expense');
    const catMap = {}; expData.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);

    charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
    });

    const weekly = new Array(7).fill(0); expData.forEach(t => weekly[new Date(t.date).getDay()] += t.amount);
    charts.weekly = new Chart(document.getElementById('weeklyChart'), {
        type: 'line', data: { labels: ['S','M','T','W','T','F','S'], datasets: [{ label:'Spent', data: weekly, borderColor:'#6366f1', tension: 0.4, fill: true, backgroundColor: 'rgba(99, 102, 241, 0.05)' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const curInc = trail.filter(t => t.type === 'income' && t.date.startsWith(curMonth)).reduce((s,t) => s + t.amount, 0);
    const curExp = trail.filter(t => t.type === 'expense' && t.date.startsWith(curMonth)).reduce((s,t) => s + t.amount, 0);
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar', data: { labels: ['Income', 'Expenditure'], datasets: [{ data: [curInc, curExp], backgroundColor: ['#22c55e', '#ef4444'], borderRadius: 12 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderInsights() {
    document.getElementById("fullHistoryList").innerHTML = trail.map(t => `<li class="${t.type}-item"><div>${t.category || 'General'}<br><small>${t.date}</small></div><b>₹${t.amount.toLocaleString()}</b></li>`).join('');
    if (charts.history) charts.history.destroy();
    const monthly = {};
    trail.forEach(t => { const m = t.date.slice(0, 7); if(!monthly[m]) monthly[m] = {i:0, e:0}; t.type === 'income' ? monthly[m].i += t.amount : monthly[m].e += t.amount; });
    const mLabels = Object.keys(monthly).sort();
    charts.history = new Chart(document.getElementById('historyBarChart'), {
        type: 'bar', data: { labels: mLabels, datasets: [{ label:'In', data:mLabels.map(m=>monthly[m].i), backgroundColor:'#22c55e' },{ label:'Out', data:mLabels.map(m=>monthly[m].e), backgroundColor:'#ef4444' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ---------- CAT MANAGEMENT ---------- */
function populateCategories() {
    const type = document.getElementById("type").value;
    const sorted = [...categories].sort();
    document.getElementById("category").innerHTML = (type === 'income' ? '<option value="">(None)</option>' : '') + sorted.map(c => `<option value="${c}">${c}</option>`).join('') + `<option value="custom">+ New Category</option>`;
    document.getElementById("filterCategory").innerHTML = `<option value="all">All Categories</option>` + sorted.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById("manageCatsList").innerHTML = sorted.map(c => `<li class="cat-pill"><span>${c}</span><button onclick="delCat('${c}')" class="cat-del-btn"><i class="fas fa-xmark"></i></button></li>`).join('');
}

/* ---------- STORAGE ---------- */
function save() {
    localStorage.setItem("trail_pro_v22", JSON.stringify(trail));
    localStorage.setItem("rem_pro_v22", JSON.stringify(reminders));
    localStorage.setItem("cats_pro_v22", JSON.stringify(categories));
}

document.getElementById("transactionForm").onsubmit = (e) => {
    e.preventDefault();
    const type = document.getElementById("type").value;
    const catVal = document.getElementById("category").value;
    const finalCat = (catVal === 'custom') ? document.getElementById("customCategory").value : catVal;
    if (catVal === 'custom' && finalCat && !categories.includes(finalCat)) { categories.push(finalCat); populateCategories(); }
    const entry = { id: Date.now(), type, amount: parseFloat(document.getElementById("amount").value), date: document.getElementById("date").value, category: (type === 'income' && !finalCat) ? "" : (finalCat || "General"), description: document.getElementById("description").value };
    if (document.getElementById("isReminder").checked) { reminders.push(entry); toast("Reminder Saved"); }
    else { trail.push(entry); toast("Saved Successfully"); }
    save(); updateUI(); e.target.reset();
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
};

function checkMonthlyRecurring() {
    if (new Date().getDate() === 1) {
        trail.filter(t => t.recurring && !t.autoAdded).forEach(t => {
            trail.push({ ...t, id: Date.now(), date: new Date().toISOString().split('T')[0], autoAdded: true });
        });
        save();
    }
}

document.getElementById("backupBtn").onclick = () => {
    const blob = new Blob([JSON.stringify({ trail, reminders, categories })], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `MoneyTrail_Backup.json`; link.click();
    toast("Backup Created");
};

document.getElementById("restoreInput").onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imp = JSON.parse(ev.target.result);
            trail = imp.trail || []; reminders = imp.reminders || []; categories = imp.categories || categories;
            save(); updateUI(); populateCategories(); toast("Restored!", "success");
        } catch { toast("Invalid File", "error"); }
    };
    reader.readAsText(e.target.files[0]);
};

/* ---------- SERVICE WORKER ---------- */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('PWA Failed', err));
    });
}

document.getElementById("showInsights").onclick = () => { document.getElementById("dashboardView").style.display = "none"; document.getElementById("insightsView").style.display = "block"; renderInsights(); };
document.getElementById("backToDash").onclick = () => { document.getElementById("insightsView").style.display = "none"; document.getElementById("dashboardView").style.display = "block"; updateUI(); };
document.getElementById("resetAppBtn").onclick = async () => { if (await askConfirm("Wipe Data?", "All history will be erased!")) { trail=[]; reminders=[]; save(); updateUI(); } };
document.getElementById("darkModeToggle").onclick = () => document.body.classList.toggle("dark");
document.getElementById("type").onchange = populateCategories;
document.getElementById("category").onchange = e => document.getElementById("customCategoryGroup").style.display = e.target.value === 'custom' ? 'block' : 'none';
["searchInput", "filterType", "filterCategory"].forEach(id => document.getElementById(id).addEventListener("input", updateUI));

init();