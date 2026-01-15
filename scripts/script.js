// State Management
let transactions = JSON.parse(localStorage.getItem("trail_data")) || [];
let reminders = JSON.parse(localStorage.getItem("trail_reminders")) || [];
let categories = JSON.parse(localStorage.getItem("trail_cats")) || ["Food", "Rent", "Salary", "Shopping", "Bills", "Health"];
let charts = {};

/* ---------- INITIALIZATION ---------- */
function init() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("date").value = today;
    populateDropdowns();
    updateUI();
}

/* ---------- CORE LOGIC ---------- */
function save() {
    localStorage.setItem("trail_data", JSON.stringify(transactions));
    localStorage.setItem("trail_reminders", JSON.stringify(reminders));
    localStorage.setItem("trail_cats", JSON.stringify(categories));
}

function updateUI() {
    const filtered = filterData();
    calculateTotals(filtered);
    renderTransactions(filtered);
    renderReminders();
    initCharts(filtered);
}

function calculateTotals(data) {
    const inc = data.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const exp = data.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    document.getElementById("income").textContent = `₹${inc.toLocaleString()}`;
    document.getElementById("expense").textContent = `₹${exp.toLocaleString()}`;
    document.getElementById("balance").textContent = `₹${(inc - exp).toLocaleString()}`;
}

function filterData() {
    let data = [...transactions];
    const tf = document.getElementById("timeFrame").value;
    if (tf === "day") data = data.filter(t => t.date === document.getElementById("filterDate").value);
    if (tf === "month") data = data.filter(t => t.date.startsWith(document.getElementById("filterMonth").value));
    
    const search = document.getElementById("searchInput").value.toLowerCase();
    data = data.filter(t => t.category.toLowerCase().includes(search) || (t.description || "").toLowerCase().includes(search));
    
    return data.sort((a,b) => document.getElementById("sortBy").value === "newest" ? b.id - a.id : b.amount - a.amount);
}

/* ---------- RENDERING ---------- */
function renderTransactions(data) {
    document.getElementById("transactionList").innerHTML = data.map(t => `
        <li class="${t.type}">
            <div class="li-content">
                <span class="li-category">${t.category} ${t.recurring ? '🔄' : ''}</span>
                <span class="li-date">${t.date}</span>
                <small class="li-desc">${t.description || ''}</small>
            </div>
            <div style="display:flex; align-items:center; gap:15px;">
                <span class="li-amount">${t.type === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()}</span>
                <button onclick="deleteTransaction(${t.id})" class="delete-btn"><i class="fas fa-trash-alt"></i></button>
            </div>
        </li>`).join('');
}

function renderReminders() {
    document.getElementById("reminderList").innerHTML = reminders.length ? reminders.map(r => `
        <li class="reminder-item" style="border-left: 5px solid var(--primary);">
            <span><b>${r.date}:</b> ${r.category} (₹${r.amount})</span>
            <div style="display:flex; gap:12px;">
                <button title="Mark as Paid" onclick="completeReminder(${r.id})" class="complete-btn"><i class="fas fa-check-circle"></i></button>
                <button title="Remove Reminder" onclick="deleteReminder(${r.id})" class="delete-btn"><i class="fas fa-trash-alt"></i></button>
            </div>
        </li>`).join('') : "<li>No upcoming bill reminders.</li>";
}

/* ---------- ACTIONS ---------- */
function completeReminder(id) {
    const idx = reminders.findIndex(r => r.id === id);
    if (idx !== -1) {
        const item = reminders[idx];
        transactions.push({
            ...item,
            id: Date.now(),
            date: new Date().toISOString().split('T')[0], // Deduct today
            reminder: false
        });
        reminders.splice(idx, 1);
        save(); updateUI();
    }
}

function deleteReminder(id) {
    if(confirm("Delete this reminder?")) {
        reminders = reminders.filter(r => r.id !== id);
        save(); updateUI();
    }
}

function deleteTransaction(id) {
    if(confirm("Permanently delete this entry?")) {
        transactions = transactions.filter(t => t.id !== id);
        save(); updateUI();
    }
}

