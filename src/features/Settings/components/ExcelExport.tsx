import React, { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { db } from '../../../db';
import { ExpenseGroup, ExpenseItem, Category, PaymentMethod } from '../../../types';

interface ExcelExportProps {
  activeAccountId: string;
  onClose: () => void;
}

interface FilterState {
  startDate: string;
  endDate: string;
  selectedCategories: Set<string>;
  selectedPayments: Set<string>;
  selectedKkbUsers: Set<string>;
}

export const ExcelExport: React.FC<ExcelExportProps> = ({ activeAccountId, onClose }) => {
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [allKkbUsers, setAllKkbUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    selectedCategories: new Set(),
    selectedPayments: new Set(),
    selectedKkbUsers: new Set(),
  });

  // ── Load data from IndexedDB ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [gs, is, cats, pms] = await Promise.all([
          db.getGroupedByIndex<ExpenseGroup>('expense_groups', 'accountId', activeAccountId),
          db.getAll<ExpenseItem>('expense_items'),
          db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId),
          db.getAll<PaymentMethod>('payment_methods'),
        ]);

        // Collect all unique KKB users across all items
        const kkbSet = new Set<string>();
        is.forEach(item => {
          const u = item.splitUser?.trim();
          if (u && u.toLowerCase() !== 'me' && u.toLowerCase() !== 'unassigned') {
            kkbSet.add(u);
          }
        });

        const kkbArr = Array.from(kkbSet).sort();
        setGroups(gs);
        setItems(is);
        setCategories(cats);
        setPayments(pms);
        setAllKkbUsers(kkbArr);

        // Default: select all KKB users
        setFilters(prev => ({
          ...prev,
          selectedCategories: new Set(cats.map(c => c.name)),
          selectedPayments: new Set(pms.map(p => p.name)),
          selectedKkbUsers: new Set(kkbArr),
        }));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [activeAccountId]);

  // ── Derive filtered groups ────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return groups
      .filter(g => {
        // Date range — dates are stored as YYYY-MM-DD strings so lexicographic comparison is safe
        if (filters.startDate && g.date < filters.startDate) return false;
        if (filters.endDate && g.date > filters.endDate) return false;

        // Payment method — match by paymentMethod name or ID against selectedPayments
        const pmObj = payments.find(p => p.id === g.paymentMethod || p.name === g.paymentMethod);
        const pmName = pmObj ? pmObj.name : g.paymentMethod;
        if (!filters.selectedPayments.has(pmName) && !filters.selectedPayments.has(g.paymentMethod)) {
          return false;
        }

        return true;
      })
      .map(g => {
        const groupItems = items.filter(i => i.groupId === g.id);

        // Filter items inside the group by Category and KKB User
        const filteredItems = groupItems.filter(i => {
          // Category filter
          if (!filters.selectedCategories.has(i.category)) return false;

          // KKB User filter (if item is assigned to a split user, check if user is selected)
          const splitUser = i.splitUser?.trim();
          if (splitUser && splitUser.toLowerCase() !== 'me' && splitUser.toLowerCase() !== 'unassigned') {
            if (!filters.selectedKkbUsers.has(splitUser)) return false;
          }

          return true;
        });

        return { ...g, _items: filteredItems };
      })
      .filter(g => g._items.length > 0);
  }, [groups, items, payments, filters]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleSet = (
    key: keyof Pick<FilterState, 'selectedCategories' | 'selectedPayments' | 'selectedKkbUsers'>,
    value: string
  ) => {
    setFilters(prev => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [key]: next };
    });
  };

  const toggleAll = (
    key: keyof Pick<FilterState, 'selectedCategories' | 'selectedPayments' | 'selectedKkbUsers'>,
    allValues: string[]
  ) => {
    setFilters(prev => {
      const current = prev[key];
      const allSelected = allValues.every(v => current.has(v));
      return { ...prev, [key]: allSelected ? new Set() : new Set(allValues) };
    });
  };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const kkbColumns = Array.from(filters.selectedKkbUsers).sort();
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Fahh Expense Tracker';
      const ws = wb.addWorksheet('Expenses');

      // ── Column widths ────────────────────────────────────────────────────
      const colDefs: Partial<ExcelJS.Column>[] = [
        { key: 'date',     width: 12 },
        { key: 'category', width: 16 },
        { key: 'amount',   width: 14 },
        { key: 'paid',     width: 10 },
        { key: 'paidat',   width: 18 },
        { key: 'desc',     width: 30 },
      ];
      kkbColumns.forEach(u => colDefs.push({ key: u, width: 14 }));
      ws.columns = colDefs;

      const totalDataRows = filteredGroups.length;
      const dataStartRow = 4;
      const dataEndRow = dataStartRow + totalDataRows - 1;

      // ── Helper: currency cell format ──────────────────────────────────────
      const phpFmt = '"₱"#,##0.00';
      const setCurrency = (cell: ExcelJS.Cell) => { cell.numFmt = phpFmt; };

      // ── Row 1: totals row ─────────────────────────────────────────────────
      // Leave A1–F1 blank; KKB total columns get ₱0.00 placeholder
      ws.getRow(1).height = 18;
      if (kkbColumns.length > 0) {
        const firstKkbColLetter = ws.getColumn(7).letter;
        const r1cell = ws.getCell(`${firstKkbColLetter}1`);
        r1cell.value = 0;
        setCurrency(r1cell);
        r1cell.font = { name: 'Arial', size: 10, bold: true };
        r1cell.alignment = { horizontal: 'right' };
      }

      // ── Row 2: sum & KKB user name headers ───────────────────────────────
      ws.getRow(2).height = 18;
      const sumCell = ws.getCell('C2');
      sumCell.value = totalDataRows > 0
        ? { formula: `SUM(C${dataStartRow}:C${dataEndRow})` }
        : 0;
      setCurrency(sumCell);
      sumCell.font = { name: 'Arial', size: 10, bold: true };
      sumCell.alignment = { horizontal: 'right' };

      kkbColumns.forEach((u, idx) => {
        const colLetter = ws.getColumn(7 + idx).letter;
        const nameCell = ws.getCell(`${colLetter}2`);
        nameCell.value = u;
        nameCell.font = { name: 'Arial', size: 10, bold: true };
        nameCell.alignment = { horizontal: 'right' };
      });

      // ── Row 3: header labels + KKB column SUM formulas ───────────────────
      ws.getRow(3).height = 18;
      const headers = ['Date', 'Category', 'Amount', 'Paid', 'Paid at', 'Description'];
      headers.forEach((h, i) => {
        const cell = ws.getCell(3, i + 1);
        cell.value = h;
        cell.font = { name: 'Arial', size: 10, bold: true };
      });

      kkbColumns.forEach((_, idx) => {
        const colLetter = ws.getColumn(7 + idx).letter;
        const sumCell2 = ws.getCell(`${colLetter}3`);
        sumCell2.value = totalDataRows > 0
          ? { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})` }
          : 0;
        setCurrency(sumCell2);
        sumCell2.font = { name: 'Arial', size: 10, bold: true };
        sumCell2.alignment = { horizontal: 'right' };
      });

      // ── Colors ────────────────────────────────────────────────────────────
      const colorGrey  = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F3F3' } };
      const colorGreen = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9EAD3' } };
      const colorWhite = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };

      const applyRowBg = (row: ExcelJS.Row, fill: ExcelJS.Fill) => {
        const totalCols = 6 + kkbColumns.length;
        for (let c = 1; c <= totalCols; c++) {
          row.getCell(c).fill = fill;
        }
      };

      const setBaseFont = (row: ExcelJS.Row) => {
        const totalCols = 6 + kkbColumns.length;
        for (let c = 1; c <= totalCols; c++) {
          const cell = row.getCell(c);
          if (!cell.font?.bold) cell.font = { name: 'Arial', size: 10 };
        }
      };

      // ── Data rows ─────────────────────────────────────────────────────────
      filteredGroups
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((g, rowIdx) => {
          const rowNum = dataStartRow + rowIdx;
          const row = ws.getRow(rowNum);
          row.height = 16;

          const groupItems = g._items;
          const totalAmount = groupItems.reduce((s, i) => s + i.amount, 0);

          // Category from first item
          const firstItem = groupItems[0];
          const catName = firstItem?.category ?? '';

          // Formatted date
          let displayDate = g.date;
          if (g.date) {
            try {
              const d = new Date(g.date);
              displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch {}
          }

          // Identify KKB users present
          const kkbItems = groupItems.filter(i => {
            const u = i.splitUser?.trim().toLowerCase();
            return u && u !== 'me' && u !== 'unassigned';
          });
          const hasSplits = kkbItems.length > 0;

          // Paid users set (lowercased)
          const paidSet = new Set((g.paidUsers || []).map(u => u.trim().toLowerCase()));

          // A: Date
          const dateCell = row.getCell(1);
          dateCell.value = displayDate;
          dateCell.alignment = { horizontal: 'center' };

          // B: Category
          const catCell = row.getCell(2);
          catCell.value = catName;
          catCell.alignment = { horizontal: 'left' };

          // C: Amount
          const amtCell = row.getCell(3);
          amtCell.value = totalAmount;
          setCurrency(amtCell);
          amtCell.alignment = { horizontal: 'right' };

          // D: Paid (empty)
          row.getCell(4).value = '';

          // E: Paid at (empty)
          row.getCell(5).value = '';

          // F: Description
          const descCell = row.getCell(6);
          descCell.value = g.description;
          descCell.alignment = { horizontal: 'left' };

          // KKB columns
          kkbColumns.forEach((u, idx) => {
            const colNum = 7 + idx;
            const userItemsForCol = groupItems.filter(
              i => i.splitUser?.trim().toLowerCase() === u.toLowerCase()
            );
            const colCell = row.getCell(colNum);
            if (userItemsForCol.length > 0) {
              colCell.value = userItemsForCol.reduce((s, i) => s + i.amount, 0);
              setCurrency(colCell);
              colCell.alignment = { horizontal: 'right' };
            } else {
              colCell.value = '';
            }
          });

          // ── Row background & highlight ──────────────────────────────────
          setBaseFont(row);

          if (!hasSplits) {
            // Personal / general expense → grey row, green amount cell
            applyRowBg(row, colorGrey);
            row.getCell(3).fill = colorGreen;
          } else {
            // Split row → white, green for paid KKB cells
            applyRowBg(row, colorWhite);
            kkbColumns.forEach((u, idx) => {
              const colNum = 7 + idx;
              const cell = row.getCell(colNum);
              const hasValue = cell.value !== '' && cell.value != null;
              const isPaid = paidSet.has(u.toLowerCase());
              if (hasValue && isPaid) {
                cell.fill = colorGreen;
              }
            });
          }
        });

      // ── Download ──────────────────────────────────────────────────────────
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Fahh_Expenses_${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Helpers for "Select All" state ────────────────────────────────────────
  const allCatNames = categories.map(c => c.name);
  const allPmNames = payments.map(p => p.name);
  const catAllSelected = allCatNames.length > 0 && allCatNames.every(n => filters.selectedCategories.has(n));
  const pmAllSelected  = allPmNames.length > 0 && allPmNames.every(n => filters.selectedPayments.has(n));
  const kkbAllSelected = allKkbUsers.length > 0 && allKkbUsers.every(u => filters.selectedKkbUsers.has(u));

  // ── Styles ────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    color: 'var(--text-muted)',
    fontFamily: 'Outfit, sans-serif',
    marginBottom: '6px',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    colorScheme: 'dark',
  };
  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '999px',
    border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`,
    backgroundColor: active ? 'var(--color-primary-tinted)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    userSelect: 'none',
    flexShrink: 0,
  });
  const sectionLabel = (text: string) => (
    <p style={labelStyle}>{text}</p>
  );

  const CheckPill: React.FC<{
    label: string;
    icon?: string;
    active: boolean;
    onClick: () => void;
  }> = ({ label, icon, active, onClick }) => (
    <div style={pillStyle(active)} onClick={onClick} role="checkbox" aria-checked={active}>
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {active && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="view-header"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: 20, height: 20 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
          Export to Excel
        </h1>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div
        className="scroll-content padding-bottom-large"
        style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Loading data…
          </div>
        ) : (
          <>
            {/* ── Preview banner ─────────────────────────────────────────── */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(88,76,244,0.18) 0%, rgba(88,76,244,0.06) 100%)',
                border: '1px solid rgba(88,76,244,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '2px' }}>
                  Matching Records
                </p>
                <p style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'var(--color-primary)', margin: 0 }}>
                  {filteredGroups.length}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
                    / {groups.length} groups
                  </span>
                </p>
              </div>
              <span style={{ fontSize: '32px' }}>📊</span>
            </div>

            {/* ── Date Range ─────────────────────────────────────────────── */}
            <div style={cardStyle}>
              {sectionLabel('Date Range')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>From</p>
                  <input
                    id="export-start-date"
                    type="date"
                    style={inputStyle}
                    value={filters.startDate}
                    onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>To</p>
                  <input
                    id="export-end-date"
                    type="date"
                    style={inputStyle}
                    value={filters.endDate}
                    onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              {(filters.startDate || filters.endDate) && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                >
                  ✕ Clear dates
                </button>
              )}
            </div>

            {/* ── KKB User Columns ───────────────────────────────────────── */}
            {allKkbUsers.length > 0 && (
              <div style={cardStyle}>
                {sectionLabel('KKB Split Columns')}
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '-4px' }}>
                  Select which KKB users appear as columns in the exported sheet.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <CheckPill
                    label="All"
                    active={kkbAllSelected}
                    onClick={() => toggleAll('selectedKkbUsers', allKkbUsers)}
                  />
                  {allKkbUsers.map(u => (
                    <CheckPill
                      key={u}
                      label={u}
                      active={filters.selectedKkbUsers.has(u)}
                      onClick={() => toggleSet('selectedKkbUsers', u)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Categories ─────────────────────────────────────────────── */}
            {categories.length > 0 && (
              <div style={cardStyle}>
                {sectionLabel('Categories')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <CheckPill
                    label="All"
                    active={catAllSelected}
                    onClick={() => toggleAll('selectedCategories', allCatNames)}
                  />
                  {categories.map(cat => (
                    <CheckPill
                      key={cat.id}
                      label={cat.name}
                      icon={cat.icon}
                      active={filters.selectedCategories.has(cat.name)}
                      onClick={() => toggleSet('selectedCategories', cat.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Payment Methods ────────────────────────────────────────── */}
            {payments.length > 0 && (
              <div style={cardStyle}>
                {sectionLabel('Payment Method')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <CheckPill
                    label="All"
                    active={pmAllSelected}
                    onClick={() => toggleAll('selectedPayments', allPmNames)}
                  />
                  {payments.map(pm => (
                    <CheckPill
                      key={pm.id}
                      label={pm.name}
                      active={filters.selectedPayments.has(pm.name)}
                      onClick={() => toggleSet('selectedPayments', pm.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Export Button ──────────────────────────────────────────── */}
            <button
              id="export-xlsx-btn"
              onClick={handleExport}
              disabled={isExporting || filteredGroups.length === 0}
              style={{
                width: '100%',
                padding: '16px 0',
                backgroundColor:
                  filteredGroups.length === 0 ? 'var(--bg-surface-elevated)' : 'var(--color-primary)',
                boxShadow: filteredGroups.length > 0 ? 'var(--shadow-glow)' : 'none',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: filteredGroups.length === 0 ? 'var(--text-muted)' : '#fff',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
                cursor: filteredGroups.length === 0 || isExporting ? 'not-allowed' : 'pointer',
                transition: 'var(--transition-smooth)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                opacity: isExporting ? 0.75 : 1,
                letterSpacing: '0.3px',
              }}
            >
              {isExporting ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite', width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
                  </svg>
                  Generating Excel file…
                </>
              ) : filteredGroups.length === 0 ? (
                'No records match current filters'
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 18, height: 18 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download {filteredGroups.length} Records as .xlsx
                </>
              )}
            </button>

            {/* ── Format legend ──────────────────────────────────────────── */}
            <div style={{ ...cardStyle, gap: '10px' }}>
              <p style={labelStyle}>Excel Format Legend</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { color: '#F3F3F3', label: 'Personal/General expense row (no splits)' },
                  { color: '#D9EAD3', label: 'Amount or KKB column that is settled / paid' },
                  { color: '#FFFFFF', label: 'KKB split row (white background)' },
                ].map(({ color, label }) => (
                  <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                      backgroundColor: color,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
};
