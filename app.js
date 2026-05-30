/* ==========================================================================
   Fam Expense Tracker - Master Core JS
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. IndexedDB Database Driver (Zero Dependencies, Offline-First)
// --------------------------------------------------------------------------
class FamDB {
  constructor() {
    this.dbName = 'FamExpenseTracker';
    this.version = 1;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (e) => {
        console.error('Database opening failed:', e);
        reject(e);
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // 1. Accounts Store
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'id' });
        }
        // 2. Expense Groups Store (Master)
        if (!db.objectStoreNames.contains('expense_groups')) {
          const groupStore = db.createObjectStore('expense_groups', { keyPath: 'id' });
          groupStore.createIndex('accountId', 'accountId', { unique: false });
          groupStore.createIndex('date', 'date', { unique: false });
        }
        // 3. Expense Items Store (Detail)
        if (!db.objectStoreNames.contains('expense_items')) {
          const itemStore = db.createObjectStore('expense_items', { keyPath: 'id' });
          itemStore.createIndex('groupId', 'groupId', { unique: false });
        }
        // 4. Scoped Categories Store
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('accountId', 'accountId', { unique: false });
        }
        // 5. Scoped Labels Store
        if (!db.objectStoreNames.contains('labels')) {
          const labelStore = db.createObjectStore('labels', { keyPath: 'id' });
          labelStore.createIndex('accountId', 'accountId', { unique: false });
        }
        // 6. Global Payment Methods Store
        if (!db.objectStoreNames.contains('payment_methods')) {
          db.createObjectStore('payment_methods', { keyPath: 'id' });
        }
        // 7. Core Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // Generic Helpers
  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  put(storeName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Scoped queries by Index
  getGroupedByIndex(storeName, indexName, queryValue) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const idx = store.index(indexName);
      const req = idx.getAll(queryValue);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Complex cascade delete of receipt group
  deleteExpenseGroup(groupId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['expense_groups', 'expense_items'], 'readwrite');
      
      // 1. Delete group
      tx.objectStore('expense_groups').delete(groupId);

      // 2. Delete linked items
      const itemsStore = tx.objectStore('expense_items');
      const idx = itemsStore.index('groupId');
      const req = idx.openCursor(IDBKeyRange.only(groupId));

      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Save full receipt (Group + Items) in a single atomic transaction
  saveFullReceipt(group, items) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['expense_groups', 'expense_items'], 'readwrite');
      
      tx.objectStore('expense_groups').put(group);
      
      // If updating, delete existing items first to avoid leaks
      const itemsStore = tx.objectStore('expense_items');
      const idx = itemsStore.index('groupId');
      const req = idx.openCursor(IDBKeyRange.only(group.id));

      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Write all new items
          items.forEach(item => {
            itemsStore.put(item);
          });
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Completely wipe data
  clearAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(
        ['accounts', 'expense_groups', 'expense_items', 'categories', 'labels', 'payment_methods', 'settings'],
        'readwrite'
      );
      tx.objectStore('accounts').clear();
      tx.objectStore('expense_groups').clear();
      tx.objectStore('expense_items').clear();
      tx.objectStore('categories').clear();
      tx.objectStore('labels').clear();
      tx.objectStore('payment_methods').clear();
      tx.objectStore('settings').clear();

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

// --------------------------------------------------------------------------
// 2. Global State Model
// --------------------------------------------------------------------------
const state = {
  db: null,
  activeAccountId: '',
  currentView: 'dashboard-view',
  historyStack: ['dashboard-view'],
  activeMonth: new Date(), // Focus on this month/year for list display
  balanceHidden: false,
  selectedLabels: new Set(), // Set of label names for active expense draft
  activeEditingGroupId: null, // If editing existing group
  calculatorActiveInput: null, // Active element calculator keypad is editing
  
  // Settings toggle
  locationAutocompleteEnabled: false,
  cachedPosition: null
};

// Helper UUID Generator for zero-dependency record IDs
function generateUUID(prefix = '') {
  return prefix + '_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// --------------------------------------------------------------------------
// 3. Database Pre-seeding Script
// --------------------------------------------------------------------------
async function seedDatabaseIfEmpty(db) {
  const accounts = await db.getAll('accounts');
  if (accounts.length > 0) return; // DB already seeded

  console.log('[Fam DB] Database empty. Pre-seeding default variables...');

  // 1. Initial Default Account
  const defaultAccount = {
    id: generateUUID('acc'),
    name: 'Personal Account',
    createdAt: Date.now()
  };
  await db.put('accounts', defaultAccount);

  // Set as active account in settings
  await db.put('settings', { key: 'activeAccountId', value: defaultAccount.id });
  state.activeAccountId = defaultAccount.id;

  // 2. Global Payment Methods
  const payments = [
    { id: generateUUID('pm'), name: 'Cash', createdAt: Date.now() },
    { id: generateUUID('pm'), name: 'Card', createdAt: Date.now() + 1 },
    { id: generateUUID('pm'), name: 'G-Cash', createdAt: Date.now() + 2 }
  ];
  for (const pm of payments) {
    await db.put('payment_methods', pm);
  }

  // 3. Scoped Categories (Specific to Personal Account)
  const categories = [
    {
      id: generateUUID('cat'),
      accountId: defaultAccount.id,
      name: 'Food',
      icon: '🍟',
      bgColor: '#ffe4e6',
      textColor: '#e11d48'
    },
    {
      id: generateUUID('cat'),
      accountId: defaultAccount.id,
      name: 'Transpo',
      icon: '🚄',
      bgColor: '#e0f2fe',
      textColor: '#0284c7'
    },
    {
      id: generateUUID('cat'),
      accountId: defaultAccount.id,
      name: 'Utilities',
      icon: '💡',
      bgColor: '#fef3c7',
      textColor: '#d97706'
    },
    {
      id: generateUUID('cat'),
      accountId: defaultAccount.id,
      name: 'Shopping',
      icon: '🛍️',
      bgColor: '#f3e8ff',
      textColor: '#7c3aed'
    }
  ];
  for (const cat of categories) {
    await db.put('categories', cat);
  }

  // 4. Scoped Labels (Specific to Personal Account)
  const labels = [
    { id: generateUUID('lbl'), accountId: defaultAccount.id, name: 'Emergency' },
    { id: generateUUID('lbl'), accountId: defaultAccount.id, name: 'Fast Food' },
    { id: generateUUID('lbl'), accountId: defaultAccount.id, name: 'Splittable' }
  ];
  for (const lbl of labels) {
    await db.put('labels', lbl);
  }

  // 5. Pre-seed a sample expense group (PHP 101.00 - Food - Mcdo - Cash) matching screenshot
  const sampleGroup = {
    id: generateUUID('grp'),
    accountId: defaultAccount.id,
    description: 'Mcdo',
    date: new Date().toISOString().split('T')[0], // Today
    paymentMethod: 'Cash',
    labels: ['Fast Food'],
    latitude: 14.5995, // Manila coordinates for initial testing
    longitude: 120.9842,
    createdAt: Date.now()
  };

  const sampleItems = [
    {
      id: generateUUID('item'),
      groupId: sampleGroup.id,
      description: 'Food',
      amount: 101.00,
      category: 'Food'
    }
  ];

  await db.saveFullReceipt(sampleGroup, sampleItems);
}

// --------------------------------------------------------------------------
// 4. View Router & Transitions
// --------------------------------------------------------------------------
function navigateTo(viewId, pushToHistory = true) {
  const currentPanel = document.getElementById(state.currentView);
  const nextPanel = document.getElementById(viewId);

  if (!nextPanel) return;

  // Track history stack
  if (pushToHistory) {
    state.historyStack.push(viewId);
  }

  // Animate transition
  if (currentPanel) {
    currentPanel.classList.remove('active');
    // Slide left effect on current to feel layered
    currentPanel.classList.add('slide-left');
  }

  nextPanel.classList.remove('slide-left');
  nextPanel.classList.add('active');
  state.currentView = viewId;

  // Dispatch renderer updates
  triggerViewRenderer(viewId);
}

function navigateBack() {
  if (state.historyStack.length <= 1) return;

  const currentViewId = state.historyStack.pop();
  const previousViewId = state.historyStack[state.historyStack.length - 1];

  const currentPanel = document.getElementById(currentViewId);
  const prevPanel = document.getElementById(previousViewId);

  if (currentPanel) {
    currentPanel.classList.remove('active');
  }

  if (prevPanel) {
    prevPanel.classList.remove('slide-left');
    prevPanel.classList.add('active');
  }

  state.currentView = previousViewId;
  triggerViewRenderer(previousViewId);
}

function triggerViewRenderer(viewId) {
  // Suppress calculator overlay if navigating away
  hideCalculator();

  switch (viewId) {
    case 'dashboard-view':
      renderDashboard();
      break;
    case 'overview-view':
      renderOverview();
      break;
    case 'expense-form-view':
      // Renderer called directly when setting up creation or edit draft
      break;
    case 'labels-view':
      renderLabelsList();
      break;
    case 'settings-view':
      renderSettings();
      break;
  }
}

// --------------------------------------------------------------------------
// 5. In-App Calculator Logic (Keyboard Suppression & Parser)
// --------------------------------------------------------------------------
function showCalculator(inputElement) {
  state.calculatorActiveInput = inputElement;
  const calcPanel = document.getElementById('calculator-keypad');
  
  // Set initial formula display based on input value
  const val = inputElement.value || '0';
  document.getElementById('calc-formula-display').textContent = val;
  updateCalculatorResult(val);

  calcPanel.classList.remove('hidden');
}

function hideCalculator() {
  const calcPanel = document.getElementById('calculator-keypad');
  calcPanel.classList.add('hidden');
  state.calculatorActiveInput = null;
}

function updateCalculatorResult(formula) {
  const displayVal = document.getElementById('calc-result-display');
  try {
    const cleaned = formula.replace(/[^-+*/.0-9]/g, '');
    const result = evaluateMathExpression(cleaned);
    displayVal.textContent = `PHP ${parseFloat(result).toFixed(2)}`;
    return result;
  } catch (e) {
    displayVal.textContent = 'PHP 0.00';
    return 0;
  }
}

