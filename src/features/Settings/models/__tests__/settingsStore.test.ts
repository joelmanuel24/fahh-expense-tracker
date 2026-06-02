import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../store';

describe('Settings Zustand Store Slices', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useSettingsStore.setState({
      newAccountName: '',
      newPaymentName: '',
      newCatIcon: '',
      newCatName: '',
      newQrName: '',
      newQrBase64: '',
      newQrFileName: 'Choose Image',
      deleteTargetPaymentId: null,
      deleteTargetPaymentName: '',
      deleteTargetAccountId: null,
      deleteTargetAccountName: '',
      deleteTargetCategoryId: null,
      deleteTargetCategoryName: '',
      deleteTargetQrId: null,
      deleteTargetQrName: ''
    });
  });

  describe('Accounts Slice', () => {
    it('should set new account name input value', () => {
      const store = useSettingsStore.getState();
      expect(store.newAccountName).toBe('');
      
      store.setNewAccountName('Savings Account');
      expect(useSettingsStore.getState().newAccountName).toBe('Savings Account');
    });
  });

  describe('Payments Slice', () => {
    it('should set new payment name input value', () => {
      const store = useSettingsStore.getState();
      expect(store.newPaymentName).toBe('');
      
      store.setNewPaymentName('PayPal');
      expect(useSettingsStore.getState().newPaymentName).toBe('PayPal');
    });
  });

  describe('Categories Slice', () => {
    it('should update category icon and name inputs', () => {
      const store = useSettingsStore.getState();
      expect(store.newCatIcon).toBe('');
      expect(store.newCatName).toBe('');
      
      store.setNewCatIcon('🎨');
      store.setNewCatName('Arts');
      
      const updated = useSettingsStore.getState();
      expect(updated.newCatIcon).toBe('🎨');
      expect(updated.newCatName).toBe('Arts');
    });
  });

  describe('Qrs Slice', () => {
    it('should update QR name, file, and base64 string values', () => {
      const store = useSettingsStore.getState();
      expect(store.newQrName).toBe('');
      expect(store.newQrFileName).toBe('Choose Image');
      
      store.setNewQrName('My GCash');
      store.setNewQrFileName('qr_screenshot.png');
      store.setNewQrBase64('data:image/png;base64,...');
      
      const updated = useSettingsStore.getState();
      expect(updated.newQrName).toBe('My GCash');
      expect(updated.newQrFileName).toBe('qr_screenshot.png');
      expect(updated.newQrBase64).toBe('data:image/png;base64,...');
    });
  });

  describe('General Slice Overlay Modals', () => {
    it('should trigger delete target payment state transitions', () => {
      const store = useSettingsStore.getState();
      expect(store.deleteTargetPaymentId).toBeNull();
      
      store.setDeleteTargetPaymentId('pm_cash');
      expect(useSettingsStore.getState().deleteTargetPaymentId).toBe('pm_cash');
    });

    it('should trigger delete target account and category state transitions', () => {
      const store = useSettingsStore.getState();
      expect(store.deleteTargetAccountId).toBeNull();
      expect(store.deleteTargetCategoryId).toBeNull();
      
      store.setDeleteTargetAccountId('acc_personal');
      store.setDeleteTargetCategoryId('cat_food');
      
      const updated = useSettingsStore.getState();
      expect(updated.deleteTargetAccountId).toBe('acc_personal');
      expect(updated.deleteTargetCategoryId).toBe('cat_food');
    });
  });
});
