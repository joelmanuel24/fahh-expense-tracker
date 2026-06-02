const CACHE_NAME = 'fam-tracker-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

// Install Event - cache core shell resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event - clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event - Cache First, Network Fallback
self.addEventListener('fetch', (event) => {
  // Only intercept HTTP/HTTPS (bypass chrome-extensions etc)
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached shell asset
        return cachedResponse;
      }

      // Fetch from network, cache for next time
      return fetch(event.request).then((response) => {
        // Check valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Offline fallback for html requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});


## 📋 Proposed Files

1. **[index.html](file:///c:/Users/aysfr/OneDrive/Desktop/antigravity%20projects/fam/index.html)**: Master frame for views, receipt builders, calculator sheets, and the KKB screenshot card.
2. **[style.css](file:///c:/Users/aysfr/OneDrive/Desktop/antigravity%20projects/fam/style.css)**: Obsidian dark tokens, calculator style matrix, glass receipt-slip animations, dotted margins, and screenshot layout variables.
3. **[app.js](file:///c:/Users/aysfr/OneDrive/Desktop/antigravity%20projects/fam/app.js)**: Holds IndexedDB schema driver, geolocation handling, Haversine formula, KKB calculation algorithms, share templates, and route binds.
4. **[sw.js](file:///c:/Users/aysfr/OneDrive/Desktop/antigravity%20projects/fam/sw.js)**: Service worker.
5. **[manifest.json](file:///c:/Users/aysfr/OneDrive/Desktop/antigravity%20projects/fam/manifest.json)**: Manifest.
6. **[icon.svg](file:///c:/Users/aysfr/OneDrive/Desktop/antigravity%20projects/fam/icon.svg)**: Vector logo.

---

## 🔍 Verification Plan

### Automated & Browser Verification
- Open Chrome DevTools and check geolocation, inspect IndexedDB structures.

### Manual Verification Checklist
- [ ] Create an expense group with 3 items (Burger PHP 70.00, Fries PHP 31.00, Soda PHP 25.00).
- [ ] Open the Edit screen, click the **⚡ KKB!** button.
- [ ] Tag the Burger with "Alice", Fries with "Bob", and Soda with "Me".
- [ ] Click Save and check that the "View Split Receipt" button appears.
- [ ] Tap "View Split Receipt" and verify the screenshot card renders beautifully with:
  - Alice's total as PHP 70.00.
  - Bob's total as PHP 31.00.
  - My total as PHP 25.00.
  - A clean monospace style suited for screenshots.
- [ ] Tap "Copy Text Summary" and paste it into a text editor to confirm the template is formatted correctly.

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
          curs











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
        <svg viewBox="0 0 24 24" class="select-arrows"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59-1.41-1.41-3.18 3.17z"/></svg>
      </div>

      <!-- Delete row -->
      <button type="button" class="delete-row-btn" aria-label="Delete Item">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>

      <!-- KKB User assignee block (visible only when KKB split view active) -->
      <div class="item-kkb-assignee-row hidden">
        <span class="assignee-avatar">👤</span>
        <input type="text" class="assignee-input" placeholder="Who bought this? (e.g. Alice)" value="${item.splitUser || ''}">
      </div>
    `;
































































































































  const suggestions = Array.from(suggestionsMap.values()).sort((a, b) => {
    const aNear = a.distance < 500;
    const bNear = b.distance < 500;

    if (aNear && !bNear) return -1;
    if (!aNear && bNear) return 1;
    if (aNear && bNear) return a.distance - b.distance; // closer first

    return a.description.localeCompare(b.description);
  });

  if (suggestions.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  // Draw dropdown list

    dropdownEl.appendChild(itemEl);
  });

  dropdownEl.classList.remove('hidden');
}

// --------------------------------------------------------------------------
// 8. Dashboard View Renderer
// --------------------------------------------------------------------------
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
  const oldSegments = svg.querySelecto












































































































































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
    return a
  const d = new Date(group.date);
  const formattedDate = d.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('slip-date').textContent = formattedDate.toUpperCase();
  document.getElementById('slip-payment-method').textContent = group.paymentMethod;






















      <div class="slip-person-items-list">
        ${itemsRowsHtml}
      </div>
    `;
    splitsContainer.appendChild(personBlock);

    // Add sub-total box to checkout list
    const subRow = document.createElement('div');
    subRow.className = 'slip-totals-row';
    subRow.innerHTML = `
      <span class="total-person-name">👤 ${user}</span>
      <span class="total-person-amount">PHP ${userSum.toFixed(2)}</span>
    `;
    subtotalsList.appendChild(subRow);
  });

  // 4. Clipboard copier utility template
  const copyBtn = document.getElementById('kkb-copy-text-btn');
  copyBtn.onclick = () => {
    let copyText = `⚡ *SPLIT SUMMARY: ${group.description.toUpperCase()}* 🧾\n`;
    copyText += `📅 Date: ${formattedDate}\n`;
    copyText += `💳 Paid via: ${group.paymentMethod}\n`;
    copyText += `------------------------------\n`;

    usersSorted.forEach((user) => {
      const userItems = splitsMap.get(user);
      const userSum = userItems.reduce((acc, curr) => acc + curr.amount, 0);
      copyText += `👤 *${user}* owes *PHP ${userSum.toFixed(2)}*:\n`;
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
    });

    copyText += `------------------------------\n`;
    copyText += `💰 *TOTAL BILL: PHP ${grandSum.toFixed(2)}*\n`;
    copyText += `_Generated via Fam Expense Tracker PWA_`;

    navigator.clipboard.writeText(copyText).then(() => {
      const originalText = copyBtn.querySelector('span').textContent;
      copyBtn.querySelector('span').textContent = '📋 Copied Split!';
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
  const qrVisibilityToggle = document.getElementById('kkb-qrs-toggle-visibility');

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

    // Wire up master show/hide visibility checkbox
    qrVisibilityToggle.checked = true;
    qrAttachedList.classList.remove('hidden');
    
    qrVisibilityToggle.onchange = (e) => {
      if (e.target.checked) {
        qrAttachedList.classList.remove('hidden');
      } else {
        qrAttachedList.classList.add('hidden');
      }
    };
  }

  navigateTo('kkb-view');
}

// Custom overlay modal helper for marking splits as paid/unpaid
function showKKBPaidModal(user, amount, group) {

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
        ${!isActive ? `<button class="accent-icon-btn switch-acc-btn" data-id="${acc.id}">✓</button>` : ''}
        ${accountsList.length > 1 ? `<button class="accent-icon-btn delete-acc-btn" style="border-color: var(--color-danger); color: var(--color-danger);" data-id="${acc.id}">×</button>` : ''}
      </div>
    `;

    // Click Switch
    const switchBtn = row.querySelector('.switch-acc-btn');
    if (switchBtn) {
      switchBtn.onclick = async () => {
        state.activeAccountId = acc.id;
        await state.db.put('settings', { key: 'activeAccountId', value: acc.id });
        renderSettings();
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




















    listContainer.appendChild(row);
  });
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
          <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
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

// -----------------------------------------------------------



















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
  // 4. Utility Wipes
  document.getElementById('clear-all-data-btn').onclick = async () => {
    if (confirm('CAUTION: This will wipe all accounts, transactions, and variables in the database. Proceed?')) {
      await db.clearAll();





    const name = inp.value.trim();
    if (!name) return;

    await db.put('payment_methods', {
      id: generateUUID('pm'),
      name: name,
      createdAt: Date.now()
    });

    inp.value = '';
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

    a.download = `Fam_Expense_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  // Service Worker Registration for PWA caching
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[Service Worker] Registered successfully:', reg.scope))
        .catch((err) => console.warn('[Service Worker] Registration failed:', err));
    });
  }

  // Draw initial dashboard screen
  renderDashboard();
});



























































































































    URL.revokeObjectURL(url);
  };

  // Service Worker Registration for PWA caching
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[Service Worker] Registered successfully:', reg.scope))
        .catch((err) => console.warn('[Service Worker] Registration failed:', err));
    });
  }