// Extremely robust, secure offline math expression parser (Zero eval usage)
function evaluateMathExpression(str) {
  // Simple token parser for basic ops: +, -, *, /
  // Using a secure math builder to handle hierarchy
  if (!str || str.trim() === '') return 0;
  
  // Clean tokens
  const tokens = str.match(/([0-9.]+|[-+*/])/g) || [];
  if (tokens.length === 0) return 0;

  // Process multiplications and divisions first
  const intermediateValues = [];
  let index = 0;
  
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === '*' || token === '/') {
      const prevVal = parseFloat(intermediateValues.pop());
      const nextVal = parseFloat(tokens[index + 1]);
      if (isNaN(nextVal)) {
        intermediateValues.push(prevVal);
      } else {
        const product = token === '*' ? prevVal * nextVal : prevVal / nextVal;
        intermediateValues.push(product);
      }
      index += 2;
    } else {
      intermediateValues.push(token);
      index++;
    }
  }

  // Process additions and subtractions
  let finalResult = parseFloat(intermediateValues[0]);
  if (isNaN(finalResult)) finalResult = 0;
  
  let i = 1;
  while (i < intermediateValues.length) {
    const operator = intermediateValues[i];
    const val = parseFloat(intermediateValues[i + 1]);
    if (!isNaN(val)) {
      if (operator === '+') finalResult += val;
      if (operator === '-') finalResult -= val;
    }
    i += 2;
  }

  return isNaN(finalResult) ? 0 : finalResult;
}

function handleCalculatorButton(btnVal) {
  const formulaDisplay = document.getElementById('calc-formula-display');
  let currentFormula = formulaDisplay.textContent;

  if (currentFormula === '0' && btnVal !== '.' && btnVal !== '/' && btnVal !== '*' && btnVal !== '-' && btnVal !== '+') {
    currentFormula = '';
  }

  if (btnVal === 'C') {
    // Clear
    formulaDisplay.textContent = '0';
    updateCalculatorResult('0');
  } else if (btnVal === 'backspace') {
    // Delete
    const nextFormula = currentFormula.slice(0, -1) || '0';
    formulaDisplay.textContent = nextFormula;
    updateCalculatorResult(nextFormula);
  } else if (btnVal === '=') {
    // Solve and lock formula to result
    const solved = updateCalculatorResult(currentFormula);
    formulaDisplay.textContent = parseFloat(solved).toFixed(2);
  } else if (btnVal === 'confirm') {
    // Confirm and update form
    const solved = updateCalculatorResult(currentFormula);
    if (state.calculatorActiveInput) {
      state.calculatorActiveInput.value = parseFloat(solved).toFixed(2);
      // Trigger running total updating process
      updateReceiptRunningTotal();
    }
    hideCalculator();
  } else {
    // Digit or Operator append
    // Prevent consecutive double operators
    const isOperator = ['+', '-', '*', '/'].includes(btnVal);
    const lastChar = currentFormula.slice(-1);
    const isLastOperator = ['+', '-', '*', '/'].includes(lastChar);

    if (isOperator && isLastOperator) {
      currentFormula = currentFormula.slice(0, -1); // Swap operator
    }
    
    currentFormula += btnVal;
    formulaDisplay.textContent = currentFormula;
    updateCalculatorResult(currentFormula);
  }
}

// --------------------------------------------------------------------------
// 6. Geolocation & Haversine suggestions calculations
// --------------------------------------------------------------------------
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function updateGeoPosition() {
  if (!state.locationAutocompleteEnabled) {
    state.cachedPosition = null;
    return;
  }

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.cachedPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        console.log('[Geo PWA] User coordinates acquired:', state.cachedPosition);
      },
      (err) => {
        console.warn('[Geo PWA] Geolocation acquisition failed:', err.message);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }
}

// --------------------------------------------------------------------------
// 7. Swapped Autocomplete Receipt Builder
// --------------------------------------------------------------------------
let activeAutocompleteRow = null;

function renderItemRow(item = { description: '', amount: '0.00', category: '', splitUser: '' }) {
  const container = document.getElementById('receipt-items-container');
  const rowId = generateUUID('row');

  const row = document.createElement('div');
  row.className = 'item-row';
  row.id = rowId;
  row.dataset.splitUser = item.splitUser || '';

  // Get active categories list to render selection options
  state.db.getGroupedByIndex('categories', 'accountId', state.activeAccountId).then((categoriesList) => {
    let catOptions = '';
    categoriesList.forEach((c) => {
      const selected = c.name === item.category ? 'selected' : '';
      catOptions += `<option value="${c.name}" ${selected}>${c.name}</option>`;
    });

    row.innerHTML = `
      <!-- Description Input -->
      <div style="position: relative;">
        <input type="text" class="item-input description" placeholder="Fries, Gas" value="${item.description}" required autocomplete="off">
      </div>

      <!-- Amount Input -->
      <input type="text" class="item-input amount" placeholder="0.00" value="${item.amount}" readonly inputmode="none">

      <!-- Category Select -->
      <div class="custom-select-wrapper">
        <select class="select-field category-select">
          ${catOptions}
        </select>
        <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="select-arrows"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </div>

      <!-- Delete row -->
      <button type="button" class="delete-row-btn" aria-label="Delete Item">
        <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.342 8.142A2.25 2.25 0 0 1 12.184 20H9.816a2.25 2.25 0 0 1-2.214-2.858L7.26 9m4.86-5.813L15 12M9 6h6M4 6h16" /></svg>
      </button>

      <!-- KKB User assignee block (visible only when KKB split view active) -->
      <div class="item-kkb-assignee-row hidden">
        <span class="assignee-avatar">👤</span>
        <input type="text" class="assignee-input" placeholder="Who bought this? (e.g. Alice)" value="${item.splitUser || ''}">
      </div>
    `;

    // Event binding inside row
    const descInput = row.querySelector('.description');
    const amountInput = row.querySelector('.amount');
    const deleteBtn = row.querySelector('.delete-row-btn');
    const categorySelect = row.querySelector('.category-select');
    const assigneeRow = row.querySelector('.item-kkb-assignee-row');
    const assigneeInput = row.querySelector('.assignee-input');

    // Description is plain text — no per-row autocomplete (autocomplete is on group description)

    // 2. Tap Amount -> Suppress standard keyboard, trigger customized calculator sheet
    amountInput.addEventListener('click', (e) => {
      showCalculator(e.target);
    });

    // 3. Delete row mechanism
    deleteBtn.addEventListener('click', () => {
      const allRows = container.querySelectorAll('.item-row');
      if (allRows.length > 1) {
        row.remove();
        updateReceiptRunningTotal();
      } else {
        // Clear instead
        descInput.value = '';
        amountInput.value = '0.00';
        updateReceiptRunningTotal();
      }
    });

    // Recalculates sum total on category or user adjustments
    categorySelect.addEventListener('change', updateReceiptRunningTotal);
    
    // Assign split user updates
    assigneeInput.addEventListener('input', (e) => {
      row.dataset.splitUser = e.target.value;
    });

    // If KKB split is active when drawing rows, unhide assignee panels
    const kkbBtn = document.getElementById('form-kkb-trigger');
    if (kkbBtn.classList.contains('active')) {
      assigneeRow.classList.remove('hidden');
    }

    container.appendChild(row);
    updateReceiptRunningTotal();
  });
}

function updateReceiptRunningTotal() {
  const container = document.getElementById('receipt-items-container');
  const rows = container.querySelectorAll('.item-row');
  let runningSum = 0;

  rows.forEach((row) => {
    const amt = parseFloat(row.querySelector('.amount').value) || 0;
    runningSum += amt;
  });

  document.getElementById('receipt-running-total-value').textContent = `PHP ${runningSum.toFixed(2)}`;
}

