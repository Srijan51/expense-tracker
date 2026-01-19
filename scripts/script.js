// Data State
let trailData = JSON.parse(localStorage.getItem("trail_v9")) || [];
let pendingBills = JSON.parse(localStorage.getItem("bills_v9")) || [];
let cats = JSON.parse(localStorage.getItem("cats_v9")) || ["Food", "Rent", "Salary", "Shopping", "Transport", "Health"];
let charts = {};

/* ---------- INITIALIZATION ---------- */
function init() {
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
    populateDropdowns();
    updateUI();
}

/* ---------- SMART VOICE TOGGLE & PARSER ---------- */
const voiceBtn = document.getElementById("voiceBtn");
let isListening = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        parseSmartVoice(transcript);
    };

    recognition.onend = () => { if (isListening) recognition.start(); };

    voiceBtn.onclick = () => {
        if (!isListening) {
            recognition.start();
            isListening = true;
            voiceBtn.classList.add("listening");
            notify("Listening... Speak naturally!");
        } else {
            isListening = false;
            recognition.stop();
            voiceBtn.classList.remove("listening");
            notify("Voice Entry Stopped");
        }
    };
}

function parseSmartVoice(text) {
    console.log("Analyzing Voice:", text);

    // 1. Amount Extraction
    const amountMatch = text.match(/\d+/);
    if (amountMatch) document.getElementById("amount").value = amountMatch[0];

    // 2. Type Detection
    if (["income", "salary", "earned"].some(k => text.includes(k))) document.getElementById("type").value = "income";
    if (["expenditure", "expense", "spent", "paid"].some(k => text.includes(k))) document.getElementById("type").value = "expense";

    // 3. Category Search
    const foundCat = cats.find(c => text.includes(c.toLowerCase()));
    if (foundCat) document.getElementById("category").value = foundCat;

    // 4. ROBUST DATE RECONSTRUCTOR
    let dateToSet = new Date();
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    
    if (text.includes("yesterday")) {
        dateToSet.setDate(dateToSet.getDate() - 1);
    } else if (text.includes("tomorrow")) {
        dateToSet.setDate(dateToSet.getDate() + 1);
    } else {
        // Find a day (1-31) and a month name
        const dayMatch = text.match(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/);
        const monthIndex = months.findIndex(m => text.includes(m));

        if (dayMatch && monthIndex !== -1) {
            dateToSet = new Date(new Date().getFullYear(), monthIndex, dayMatch[1]);
        }
    }
    document.getElementById("date").value = dateToSet.toISOString().split('T')[0];
    notify("Form Updated!");
}

/* ---------- UI ENGINE ---------- */
function updateUI() {
    const filtered = filterData();
    const inc = trailData.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const exp = trailData.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    
    document.getElementById("balance").textContent = `₹${(inc - exp).toLocaleString()}`;
    document.getElementById("income").textContent = `₹${inc.toLocaleString()}`;
    document.getElementById("expense").textContent = `₹${exp.toLocaleString()}`;
    
    renderList(filtered);
    renderReminders();
    initCharts(filtered);
}

function filterData() {
    let data = [...trailData];
    const search = document.getElementById("searchInput").value.toLowerCase();
    const typeF = document.getElementById("filterType").value;
    if (typeF !== "all") data = data.filter(t => t.type === typeF);
    data = data.filter(t => t.category.toLowerCase().includes(search) || (t.description || "").toLowerCase().includes(search));
    return data.sort((a,b) => b.id - a.id);
}

function renderList(data) {
    document.getElementById("transactionList").innerHTML = data.slice(0, 25).map(t => `
        <li class="${t.type}">
            <div><b>${t.category}</b><br><small>${t.date}</small></div>
            <div style="display:flex; align-items:center; gap:10px;">
                <b>₹${t.amount.toLocaleString()}</b>
                <button onclick="removeEntry(${t.id}, 'trail')" class="delete-btn"><i class="fas fa-trash"></i></button>
            </div>
        </li>`).join('');
}

function renderReminders() {
    document.getElementById("reminderList").innerHTML = pendingBills.map(b => `
        <li style="border-left: 5px solid var(--primary)">
            <span>${b.date}: ${b.category} (₹${b.amount})</span>
            <div style="display:flex; gap:10px;">
                <button onclick="payBill(${b.id})" style="color:var(--income); border:none; background:none; cursor:pointer"><i class="fas fa-check-circle"></i></button>
                <button onclick="removeEntry(${b.id}, 'bill')" class="delete-btn"><i class="fas fa-trash"></i></button>
            </div>
        </li>`).join('') || "<li>No pending bills</li>";
}

