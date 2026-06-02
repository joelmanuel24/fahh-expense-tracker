import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../db';
import { ExpenseGroup, ExpenseItem } from '../../../types';
import { Calculator } from '../../../components/Calculator';
import { LabelsDrawer } from '../components/LabelsDrawer';
import { SwitchToggle } from '../../../components/SwitchToggle';
import { getHaversineDistance } from '../utils/locationLogic';
import { useSettingsStore } from '../../Settings/models/store';
import { useExpensesStore } from '../models/store';

interface ExpenseFormProps {
  activeAccountId: string;
  editingGroupId: string | null;
  onClose: () => void;
  activeMonth: Date;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  activeAccountId,
  editingGroupId,
  onClose,
  activeMonth
}) => {
  const getTodayDateString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(() => getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isKkbActive, setIsKkbActive] = useState<boolean>(false);
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [isReceiptDrawerOpen, setIsReceiptDrawerOpen] = useState<boolean>(false);
  const [activeToast, setActiveToast] = useState<{
    message: string;
    item: Partial<ExpenseItem>;
    index: number;
  } | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  
  // Breakdown items state
  const [items, setItems] = useState<Partial<ExpenseItem>[]>([
    { id: '1', description: '', amount: 0, category: 'Others', splitUser: '' }
  ]);

  // Options & past transaction states fetched from settings and expenses stores
  const { categories, payments, loadCategories, loadPayments } = useSettingsStore();
  const { expenseGroups, expenseItems, loadExpensesData, saveExpenseGroup } = useExpensesStore();
  
  // Geolocation states
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // Keyboard suppression & Calculator states
  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [calcInitialVal, setCalcInitialVal] = useState<string>('0');

  // Autocomplete states
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Derive pastTransactions reactively from store arrays
  const pastTransactions = React.useMemo(() => {
    return expenseGroups.map(g => {
      const firstItem = expenseItems.find(i => i.groupId === g.id);
      return {
        ...g,
        category: firstItem ? firstItem.category : 'Others'
      };
    });
  }, [expenseGroups, expenseItems]);

  // Labels selection drawer state
  const [isLabelsOpen, setIsLabelsOpen] = useState<boolean>(false);

  // Category picker bottom-sheet state
  const [isCatPickerOpen, setIsCatPickerOpen] = useState<boolean>(false);

  // Payment drawer bottom-sheet state
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState<boolean>(false);

  // Throttle timer reference to prevent autocomplete flash
  const timerRef = useRef<any>(null);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const handleDateButtonClick = () => {
    if (dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch (err) {
        dateInputRef.current.click();
      }
    }
  };

  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setReceiptImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Load select options and past transactions from global store creators in parallel
  useEffect(() => {
    const initData = async () => {
      await Promise.all([
        loadCategories(activeAccountId),
        loadPayments(),
        loadExpensesData(activeAccountId)
      ]);
    };
    initData();
  }, [activeAccountId, loadCategories, loadPayments, loadExpensesData]);

  // Pre-select cash if creating new and payments have loaded
  useEffect(() => {
    if (!editingGroupId && payments.length > 0) {
      // Find "Cash" in payments, placing it as first preference
      const cashPm = payments.find(p => p.name.toLowerCase() === 'cash');
      setPaymentMethod(cashPm ? cashPm.name : payments[0].name);
    }
  }, [payments, editingGroupId]);

  // Fetch location suggestions enabled state
  useEffect(() => {
    const checkGeo = async () => {
      const locEnabled = await db.get<{ key: string; value: boolean }>('settings', 'locationSuggestEnabled');
      if (locEnabled && locEnabled.value && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          },
          () => console.log("Geolocation permission denied.")
        );
      }
    };
    checkGeo();
  }, []);

  // Close calculator, labels, category picker, or payment drawer overlay on browser/hardware back button swipe
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const activeModal = params.get('modal');
      if (activeModal !== 'calculator') {
        setIsCalcOpen(false);
      }
      if (activeModal !== 'labels') {
        setIsLabelsOpen(false);
      }
      if (activeModal !== 'category-picker') {
        setIsCatPickerOpen(false);
      }
      if (activeModal !== 'payment-drawer') {
        setIsPaymentDrawerOpen(false);
      }
      if (activeModal !== 'receipt-drawer') {
        setIsReceiptDrawerOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Pre-select category for quick-add grid shortcut on load
  useEffect(() => {
    if (!editingGroupId && categories.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const quickCat = params.get('quickAddCategory');
      if (quickCat) {
        const matched = categories.find(c => c.name.toLowerCase() === quickCat.toLowerCase());
        if (matched) {
          setItems([
            { id: '1', description: '', amount: 0, category: matched.name, splitUser: '' }
          ]);
        }
      }
    }
  }, [categories, editingGroupId]);

  // Load existing expense for EDIT mode
  useEffect(() => {
    const loadEditingGroup = async () => {
      if (!editingGroupId) return;
      const group = await db.get<ExpenseGroup>('expense_groups', editingGroupId);
      if (!group) return;

      setDescription(group.description);
      setDate(group.date);
      setPaymentMethod(group.paymentMethod);
      setSelectedLabels(group.labels || []);
      setReceiptImage(group.receiptImage || '');
      
      const groupItems = await db.getGroupedByIndex<ExpenseItem>('expense_items', 'groupId', editingGroupId);
      setItems(groupItems);

      const hasSplits = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      setIsKkbActive(hasSplits);
    };
    loadEditingGroup();
  }, [editingGroupId]);

  // Trigger Smart Autocomplete
  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (!val.trim()) {
      setAutocompleteSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Filter unique vendors by query
    const query = val.toLowerCase();
    const uniqueVendors = new Map<string, any>();

    pastTransactions.forEach((tx) => {
      if (tx.description.toLowerCase().includes(query)) {
        let distance = Infinity;
        if (coords && tx.lat && tx.lng) {
          distance = getHaversineDistance(coords.lat, coords.lng, tx.lat, tx.lng);
        }
        
        // Keep closest record of this vendor name
        const existing = uniqueVendors.get(tx.description);
        if (!existing || distance < existing.distance) {
          uniqueVendors.set(tx.description, {
            description: tx.description,
            category: tx.category,
            distance: distance
          });
        }
      }
    });

    // Rank list: nearest locations within 500m go to the top!
    const ranked = Array.from(uniqueVendors.values()).sort((a, b) => a.distance - b.distance);
    setAutocompleteSuggestions(ranked);
    setShowSuggestions(ranked.length > 0);
  };

  const handleSelectSuggestion = (sug: any) => {
    setDescription(sug.description);
    setShowSuggestions(false);
    
    // Auto-populate first row category if blank
    if (items.length > 0 && !items[0].description) {
      const nextItems = [...items];
      nextItems[0] = { ...nextItems[0], category: sug.category };
      setItems(nextItems);
    }
  };

  // Close suggestions with a slight delay to allow clicks
  const handleDescriptionBlur = () => {
    timerRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Row breakdown actions
  const handleAddItemRow = () => {
    const defaultCat = categories.length > 0 ? categories[0].name : 'Others';
    const nextCat = items.length > 0 && items[items.length - 1].category ? items[items.length - 1].category : defaultCat;
    setItems(prev => [
      ...prev,
      { id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, description: '', amount: 0, category: nextCat, splitUser: '' }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length === 1) return;
    const itemToDelete = items[idx];
    
    // Save to toast state
    setActiveToast({
      message: `Item "${itemToDelete.description || 'Unnamed Item'}" deleted`,
      item: itemToDelete,
      index: idx
    });
    
    // Remove from active items list
    setItems(prev => prev.filter((_, i) => i !== idx));
    
    // Auto-dismiss after 4 seconds
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 4000);
  };

  const handleUndoDelete = () => {
    if (!activeToast) return;
    const { item, index } = activeToast;
    
    // Restore the item at its original index
    setItems(prev => {
      const next = [...prev];
      next.splice(index, 0, item);
      return next;
    });
    
    // Clear toast
    setActiveToast(null);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  };

  const handleItemFieldChange = (idx: number, field: string, val: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };

  // Category picker helper methods
  const getCategoryIcon = (catName: string) => {
    const found = categories.find(c => c.name === catName);
    return found ? found.icon : '📦';
  };

  const openCategoryPicker = (idx: number) => {
    setActiveItemIndex(idx);
    setIsCatPickerOpen(true);
    // Push url state for popstate back navigation closure
    const params = new URLSearchParams(window.location.search);
    params.set('modal', 'category-picker');
    window.history.pushState({ modal: 'category-picker' }, '', `?${params.toString()}`);
  };

  const closeCategoryPicker = () => {
    setIsCatPickerOpen(false);
    const params = new URLSearchParams(window.location.search);
    if (params.get('modal') === 'category-picker') {
      window.history.back();
    }
  };

  const handleSelectCategory = (catName: string) => {
    if (activeItemIndex !== null) {
      handleItemFieldChange(activeItemIndex, 'category', catName);
    }
    setIsCatPickerOpen(false);
    const params = new URLSearchParams(window.location.search);
    if (params.get('modal') === 'category-picker') {
      window.history.back();
    }
  };

  // Trigger custom calculator overlay
  const handleAmountFocus = (idx: number) => {
    setActiveItemIndex(idx);
    setCalcInitialVal(items[idx].amount?.toString() || '0');
    setIsCalcOpen(true);
    
    // Push url state for popstate back navigation closure
    window.history.pushState({ modal: 'calculator' }, '', '?modal=calculator');
  };

  const handleCalcConfirm = (finalVal: number) => {
    if (activeItemIndex !== null) {
      handleItemFieldChange(activeItemIndex, 'amount', finalVal);
    }
    setIsCalcOpen(false);
    window.history.back(); // roll back url state
  };

  const handleLabelsConfirm = (labels: string[]) => {
    setSelectedLabels(labels);
    setIsLabelsOpen(false);
    window.history.back();
  };

  const calculateReceiptTotal = (): number => {
    return items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      alert('Please fill out the vendor/store description.');
      return;
    }

    const totalAmount = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    if (totalAmount <= 0) {
      alert('Total expense amount must be greater than 0.');
      return;
    }

    const invalidItem = items.find(i => !i.description?.trim());
    if (invalidItem) {
      alert('Please fill out descriptions for all breakdown items.');
      return;
    }

    const groupId = editingGroupId || `grp_${Date.now()}`;
    
    // Save Group
    const groupRecord: ExpenseGroup = {
      id: groupId,
      accountId: activeAccountId,
      description: description.trim(),
      date: date,
      paymentMethod: paymentMethod,
      labels: selectedLabels,
      receiptImage: receiptImage || undefined
    };

    // Attach Geotag coordinates if location check is active
    if (coords) {
      groupRecord.lat = coords.lat;
      groupRecord.lng = coords.lng;
    }

    const itemRecords: ExpenseItem[] = items.map((row) => ({
      id: row.id && !row.id.startsWith('new_') ? row.id : `item_${Math.random().toString(36).substring(2, 9)}`,
      groupId: groupId,
      description: (row.description || '').trim(),
      amount: parseFloat(row.amount as any) || 0,
      category: row.category || 'Others',
      splitUser: isKkbActive ? row.splitUser || '' : ''
    }));

    await saveExpenseGroup(groupRecord, itemRecords, editingGroupId);

    onClose();
  };

  return (
    <>
      <header className="view-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="icon-btn" onClick={onClose} aria-label="Back" style={{ zIndex: 5, flexShrink: 0 }}>
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        
        <h1 className="view-title" id="form-title" style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          margin: 0,
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: 700,
          width: 'max-content',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          {editingGroupId ? 'Edit Expense' : 'New Expense'}
        </h1>
        
        {/* ⚡ KKB split badge action button on the top right */}
        <button 
          type="button" 
          className={`kkb-btn-action ${isKkbActive ? 'active' : ''}`}
          onClick={() => setIsKkbActive(prev => !prev)}
          style={{ zIndex: 5, flexShrink: 0 }}
        >
          <span className="kkb-glow">⚡ KKB!</span>
        </button>
      </header>

      <div className="scroll-content padding-bottom-large">
        <form onSubmit={(e) => e.preventDefault()}>
          
          {/* Vendor Name */}
          <div className="form-group">
            <label className="input-label">DESCRIPTION</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text" 
                placeholder="e.g. Mcdo, Walmart" 
                required 
                autoComplete="off" 
                className="form-input"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onBlur={handleDescriptionBlur}
              />
              
              {/* Autocomplete suggestion popups */}
              {showSuggestions && (
                <div className="autocomplete-dropdown" style={{ top: '100%', left: 0, right: 0, marginTop: '6px' }}>
                  {autocompleteSuggestions.map((sug, idx) => (
                    <div 
                      key={idx} 
                      className="autocomplete-item"
                      onMouseDown={() => handleSelectSuggestion(sug)}
                    >
                      <span className="desc-text">
                        {sug.distance < 0.5 && <span style={{ marginRight: '4px' }}>📍</span>}
                        {sug.description}
                      </span>
                      <span className="price-badge">{sug.category}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Date and Labels bubbles */}
          <div className="badge-actions-row">
            <div 
              className="badge-action-btn" 
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={handleDateButtonClick}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="badge-icon">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <span>{date === getTodayDateString() ? 'Today' : date}</span>
              <input 
                ref={dateInputRef}
                type="date" 
                className="hidden-date-picker"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
              />
            </div>
            
            <button 
              type="button" 
              className="badge-action-btn"
              onClick={() => {
                setIsLabelsOpen(true);
                window.history.pushState({ modal: 'labels' }, '', '?modal=labels');
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="badge-icon">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.5 1.5 0 0 0 2.122 0l4.318-4.318a1.5 1.5 0 0 0 0-2.122L11.16 4.659A2.25 2.25 0 0 0 9.568 3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
              </svg>
              <span>
                {selectedLabels.length > 1 
                  ? `${selectedLabels.length} labels` 
                  : selectedLabels.length === 1 
                    ? selectedLabels[0] 
                    : 'Label'}
              </span>
            </button>

            <button 
              type="button"
              className={`badge-action-btn ${receiptImage ? 'active' : ''}`}
              style={{ 
                position: 'relative', 
                cursor: 'pointer',
                backgroundColor: receiptImage ? 'rgba(88, 76, 244, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                borderColor: receiptImage ? 'var(--color-primary)' : 'transparent',
                color: receiptImage ? 'var(--color-primary-light)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={() => {
                setIsReceiptDrawerOpen(true);
                window.history.pushState({ modal: 'receipt-drawer' }, '', '?modal=receipt-drawer');
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="badge-icon">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              <span>Receipt</span>
            </button>
            <input 
              ref={receiptFileInputRef}
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }}
              onChange={handleReceiptFileChange}
            />
          </div>

          {/* Scoped Payment Method */}
          <div className="form-group flex-row-between">
            <span className="payment-method-label">Payment Method:</span>
            <button
              type="button"
              className="payment-method-trigger-btn"
              onClick={() => {
                setIsPaymentDrawerOpen(true);
                window.history.pushState({ modal: 'payment-drawer' }, '', '?modal=payment-drawer');
              }}
            >
              <span>{paymentMethod}</span>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="chevron-icon">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Breakdown Items stack */}
          <div className="items-breakdown-section">
            <div className="items-header-row">
              <span className="items-title">BREAKDOWN ITEMS</span>
              <button type="button" className="text-action-btn" onClick={handleAddItemRow}>
                <span>+ Add Item</span>
              </button>
            </div>

            <div className="items-container">
              {items.map((row, idx) => (
                <div key={row.id || idx} className="item-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                  
                  {/* Dynamic grid row inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 32px', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      placeholder="Item name"
                      className="item-input description"
                      value={row.description || ''}
                      onChange={(e) => handleItemFieldChange(idx, 'description', e.target.value)}
                    />
                    
                    {/* suppression amount */}
                    <input 
                      type="text" 
                      inputMode="none"
                      placeholder="0.00"
                      className="item-input amount"
                      value={row.amount === 0 ? '' : row.amount}
                      onFocus={() => handleAmountFocus(idx)}
                      readOnly
                    />

                    <div 
                      className="category-picker-trigger" 
                      onClick={() => openCategoryPicker(idx)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        height: '28px', 
                        borderRadius: 'var(--radius-sm)', 
                        backgroundColor: 'var(--bg-app)', 
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        padding: '0 6px',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      <span style={{ fontSize: '15px', lineHeight: '1' }}>
                        {getCategoryIcon(row.category || 'Others')}
                      </span>
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '10px', height: '10px', marginLeft: '3px', color: 'var(--text-secondary)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>

                    <button 
                      type="button" 
                      className="delete-row-btn" 
                      onClick={() => handleRemoveItemRow(idx)}
                      disabled={items.length === 1}
                      aria-label="Delete Item"
                    >
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>

                  {/* KKB Split assignee row (expanded inline) */}
                  {isKkbActive && (
                    <div className="item-kkb-assignee-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                      <span className="assignee-avatar">👤</span>
                      <input 
                        type="text" 
                        placeholder="Who bought this? (e.g. Alice)"
                        className="assignee-input"
                        style={{ flex: 1 }}
                        value={row.splitUser || ''}
                        disabled={row.splitUser?.trim().toLowerCase() === 'me'}
                        onChange={(e) => handleItemFieldChange(idx, 'splitUser', e.target.value)}
                      />
                      
                      {/* "Me" Toggle Switch */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Me</span>
                        <SwitchToggle
                          checked={row.splitUser?.trim().toLowerCase() === 'me'}
                          onChange={(checked) => handleItemFieldChange(idx, 'splitUser', checked ? 'Me' : '')}
                          scale={0.75}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Running total */}
          <div className="receipt-running-total">
            <span>RECEIPT TOTAL</span>
            <span className="total-big">PHP {calculateReceiptTotal().toFixed(2)}</span>
          </div>

          {/* Form Submit buttons */}
          <div className="form-submit-footer">
            <button 
              type="button" 
              className="primary-action-btn"
              onClick={handleSubmit}
            >
              {editingGroupId ? 'Update Expense' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>

      {/* Calculator keyboard Overlay */}
      <Calculator 
        isOpen={isCalcOpen}
        initialValue={calcInitialVal}
        onConfirm={handleCalcConfirm}
        onClose={() => {
          setIsCalcOpen(false);
          window.history.back();
        }}
      />

      {/* Labels checklists Overlay */}
      <LabelsDrawer 
        isOpen={isLabelsOpen}
        selectedLabels={new Set(selectedLabels)}
        onConfirm={handleLabelsConfirm}
        onClose={() => {
          setIsLabelsOpen(false);
          window.history.back();
        }}
        activeAccountId={activeAccountId}
      />

      {/* Custom Category Picker Bottom Sheet */}
      {isCatPickerOpen && activeItemIndex !== null && (
        <div className="bottom-sheet-overlay" style={{ zIndex: 300 }}>
          <div className="sheet-scrim" onClick={closeCategoryPicker}></div>
          <div 
            className="sheet-content-wrapper" 
            style={{ 
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              padding: '24px 24px 40px 24px',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              backgroundColor: '#1c1c1e',
              borderTop: '1px solid var(--border-light)',
              maxWidth: '480px',
              width: '100%',
              margin: '0 auto',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Select Category</h3>
              <button 
                type="button" 
                onClick={closeCategoryPicker} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '12px', 
              maxHeight: '300px', 
              overflowY: 'auto'
            }}>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.name)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px 8px',
                    borderRadius: '16px',
                    backgroundColor: items[activeItemIndex]?.category === cat.name ? 'rgba(110, 68, 255, 0.15)' : '#2c2c2e',
                    border: items[activeItemIndex]?.category === cat.name ? '1px solid var(--color-primary)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    gap: '8px'
                  }}
                >
                  <div style={{ 
                    fontSize: '28px', 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%', 
                    backgroundColor: cat.bgColor || '#3a3a3c',
                    color: cat.textColor || '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}>
                    {cat.icon}
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: items[activeItemIndex]?.category === cat.name ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    fontFamily: 'Plus Jakarta Sans, sans-serif'
                  }}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Payment Method Selection Drawer */}
      <div className={`bottom-sheet-overlay ${isPaymentDrawerOpen ? '' : 'hidden'}`}>
        <div 
          className="sheet-scrim" 
          onClick={() => {
            setIsPaymentDrawerOpen(false);
            window.history.back();
          }}
        ></div>
        <div className="sheet-content-wrapper">
          <div className="sheet-drag-indicator" onClick={() => {
            setIsPaymentDrawerOpen(false);
            window.history.back();
          }}></div>
          <h3 className="sheet-title">Select Payment Method</h3>
          
          <div className="sheet-accounts-list" style={{ paddingBottom: '24px' }}>
            {payments.map((pm) => {
              const isActive = pm.name === paymentMethod;
              return (
                <div 
                  key={pm.id} 
                  className={`sheet-account-row ${isActive ? 'active' : ''}`}
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: isActive ? 700 : 600
                  }}
                  onClick={() => {
                    setPaymentMethod(pm.name);
                    setIsPaymentDrawerOpen(false);
                    window.history.back();
                  }}
                >
                  <span className="row-name">{pm.name}</span>
                  <div className="check-dot"></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Receipt Image Drawer */}
      <div className={`bottom-sheet-overlay ${isReceiptDrawerOpen ? '' : 'hidden'}`} style={{ zIndex: 400 }}>
        <div 
          className="sheet-scrim" 
          onClick={() => {
            setIsReceiptDrawerOpen(false);
            window.history.back();
          }}
        ></div>
        <div className="sheet-content-wrapper" style={{ maxHeight: '90%' }}>
          <div className="sheet-drag-indicator" onClick={() => {
            setIsReceiptDrawerOpen(false);
            window.history.back();
          }}></div>
          <h3 className="sheet-title">Receipt Photo</h3>
          
          <div style={{ padding: '0 24px 32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            {receiptImage ? (
              <>
                <div style={{
                  width: '100%',
                  maxHeight: '260px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#000'
                }}>
                  <img 
                    src={receiptImage} 
                    alt="Attached receipt" 
                    style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain' }} 
                  />
                </div>
                
                <div className="kkb-modal-actions-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <button 
                    type="button" 
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-primary)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '15px',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'var(--transition-smooth)',
                      boxShadow: '0 4px 12px rgba(110, 68, 255, 0.2)'
                    }}
                    onClick={() => {
                      receiptFileInputRef.current?.click();
                    }}
                  >
                    Change
                  </button>
                  <button 
                    type="button" 
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-danger)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '15px',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'var(--transition-smooth)',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
                    }}
                    onClick={() => {
                      setReceiptImage('');
                      setIsReceiptDrawerOpen(false);
                      window.history.back();
                    }}
                  >
                    Delete
                  </button>
                  <button 
                    type="button" 
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '15px',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'var(--transition-smooth)'
                    }}
                    onClick={() => {
                      setIsReceiptDrawerOpen(false);
                      window.history.back();
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: '100%',
                  height: '140px',
                  borderRadius: '16px',
                  border: '2px dashed rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
                onClick={() => receiptFileInputRef.current?.click()}
                >
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '36px', height: '36px', color: 'rgba(255, 255, 255, 0.3)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>No Receipt Attached</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <button 
                    type="button" 
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--color-primary)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '15px',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'var(--transition-smooth)',
                      boxShadow: '0 4px 12px rgba(110, 68, 255, 0.2)'
                    }}
                    onClick={() => receiptFileInputRef.current?.click()}
                  >
                    Select Receipt File
                  </button>
                  <button 
                    type="button" 
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '15px',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'var(--transition-smooth)'
                    }}
                    onClick={() => {
                      setIsReceiptDrawerOpen(false);
                      window.history.back();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {activeToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 500,
          backgroundColor: '#1c1c1e',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          width: 'calc(100% - 32px)',
          maxWidth: '400px',
          boxSizing: 'border-box',
          animation: 'toastSlideUpScale 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1
          }}>
            {activeToast.message}
          </span>
          <button 
            type="button"
            onClick={handleUndoDelete}
            style={{
              backgroundColor: 'rgba(110, 68, 255, 0.15)',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary-light)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              padding: '6px 12px',
              borderRadius: '10px',
              transition: 'all 0.2s ease'
            }}
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
};
