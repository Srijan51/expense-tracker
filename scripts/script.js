// State
let transactions = JSON.parse(localStorage.getItem("moneytrail_data")) || [];
let categories = JSON.parse(localStorage.getItem("moneytrail_cats")) || 
                 ["Food", "Travel", "Rent", "Shopping", "Bills", "Health", "Salary"];

let pieChart, barChart;

// DOM
const form = document.getElementById("transactionForm");
const list = document.getElementById("transactionList");
const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const customCategoryGroup = document.getElementById("customCategoryGroup");
const customCategoryInput = document.getElementById("customCategory");

// Filter Elements
const timeFrame = document.getElementById("timeFrame");
const filterDate = document.getElementById("filterDate");
const filterMonth = document.getElementById("filterMonth");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const filterCategory = document.getElementById("filterCategory");

/* ---------- INITIALIZATION & CATEGORIES ---------- */

function populateDropdowns() {
    const sortedCats = [...categories].sort();
    
    categorySelect.innerHTML = `<option value="">(None / Optional)</option>` + 
        sortedCats.map(c => `<option value="${c}">${c}</option>`).join('') + 
        `<option value="custom">Other (Add New...)</option>`;

    filterCategory.innerHTML = `<option value="all">All Categories</option>` + 
        sortedCats.map(c => `<option value="${c}">${c}</option>`).join('');

    // Update Manage List
    const manageList = document.getElementById("manageCatsList");
    manageList.innerHTML = sortedCats.map(c => `
        <li class="cat-item">
            <span>${c}</span>
            <button onclick="deleteCategory('${c}')"><i class="fas fa-times"></i></button>
        </li>
    `).join('');
}

function deleteCategory(catName) {
    if (confirm(`Remove "${catName}" from categories?`)) {
        categories = categories.filter(c => c !== catName);
        save();
        populateDropdowns();
    }
}

/* ---------- CORE LOGIC ---------- */

function save() {
    localStorage.setItem("moneytrail_data", JSON.stringify(transactions));
    localStorage.setItem("moneytrail_cats", JSON.stringify(categories));
}

function resetApp() {
    if (confirm("DANGER: This will permanently delete ALL transactions and custom categories. Continue?")) {
        localStorage.clear();
        location.reload();
    }
}

function updateUI() {
    const filtered = filterData();
    calculateTotals(filtered);
    renderTransactions(filtered);
    initCharts(filtered);
}

function calculateTotals(data) {
    const income = data.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = data.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    document.getElementById("income").textContent = `₹${income.toLocaleString()}`;
    document.getElementById("expense").textContent = `₹${expense.toLocaleString()}`;
    document.getElementById("balance").textContent = `₹${(income - expense).toLocaleString()}`;
}

function filterData() {
    let data = [...transactions];
    const timeframeVal = timeFrame.value;
    const searchTerm = searchInput.value.toLowerCase();

    // 1. Time Frame Filter
    if (timeframeVal === "day" && filterDate.value) {
        data = data.filter(t => t.date === filterDate.value);
    } else if (timeframeVal === "month" && filterMonth.value) {
        data = data.filter(t => t.date.startsWith(filterMonth.value));
    }

    // 2. Metadata Filters
    data = data.filter(t => {
        const matchesSearch = t.category.toLowerCase().includes(searchTerm) || 
                              (t.description && t.description.toLowerCase().includes(searchTerm));
        const matchesType = filterType.value === "all" || t.type === filterType.value;
        const matchesCat = filterCategory.value === "all" || t.category === filterCategory.value;
        return matchesSearch && matchesType && matchesCat;
    });

    return data.sort((a, b) => b.id - a.id);
}

function renderTransactions(data) {
    list.innerHTML = "";
    document.getElementById("transactionCount").textContent = `${data.length} entries`;
    data.forEach((t) => {
        const li = document.createElement("li");
        li.className = t.type;
        li.innerHTML = `
            <div class="li-content">
                <span class="li-category">${t.category || 'General'}</span>
                <span class="li-date">${new Date(t.date).toLocaleDateString()}</span>
                ${t.description ? `<small class="li-desc">${t.description}</small>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span class="li-amount">${t.type === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()}</span>
                <button class="delete-btn" onclick="deleteTransaction(${t.id})"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

/* ---------- CHARTS ---------- */

function initCharts(data) {
    const expenses = data.filter(t => t.type === "expense");
    const catData = {};
    expenses.forEach(e => {
        const c = e.category || "General";
        catData[c] = (catData[c] || 0) + e.amount;
    });

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
        options: { responsive: true, maintainAspectRatio: false }
    });

    const monthlyTrend = {};
    data.forEach(t => {
        const m = t.date.slice(0, 7);
        if (!monthlyTrend[m]) monthlyTrend[m] = { inc: 0, exp: 0 };
        t.type === 'income' ? monthlyTrend[m].inc += t.amount : monthlyTrend[m].exp += t.amount;
    });

    const months = Object.keys(monthlyTrend).sort();
    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: 'Income', data: months.map(m => monthlyTrend[m].inc), backgroundColor: '#10b981' },
                { label: 'Expense', data: months.map(m => monthlyTrend[m].exp), backgroundColor: '#ef4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/* ---------- EVENTS ---------- */

timeFrame.addEventListener("change", () => {
    const val = timeFrame.value;
    filterDate.style.display = val === "day" ? "block" : "none";
    filterMonth.style.display = val === "month" ? "block" : "none";
    updateUI();
});

form.addEventListener("submit", e => {
    e.preventDefault();
    let finalCategory = categorySelect.value;

    if (finalCategory === "custom") {
        const newCat = customCategoryInput.value.trim();
        if (newCat) {
            finalCategory = newCat;
            if (!categories.includes(newCat)) {
                categories.push(newCat);
                populateDropdowns();
            }
        }
    }

    transactions.push({
        id: Date.now(),
        type: typeSelect.value,
        amount: parseFloat(document.getElementById("amount").value),
        date: document.getElementById("date").value,
        category: finalCategory,
        description: document.getElementById("description").value
    });

    save();
    updateUI();
    form.reset();
    customCategoryGroup.style.display = "none";
});

function deleteTransaction(id) {
    if(confirm("Remove this entry?")) {
        transactions = transactions.filter(t => t.id !== id);
        save();
        updateUI();
    }
}

categorySelect.addEventListener("change", () => {
    customCategoryGroup.style.display = categorySelect.value === "custom" ? "block" : "none";
});

document.getElementById("resetAppBtn").onclick = resetApp;
[filterDate, filterMonth, searchInput, filterType, filterCategory].forEach(el => el.addEventListener("input", updateUI));

document.getElementById("darkModeToggle").onclick = () => {
    document.body.classList.toggle("dark");
    document.querySelector("#darkModeToggle i").classList.toggle("fa-moon");
    document.querySelector("#darkModeToggle i").classList.toggle("fa-sun");
};

populateDropdowns();
updateUI();