function payBill(id) {
    const idx = pendingBills.findIndex(b => b.id === id);
    const bill = pendingBills.splice(idx, 1)[0];
    trailData.push({ ...bill, id: Date.now(), date: new Date().toISOString().split('T')[0] });
    save(); updateUI();
}

function removeEntry(id, pool) {
    if (pool === 'trail') trailData = trailData.filter(t => t.id !== id);
    else pendingBills = pendingBills.filter(b => b.id !== id);
    save(); updateUI();
}

/* ---------- CHARTS ---------- */
function initCharts(data) {
    Object.values(charts).forEach(c => c && c.destroy());
    const expData = data.filter(t => t.type === 'expense');
    
    // Pie
    const catMap = {}; expData.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);
    charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Weekly
    const weekly = new Array(7).fill(0); expData.forEach(t => weekly[new Date(t.date).getDay()] += t.amount);
    charts.weekly = new Chart(document.getElementById('weeklyChart'), {
        type: 'line', data: { labels: ['S','M','T','W','T','F','S'], datasets: [{ label:'Spent', data: weekly, borderColor:'#6366f1', tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Monthly Bar
    const monthly = {}; trailData.forEach(t => { const m = t.date.slice(0, 7); if(!monthly[m]) monthly[m] = {i:0, e:0}; t.type === 'income' ? monthly[m].i += t.amount : monthly[m].e += t.amount; });
    const mLabels = Object.keys(monthly).sort();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar', data: { labels: mLabels, datasets: [ { label:'Income', data:mLabels.map(m=>monthly[m].i), backgroundColor:'#10b981' }, { label:'Expense', data:mLabels.map(m=>monthly[m].e), backgroundColor:'#ef4444' } ]},
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ---------- EVENTS & UTILS ---------- */
document.getElementById("transactionForm").onsubmit = (e) => {
    e.preventDefault();
    const catVal = document.getElementById("category").value;
    const finalCat = (catVal === 'custom') ? document.getElementById("customCategory").value : catVal;

    const entry = {
        id: Date.now(),
        type: document.getElementById("type").value,
        amount: parseFloat(document.getElementById("amount").value),
        date: document.getElementById("date").value,
        category: finalCat || "General",
        description: document.getElementById("description").value,
        recurring: document.getElementById("isRecurring").checked
    };

    if (catVal === 'custom' && finalCat) { cats.push(finalCat); populateDropdowns(); }
    if (document.getElementById("isReminder").checked) pendingBills.push(entry);
    else trailData.push(entry);

    save(); updateUI(); e.target.reset();
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
};

function populateDropdowns() {
    const list = cats.sort().map(c => `<option value="${c}">${c}</option>`).join('') + `<option value="custom">+ New Category</option>`;
    document.getElementById("category").innerHTML = list;
    document.getElementById("manageCatsList").innerHTML = cats.map(c => `<li class="cat-item"><span>${c}</span></li>`).join('');
}

function notify(msg) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function save() {
    localStorage.setItem("trail_v9", JSON.stringify(trailData));
    localStorage.setItem("bills_v9", JSON.stringify(pendingBills));
    localStorage.setItem("cats_v9", JSON.stringify(cats));
}

document.getElementById("resetAppBtn").onclick = () => {
    const overlay = document.getElementById("modalOverlay");
    document.getElementById("modalTitle").innerText = "Clear All Data?";
    document.getElementById("modalText").innerText = "This will permanently delete your entire history.";
    overlay.style.display = "flex";
    document.getElementById("modalConfirm").onclick = () => { localStorage.clear(); location.reload(); };
    document.getElementById("modalCancel").onclick = () => overlay.style.display = "none";
};

document.getElementById("category").onchange = e => document.getElementById("customCategoryGroup").style.display = e.target.value === 'custom' ? 'block' : 'none';
document.getElementById("darkModeToggle").onclick = () => document.body.classList.toggle("dark");
["searchInput", "filterType"].forEach(id => document.getElementById(id).addEventListener("input", updateUI));

init();