// Geolocation-Aware Autocomplete suggestion engine
// mode = 'group' → searches past expense_groups by description (store/vendor name)
async function triggerAutocomplete(inputElement, dropdownEl) {
  const query = inputElement.value.trim().toLowerCase();

  if (!dropdownEl) return;

  if (query.length < 1) {
    dropdownEl.classList.add('hidden');
    return;
  }

  // Query past expense groups for this account
  const groupsList = await state.db.getAll('expense_groups');
  const accountGroups = groupsList.filter(g => g.accountId === state.activeAccountId);

  const suggestionsMap = new Map();

  for (const group of accountGroups) {
    if (!group.description || !group.description.toLowerCase().includes(query)) continue;

    let distance = Infinity;
    if (
      state.locationAutocompleteEnabled &&
      state.cachedPosition &&
      group.latitude != null &&
      group.longitude != null
    ) {
      distance = calculateHaversineDistance(
        state.cachedPosition.lat,
        state.cachedPosition.lng,
        group.latitude,
        group.longitude
      );
    }

    // Keep only the closest (most recent by proximity) entry per description
    const key = group.description.toLowerCase();
    const existing = suggestionsMap.get(key);
    if (!existing || distance < existing.distance) {
      suggestionsMap.set(key, {
        description: group.description,
        paymentMethod: group.paymentMethod,
        distance: distance,
        groupId: group.id
      });
    }
  }

  // Sort: nearby (<500m) first, then alphabetical
  const suggestions = Array.from(suggestionsMap.values()).sort((a, b) => {
    const aNear = a.distance < 500;
    const bNear = b.distance < 500;
    if (aNear && !bNear) return -1;
    if (!aNear && bNear) return 1;
    if (aNear && bNear) return a.distance - b.distance;
    return a.description.localeCompare(b.description);
  });

  if (suggestions.length === 0) {
    dropdownEl.classList.add('hidden');
    return;
  }

  dropdownEl.innerHTML = '';
  suggestions.slice(0, 6).forEach((s) => {
    const isNearby = s.distance < 500;
    const itemEl = document.createElement('div');
    itemEl.className = 'autocomplete-item';

    itemEl.innerHTML = `
      <span class="desc-text">${s.description}</span>
      <div class="meta-pills">
        ${isNearby ? '<span class="pin-icon" title="Purchased Nearby">📍</span>' : ''}
        ${s.paymentMethod ? `<span class="price-badge">${s.paymentMethod}</span>` : ''}
      </div>
    `;

    itemEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      inputElement.value = s.description;
      dropdownEl.classList.add('hidden');
    });

    dropdownEl.appendChild(itemEl);
  });

  dropdownEl.classList.remove('hidden');
}

// --------------------------------------------------------------------------
// 8. Dashboard View Renderer
// --------------------------------------------------------------------------
async function renderDashboard() {
  const monthName = state.activeMonth.toLocaleString('default', { month: 'short' }).toUpperCase();
  const yearNumber = state.activeMonth.getFullYear();
  document.getElementById('current-month-display').innerHTML = `${monthName}<span class="year-sub">${yearNumber}</span>`;

  // 1. Set active account title
  const activeAcc = await state.db.get('accounts', state.activeAccountId);
  if (activeAcc) {
    document.getElementById('active-account-name').textContent = activeAcc.name;
  }

  // 2. Fetch all monthly groups
  const allGroups = await state.db.getGroupedByIndex('expense_groups', 'accountId', state.activeAccountId);
  
  // Filter by year & month
  const targetYear = state.activeMonth.getFullYear();
  const targetMonth = state.activeMonth.getMonth();

  const monthlyGroups = allGroups.filter((g) => {
    const d = new Date(g.date);
    return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
  });

  // Fetch all items to summarize
  const allItems = await state.db.getAll('expense_items');
  const monthlyItems = allItems.filter((item) => {
    return monthlyGroups.some((g) => g.id === item.groupId);
  });

  // Calculate monthly total
  const monthlySum = monthlyItems.reduce((acc, curr) => acc + curr.amount, 0);
  
  const amtDisplay = document.getElementById('total-amount-display');
  if (state.balanceHidden) {
    amtDisplay.textContent = 'PHP ••••••';
  } else {
    amtDisplay.textContent = `PHP ${monthlySum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // 3. Draw category carousel bubbles
  const categoriesList = await state.db.getGroupedByIndex('categories', 'accountId', state.activeAccountId);
  const quickCategoriesGrid = document.getElementById('quick-categories-grid');
  quickCategoriesGrid.innerHTML = '';

  categoriesList.forEach((cat) => {
    // Sum for this category
    const catSum = monthlyItems.filter(item => item.category === cat.name).reduce((sum, item) => sum + item.amount, 0);

    const card = document.createElement('div');
    card.className = 'category-bubble-card';
    card.innerHTML = `
      <div class="icon-bubble default" style="background-color: ${cat.bgColor}; color: ${cat.textColor};">
        ${cat.icon || '💰'}
      </div>
      <span class="category-name">${cat.name}</span>
      <span style="font-size: 11px; font-weight: 700; color: var(--text-primary);">
        ${state.balanceHidden ? 'PHP •••' : 'PHP ' + catSum.toFixed(0)}
      </span>
    `;

    // Click -> switches directly to overview filtering by this category!
    card.addEventListener('click', () => {
      state.historyStack.push('overview-view');
      state.currentView = 'overview-view';
      document.getElementById('dashboard-view').classList.remove('active');
      document.getElementById('dashboard-view').classList.add('slide-left');
      
      const nextPanel = document.getElementById('overview-view');
      nextPanel.classList.remove('slide-left');
      nextPanel.classList.add('active');

      renderOverview(cat.name);
    });

    quickCategoriesGrid.appendChild(card);
  });

  // 4. Draw Recent Transactions List (grouped transactions)
  const recentList = document.getElementById('recent-expenses-list');
  recentList.innerHTML = '';

  // Sort groups by date descending
  const sortedGroups = monthlyGroups.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sortedGroups.length === 0) {
    recentList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px;">
        No transactions recorded this month.
      </div>
    `;
    return;
  }

  for (const group of sortedGroups) {
    const groupItems = monthlyItems.filter(item => item.groupId === group.id);
    const groupTotal = groupItems.reduce((acc, curr) => acc + curr.amount, 0);
    
    // Find unique categories within this group to display bubble
    const itemCategories = [...new Set(groupItems.map(item => item.category))];
    const catInfo = categoriesList.find(c => c.name === itemCategories[0]);
    
    const card = document.createElement('div');
    card.className = 'transaction-group-card';
    
    // Check if splitted via KKB
    const hasKKBSplit = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
    const kkbIndicator = hasKKBSplit ? '<span class="item-tag-user" style="margin-left: 8px;">⚡ KKB</span>' : '';

    // Monospace breakdown accordion list builder
    let accordionItemsHtml = '';
    groupItems.forEach((item) => {
      const userTag = item.splitUser ? `<span class="item-tag-user">${item.splitUser}</span>` : '';
      accordionItemsHtml += `
        <div class="accordion-item-row">
          <div class="item-left">
            <span>•</span>
            <span class="item-name">${item.description || 'Item'}</span>
            ${userTag}
          </div>
          <span class="item-amount">PHP ${item.amount.toFixed(2)}</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="card-main-row">
        <div class="card-left-info">
          <div class="tiny-bubble" style="background-color: ${catInfo ? catInfo.bgColor : '#2b2b2b'}; color: ${catInfo ? catInfo.textColor : '#ffffff'}">
            ${catInfo ? catInfo.icon : '🧾'}
          </div>
          <div class="card-meta-text">
            <span class="group-title-label">${group.description} ${kkbIndicator}</span>
            <span class="group-payment-method-label">${group.paymentMethod}</span>
          </div>
        </div>

        <div class="card-right-amount">
          <span class="amount-text">PHP ${groupTotal.toFixed(2)}</span>
          <span class="sub-item-detail">${groupItems.length} item${groupItems.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <!-- Collapsible panel -->
      <div class="card-accordion-content">
        ${accordionItemsHtml}
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.06);">
          ${hasKKBSplit ? `<button type="button" class="badge-action-btn view-split-slip-btn" data-id="${group.id}">🧾 View Split</button>` : ''}
          <button type="button" class="badge-action-btn edit-group-pencil-btn" data-id="${group.id}">✏️ Edit</button>
        </div>
      </div>
    `;

    // Accordion Expand/Collapse on card body click (skipping nested buttons)
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; // ignore buttons
      
      const isExpanded = card.classList.contains('expanded');
      
      // Collapse others
      recentList.querySelectorAll('.transaction-group-card').forEach(c => c.classList.remove('expanded'));
      
      if (!isExpanded) {
        card.classList.add('expanded');
      }
    });

    // Direct actions inside expanded panel
    card.querySelector('.edit-group-pencil-btn').addEventListener('click', (e) => {
      setupExpenseForm(group.id);
    });

    if (hasKKBSplit) {
      card.querySelector('.view-split-slip-btn').addEventListener('click', (e) => {
        renderKKBSplitSlip(group.id);
      });
    }

    recentList.appendChild(card);
  }
}

