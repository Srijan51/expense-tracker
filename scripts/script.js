const form = document.getElementById("transactionForm");
const list = document.getElementById("transactionList");
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const errorEl = document.getElementById("error");

const pieCanvas = document.getElementById("pieChart");
const barCanvas = document.getElementById("barChart");
const pieCtx = pieCanvas.getContext("2d");
const barCtx = barCanvas.getContext("2d");

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

/* ---------- CORE LOGIC ---------- */
function save() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function calculateTotals() {
  let income = 0, expense = 0;
  transactions.forEach(t => {
    t.type === "income" ? income += t.amount : expense += t.amount;
  });
  incomeEl.textContent = `₹${income}`;
  expenseEl.textContent = `₹${expense}`;
  balanceEl.textContent = `₹${income - expense}`;
}

function renderTransactions() {
  list.innerHTML = "";
  transactions.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = t.type;
    li.innerHTML = `
      <span>${t.category} - ₹${t.amount} <small>${t.date}</small></span>
      <button onclick="deleteTransaction(${i})">✖</button>
    `;
    list.appendChild(li);
  });
}

/* ---------- CHARTS ---------- */
function drawPieChart() {
  pieCtx.clearRect(0, 0, pieCanvas.width, pieCanvas.height);
  const expenses = transactions.filter(t => t.type === "expense");
  const data = {};

  expenses.forEach(e => {
    data[e.category] = (data[e.category] || 0) + e.amount;
  });

  const total = Object.values(data).reduce((a,b)=>a+b,0);
  let startAngle = 0;
  const colors = ["#6366f1","#ec4899","#f97316","#10b981","#ef4444","#8b5cf6","#14b8a6"];

  Object.keys(data).forEach((cat,i) => {
    const slice = (data[cat] / total) * Math.PI * 2;
    pieCtx.beginPath();
    pieCtx.moveTo(150,150);
    pieCtx.arc(150,150,120,startAngle,startAngle+slice);
    pieCtx.fillStyle = colors[i % colors.length];
    pieCtx.fill();
    startAngle += slice;
  });
}

function drawBarChart() {
  barCtx.clearRect(0,0,barCanvas.width,barCanvas.height);
  const monthly = {};

  transactions.forEach(t => {
    const month = t.date.slice(0,7);
    monthly[month] = monthly[month] || {income:0,expense:0};
    monthly[month][t.type] += t.amount;
  });

  const months = Object.keys(monthly);
  const barWidth = 30;
  months.forEach((m,i) => {
    barCtx.fillStyle = "#2ecc71";
    barCtx.fillRect(50+i*80,200-monthly[m].income/10,barWidth,monthly[m].income/10);
    barCtx.fillStyle = "#e74c3c";
    barCtx.fillRect(90+i*80,200-monthly[m].expense/10,barWidth,monthly[m].expense/10);
  });
}

/* ---------- EVENTS ---------- */
form.addEventListener("submit", e => {
  e.preventDefault();
  errorEl.textContent = "";

  const amount = +amount.value;
  if (amount <= 0) {
    errorEl.textContent = "Amount must be greater than zero";
    return;
  }

  transactions.push({
    type: type.value,
    amount,
    date: date.value,
    category: category.value
  });

  save();
  updateUI();
  form.reset();
});

function deleteTransaction(i) {
  transactions.splice(i,1);
  save();
  updateUI();
}

function updateUI() {
  calculateTotals();
  renderTransactions();
  drawPieChart();
  drawBarChart();
}

/* ---------- DARK MODE ---------- */
document.getElementById("darkModeToggle").onclick = () => {
  document.body.classList.toggle("dark");
};

updateUI();
