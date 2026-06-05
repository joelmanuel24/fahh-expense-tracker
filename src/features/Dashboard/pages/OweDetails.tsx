import React, { useState } from 'react';
import { useExpensesStore } from '../../Expenses/models/store';
import { useSettingsStore } from '../../Settings/models/store';
import { calculateOweBreakdown } from '../utils/dashboardLogic';
import { Credit } from '../../../types';

interface OweDetailsProps {
  activeAccountId: string;
  onClose: () => void;
}

export const OweDetails: React.FC<OweDetailsProps> = ({ activeAccountId, onClose }) => {
  const { 
    expenseGroups, 
    expenseItems, 
    credits, 
    saveCredit, 
    deleteCredit 
  } = useExpensesStore();
  const { categories } = useSettingsStore();

  // Calculate detailed breakdown per user (includes credits subtraction)
  const breakdowns = calculateOweBreakdown(expenseGroups, expenseItems, credits);

  // Accordion state: track which user names are expanded
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Credits pagination: track how many credits are visible per debtor user
  const [visibleCreditsCount, setVisibleCreditsCount] = useState<Record<string, number>>({});

  const handleShowMoreCredits = (userName: string) => {
    setVisibleCreditsCount(prev => ({
      ...prev,
      [userName]: (prev[userName] || 1) + 5
    }));
  };

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [targetUserName, setTargetUserName] = useState('');
  
  // Form input fields
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const toggleAccordion = (userName: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userName)) {
        next.delete(userName);
      } else {
        next.add(userName);
      }
      return next;
    });
  };

  // Helper for formatting date
  const formatDateCleanly = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const handleAddCredit = (userName: string) => {
    setModalMode('add');
    setTargetUserName(userName);
    setEditingCredit(null);
    setFormAmount('');
    setFormDescription('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleEditCredit = (credit: Credit) => {
    setModalMode('edit');
    setTargetUserName(credit.userName);
    setEditingCredit(credit);
    setFormAmount(credit.amount.toString());
    setFormDescription(credit.description);
    setFormDate(credit.date);
    setIsModalOpen(true);
  };

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    const creditData: Credit = {
      id: editingCredit ? editingCredit.id : crypto.randomUUID(),
      accountId: activeAccountId,
      userName: targetUserName,
      amount: amountNum,
      description: formDescription.trim() || 'Settlement',
      date: formDate
    };

    await saveCredit(creditData);
    setIsModalOpen(false);
  };

  const handleDeleteCreditConfirm = async (credit: Credit) => {
    if (confirm(`Are you sure you want to delete the settlement of PHP ${credit.amount.toFixed(2)} for ${credit.userName}?`)) {
      await deleteCredit(credit.id, activeAccountId);
    }
  };

  return (
    <>
      <header className="view-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="icon-btn" onClick={onClose} aria-label="Back" style={{ zIndex: 5, flexShrink: 0 }}>
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="view-title" style={{
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          margin: 0,
          pointerEvents: 'none',
          fontSize: '18px',
          fontWeight: 700,
          fontFamily: "'Outfit', sans-serif"
        }}>
          Owed Details
        </h1>
        <div style={{ width: '40px' }} />
      </header>

      <div className="scroll-content padding-bottom-large" style={{ padding: '16px' }}>
        {breakdowns.length === 0 ? (
          <div className="settings-card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🎉</span>
            <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No outstanding balances</span>
          </div>
        ) : (
          breakdowns.map((userBreakdown) => {
            const isExpanded = expandedUsers.has(userBreakdown.userName);

            // Generate avatar color based on name
            const hues = [0, 35, 140, 200, 260, 310];
            const hueIdx = userNameHash(userBreakdown.userName) % hues.length;
            const avatarBg = `hsla(${hues[hueIdx]}, 70%, 50%, 0.15)`;
            const avatarColor = `hsl(${hues[hueIdx]}, 85%, 65%)`;

            // Filter credits belonging to this user
            const userCredits = credits.filter(c => c.userName.toLowerCase() === userBreakdown.userName.toLowerCase());

            // Sort user credits by date descending (newest first)
            const sortedUserCredits = [...userCredits].sort((a, b) => {
              return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            // Sliced credits for pagination
            const visibleCount = visibleCreditsCount[userBreakdown.userName] || 1;
            const slicedCredits = sortedUserCredits.slice(0, visibleCount);

            // Resolve outstanding items oldest-first using total credits amount
            const totalCreditsAmount = userCredits.reduce((sum, c) => sum + c.amount, 0);
            let remainingCredits = totalCreditsAmount;

            // Sort gross items by date ascending to pay off oldest first
            const itemsSortedAsc = [...userBreakdown.items].sort((a, b) => {
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            });

            const outstandingItemsList: { item: typeof userBreakdown.items[0]; remainingAmount: number }[] = [];

            itemsSortedAsc.forEach(item => {
              if (remainingCredits >= item.amount) {
                // Fully covered/paid by credits
                remainingCredits -= item.amount;
              } else if (remainingCredits > 0) {
                // Partially paid
                const remainingAmount = item.amount - remainingCredits;
                remainingCredits = 0;
                outstandingItemsList.push({ item, remainingAmount });
              } else {
                // Unpaid
                outstandingItemsList.push({ item, remainingAmount: item.amount });
              }
            });

            // Sort outstandingItems back to descending order (newest first) for UI display consistency
            const visibleOutstandingItems = outstandingItemsList.sort((a, b) => {
              return new Date(b.item.date).getTime() - new Date(a.item.date).getTime();
            });

            return (
              <div 
                key={userBreakdown.userName}
                className={`transaction-group-card ${isExpanded ? 'expanded' : ''}`}
                style={{ 
                  padding: 0, 
                  overflow: 'hidden', 
                  marginBottom: '16px',
                  cursor: 'pointer'
                }}
                onClick={() => toggleAccordion(userBreakdown.userName)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: avatarBg,
                      color: avatarColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      flexShrink: 0
                    }}>
                      {userBreakdown.userName.charAt(0)}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {userBreakdown.userName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      fontSize: '15px', 
                      fontWeight: 800, 
                      color: userBreakdown.totalAmount <= 0 ? 'var(--text-muted)' : 'var(--color-success)', 
                      fontFamily: "'Outfit', sans-serif" 
                    }}>
                      PHP {userBreakdown.totalAmount.toFixed(2)}
                    </span>
                    <svg
                      style={{
                        width: '18px',
                        height: '18px',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        stroke: 'var(--text-secondary)'
                      }}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                <div 
                  className="card-accordion-content"
                  style={{
                    maxHeight: isExpanded ? '1000px' : '0px',
                    opacity: isExpanded ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    borderTop: isExpanded ? '1px dashed var(--border-color)' : '1px dashed transparent',
                    padding: isExpanded ? '14px 20px 16px 20px' : '0px 20px',
                    marginTop: isExpanded ? '10px' : '0'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Section 1: Outstanding KKBs */}
                    <h4 style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px', 
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                      marginBottom: '10px',
                      fontFamily: "'Plus Jakarta Sans', sans-serif"
                    }}>
                      Outstanding KKBs
                    </h4>
                    {visibleOutstandingItems.length === 0 ? (
                      <div style={{ padding: '4px 0 12px 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        No outstanding KKBs (all settled).
                      </div>
                    ) : (
                      visibleOutstandingItems.map((itemWrapper, itemIdx) => {
                        const { item, remainingAmount } = itemWrapper;
                        const matchedCat = categories.find(c => c.name.toLowerCase() === item.category.toLowerCase());
                        const catColor = matchedCat ? {
                          bgColor: matchedCat.bgColor.replace('0.15', '0.2').replace('0.04', '0.08'),
                          textColor: matchedCat.textColor
                        } : {
                          bgColor: 'rgba(255, 255, 255, 0.06)',
                          textColor: 'var(--text-secondary)'
                        };

                        return (
                          <div key={item.id}>
                            {itemIdx > 0 && (
                              <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '10px 0' }} />
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '70%' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                  {item.groupDescription}
                                </span>
                                {item.itemDescription && item.itemDescription !== item.groupDescription && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    {item.itemDescription}
                                  </span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: catColor.bgColor,
                                    color: catColor.textColor,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                                  }}>
                                    {item.category}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                    {formatDateCleanly(item.date)}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
                                  PHP {remainingAmount.toFixed(2)}
                                </span>
                                {remainingAmount < item.amount && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'line-through', fontFamily: "'Outfit', sans-serif", marginTop: '2px' }}>
                                    PHP {item.amount.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '16px 0 12px 0' }} />

                    {/* Section 2: Credits / Settlements */}
                    <h4 style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px', 
                      color: 'var(--text-muted)',
                      marginBottom: '10px',
                      fontFamily: "'Plus Jakarta Sans', sans-serif"
                    }}>
                      Credits / Settlements
                    </h4>

                    {sortedUserCredits.length === 0 ? (
                      <div style={{ padding: '4px 0 8px 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        No credits or payments recorded yet.
                      </div>
                    ) : (
                      <>
                        {slicedCredits.map((credit, creditIdx) => (
                          <div key={credit.id}>
                            {creditIdx > 0 && (
                              <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '10px 0' }} />
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '60%' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                  {credit.description}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                  {formatDateCleanly(credit.date)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: "'Outfit', sans-serif" }}>
                                  - PHP {credit.amount.toFixed(2)}
                                </span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button 
                                    onClick={() => handleEditCredit(credit)} 
                                    className="icon-btn" 
                                    style={{ 
                                      width: '28px', 
                                      height: '28px', 
                                      borderRadius: '6px', 
                                      backgroundColor: 'rgba(255,255,255,0.03)', 
                                      border: '1px solid var(--border-light)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer'
                                    }}
                                    title="Edit Credit"
                                  >
                                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '13px', height: '13px', color: 'var(--text-secondary)' }}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                    </svg>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCreditConfirm(credit)} 
                                    className="icon-btn" 
                                    style={{ 
                                      width: '28px', 
                                      height: '28px', 
                                      borderRadius: '6px', 
                                      backgroundColor: 'rgba(255,255,255,0.03)', 
                                      border: '1px solid var(--border-light)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer'
                                    }}
                                    title="Delete Credit"
                                  >
                                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '13px', height: '13px', color: 'var(--color-danger)' }}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {sortedUserCredits.length > visibleCount && (
                          <button
                            type="button"
                            onClick={() => handleShowMoreCredits(userBreakdown.userName)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-primary)',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '8px 0',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '8px',
                              fontFamily: "'Plus Jakarta Sans', sans-serif"
                            }}
                          >
                            Show More ({sortedUserCredits.length - visibleCount} remaining)
                          </button>
                        )}
                      </>
                    )}

                    {/* Settle Debt Trigger Button */}
                    <button
                      onClick={() => handleAddCredit(userBreakdown.userName)}
                      style={{
                        width: '100%',
                        marginTop: '16px',
                        padding: '10px 14px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'var(--transition-smooth)',
                        fontFamily: "'Plus Jakarta Sans', sans-serif"
                      }}
                      className="add-credit-btn"
                    >
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Settle Debt / Add Credit
                    </button>

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Credit Form Modal Dialog Overlay */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: "'Plus Jakarta Sans', sans-serif"
            }}>
              {modalMode === 'add' ? 'Settle Debt / Add Credit' : 'Edit Credit'}
            </h3>
            <form onSubmit={handleSaveCredit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Debtor User
                </label>
                <input
                  type="text"
                  value={targetUserName}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Amount (PHP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface-elevated, #242424)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    fontWeight: 600,
                    outline: 'none',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. GCash payment, Cash, etc."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface-elevated, #242424)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}>
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-surface-elevated, #242424)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// Simple string hashing helper for deterministic avatar color assignment
function userNameHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}