// --------------------------------------------------------------------------
// 9. Expenses Detailed Overview (SVG Doughnut Chart)
// --------------------------------------------------------------------------
async function renderOverview(preSelectedCategoryFilter = 'all') {
  const activeMonthStr = state.activeMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  
  // Setup filter dropdown
  const filterBtn = document.getElementById('overview-filter-btn');
  const filterText = document.getElementById('active-overview-filter');
  const dropdownMenu = document.getElementById('overview-filter-dropdown');

  filterText.textContent = preSelectedCategoryFilter === 'all' ? 'All' : preSelectedCategoryFilter;

  // 1. Fetch categories to populate dropdown filter items
  const categoriesList = await state.db.getGroupedByIndex('categories', 'accountId', state.activeAccountId);
  
  let dropdownItemsHtml = `<div class="dropdown-item ${preSelectedCategoryFilter === 'all' ? 'active' : ''}" data-filter="all">All</div>`;
  categoriesList.forEach((c) => {
    const activeClass = c.name === preSelectedCategoryFilter ? 'active' : '';
    dropdownItemsHtml += `<div class="dropdown-item ${activeClass}" data-filter="${c.name}">${c.name}</div>`;
  });
  dropdownMenu.innerHTML = dropdownItemsHtml;

  // Re-bind click options on filters
  dropdownMenu.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const chosenFilter = e.target.dataset.filter;
      dropdownMenu.classList.add('hidden');
      renderOverview(chosenFilter);
    });
  });

  // Toggle filter visibility
  filterBtn.onclick = (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('hidden');
  };

  // Close dropdown on click outside
  document.onclick = () => {
    dropdownMenu.classList.add('hidden');
  };

  // 2. Fetch active transactions
  const allGroups = await state.db.getGroupedByIndex('expense_groups', 'accountId', state.activeAccountId);
  
  const targetYear = state.activeMonth.getFullYear();
  const targetMonth = state.activeMonth.getMonth();

  const monthlyGroups = allGroups.filter((g) => {
    const d = new Date(g.date);
    return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
  });

  const allItems = await state.db.getAll('expense_items');
  const monthlyItems = allItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

  // Compute category shares for doughnut segments
  const categorySums = [];
  let totalCalculatedBill = 0;

  categoriesList.forEach((cat) => {
    const sum = monthlyItems.filter(item => item.category === cat.name).reduce((acc, curr) => acc + curr.amount, 0);
    if (sum > 0) {
      categorySums.push({
        name: cat.name,
        amount: sum,
        bgColor: cat.bgColor,
        textColor: cat.textColor,
        icon: cat.icon
      });
      totalCalculatedBill += sum;
    }
  });

  // 3. Draw SVG Donut Chart dynamically!
  const svg = document.getElementById('donut-chart-svg');
  // Clear old dynamic segments (keep background track circle)
  const oldSegments = svg.querySelectorAll('.chart-segment');
  oldSegments.forEach(s => s.remove());

  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82
  let strokeOffsetAccumulator = 0;

  const centerIndicatorBadge = document.getElementById('chart-center-badge');
  centerIndicatorBadge.classList.add('hidden');

  categorySums.forEach((share) => {
    const percentage = share.amount / totalCalculatedBill;
    const segmentLength = circumference * percentage;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '100');
    circle.setAttribute('cy', '100');
    circle.setAttribute('r', radius.toString());
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', share.textColor); // High-fidelity color
    circle.setAttribute('stroke-width', '18');
    circle.setAttribute('stroke-dasharray', `${segmentLength} ${circumference}`);
    circle.setAttribute('stroke-dashoffset', (-strokeOffsetAccumulator).toString());
    circle.className.baseVal = 'chart-segment';

    // Interactive segment animations -> Clicking details focuses the group list below!
    circle.addEventListener('mouseover', () => {
      centerIndicatorBadge.innerHTML = `
        <span class="center-indicator-icon">${share.icon}</span>
        <span class="center-indicator-value">${(percentage * 100).toFixed(0)}%</span>
      `;
      centerIndicatorBadge.classList.remove('hidden');
    });

    circle.addEventListener('click', () => {
      renderOverview(share.name);
    });

    svg.appendChild(circle);
    strokeOffsetAccumulator += segmentLength;
  });

  // 4. Render Grouped Transaction List
  const listContainer = document.getElementById('overview-grouped-list');
  listContainer.innerHTML = '';

  // Filter based on dropdown or chart slice category click
  const filteredGroups = monthlyGroups.filter((g) => {
    const groupItems = monthlyItems.filter(item => item.groupId === g.id);
    if (preSelectedCategoryFilter === 'all') return true;
    return groupItems.some(item => item.category === preSelectedCategoryFilter);
  });

  if (filteredGroups.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px;">
        No items match the selected filters.
      </div>
    `;
    return;
  }

  // Helper date formatter to match screenshot (e.g. "Last Wednesday", "Today", or "May 27, 2026")
  function getFriendlyDateHeader(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dateStr);
    target.setHours(0,0,0,0);

    const diffTime = today - target;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 7) {
      const options = { weekday: 'long' };
      return `Last ${target.toLocaleDateString('default', options)}`;
    }
    
    // Normal date
    return target.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Sort groups by date descending, and group by friendly headers
  const groupsSorted = filteredGroups.sort((a, b) => new Date(b.date) - new Date(a.date));
  const groupsByDate = new Map();

  groupsSorted.forEach((g) => {
    const friendlyHeader = getFriendlyDateHeader(g.date);
    if (!groupsByDate.has(friendlyHeader)) {
      groupsByDate.set(friendlyHeader, []);
    }
    groupsByDate.get(friendlyHeader).push(g);
  });

  // Render day groups
  for (const [dayTitle, list] of groupsByDate.entries()) {
    const dayGroup = document.createElement('div');
    dayGroup.className = 'day-header-group';
    
    dayGroup.innerHTML = `<h3 class="day-title">${dayTitle}</h3>`;
    
    for (const group of list) {
      const groupItems = monthlyItems.filter(item => item.groupId === group.id);
      const groupTotal = groupItems.reduce((acc, curr) => acc + curr.amount, 0);
      
      const itemCategories = [...new Set(groupItems.map(item => item.category))];
      const catInfo = categoriesList.find(c => c.name === itemCategories[0]);

      const card = document.createElement('div');
      card.className = 'transaction-group-card';
      
      const hasKKBSplit = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      const kkbIndicator = hasKKBSplit ? '<span class="item-tag-user" style="margin-left: 8px;">⚡ KKB</span>' : '';

      let accordionItemsHtml = '';
      groupItems.forEach((item) => {
        const userTag = item.splitUser ? `<span class="item-tag-user">${item.splitUser}</span>` : '';
        accordionItemsHtml += `
          <div class="accordion-item-row">
            <div class="item-left">
              <span>•</span>
              <span class="item-name">${item.description || 'Item'}</span>
              ${userTag}
            </div>
            <span class="item-amount">PHP ${item.amount.toFixed(2)}</span>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="card-main-row">
          <div class="card-left-info">
            <div class="tiny-bubble" style="background-color: ${catInfo ? catInfo.bgColor : '#2b2b2b'}; color: ${catInfo ? catInfo.textColor : '#ffffff'}">
              ${catInfo ? catInfo.icon : '🧾'}
            </div>
            <div class="card-meta-text">
              <span class="group-title-label">${group.description} ${kkbIndicator}</span>
              <span class="group-payment-method-label">${group.paymentMethod}</span>
            </div>
          </div>

          <div class="card-right-amount">
            <span class="amount-text">PHP ${groupTotal.toFixed(2)}</span>
            <span class="sub-item-detail">${groupItems.length} item${groupItems.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="card-accordion-content">
          ${accordionItemsHtml}
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.06);">
            ${hasKKBSplit ? `<button type="button" class="badge-action-btn view-split-slip-btn" data-id="${group.id}">🧾 View Split</button>` : ''}
            <button type="button" class="badge-action-btn edit-group-pencil-btn" data-id="${group.id}">✏️ Edit</button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const isExpanded = card.classList.contains('expanded');
        dayGroup.querySelectorAll('.transaction-group-card').forEach(c => c.classList.remove('expanded'));
        if (!isExpanded) card.classList.add('expanded');
      });

      card.querySelector('.edit-group-pencil-btn').addEventListener('click', () => {
        setupExpenseForm(group.id);
      });

      if (hasKKBSplit) {
        card.querySelector('.view-split-slip-btn').addEventListener('click', () => {
          renderKKBSplitSlip(group.id);
        });
      }

      dayGroup.appendChild(card);
    }
    
    listContainer.appendChild(dayGroup);
  }
}

