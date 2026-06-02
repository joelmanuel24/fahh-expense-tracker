import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { ExpenseGroup, ExpenseItem, Category, PaymentMethod } from '../types';
import { Calculator } from '../components/Calculator';
import { LabelsDrawer } from '../components/LabelsDrawer';
import { sortItemsByIds } from './Settings';

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
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [isKkbActive, setIsKkbActive] = useState<boolean>(false);
  
  // Breakdown items state
  const [items, setItems] = useState<Partial<ExpenseItem>[]>([
    { id: '1', description: '', amount: 0, category: 'Others', splitUser: '' }
  ]);

  // Options states
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Geolocation states
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // Keyboard suppression & Calculator states
  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [calcInitialVal, setCalcInitialVal] = useState<string>('0');

  // Autocomplete states
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [pastTransactions, setPastTransactions] = useState<any[]>([]);

  // Labels selection drawer state
  const [isLabelsOpen, setIsLabelsOpen] = useState<boolean>(false);

  // Category picker bottom-sheet state
  const [isCatPickerOpen, setIsCatPickerOpen] = useState<boolean>(false);

  // Payment drawer bottom-sheet state
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState<boolean>(false);

  // Load select options and past transactions
  useEffect(() => {
    const loadFormData = async () => {
      const pmList = await db.getAll<PaymentMethod>('payment_methods');
      const paymentsOrder = await db.get<{ key: string; value: string[] }>('settings', 'payment_methods_order');
      let sortedPmList = pmList;
      if (paymentsOrder && Array.isArray(paymentsOrder.value)) {
        sortedPmList = sortItemsByIds(pmList, paymentsOrder.value);
      } else {
        // Sort: "Cash" first, then others alphabetically by name
        pmList.sort((a, b) => {
          if (a.name.toLowerCase() === 'cash') return -1;
          if (b.name.toLowerCase() === 'cash') return 1;
          return a.name.localeCompare(b.name);
        });
        sortedPmList = pmList;
      }
      setPayments(sortedPmList);
      if (sortedPmList.length > 0) setPaymentMethod(sortedPmList[0].name);

      const catList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
      const categoriesOrder = await db.get<{ key: string; value: string[] }>('settings', 'categories_order');
      setCategories(sortItemsByIds(catList, categoriesOrder ? categoriesOrder.value : null));

      // Fetch all past transaction groups to feed geolocation autocomplete ranking
      const groups = await db.getGroupedByIndex<ExpenseGroup>('expense_groups', 'accountId', activeAccountId);
      const allItems = await db.getAll<ExpenseItem>('expense_items');
      
      const populated = groups.map(g => {
        const firstItem = allItems.find(i => i.groupId === g.id);
        return {
          ...g,
          category: firstItem ? firstItem.category : 'Others'
        };
      });
      setPastTransactions(populated);

      // Fetch location suggestions enabled state
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
    loadFormData();
  }, [activeAccountId]);

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
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Pre-select category for quick-add grid shortcut on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quickCat = params.get('quickAddCategory');
    if (quickCat) {
      setItems([
        { id: '1', description: '', amount: 0, category: decodeURIComponent(quickCat), splitUser: '' }
      ]);
    }
  }, []);

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
      
      const groupItems = await db.getGroupedByIndex<ExpenseItem>('expense_items', 'groupId', editingGroupId);
      setItems(groupItems);

      const hasSplits = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      setIsKkbActive(hasSplits);
    };
    loadEditingGroup();
  }, [editingGroupId]);

  // Haversine distance calculator
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in km
  };

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

  // Row breakdown actions
  const handleAddItemRow = () => {
    const defaultCat = categories.length > 0 ? categories[0].name : 'Others';
    const nextCat = items.length > 0 && items[items.length - 1].category ? items[items.length - 1].category : defaultCat;
    setItems(prev => [
      ...prev,
      { id: `new_${Date.now()}`, description: '', amount: 0, category: nextCat, splitUser: '' }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
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

    const groupId = editingGroupId || `grp_${Date.now()}`;
    
    // 1. Save Group
    const groupRecord: ExpenseGroup = {
      id: groupId,
      accountId: activeAccountId,
      description: description.trim(),
      date: date,
      paymentMethod: paymentMethod,
      labels: selectedLabels,
      paidUsers: editingGroupId ? (await db.get<ExpenseGroup>('expense_groups', editingGroupId))?.paidUsers || [] : []
    };

    // Attach Geotag coordinates if location check is active
    if (coords) {
      groupRecord.lat = coords.lat;
      groupRecord.lng = coords.lng;
    }

    await db.put('expense_groups', groupRecord);

    // 2. Save Breakdown Items (cascading deletes first if editing)
    if (editingGroupId) {
      const oldItems = await db.getGroupedByIndex<ExpenseItem>('expense_items', 'groupId', editingGroupId);
      for (const old of oldItems) {
        await db.delete('expense_items', old.id);
      }
    }

    for (const row of items) {
      const itemRecord: ExpenseItem = {
        id: row.id && !row.id.startsWith('new_') ? row.id : `item_${Math.random().toString(36).substring(2, 9)}`,
        groupId: groupId,
        description: (row.description || description).trim(),
        amount: parseFloat(row.amount as any) || 0,
        category: row.category || 'Others',
        splitUser: isKkbActive ? row.splitUser || '' : ''
      };
      await db.put('expense_items', itemRecord);
    }

    onClose();
  };

  return (
    <>
      <header className="view-header">
        <button className="icon-btn" onClick={onClose} aria-label="Back">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="view-title" id="form-title">
          {editingGroupId ? 'Edit Expense' : 'New Expense'}
        </h1>
        
        {/* ⚡ KKB split badge action button */}
        {editingGroupId && (
          <button 
            type="button" 
            className={`kkb-btn-action ${isKkbActive ? 'active' : ''}`}
            onClick={() => setIsKkbActive(prev => !prev)}
          >
            <span className="kkb-glow">⚡ KKB!</span>
          </button>
        )}
      </header>

      <div className="scroll-content padding-bottom-large">
        <form onSubmit={(e) => e.preventDefault()}>
          
          {/* Vendor Name */}
          <div className="form-group">
            <label className="input-label">Description</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text" 
                placeholder="e.g. Mcdo, Starbucks" 
                required 
                autoComplete="off" 
                className="form-input"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
            <button type="button" className="badge-action-btn" style={{ position: 'relative' }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="badge-icon">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <span>{date === new Date().toISOString().split('T')[0] ? 'Today' : date}</span>
              <input 
                type="date" 
                className="hidden-date-picker"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </button>
            
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
              <span>{selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Label'}</span>
            </button>
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
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '14px',
                fontWeight: 600,
                padding: '10px 16px',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                gap: '8px',
                minWidth: '120px',
                transition: 'var(--transition-smooth)'
              }}
            >
              <span>{paymentMethod}</span>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }}>
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
                      value={row.amount || ''}
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
                        <label className="switch-toggle" style={{ transform: 'scale(0.75)', margin: 0 }}>
                          <input 
                            type="checkbox" 
                            checked={row.splitUser?.trim().toLowerCase() === 'me'}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              handleItemFieldChange(idx, 'splitUser', isChecked ? 'Me' : '');
                            }}
                          />
                          <span className="switch-slider"></span>
                        </label>
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
    </>
  );
};
