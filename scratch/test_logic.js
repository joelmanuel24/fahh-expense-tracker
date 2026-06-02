const defaultWidgets = [
  { id: 'total_expenses', name: 'Total Expenses', visible: true },
  { id: 'categories', name: 'Category List', visible: true },
  { id: 'category_grid', name: 'Category Grid', visible: true },
  { id: 'recent_expenses', name: 'Recent Expenses', visible: true }
];

const savedList = [
  { id: 'total_expenses', name: 'Total Expenses', visible: true },
  { id: 'categories', name: 'Category List', visible: true },
  { id: 'recent_expenses', name: 'Recent Expenses', visible: true }
];

const missing = defaultWidgets.filter(dw => !savedList.some(sw => sw.id === dw.id));
console.log('Missing:', missing);
console.log('ActiveWidgets:', [...savedList, ...missing]);
