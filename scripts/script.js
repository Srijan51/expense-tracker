// Data Persistence
let trail = JSON.parse(localStorage.getItem("moneytrail_v6")) || [];
let pendingBills = JSON.parse(localStorage.getItem("mt_bills_v6")) || [];
let cats = JSON.parse(localStorage.getItem("mt_cats_v6")) || ["Food", "Rent", "Salary", "Shopping", "Transport", "Entertainment", "Health"];
let charts = {};

/* ---------- INITIALIZATION ---------- */
function init() {
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
    populateDropdowns();
    updateUI();
}

/* ---------- SMART VOICE PARSER ---------- */
const voiceBtn = document.getElementById("voiceBtn");

if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-IN';

    recognition.onstart = () => notify("Listening... Just speak naturally!", 2000);
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log("Speech recognized:", transcript);
        parseNaturalLanguage(transcript);
    };

    voiceBtn.onclick = () => recognition.start();
}

function parseNaturalLanguage(text) {
    // 1. Extract Amount (First number found)
    const amountMatch = text.match(/\d+/);
    if (amountMatch) document.getElementById("amount").value = amountMatch[0];

    // 2. Extract Type (Expenditure vs Income)
    const expWords = ["expenditure", "expense", "spent", "spending", "paid", "gave"];
    const incWords = ["income", "salary", "earned", "got", "received"];
    
    if (expWords.some(w => text.includes(w))) {
        document.getElementById("type").value = "expense";
    } else if (incWords.some(w => text.includes(w))) {
        document.getElementById("type").value = "income";
    }

    // 3. Extract Category (Search for existing categories in string)
    const foundCat = cats.find(c => text.includes(c.toLowerCase()));
    if (foundCat) {
        document.getElementById("category").value = foundCat;
    } else {
        // Fallback for Custom if "for [something]" pattern is used
        const customMatch = text.match(/for (.*?) (and|at|on|$)/);
        if (customMatch) {
            document.getElementById("category").value = "custom";
            document.getElementById("customCategoryGroup").style.display = "block";
            document.getElementById("customCategory").value = customCategory.value = customMatch[1].trim();
        }
    }

    // 4. Extract Date
    if (text.includes("yesterday")) {
        let d = new Date(); d.setDate(d.getDate() - 1);
        document.getElementById("date").value = d.toISOString().split('T')[0];
    } else if (text.includes("tomorrow")) {
        let d = new Date(); d.setDate(d.getDate() + 1);
        document.getElementById("date").value = d.toISOString().split('T')[0];
    }

    notify("Voice recognized! Check the form and hit save.", 4000);
}

/* ---------- STYLISH NOTIFICATIONS ---------- */
function notify(msg, duration = 3000) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

function askConfirmation(title, text, onConfirm) {
    const overlay = document.getElementById("modalOverlay");
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalText").innerText = text;
    overlay.style.display = "flex";

    document.getElementById("modalConfirm").onclick = () => {
        onConfirm();
        overlay.style.display = "none";
    };
    document.getElementById("modalCancel").onclick = () => overlay.style.display = "none";
}

/* ---------- CORE ENGINE ---------- */
function updateUI() {
    const filtered = filterData();
    calculateDashboard(filtered);
    renderList(filtered);
    renderBills();
    initCharts(filtered);
}

function calculateDashboard(data) {
    const inc = trail.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
    const exp = trail.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    document.getElementById("balance").textContent = `₹${(inc - exp).toLocaleString()}`;
    document.getElementById("income").textContent = `₹${inc.toLocaleString()}`;
    document.getElementById("expense").textContent = `₹${exp.toLocaleString()}`;
}

function filterData() {
    let data = [...trail];
    const search = document.getElementById("searchInput").value.toLowerCase();
    const typeF = document.getElementById("filterType").value;
    
    if (typeF !== "all") data = data.filter(t => t.type === typeF);
    data = data.filter(t => t.category.toLowerCase().includes(search) || (t.description || "").toLowerCase().includes(search));
    
    return data.sort((a,b) => b.id - a.id);
}

function renderList(data) {
    document.getElementById("transactionList").innerHTML = data.slice(0, 20).map(t => `
        <li class="${t.type}">
            <div><b>${t.category}</b><br><small>${t.date}</small></div>
            <div>${t.type === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()} 
            <button onclick="deleteEntry(${t.id}, 'trail')" class="delete-btn"><i class="fas fa-trash"></i></button></div>
        </li>`).join('');
}

function renderBills() {
    document.getElementById("reminderList").innerHTML = pendingBills.map(b => `
        <li style="border-left: 5px solid var(--primary)">
            <span>${b.date}: ${b.category} (₹${b.amount})</span>
            <div>
                <button onclick="payBill(${b.id})" style="color:var(--income); border:none; background:none; cursor:pointer"><i class="fas fa-check-circle"></i></button>
                <button onclick="deleteEntry(${b.id}, 'bill')" style="color:var(--expense); border:none; background:none; cursor:pointer; margin-left:10px;"><i class="fas fa-trash-alt"></i></button>
            </div>
        </li>`).join('') || "<li>All caught up!</li>";
}

