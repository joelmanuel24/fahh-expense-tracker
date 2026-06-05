import { Account, Category, PaymentMethod, KkbQr } from '../../../types';

export interface AccountsSlice {
  accounts: Account[];
  newAccountName: string;
  setNewAccountName: (name: string) => void;
  loadAccounts: () => Promise<void>;
  handleAddAccount: () => Promise<void>;
  handleSwitchAccount: (id: string) => Promise<void>;
  handleRenameAccount: (acc: Account) => Promise<void>;
  confirmDeleteAccount: (activeAccountId: string) => Promise<void>;
  handleReorderAccounts: (newAccounts: Account[]) => Promise<void>;
}

export interface PaymentsSlice {
  payments: PaymentMethod[];
  newPaymentName: string;
  setNewPaymentName: (name: string) => void;
  loadPayments: () => Promise<void>;
  handleAddPayment: () => Promise<void>;
  confirmDeletePayment: () => Promise<void>;
  handleReorderPayments: (newPayments: PaymentMethod[]) => Promise<void>;
}

export interface CategoriesSlice {
  categories: Category[];
  newCatIcon: string;
  newCatName: string;
  setNewCatIcon: (icon: string) => void;
  setNewCatName: (name: string) => void;
  loadCategories: (activeAccountId: string) => Promise<void>;
  handleAddCategory: (activeAccountId: string) => Promise<void>;
  confirmDeleteCategory: () => Promise<void>;
  handleReorderCategories: (newCategories: Category[]) => Promise<void>;
}

export interface QrsSlice {
  qrs: KkbQr[];
  newQrName: string;
  newQrBase64: string;
  newQrFileName: string;
  setNewQrName: (name: string) => void;
  setNewQrBase64: (base64: string) => void;
  setNewQrFileName: (fileName: string) => void;
  loadQrs: () => Promise<void>;
  handleAddQr: () => Promise<void>;
  confirmDeleteQr: () => Promise<void>;
}

export interface GeneralSlice {
  locationEnabled: boolean;
  widgets: any[];
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  loadLocationAndWidgets: () => Promise<void>;
  handleToggleLocation: (active: boolean) => Promise<void>;
  handleToggleWidget: (index: number, visible: boolean) => Promise<void>;
  handleReorderWidgets: (newWidgets: any[]) => Promise<void>;

  // Delete target overlay states
  deleteTargetPaymentId: string | null;
  deleteTargetPaymentName: string;
  deleteTargetAccountId: string | null;
  deleteTargetAccountName: string;
  deleteTargetCategoryId: string | null;
  deleteTargetCategoryName: string;
  deleteTargetQrId: string | null;
  deleteTargetQrName: string;

  // Dialog triggers
  triggerDeletePayment: (id: string, name: string) => void;
  triggerDeleteAccount: (id: string, name: string, accountsLength: number) => void;
  triggerDeleteCategory: (id: string, name: string, categoriesLength: number) => void;
  triggerDeleteQr: (id: string, name: string) => void;

  setDeleteTargetPaymentId: (id: string | null) => void;
  setDeleteTargetAccountId: (id: string | null) => void;
  setDeleteTargetCategoryId: (id: string | null) => void;
  setDeleteTargetQrId: (id: string | null) => void;
}

export type SettingsStore = AccountsSlice & PaymentsSlice & CategoriesSlice & QrsSlice & GeneralSlice;