// --------------------------------------------------------------------------
// 10. KKB Splitting & Screenshot Receipt slips
// --------------------------------------------------------------------------
async function renderKKBSplitSlip(groupId) {
  const group = await state.db.get('expense_groups', groupId);
  if (!group) return;

  const items = await state.db.getGroupedByIndex('expense_items', 'groupId', groupId);
  const categoriesList = await state.db.getGroupedByIndex('categories', 'accountId', state.activeAccountId);

  // 1. Populate receipt variables
  document.getElementById('slip-store-name').textContent = `${group.description.toUpperCase()} SPLIT BILL`;
  
  const d = new Date(group.date);
  const formattedDate = d.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('slip-date').textContent = formattedDate.toUpperCase();
  document.getElementById('slip-payment-method').textContent = group.paymentMethod;

  // 2. Group items by tagged user (default unassigned to "Unassigned")
  const splitsMap = new Map();
  let grandSum = 0;

  items.forEach((item) => {
    const user = item.splitUser && item.splitUser.trim() !== '' ? item.splitUser.trim() : 'Unassigned';
    if (!splitsMap.has(user)) {
      splitsMap.set(user, []);
    }
    splitsMap.get(user).push(item);
    grandSum += item.amount;
  });

  document.getElementById('slip-total-amount').textContent = `PHP ${grandSum.toFixed(2)}`;

  // 3. Draw items list broken down by person name
  const splitsContainer = document.getElementById('slip-splits-container');
  splitsContainer.innerHTML = '';

  const subtotalsList = document.getElementById('slip-subtotals-list');
  subtotalsList.innerHTML = '';

  // Order assigned users with "Unassigned" last
  const usersSorted = Array.from(splitsMap.keys()).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  usersSorted.forEach((user) => {
    const userItems = splitsMap.get(user);
    const userSum = userItems.reduce((acc, curr) => acc + curr.amount, 0);

    // Create itemized visual box per person
    const personBlock = document.createElement('div');
    personBlock.className = 'slip-person-block';
    
    let itemsRowsHtml = '';
    userItems.forEach((ui) => {
      const cat = categoriesList.find(c => c.name === ui.category);
      itemsRowsHtml += `
        <div class="slip-item-row">
          <span class="item-left">${cat ? cat.icon : '•'} ${ui.description}</span>
          <span class="item-right">PHP ${ui.amount.toFixed(2)}</span>
        </div>
      `;
    });

    personBlock.innerHTML = `
      <div class="slip-person-header">
        <span>👤</span>
        <span>${user.toUpperCase()}</span>
      </div>
      <div class="slip-person-items-list">
        ${itemsRowsHtml}
      </div>
    `;
    splitsContainer.appendChild(personBlock);

    // Add sub-total box to checkout list
    const paidUsers = group.paidUsers || [];
    const isPaid = paidUsers.includes(user);
    const subRow = document.createElement('div');
    subRow.className = `slip-totals-row ${isPaid ? 'paid' : ''}`;
    subRow.innerHTML = `
      <span class="total-person-name">👤 ${user}${isPaid ? ' ✅' : ''}</span>
      <span class="total-person-amount">PHP ${userSum.toFixed(2)}</span>
    `;
    subRow.addEventListener('click', () => {
      showKKBPaidModal(user, userSum, group);
    });
    subtotalsList.appendChild(subRow);
  });

  // 4. Clipboard copier utility template
  const copyBtn = document.getElementById('kkb-copy-text-btn');
  copyBtn.onclick = () => {
    let copyText = `⚡ *SPLIT SUMMARY: ${group.description.toUpperCase()}* 🧾\n`;
    copyText += `📅 Date: ${formattedDate}\n`;
    copyText += `💳 Paid via: ${group.paymentMethod}\n`;
    copyText += `------------------------------\n`;

    const paidUsers = group.paidUsers || [];
    usersSorted.forEach((user) => {
      const userItems = splitsMap.get(user);
      const userSum = userItems.reduce((acc, curr) => acc + curr.amount, 0);
      const isPaid = paidUsers.includes(user);
      copyText += `👤 *${user}* ${isPaid ? '(Paid ✅)' : '(Unpaid ❌)'} owes *PHP ${userSum.toFixed(2)}*:\n`;
      userItems.forEach(ui => {
        copyText += `  - ${ui.description}: PHP ${ui.amount.toFixed(2)}\n`;
      });
      copyText += `\n`;
    });

    copyText += `------------------------------\n`;
    copyText += `💰 *TOTAL BILL: PHP ${grandSum.toFixed(2)}*\n`;
    copyText += `_Generated via Fam Expense Tracker PWA_`;

    navigator.clipboard.writeText(copyText).then(() => {
      const originalText = copyBtn.querySelector('span').textContent;
      copyBtn.querySelector('span').textContent = '📋 Copied Split!';
      setTimeout(() => {
        copyBtn.querySelector('span').textContent = originalText;
      }, 2000);
    });
  };

  // 5. Native share integration
  const shareBtn = document.getElementById('kkb-share-btn');
  shareBtn.onclick = () => {
    if (navigator.share) {
      navigator.share({
        title: `${group.description} Bill Split`,
        text: `Split totals for ${group.description}: PHP ${grandSum.toFixed(2)}`,
        url: window.location.href
      }).catch(err => console.log(err));
    } else {
      alert('Screencapture this beautiful receipt or use "Copy Text Summary" to send splits to your friends!');
    }
  };

  // 6. Draw KKB QRs attachment list
  const qrsRecord = await state.db.get('settings', 'kkbQrs');
  const qrsList = qrsRecord ? qrsRecord.value : [];
  const qrArea = document.getElementById('kkb-qrs-attach-area');
  const qrAttachedList = document.getElementById('kkb-attached-qrs-list');

  if (qrsList.length === 0) {
    qrArea.classList.add('hidden');
  } else {
    qrArea.classList.remove('hidden');
    qrAttachedList.innerHTML = '';
    
    qrsList.forEach((qr) => {
      const qrCard = document.createElement('div');
      qrCard.className = 'attached-qr-card';
      qrCard.innerHTML = `
        <button class="attached-qr-dismiss-btn" aria-label="Hide QR">×</button>
        <img src="${qr.base64}" class="attached-qr-image" alt="KKB Payment QR">
        <span class="attached-qr-name">${qr.name}</span>
      `;

      qrCard.querySelector('.attached-qr-dismiss-btn').onclick = (e) => {
        e.stopPropagation();
        qrCard.classList.add('dismissed');
      };

      qrAttachedList.appendChild(qrCard);
    });

    qrAttachedList.classList.remove('hidden');
  }

  navigateTo('kkb-view');
}

// Custom overlay modal helper for marking splits as paid/unpaid
function showKKBPaidModal(user, amount, group) {
  const modal = document.getElementById('kkb-paid-modal');
  const title = document.getElementById('kkb-modal-title');
  const subtitle = document.getElementById('kkb-modal-subtitle');
  const markPaidBtn = document.getElementById('kkb-mark-paid-btn');
  const markUnpaidBtn = document.getElementById('kkb-mark-unpaid-btn');
  const cancelBtn = document.getElementById('kkb-modal-cancel-btn');
  const scrim = document.getElementById('kkb-paid-scrim');

  title.textContent = `${user.toUpperCase()}'S SPLIT`;
  subtitle.textContent = `PHP ${amount.toFixed(2)}`;

  modal.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  scrim.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  markPaidBtn.onclick = async () => {
    if (!group.paidUsers) group.paidUsers = [];
    if (!group.paidUsers.includes(user)) {
      group.paidUsers.push(user);
    }
    await state.db.put('expense_groups', group);
    closeModal();
    renderKKBSplitSlip(group.id);
  };

  markUnpaidBtn.onclick = async () => {
    if (group.paidUsers) {
      group.paidUsers = group.paidUsers.filter(u => u !== user);
    }
    await state.db.put('expense_groups', group);
    closeModal();
    renderKKBSplitSlip(group.id);
  };
}

// --------------------------------------------------------------------------
// 11. New / Edit Expense Form Configurator
// --------------------------------------------------------------------------
async function setupExpenseForm(existingGroupId = null) {
  state.activeEditingGroupId = existingGroupId;
  
  const formTitle = document.getElementById('form-title');
  const kkbBtn = document.getElementById('form-kkb-trigger');
  
  // Clear core inputs
  document.getElementById('form-group-description').value = '';
  document.getElementById('form-date-picker').value = new Date().toISOString().split('T')[0];
  document.getElementById('form-date-text').textContent = 'Today';
  
  const itemsContainer = document.getElementById('receipt-items-container');
  itemsContainer.innerHTML = '';

  state.selectedLabels.clear();
  document.getElementById('form-labels-text').textContent = 'Label';

  // Seed Payment options dynamically
  const paymentsList = await state.db.getAll('payment_methods');
  const paymentSelect = document.getElementById('form-payment-method');
  paymentSelect.innerHTML = '';
  paymentsList.forEach((pm) => {
    paymentSelect.innerHTML += `<option value="${pm.name}">${pm.name}</option>`;
  });

  // Enable geolocation check if active
  updateGeoPosition();

  // Wire group-level description autocomplete (searches past store/vendor names)
  const groupDescInput = document.getElementById('form-group-description');
  const groupAutocompleteEl = document.getElementById('group-autocomplete');
  // Remove any previously attached listeners by cloning the node
  const freshDescInput = groupDescInput.cloneNode(true);
  groupDescInput.parentNode.replaceChild(freshDescInput, groupDescInput);

  freshDescInput.addEventListener('input', () => {
    triggerAutocomplete(freshDescInput, groupAutocompleteEl);
  });
  freshDescInput.addEventListener('blur', () => {
    setTimeout(() => groupAutocompleteEl.classList.add('hidden'), 200);
  });

  if (existingGroupId) {
    // Mode: EDITING
    formTitle.textContent = 'Edit Expense';
    kkbBtn.classList.remove('hidden'); // allow KKB tagging inside edit

    const group = await state.db.get('expense_groups', existingGroupId);
    const items = await state.db.getGroupedByIndex('expense_items', 'groupId', existingGroupId);

    document.getElementById('form-group-description').value = group.description;
    document.getElementById('form-date-picker').value = group.date;
    document.getElementById('form-date-text').textContent = group.date;
    paymentSelect.value = group.paymentMethod;

    if (group.labels && group.labels.length > 0) {
      group.labels.forEach(l => state.selectedLabels.add(l));
      document.getElementById('form-labels-text').textContent = group.labels.join(', ');
    }

    // Un-toggle KKB buttons initially
    kkbBtn.classList.remove('active');

    // Build row list
    items.forEach((item) => {
      renderItemRow({
        description: item.description,
        amount: item.amount.toFixed(2),
        category: item.category,
        splitUser: item.splitUser || ''
      });
    });
  } else {
    // Mode: CREATING NEW
    formTitle.textContent = 'New Expense';
    kkbBtn.classList.add('hidden'); // disable KKB splits until saved

    // Default seed 1 blank row to get started
    renderItemRow();
  }

  navigateTo('expense-form-view');
}