function payBill(id) {
    const idx = pendingBills.findIndex(b => b.id === id);
    const bill = pendingBills.splice(idx, 1)[0];
    trail.push({ ...bill, id: Date.now(), date: new Date().toISOString().split('T')[0] });
    save(); updateUI(); notify("Bill Paid & Recorded!");
}

function deleteEntry(id, type) {
    if (type === 'trail') trail = trail.filter(t => t.id !== id);
    else pendingBills = pendingBills.filter(b => b.id !== id);
    save(); updateUI();
}

/* ---------- FORM & EXPORTS ---------- */
document.getElementById("transactionForm").onsubmit = (e) => {
    e.preventDefault();
    const catVal = document.getElementById("category").value;
    const finalCat = catVal === 'custom' ? document.getElementById("customCategory").value : catVal;

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

    if (document.getElementById("isReminder").checked) {
        pendingBills.push(entry); notify("Reminder Saved!");
    } else {
        trail.push(entry); notify("Added to Trail!");
    }
    
    save(); updateUI(); e.target.reset();
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
};

document.getElementById("downloadReport").onclick = () => {
    const temp = document.getElementById("pdf-template");
    document.getElementById("pdf-report-date").innerText = `Trail Summary: ${new Date().toLocaleDateString()}`;
    document.getElementById("pdf-balance").innerText = document.getElementById("balance").innerText;
    document.getElementById("pdf-expense").innerText = document.getElementById("expense").innerText;
    document.getElementById("pdf-pie-img").src = charts.pie.toBase64Image();
    document.getElementById("pdf-bar-img").src = charts.bar.toBase64Image();
    document.getElementById("pdf-table-body").innerHTML = trail.map(t => `<tr><td>${t.date}</td><td>${t.category}</td><td>${t.type}</td><td style="text-align:right">₹${t.amount}</td></tr>`).join('');
    
    temp.style.display = "block";
    html2pdf().from(temp).save("MoneyTrail_Report.pdf").then(() => temp.style.display = "none");
};

document.getElementById("exportBtn").onclick = () => {
    const csv = "Date,Type,Category,Amount\n" + trail.map(t => `${t.date},${t.type},${t.category},${t.amount}`).join('\n');
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `MoneyTrail_Export.csv`; link.click();
};

/* ---------- CHARTS ---------- */
function initCharts(data) {
    Object.values(charts).forEach(c => c && c.destroy());
    const expData = data.filter(t => t.type === 'expense');
    const catMap = {}; expData.forEach(e => catMap[e.category] = (catMap[e.category] || 0) + e.amount);

    charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut', data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const monthly = {}; trail.forEach(t => { const m = t.date.slice(0, 7); if(!monthly[m]) monthly[m] = {i:0, e:0}; t.type === 'income' ? monthly[m].i += t.amount : monthly[m].e += t.amount; });
    const mLabels = Object.keys(monthly).sort();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar', data: { labels: mLabels, datasets: [ { label:'Income', data:mLabels.map(m=>monthly[m].i), backgroundColor:'#10b981' }, { label:'Expense', data:mLabels.map(m=>monthly[m].e), backgroundColor:'#ef4444' } ]},
        options: { responsive: true, maintainAspectRatio: false }
    });

    const weekly = new Array(7).fill(0); expData.forEach(t => weekly[new Date(t.date).getDay()] += t.amount);
    charts.weekly = new Chart(document.getElementById('weeklyChart'), {
        type: 'line', data: { labels: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], datasets: [{ label:'Spending', data: weekly, borderColor:'#6366f1', tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ---------- UTILS ---------- */
function populateDropdowns() {
    const html = cats.sort().map(c => `<option value="${c}">${c}</option>`).join('') + `<option value="custom">+ New Category</option>`;
    document.getElementById("category").innerHTML = html;
    document.getElementById("manageCatsList").innerHTML = cats.map(c => `<li>${c}</li>`).join('');
}

function save() {
    localStorage.setItem("moneytrail_v6", JSON.stringify(trail));
    localStorage.setItem("mt_bills_v6", JSON.stringify(pendingBills));
    localStorage.setItem("mt_cats_v6", JSON.stringify(cats));
}

document.getElementById("resetAppBtn").onclick = () => {
    askConfirmation("Reset Everything?", "All your history and categories will be permanently deleted.", () => {
        localStorage.clear(); location.reload();
    });
};

document.getElementById("category").onchange = e => document.getElementById("customCategoryGroup").style.display = e.target.value === 'custom' ? 'block' : 'none';
document.getElementById("darkModeToggle").onclick = () => document.body.classList.toggle("dark");
["searchInput", "filterType"].forEach(id => document.getElementById(id).addEventListener("input", updateUI));

init();