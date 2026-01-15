# expense-tracker

# MoneyTrail - Expense Tracker Documentation

## Overview
MoneyTrail is a comprehensive personal finance management application that allows users to track income, expenses, set bill reminders, and visualize financial data through interactive charts.

## Features

### 1. **Transaction Management**
- Add income and expense entries with amount, date, category, and optional description
- Mark transactions as recurring (monthly)
- Set bill reminders for future payments
- Search and filter transaction history
- Sort by newest or highest amount

### 2. **Category System**
- Pre-defined categories: Food, Rent, Salary, Shopping, Bills, Health
- Create custom categories
- Delete existing categories
- Dynamic category management

### 3. **Bill Reminders**
- Set reminders for upcoming bills without immediate deduction
- Mark reminders as paid (automatically adds to transaction history)
- Delete reminders

### 4. **Financial Dashboard**
- Real-time balance calculation (Income - Expenses)
- Total income display
- Total expense display
- Visual card-based layout

### 5. **Data Visualization**
- **Pie Chart**: Expense breakdown by category
- **Line Chart**: Weekly spending pattern (Sunday - Saturday)
- **Bar Chart**: Monthly income vs expense trends

### 6. **Filtering & Time Frames**
- View all-time data
- Filter by specific day
- Filter by specific month
- Search transactions by category or description

### 7. **Export Options**
- **CSV Export**: Download transaction history as CSV file
- **PDF Report**: Generate comprehensive PDF with:
  - Financial summary
  - Chart visualizations
  - Detailed transaction table

### 8. **Data Persistence**
- LocalStorage implementation
- Auto-save on every action
- Data survives browser refresh

### 9. **UI/UX Features**
- Dark mode toggle
- Glassmorphism design
- Responsive layout (mobile-friendly)
- Icon-based visual indicators
- Color-coded transactions (green for income, red for expense)

## File Structure

```
expense-tracker/
├── index.html          # Main HTML structure
├── styles/
│   └── style.css      # Glassmorphism styling & responsive design
└── scripts/
    └── script.js      # Core functionality & state management
```

## Technical Stack

- **HTML5**: Semantic markup
- **CSS3**: Custom properties, Grid, Flexbox, Glassmorphism effects
- **Vanilla JavaScript**: ES6+ features, LocalStorage API
- **Chart.js**: Data visualization library
- **html2pdf.js**: PDF generation
- **Font Awesome**: Icon library
- **Google Fonts**: Inter font family

## Key Functions

### Core Logic
- `init()`: Initialize app with today's date and load data
- `save()`: Persist data to LocalStorage
- `updateUI()`: Refresh all UI components
- `calculateTotals()`: Compute income, expense, and balance
- `filterData()`: Apply time frame and search filters

### Rendering
- `renderTransactions()`: Display transaction list
- `renderReminders()`: Display bill reminders
- `initCharts()`: Create/update all Chart.js visualizations

### Actions
- `completeReminder()`: Mark bill as paid and add to transactions
- `deleteReminder()`: Remove reminder
- `deleteTransaction()`: Remove transaction entry
- `deleteCategory()`: Remove custom category

### Data Management
- `populateDropdowns()`: Update category selectors
- Automatic form submission handling
- Dynamic show/hide for custom category input

## Browser Compatibility
- Modern browsers with ES6+ support
- LocalStorage API required
- Canvas API for charts

## Usage Notes
- All amounts are in Indian Rupees (₹)
- Dates follow ISO format (YYYY-MM-DD)
- Reset button clears ALL data permanently
- PDF reports include chart snapshots at generation time