// --------------------------------------------------------------------------
// 12. Labels View Panel Renderer
// --------------------------------------------------------------------------
async function renderLabelsList() {
  const container = document.getElementById('labels-list-options');
  const searchInput = document.getElementById('labels-search-input');
  
  const allLabels = await state.db.getGroupedByIndex('labels', 'accountId', state.activeAccountId);

  function drawChecklist(filterQuery = '') {
    container.innerHTML = '';

    const filtered = allLabels.filter(lbl => lbl.name.toLowerCase().includes(filterQuery.toLowerCase()));

    filtered.forEach((lbl) => {
      const isSelected = state.selectedLabels.has(lbl.name);
      const row = document.createElement('div');
      row.className = `label-check-row ${isSelected ? 'selected' : ''}`;
      
      row.innerHTML = `
        <span class="label-name-text">${lbl.name}</span>
        <span class="check-indicator">${isSelected ? '✓' : '+'}</span>
      `;

      row.addEventListener('click', () => {
        if (state.selectedLabels.has(lbl.name)) {
          state.selectedLabels.delete(lbl.name);
        } else {
          state.selectedLabels.add(lbl.name);
        }
        renderSelectedPills();
        drawChecklist(filterQuery);
      });

      container.appendChild(row);
    });

    // Add new label on-the-fly if it doesn't match an existing label
    const trimmedQuery = filterQuery.trim();
    const exactMatchExists = allLabels.some(lbl => lbl.name.toLowerCase() === trimmedQuery.toLowerCase());
    
    if (trimmedQuery.length > 0 && !exactMatchExists) {
      const addRow = document.createElement('div');
      addRow.className = 'label-check-row';
      addRow.style.borderColor = 'var(--color-primary)';
      addRow.style.backgroundColor = 'rgba(88, 76, 244, 0.08)';
      
      addRow.innerHTML = `
        <span class="label-name-text" style="color: var(--text-accent); font-weight: 700;">+ Add "${trimmedQuery}"</span>
        <span class="check-indicator" style="color: var(--color-primary); font-size: 14px;">⚡</span>
      `;
      
      addRow.addEventListener('click', async () => {
        const newLabel = {
          id: generateUUID('lbl'),
          accountId: state.activeAccountId,
          name: trimmedQuery
        };
        
        // Save to IndexedDB
        await state.db.put('labels', newLabel);
        
        // Add to cached list to avoid reloading full index
        allLabels.push(newLabel);
        
        // Check this label
        state.selectedLabels.add(newLabel.name);
        
        // Clear search and refresh lists
        searchInput.value = '';
        renderSelectedPills();
        drawChecklist('');
      });
      
      container.appendChild(addRow);
    }
  }

  function renderSelectedPills() {
    const pillBox = document.getElementById('selected-labels-pills');
    pillBox.innerHTML = '';

    if (state.selectedLabels.size === 0) {
      pillBox.innerHTML = '<span class="empty-state-text">No Selected Labels</span>';
      return;
    }

    state.selectedLabels.forEach((name) => {
      const pill = document.createElement('div');
      pill.className = 'label-pill';
      pill.innerHTML = `
        <span>${name}</span>
        <span class="close-x">×</span>
      `;
      pill.addEventListener('click', () => {
        state.selectedLabels.delete(name);
        renderSelectedPills();
        drawChecklist(searchInput.value);
      });
      pillBox.appendChild(pill);
    });
  }

  // Reset search
  searchInput.value = '';
  searchInput.oninput = (e) => {
    drawChecklist(e.target.value);
  };

  // Clear all click triggers
  document.getElementById('clear-selected-labels-btn').onclick = () => {
    state.selectedLabels.clear();
    renderSelectedPills();
    drawChecklist();
  };

  renderSelectedPills();
  drawChecklist();
}

// --------------------------------------------------------------------------
// 13. Settings View Panel Renderers
// --------------------------------------------------------------------------
async function renderSettings() {
  // 1. Render Accounts
  const accountsList = await state.db.getAll('accounts');
  const accountsContainer = document.getElementById('settings-accounts-list');
  accountsContainer.innerHTML = '';

  accountsList.forEach((acc) => {
    const isActive = acc.id === state.activeAccountId;
    const row = document.createElement('div');
    row.className = `settings-item-row ${isActive ? 'active' : ''}`;
    row.innerHTML = `
      <span class="settings-item-name">${acc.name} ${isActive ? '🏆' : ''}</span>
      <div style="display: flex; gap: 8px;">
        <button class="accent-icon-btn edit-acc-btn" title="Edit Account Name">✏️</button>
        ${!isActive ? `<button class="accent-icon-btn switch-acc-btn" data-id="${acc.id}">✓</button>` : ''}
        ${accountsList.length > 1 ? `<button class="accent-icon-btn delete-acc-btn" style="border-color: var(--color-danger); color: var(--color-danger);" data-id="${acc.id}">×</button>` : ''}
      </div>
    `;

    // Click Edit Account Name
    row.querySelector('.edit-acc-btn').onclick = async () => {
      const newName = prompt(`Enter new name for account:`, acc.name);
      if (newName !== null && newName.trim() !== '') {
        acc.name = newName.trim();
        await state.db.put('accounts', acc);
        renderSettings();
        renderDashboard(); // Refresh header active name
      }
    };

    // Click Switch
    const switchBtn = row.querySelector('.switch-acc-btn');
    if (switchBtn) {
      switchBtn.onclick = async () => {
        state.activeAccountId = acc.id;
        await state.db.put('settings', { key: 'activeAccountId', value: acc.id });
        renderSettings();
        renderDashboard();
      };
    }

    // Click Delete
    const deleteBtn = row.querySelector('.delete-acc-btn');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm('Are you sure you want to delete this account? All associated expenses, categories, and labels will be deleted.')) {
          // Cascading deletes of account variables
          await state.db.delete('accounts', acc.id);
          
          // Cascading delete of linked groups
          const allGroups = await state.db.getGroupedByIndex('expense_groups', 'accountId', acc.id);
          for (const g of allGroups) {
            await state.db.deleteExpenseGroup(g.id);
          }

          // Wipe custom categories and labels
          const cats = await state.db.getGroupedByIndex('categories', 'accountId', acc.id);
          for (const c of cats) await state.db.delete('categories', c.id);

          const lbls = await state.db.getGroupedByIndex('labels', 'accountId', acc.id);
          for (const l of lbls) await state.db.delete('labels', l.id);

          // If deleted active account, switch to first remaining
          if (state.activeAccountId === acc.id) {
            const remaining = await state.db.getAll('accounts');
            state.activeAccountId = remaining[0].id;
            await state.db.put('settings', { key: 'activeAccountId', value: remaining[0].id });
          }

          renderSettings();
        }
      };
    }

    accountsContainer.appendChild(row);
  });

  // 2. Render Global Payment Methods
  const paymentsList = await state.db.getAll('payment_methods');
  const paymentsContainer = document.getElementById('settings-payments-list');
  paymentsContainer.innerHTML = '';

  paymentsList.forEach((pm) => {
    const row = document.createElement('div');
    row.className = 'settings-item-row';
    row.innerHTML = `
      <span class="settings-item-name">${pm.name}</span>
      ${paymentsList.length > 1 ? `<button class="accent-icon-btn delete-pm-btn" style="border-color: var(--color-danger); color: var(--color-danger);" data-id="${pm.id}">×</button>` : ''}
    `;

    const deleteBtn = row.querySelector('.delete-pm-btn');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        await state.db.delete('payment_methods', pm.id);
        renderSettings();
      };
    }

    paymentsContainer.appendChild(row);
  });

  // 3. Render Categories (Scoped to active account)
  const categoriesList = await state.db.getGroupedByIndex('categories', 'accountId', state.activeAccountId);
  const categoriesContainer = document.getElementById('settings-categories-list');
  categoriesContainer.innerHTML = '';

  categoriesList.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'settings-item-row';
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px; padding: 4px; background: ${cat.bgColor}; border-radius: var(--radius-sm); color: ${cat.textColor}">${cat.icon || '💰'}</span>
        <span class="settings-item-name">${cat.name}</span>
      </div>
      ${categoriesList.length > 1 ? `<button class="accent-icon-btn delete-cat-btn" style="border-color: var(--color-danger); color: var(--color-danger);" data-id="${cat.id}">×</button>` : ''}
    `;

    const deleteBtn = row.querySelector('.delete-cat-btn');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm(`Are you sure you want to delete the category "${cat.name}"? Existing items will remain, but you won't be able to select it for new transactions.`)) {
          await state.db.delete('categories', cat.id);
          renderSettings();
        }
      };
    }

    categoriesContainer.appendChild(row);
  });

  // 3b. Render KKB QRs list (Stored globally in settings key 'kkbQrs')
  const qrsRecord = await state.db.get('settings', 'kkbQrs');
  const qrsList = qrsRecord ? qrsRecord.value : [];
  const qrsContainer = document.getElementById('settings-qrs-list');
  qrsContainer.innerHTML = '';

  if (qrsList.length === 0) {
    qrsContainer.innerHTML = `<div class="empty-state-text" style="padding: 10px 0;">No QR codes uploaded.</div>`;
  } else {
    qrsList.forEach((qr) => {
      const row = document.createElement('div');
      row.className = 'qr-item-row';
      row.innerHTML = `
        <div class="qr-item-info">
          <img src="${qr.base64}" class="qr-item-thumb" alt="QR Thumb">
          <span class="qr-item-name">${qr.name}</span>
        </div>
        <button class="qr-item-delete-btn" data-id="${qr.id}" aria-label="Delete QR">
          <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.342 8.142A2.25 2.25 0 0 1 12.184 20H9.816a2.25 2.25 0 0 1-2.214-2.858L7.26 9m4.86-5.813L15 12M9 6h6M4 6h16" /></svg>
        </button>
      `;

      row.querySelector('.qr-item-delete-btn').onclick = async () => {
        if (confirm(`Delete QR code "${qr.name}"?`)) {
          const updatedQrs = qrsList.filter(q => q.id !== qr.id);
          await state.db.put('settings', { key: 'kkbQrs', value: updatedQrs });
          renderSettings();
        }
      };

      qrsContainer.appendChild(row);
    });
  }

  // 4. Load Suggestions Toggle Setting
  const geoToggle = document.getElementById('location-toggle-checkbox');
  geoToggle.checked = state.locationAutocompleteEnabled;
}

