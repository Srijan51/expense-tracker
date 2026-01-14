// State Management
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let pieChart, barChart;

// DOM Elements
const form = document.getElementById("transactionForm");
const list = document.getElementById("transactionList");
const searchInput = document.getElementById("searchInput");
const filterCategory = document.getElementById("filterCategory");
const sortBy = document.getElementById("sortBy");

/* ---------- CORE LOGIC ---------- */

function save() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
}

function updateUI() {
    const filtered = filterData();
    calculateTotals();
    renderTransactions(filtered);
    initCharts(); // Refresh Charts
}

function calculateTotals() {
    const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    document.getElementById("income").textContent = `₹${income.toLocaleString()}`;
    document.getElementById("expense").textContent = `₹${expense.toLocaleString()}`;
    document.getElementById("balance").textContent = `₹${(income - expense).toLocaleString()}`;
}

function filterData() {
    let data = [...transactions];
    const searchTerm = searchInput.value.toLowerCase();
    const cat = filterCategory.value;
    const sort = sortBy.value;

    // Search & Category Filter
    data = data.filter(t => {
        const matchesSearch = t.category.toLowerCase().includes(searchTerm);
        const matchesCat = cat === "all" || t.category === cat;
        return matchesSearch && matchesCat;
    });

    // Sorting
    if (sort === "newest") data.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sort === "oldest") data.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sort === "highest") data.sort((a, b) => b.amount - a.amount);
    if (sort === "lowest") data.sort((a, b) => a.amount - b.amount);

    return data;
}

function renderTransactions(data) {
    list.innerHTML = "";
    document.getElementById("transactionCount").textContent = `${data.length} items`;
    
    data.forEach((t) => {
        const li = document.createElement("li");
        li.className = t.type;
        li.innerHTML = `
            <div class="li-content">
                <span class="li-category">${t.category}</span>
                <span class="li-date">${new Date(t.date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span class="li-amount">${t.type === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()}</span>
                <button class="delete-btn" onclick="deleteTransaction(${t.id})"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

/* ---------- CHART.JS INTEGRATION ---------- */

function initCharts() {
    const expenses = transactions.filter(t => t.type === "expense");
    
    // Pie Chart Data (Category Distribution)
    const catData = {};
    expenses.forEach(e => catData[e.category] = (catData[e.category] || 0) + e.amount);

    if (pieChart) pieChart.destroy();
    pieChart = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Bar Chart Data (Monthly Income vs Expense)
    const monthly = {};
    transactions.forEach(t => {
        const m = t.date.slice(0, 7);
        if (!monthly[m]) monthly[m] = { inc: 0, exp: 0 };
        t.type === 'income' ? monthly[m].inc += t.amount : monthly[m].exp += t.amount;
    });

    const months = Object.keys(monthly).sort();
    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: 'Income', data: months.map(m => monthly[m].inc), backgroundColor: '#10b981' },
                { label: 'Expense', data: months.map(m => monthly[m].exp), backgroundColor: '#ef4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ---------- EVENTS ---------- */

form.addEventListener("submit", e => {
    e.preventDefault();
    const amountVal = parseFloat(document.getElementById("amount").value);
    
    if (amountVal <= 0) return;

    transactions.push({
        id: Date.now(),
        type: document.getElementById("type").value,
        amount: amountVal,
        date: document.getElementById("date").value,
        category: document.getElementById("category").value
    });

    save();
    updateUI();
    form.reset();
});

function deleteTransaction(id) {
    if(confirm("Delete this transaction?")) {
        transactions = transactions.filter(t => t.id !== id);
        save();
        updateUI();
    }
}

// Live Filtering
[searchInput, filterCategory, sortBy].forEach(el => {
    el.addEventListener("input", updateUI);
});

// Dark Mode
document.getElementById("darkModeToggle").onclick = () => {
    document.body.classList.toggle("dark");
    const icon = document.querySelector("#darkModeToggle i");
    icon.classList.toggle("fa-moon");
    icon.classList.toggle("fa-sun");
};

// Export to CSV
document.getElementById("exportBtn").onclick = () => {
    if (transactions.length === 0) return;
    let csv = "Date,Type,Category,Amount\n";
    transactions.forEach(t => {
        csv += `${t.date},${t.type},${t.category},${t.amount}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
};

// Start
updateUI();