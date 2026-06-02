import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { ExpenseGroup, ExpenseItem, Category, KkbQr } from '../types';

interface SplitReceiptProps {
  groupId: string;
  onClose: () => void;
  activeAccountId: string;
}

export const SplitReceipt: React.FC<SplitReceiptProps> = ({ groupId, onClose, activeAccountId }) => {
  const [group, setGroup] = useState<ExpenseGroup | null>(null);
  const [personGroups, setPersonGroups] = useState<Map<string, ExpenseItem[]>>(new Map());
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Paid splits tracker
  const [paidUsers, setPaidUsers] = useState<string[]>([]);
  const [activeModalUser, setActiveModalUser] = useState<{ name: string; amount: number } | null>(null);
  
  // QRs tracker
  const [attachedQrs, setAttachedQrs] = useState<any[]>([]);
  const [dismissedQrIds, setDismissedQrIds] = useState<Set<string>>(new Set());

  const loadReceiptData = async () => {
    const grp = await db.get<ExpenseGroup>('expense_groups', groupId);
    if (!grp) return;
    setGroup(grp);
    setPaidUsers(grp.paidUsers || []);

    const items = await db.getGroupedByIndex<ExpenseItem>('expense_items', 'groupId', groupId);
    const cats = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
    setCategories(cats);

    // Group items by assignee
    const map = new Map<string, ExpenseItem[]>();
    let sum = 0;
    
    items.forEach((item) => {
      const user = item.splitUser && item.splitUser.trim() !== '' ? item.splitUser.trim() : 'Unassigned';
      if (!map.has(user)) {
        map.set(user, []);
      }
      map.get(user)!.push(item);
      sum += item.amount;
    });

    setPersonGroups(map);
    setGrandTotal(sum);

    // Load QR attachments
    const qrsRecord = await db.get<{ key: string; value: any[] }>('settings', 'kkbQrs');
    setAttachedQrs(qrsRecord ? qrsRecord.value : []);
  };

  useEffect(() => {
    loadReceiptData();
  }, [groupId, activeAccountId]);

  const handleTogglePayment = async (user: string, isMarkingPaid: boolean) => {
    if (!group) return;
    let nextPaid = [...paidUsers];
    if (isMarkingPaid) {
      if (!nextPaid.includes(user)) {
        nextPaid.push(user);
      }
    } else {
      nextPaid = nextPaid.filter(u => u !== user);
    }
    
    const updatedGroup = { ...group, paidUsers: nextPaid };
    await db.put('expense_groups', updatedGroup);
    setPaidUsers(nextPaid);
    setGroup(updatedGroup);
    setActiveModalUser(null);
  };

  const handleCopySummary = () => {
    if (!group) return;
    
    const formattedDate = new Date(group.date).toLocaleDateString('default', {
      month: 'long', day: 'numeric', year: 'numeric'
    });

    let copyText = `⚡ *SPLIT SUMMARY: ${group.description.toUpperCase()}* 🧾\n`;
    copyText += `📅 Date: ${formattedDate}\n`;
    copyText += `💳 Paid via: ${group.paymentMethod}\n`;
    copyText += `------------------------------\n`;

    const sortedUsers = Array.from(personGroups.keys()).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });

    sortedUsers.forEach((user) => {
      const userItems = personGroups.get(user)!;
      const userSum = userItems.reduce((acc, curr) => acc + curr.amount, 0);
      const isPaid = paidUsers.includes(user);
      copyText += `👤 *${user}* ${isPaid ? '(Paid ✅)' : '(Unpaid ❌)'} owes *PHP ${userSum.toFixed(2)}*:\n`;
      userItems.forEach(ui => {
        copyText += `  - ${ui.description}: PHP ${ui.amount.toFixed(2)}\n`;
      });
      copyText += `\n`;
    });

    copyText += `------------------------------\n`;
    copyText += `💰 *TOTAL BILL: PHP ${grandTotal.toFixed(2)}*\n`;
    copyText += `_Generated via Fahh! Expense Tracker PWA_`;

    navigator.clipboard.writeText(copyText).then(() => {
      alert('📋 Copy Split text successfully copied to clipboard!');
    });
  };

  const handleShareLink = () => {
    if (navigator.share && group) {
      navigator.share({
        title: `${group.description} Bill Split`,
        text: `Split totals for ${group.description}: PHP ${grandTotal.toFixed(2)}`,
        url: window.location.origin
      }).catch(err => console.log(err));
    } else {
      alert('Screencapture this beautiful receipt or use "Copy Text Summary" to send splits to your friends!');
    }
  };

  if (!group) return null;

  const sortedUsers = Array.from(personGroups.keys()).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  const visibleQrs = attachedQrs.filter(qr => !dismissedQrIds.has(qr.id));

  return (
    <>
      <header className="view-header">
        <button className="icon-btn" onClick={onClose} aria-label="Back">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="view-title">KKB!</h1>
        <div style={{ width: '40px' }}></div>
      </header>

      <div className="scroll-content padding-bottom-large">
        
        {/* 1. Photogenic Monospace slip */}
        <div className="screenshot-wrapper">
          <div className="split-slip-card" id="kkb-receipt-card">
            <div className="rip-edge-top"></div>
            
            <div className="slip-body">
              <div className="slip-header-center">
                <span className="slip-icon">🧾</span>
                <h2 id="slip-store-name" className="slip-title">
                  {group.description.toUpperCase()} SPLIT BILL
                </h2>
                <span id="slip-date" className="slip-date" style={{ color: '#555' }}>
                  {new Date(group.date).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                </span>
              </div>

              <div className="dashed-divider"></div>

              {/* Grouped items by person */}
              <div className="slip-grouped-splits" id="slip-splits-container">
                {sortedUsers.map((user) => {
                  const userItems = personGroups.get(user)!;
                  return (
                    <div key={user} className="slip-person-block">
                      <div className="slip-person-header">
                        <span>👤</span>
                        <span>{user.toUpperCase()}</span>
                      </div>
                      <div className="slip-person-items-list">
                        {userItems.map((ui) => {
                          const cat = categories.find(c => c.name === ui.category);
                          return (
                            <div key={ui.id} className="slip-item-row">
                              <span className="item-left">{cat ? cat.icon : '•'} {ui.description}</span>
                              <span className="item-right">PHP {ui.amount.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="dashed-divider"></div>

              {/* Owed totals checklist */}
              <div className="slip-totals-section">
                <h3 className="slip-totals-title">SUBTOTALS</h3>
                <div className="slip-totals-list">
                  {sortedUsers.map((user) => {
                    const userItems = personGroups.get(user)!;
                    const userSum = userItems.reduce((acc, curr) => acc + curr.amount, 0);
                    const isPaid = paidUsers.includes(user);

                    return (
                      <div 
                        key={user}
                        className={`slip-totals-row ${isPaid ? 'paid' : ''}`}
                        onClick={() => setActiveModalUser({ name: user, amount: userSum })}
                      >
                        <span className="total-person-name">
                          👤 {user}{isPaid ? ' ✅' : ''}
                        </span>
                        <span className="total-person-amount">
                          PHP {userSum.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="dashed-divider"></div>

              {/* Bill totals */}
              <div className="slip-footer-total-row">
                <span className="total-label">TOTAL BILL</span>
                <span id="slip-total-amount" className="total-val">
                  PHP {grandTotal.toFixed(2)}
                </span>
              </div>

              <div className="slip-footer-center">
                <span>Paid via <strong id="slip-payment-method">{group.paymentMethod}</strong></span>
              </div>
            </div>

            <div className="rip-edge-bottom"></div>
          </div>
        </div>

        {/* 2. QR Attachments */}
        {visibleQrs.length > 0 && (
          <div id="kkb-qrs-attach-area" className="kkb-qrs-attach-container">
            <div className="qrs-header" style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                ⚡ Attach Payment QRs
              </span>
            </div>
            <div id="kkb-attached-qrs-list" className="attached-qrs-grid">
              {visibleQrs.map((qr) => (
                <div key={qr.id} className="attached-qr-card">
                  <button 
                    className="attached-qr-dismiss-btn" 
                    onClick={() => {
                      setDismissedQrIds(prev => {
                        const next = new Set(prev);
                        next.add(qr.id);
                        return next;
                      });
                    }}
                    aria-label="Hide QR"
                  >
                    ×
                  </button>
                  <img src={qr.base64} className="attached-qr-image" alt="KKB Payment QR" />
                  <span className="attached-qr-name">{qr.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Split utility actions */}
        <div className="kkb-utility-container">
          <button id="kkb-copy-text-btn" className="utility-row-btn" onClick={handleCopySummary}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="btn-icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
            </svg>
            <span>Copy Text Summary</span>
          </button>
          
          <button id="kkb-share-btn" className="utility-row-btn primary-tint" onClick={handleShareLink}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="btn-icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186 2.186 2.186m0-2.186a2.25 2.25 0 1 0 2.186 2.186m-2.186-2.186v-3m0 6v3m6-6a2.25 2.25 0 1 0 0-2.186m0 2.186-2.186-2.186m0 2.186a2.25 2.25 0 1 0-2.186-2.186" />
            </svg>
            <span>Share Split Link</span>
          </button>
        </div>
      </div>

      {/* 4. Custom split overlay modal */}
      {activeModalUser && (
        <div className="bottom-sheet-overlay">
          <div className="sheet-scrim" onClick={() => setActiveModalUser(null)}></div>
          <div className="sheet-content-wrapper" style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className="sheet-drag-indicator" onClick={() => setActiveModalUser(null)}></div>
            <h3 className="sheet-title">{activeModalUser.name.toUpperCase()}'S SPLIT</h3>
            <p className="sheet-subtitle" style={{ fontFamily: 'Space Mono, monospace', fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '4px', marginBottom: '16px' }}>
              PHP {activeModalUser.amount.toFixed(2)}
            </p>
            
            <div className="kkb-modal-actions-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <button 
                type="button" 
                className="primary-action-btn" 
                style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', width: '100%' }}
                onClick={() => handleTogglePayment(activeModalUser.name, true)}
              >
                Mark as Paid
              </button>
              <button 
                type="button" 
                className="utility-action-btn-tinted" 
                style={{ width: '100%' }}
                onClick={() => handleTogglePayment(activeModalUser.name, false)}
              >
                Mark as Unpaid
              </button>
              <button 
                type="button" 
                className="utility-action-btn-tinted" 
                style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', width: '100%' }}
                onClick={() => setActiveModalUser(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