// --------------------------------------------------------------------------
// 14. Sheet Overlays (Account switcher trigger modal)
// --------------------------------------------------------------------------
async function showAccountsBottomSheet() {
  const sheet = document.getElementById('accounts-sheet');
  const accountsList = await state.db.getAll('accounts');
  const listContainer = document.getElementById('sheet-accounts-container');
  listContainer.innerHTML = '';

  accountsList.forEach((acc) => {
    const isActive = acc.id === state.activeAccountId;
    const row = document.createElement('div');
    row.className = `sheet-account-row ${isActive ? 'active' : ''}`;
    row.innerHTML = `
      <span class="row-name">${acc.name}</span>
      <span class="check-dot"></span>
    `;

    row.addEventListener('click', async () => {
      state.activeAccountId = acc.id;
      await state.db.put('settings', { key: 'activeAccountId', value: acc.id });
      sheet.classList.add('hidden');
      renderDashboard();
    });

    listContainer.appendChild(row);
  });

  sheet.classList.remove('hidden');
}

// --------------------------------------------------------------------------
// 15. Form Submission Process (Atomic saving)
// --------------------------------------------------------------------------
async function handleFormSubmit() {
  const descGroupInput = document.getElementById('form-group-description').value.trim();
  const dateStr = document.getElementById('form-date-picker').value;
  const paymentMethod = document.getElementById('form-payment-method').value;

  if (!descGroupInput) {
    alert('Please enter a description for the receipt.');
    return;
  }

  // Collect itemized rows
  const itemRows = document.querySelectorAll('#receipt-items-container .item-row');
  const itemsDrafts = [];
  const groupId = state.activeEditingGroupId || generateUUID('grp');

  let validateOK = true;

  itemRows.forEach((row) => {
    const itemDesc = row.querySelector('.description').value.trim();
    const itemAmt = parseFloat(row.querySelector('.amount').value) || 0;
    const itemCat = row.querySelector('.category-select').value;
    const itemSplitUser = row.dataset.splitUser || '';

    if (!itemDesc) {
      alert('Please fill out descriptions for all breakdown items.');
      validateOK = false;
      return;
    }

    itemsDrafts.push({
      id: generateUUID('item'),
      groupId: groupId,
      description: itemDesc,
      amount: itemAmt,
      category: itemCat,
      splitUser: itemSplitUser
    });
  });

  if (!validateOK) return;

  // Build group record
  const groupRecord = {
    id: groupId,
    accountId: state.activeAccountId,
    description: descGroupInput,
    date: dateStr,
    paymentMethod: paymentMethod,
    labels: Array.from(state.selectedLabels),
    createdAt: Date.now()
  };

  // If creating new, capture coordinates if active
  if (!state.activeEditingGroupId && state.locationAutocompleteEnabled && state.cachedPosition) {
    groupRecord.latitude = state.cachedPosition.lat;
    groupRecord.longitude = state.cachedPosition.lng;
  } else if (state.activeEditingGroupId) {
    // Preserve old coordinates when editing
    const oldGroup = await state.db.get('expense_groups', state.activeEditingGroupId);
    if (oldGroup) {
      if (oldGroup.latitude != null) groupRecord.latitude = oldGroup.latitude;
      if (oldGroup.longitude != null) groupRecord.longitude = oldGroup.longitude;
      groupRecord.createdAt = oldGroup.createdAt; // preserve creation order
    }
  }

  // Atomic database write
  await state.db.saveFullReceipt(groupRecord, itemsDrafts);
  
  // Go back
  navigateBack();
}