/* ---------- CHARTS ---------- */
function initCharts(data) {
    Object.values(charts).forEach(c => { if(c) c.destroy(); });
    
    // Expense Pie
    const expData = data.filter(t => t.type === 'expense');
    const cats = {};
    expData.forEach(e => cats[e.category] = (cats[e.category] || 0) + e.amount);
    charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444','#8b5cf6'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Weekly Line
    const weekly = new Array(7).fill(0);
    expData.forEach(t => weekly[new Date(t.date).getDay()] += t.amount);
    charts.weekly = new Chart(document.getElementById('weeklyChart'), {
        type: 'line',
        data: { labels: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], datasets: [{ label:'Expenses', data: weekly, borderColor:'#6366f1', fill:true, tension:0.4 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Monthly Trend
    const monthly = {};
    transactions.forEach(t => {
        const m = t.date.slice(0, 7);
        if(!monthly[m]) monthly[m] = {i:0, e:0};
        t.type === 'income' ? monthly[m].i += t.amount : monthly[m].e += t.amount;
    });
    const mLabels = Object.keys(monthly).sort();
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: { labels: mLabels, datasets: [
            { label: 'Income', data: mLabels.map(m => monthly[m].i), backgroundColor: '#10b981' },
            { label: 'Expense', data: mLabels.map(m => monthly[m].e), backgroundColor: '#ef4444' }
        ]},
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ---------- EXPORTS (OPTIMIZED) ---------- */
document.getElementById("downloadReport").onclick = () => {
    const template = document.getElementById('pdf-report-template');
    
    // Update text data
    document.getElementById('pdf-report-date').innerText = `Generated on: ${new Date().toLocaleDateString()}`;
    document.getElementById('pdf-income').innerText = document.getElementById('income').innerText;
    document.getElementById('pdf-expense').innerText = document.getElementById('expense').innerText;
    
    // Convert current charts to images for PDF
    document.getElementById('pdf-pie-img').src = charts.pie.toBase64Image();
    document.getElementById('pdf-bar-img').src = charts.bar.toBase64Image();

    // Fill table
    document.getElementById('pdf-table-body').innerHTML = transactions.map(t => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px;">${t.date}</td>
            <td style="padding: 10px;">${t.category}</td>
            <td style="padding: 10px; color: ${t.type === 'income' ? '#10b981' : '#ef4444'}; font-weight: 600;">${t.type.toUpperCase()}</td>
            <td style="padding: 10px; text-align: right;">₹${t.amount.toLocaleString()}</td>
        </tr>
    `).join('');

    template.style.display = 'block';
    const opt = { 
        margin: 0.5, 
        filename: 'MoneyTrail_Full_Report.pdf', 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2 }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
    };
    html2pdf().from(template).set(opt).save().then(() => template.style.display = 'none');
};

document.getElementById("exportBtn").onclick = () => {
    if (transactions.length === 0) return alert("No history to export.");
    const headers = ["Date", "Type", "Category", "Amount", "Description", "Recurring"];
    const rows = transactions.map(t => [
        t.date, 
        t.type, 
        t.category, 
        t.amount, 
        `"${t.description || ''}"`,
        t.recurring ? "Yes" : "No"
    ].join(","));
    const csv = headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MoneyTrail_Data_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
};

/* ---------- EVENTS ---------- */
document.getElementById("transactionForm").onsubmit = e => {
    e.preventDefault();
    const type = document.getElementById("type").value;
    const catInput = document.getElementById("category").value;
    const cat = catInput === 'custom' ? document.getElementById("customCategory").value : catInput;
    
    const entry = {
        id: Date.now(),
        type: type,
        amount: parseFloat(document.getElementById("amount").value),
        date: document.getElementById("date").value,
        category: cat || "General",
        description: document.getElementById("description").value,
        recurring: document.getElementById("isRecurring").checked,
        reminder: document.getElementById("isReminder").checked
    };

    if (cat && !categories.includes(cat)) { categories.push(cat); populateDropdowns(); }

    if (entry.reminder) {
        reminders.push(entry);
    } else {
        transactions.push(entry);
    }
    
    save(); updateUI(); e.target.reset();
    document.getElementById("date").value = new Date().toISOString().split('T')[0];
};

function populateDropdowns() {
    const sorted = [...categories].sort();
    document.getElementById("category").innerHTML = `<option value="">Select Category</option>` + sorted.map(c => `<option value="${c}">${c}</option>`).join('') + `<option value="custom">+ New Category</option>`;
    document.getElementById("manageCatsList").innerHTML = sorted.map(c => `<li class="cat-item"><span>${c}</span><button onclick="deleteCategory('${c}')"><i class="fas fa-times"></i></button></li>`).join('');
}

function deleteCategory(cat) {
    if (confirm(`Delete category "${cat}"?`)) { categories = categories.filter(c => c !== cat); save(); populateDropdowns(); }
}

document.getElementById("category").onchange = e => document.getElementById("customCategoryGroup").style.display = e.target.value === 'custom' ? 'block' : 'none';
document.getElementById("timeFrame").onchange = e => {
    document.getElementById("filterDate").style.display = e.target.value === 'day' ? 'inline-block' : 'none';
    document.getElementById("filterMonth").style.display = e.target.value === 'month' ? 'inline-block' : 'none';
    updateUI();
};
document.getElementById("resetAppBtn").onclick = () => { if(confirm("Erase all data?")) { localStorage.clear(); location.reload(); } };
document.getElementById("darkModeToggle").onclick = () => document.body.classList.toggle("dark");

[document.getElementById("searchInput"), document.getElementById("filterDate"), document.getElementById("filterMonth"), document.getElementById("sortBy")].forEach(el => el.addEventListener("input", updateUI));

init();