// --------------------------------------------------------------------------
// 16. App Bindings & Initializers
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Fam App] Initializing Master Engine...');

  // Initialize DB
  const db = new FamDB();
  await db.init();
  state.db = db;

  // Pre-seed if fresh setup
  await seedDatabaseIfEmpty(db);

  // Load state settings
  const cachedActiveAcc = await db.get('settings', 'activeAccountId');
  if (cachedActiveAcc) {
    state.activeAccountId = cachedActiveAcc.value;
  } else {
    // Fallback if settings was cleared
    const allAccs = await db.getAll('accounts');
    state.activeAccountId = allAccs[0].id;
  }

  const cachedBalanceHidden = await db.get('settings', 'balanceHidden');
  if (cachedBalanceHidden) {
    state.balanceHidden = cachedBalanceHidden.value;
  }

  const cachedGeoToggle = await db.get('settings', 'locationAutocomplete');
  if (cachedGeoToggle) {
    state.locationAutocompleteEnabled = cachedGeoToggle.value;
  }

  // Bind View Navigation buttons
  document.getElementById('prev-month-btn').onclick = () => {
    state.activeMonth.setMonth(state.activeMonth.getMonth() - 1);
    renderDashboard();
  };
  document.getElementById('next-month-btn').onclick = () => {
    state.activeMonth.setMonth(state.activeMonth.getMonth() + 1);
    renderDashboard();
  };

  // Nav Switch triggers
  document.getElementById('nav-settings-btn').onclick = () => navigateTo('settings-view');
  document.getElementById('settings-settings-btn').onclick = () => navigateTo('settings-view');
  document.getElementById('settings-home-btn').onclick = () => navigateTo('dashboard-view');
  document.getElementById('nav-home-btn').onclick = () => navigateTo('dashboard-view');

  // Floating + button triggers
  document.getElementById('nav-add-btn').onclick = () => setupExpenseForm();
  document.getElementById('settings-add-btn').onclick = () => setupExpenseForm();

  // Switch triggers
  document.getElementById('account-switcher-trigger').onclick = showAccountsBottomSheet;
  document.getElementById('accounts-sheet-scrim').onclick = () => {
    document.getElementById('accounts-sheet').classList.add('hidden');
  };
  document.getElementById('sheet-manage-btn').onclick = () => {
    document.getElementById('accounts-sheet').classList.add('hidden');
    navigateTo('settings-view');
  };

  // Total Expenses triggers sliding overview screen
  document.getElementById('total-expenses-trigger').onclick = () => {
    navigateTo('overview-view');
  };

  // Back arrow routing
  document.getElementById('overview-back-btn').onclick = navigateBack;
  document.getElementById('form-back-btn').onclick = navigateBack;
  document.getElementById('kkb-back-btn').onclick = navigateBack;
  document.getElementById('labels-back-btn').onclick = navigateBack;

  // Toggle visible totals eye icon
  document.getElementById('balance-toggle-btn').onclick = async (e) => {
    e.stopPropagation();
    state.balanceHidden = !state.balanceHidden;
    await db.put('settings', { key: 'balanceHidden', value: state.balanceHidden });
    renderDashboard();
  };

  // Core Calculator grid listener
  document.querySelectorAll('.calc-btn').forEach((btn) => {
    btn.onclick = () => {
      handleCalculatorButton(btn.dataset.val);
    };
  });

  // Dynamic Item row appender button
  document.getElementById('add-item-row-btn').onclick = () => {
    renderItemRow();
  };

  // Form Submitter action
  document.getElementById('submit-expense-btn').onclick = handleFormSubmit;

  // Date bubble picker action
  const dateBtn = document.getElementById('form-date-btn');
  const datePicker = document.getElementById('form-date-picker');
  
  dateBtn.onclick = () => {
    // Force native date picker to open on custom badge click
    datePicker.showPicker();
  };
  
  datePicker.onchange = (e) => {
    document.getElementById('form-date-text').textContent = e.target.value;
  };

  // Label bubble picker triggers screen switch
  document.getElementById('form-label-btn').onclick = () => {
    navigateTo('labels-view');
  };

  // Confirm labels panel changes
  document.getElementById('confirm-labels-btn').onclick = () => {
    const list = Array.from(state.selectedLabels);
    document.getElementById('form-labels-text').textContent = list.length > 0 ? list.join(', ') : 'Label';
    navigateBack();
  };

  // KKB Split Toggler action (Edit screen only)
  const formKkbBtn = document.getElementById('form-kkb-trigger');
  formKkbBtn.onclick = () => {
    const container = document.getElementById('receipt-items-container');
    const isAct = formKkbBtn.classList.toggle('active');

    container.querySelectorAll('.item-row').forEach((row) => {
      const assRow = row.querySelector('.item-kkb-assignee-row');
      if (isAct) {
        assRow.classList.remove('hidden');
      } else {
        assRow.classList.add('hidden');
        // Clear value on toggle off
        assRow.querySelector('.assignee-input').value = '';
        row.dataset.splitUser = '';
      }
    });
  };

  // Settings control setups
  // 1. Add custom account
  document.getElementById('add-account-btn').onclick = async () => {
    const inp = document.getElementById('new-account-name-input');
    const name = inp.value.trim();
    if (!name) return;

    const newAcc = {
      id: generateUUID('acc'),
      name: name,
      createdAt: Date.now()
    };
    await db.put('accounts', newAcc);
    
    // Auto-seed default categories for new account
    const defaultCats = [
      { id: generateUUID('cat'), accountId: newAcc.id, name: 'Food', icon: '🍟', bgColor: '#ffe4e6', textColor: '#e11d48' },
      { id: generateUUID('cat'), accountId: newAcc.id, name: 'Transpo', icon: '🚄', bgColor: '#e0f2fe', textColor: '#0284c7' },
      { id: generateUUID('cat'), accountId: newAcc.id, name: 'Utilities', icon: '💡', bgColor: '#fef3c7', textColor: '#d97706' },
      { id: generateUUID('cat'), accountId: newAcc.id, name: 'Shopping', icon: '🛍️', bgColor: '#f3e8ff', textColor: '#7c3aed' }
    ];
    for (const c of defaultCats) await db.put('categories', c);

    // Auto-seed default labels
    const defaultLabels = [
      { id: generateUUID('lbl'), accountId: newAcc.id, name: 'Emergency' },
      { id: generateUUID('lbl'), accountId: newAcc.id, name: 'Fast Food' }
    ];
    for (const l of defaultLabels) await db.put('labels', l);

    inp.value = '';
    renderSettings();
  };

  // 2. Add global payment method
  document.getElementById('add-payment-btn').onclick = async () => {
    const inp = document.getElementById('new-payment-name-input');
    const name = inp.value.trim();
    if (!name) return;

    await db.put('payment_methods', {
      id: generateUUID('pm'),
      name: name,
      createdAt: Date.now()
    });

    inp.value = '';
    renderSettings();
  };

  // 3. Add category (scoped to active account)
  // Cyclic palette: each new category automatically gets the next harmonious pastel pair
  const CATEGORY_COLOR_PALETTE = [
    { bgColor: '#fce7f3', textColor: '#be185d' }, // pink
    { bgColor: '#ede9fe', textColor: '#6d28d9' }, // violet
    { bgColor: '#d1fae5', textColor: '#065f46' }, // emerald
    { bgColor: '#fef3c7', textColor: '#92400e' }, // amber
    { bgColor: '#dbeafe', textColor: '#1e40af' }, // blue
    { bgColor: '#ffedd5', textColor: '#9a3412' }, // orange
    { bgColor: '#f0fdf4', textColor: '#14532d' }, // green
    { bgColor: '#fdf2f8', textColor: '#831843' }, // rose
    { bgColor: '#e0f2fe', textColor: '#0c4a6e' }, // sky
    { bgColor: '#fef9c3', textColor: '#713f12' }, // yellow
  ];

  document.getElementById('add-category-btn').onclick = async () => {
    const iconInp = document.getElementById('new-category-icon-input');
    const nameInp = document.getElementById('new-category-name-input');

    const icon = iconInp.value.trim() || '💰';
    const name = nameInp.value.trim();
    if (!name) {
      nameInp.focus();
      nameInp.style.borderColor = 'var(--color-danger)';
      setTimeout(() => { nameInp.style.borderColor = ''; }, 1200);
      return;
    }

    // Prevent duplicate category names within same account
    const existing = await db.getGroupedByIndex('categories', 'accountId', state.activeAccountId);
    if (existing.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      nameInp.style.borderColor = 'var(--color-warning)';
      setTimeout(() => { nameInp.style.borderColor = ''; }, 1200);
      return;
    }

    // Pick next palette color cyclically based on how many categories exist
    const palette = CATEGORY_COLOR_PALETTE[existing.length % CATEGORY_COLOR_PALETTE.length];

    await db.put('categories', {
      id: generateUUID('cat'),
      accountId: state.activeAccountId,
      name,
      icon,
      bgColor: palette.bgColor,
      textColor: palette.textColor
    });

    iconInp.value = '';
    nameInp.value = '';
    renderSettings();
  };

  // 3b. Add KKB QR Code binding
  const qrFileInput = document.getElementById('new-qr-file-input');
  const qrFileLabel = document.getElementById('new-qr-file-label');
  let selectedQrBase64 = null;

  qrFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Update label to show selected filename
      qrFileLabel.textContent = file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name;
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        selectedQrBase64 = evt.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      qrFileLabel.textContent = 'Choose Image';
      selectedQrBase64 = null;
    }
  };

  document.getElementById('add-qr-btn').onclick = async () => {
    const nameInp = document.getElementById('new-qr-name-input');
    const name = nameInp.value.trim();
    
    if (!name) {
      nameInp.focus();
      nameInp.style.borderColor = 'var(--color-danger)';
      setTimeout(() => { nameInp.style.borderColor = ''; }, 1200);
      return;
    }

    if (!selectedQrBase64) {
      alert('Please select a QR code image to upload.');
      return;
    }

    const qrsRecord = await db.get('settings', 'kkbQrs');
    const qrsList = qrsRecord ? qrsRecord.value : [];
    
    qrsList.push({
      id: generateUUID('qr'),
      name: name,
      base64: selectedQrBase64
    });

    await db.put('settings', { key: 'kkbQrs', value: qrsList });

    // Reset fields
    nameInp.value = '';
    qrFileInput.value = '';
    qrFileLabel.textContent = 'Choose Image';
    selectedQrBase64 = null;

    renderSettings();
  };

  // 4. Geolocation toggle
  document.getElementById('location-toggle-checkbox').onchange = async (e) => {
    state.locationAutocompleteEnabled = e.target.checked;
    await db.put('settings', { key: 'locationAutocomplete', value: state.locationAutocompleteEnabled });
    updateGeoPosition();
  };

  // 5. Utility Wipes
  document.getElementById('clear-all-data-btn').onclick = async () => {
    if (confirm('CAUTION: This will wipe all accounts, transactions, and variables in the database. Proceed?')) {
      await db.clearAll();
      // Reload page to re-seed fresh defaults
      window.location.reload();
    }
  };

  // 6. JSON Exporter
  document.getElementById('export-data-btn').onclick = async () => {
    const data = {
      accounts: await db.getAll('accounts'),
      expense_groups: await db.getAll('expense_groups'),
      expense_items: await db.getAll('expense_items'),
      categories: await db.getAll('categories'),
      labels: await db.getAll('labels'),
      payment_methods: await db.getAll('payment_methods')
    };

    const str = JSON.stringify(data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fam_Expense_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Service Worker Registration for PWA caching & Auto-Update
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('[Service Worker] Controller changed, reloading page...');
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[Service Worker] Registered successfully:', reg.scope);
          // Check for service worker updates on the server periodically
          setInterval(() => {
            reg.update().catch(() => {});
          }, 60 * 1000); // Check every minute
        })
        .catch((err) => console.warn('[Service Worker] Registration failed:', err));
    });
  }

  // Draw initial dashboard screen
  renderDashboard();
});
