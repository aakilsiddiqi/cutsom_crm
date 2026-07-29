import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, ActivityIndicator, TextInput as RNTextInput, KeyboardAvoidingView, BackHandler,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ScreenWrapper, HeaderBar, Card, Button, Input,
} from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import {
  AdminStackParamList,
  RevenueTransaction,
  RevenueTransactionType,
  RevenueCategory,
  RevenueStatus,
  RevenuePaymentMode,
  REVENUE_TRANSACTION_TYPES,
  REVENUE_CATEGORIES,
  REVENUE_STATUSES,
  REVENUE_PAYMENT_MODES,
  isIncomeType,
  isExpenseType,
} from '../../types';
import { createTransaction, updateTransaction, fetchTransactionById, validateAmount, validateDate, sanitizeAmountInput } from '../../services/revenue';
import { searchCustomers, getOrCreateCustomer, searchServiceSheetNumbers } from '../../services/customer';
import { useAuth } from '../../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<AdminStackParamList, 'RevenueTransactionForm'>;
type FormRouteProp = RouteProp<AdminStackParamList, 'RevenueTransactionForm'>;

type FormErrors = {
  transactionType?: string;
  category?: string;
  amount?: string;
  date?: string;
  customerName?: string;
  customType?: string;
  customCategory?: string;
  customPaymentMode?: string;
};

const ChipGroup = <T extends string>({
  options, selected, onSelect, label, required,
}: {
  options: readonly T[];
  selected: T | null;
  onSelect: (val: T) => void;
  label: string;
  required?: boolean;
}) => (
  <View style={chipStyles.wrapper}>
    <Text style={chipStyles.label}>{label}{required ? ' *' : ''}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={chipStyles.row}>
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={[chipStyles.chip, active ? chipStyles.chipActive : chipStyles.chipInactive]}
              activeOpacity={0.7}
            >
              <Text style={[chipStyles.chipText, active ? chipStyles.chipTextActive : chipStyles.chipTextInactive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  </View>
);

const chipStyles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1 },
  chipActive: { backgroundColor: colors.headerBg, borderColor: colors.headerBg },
  chipInactive: { backgroundColor: colors.surface, borderColor: colors.border },
  chipText: { ...typography.subhead, fontWeight: '600' },
  chipTextActive: { color: colors.textInverse },
  chipTextInactive: { color: colors.textPrimary },
});

const toInputDate = (iso: string): string => iso ? iso.substring(0, 10) : '';

const parseDateString = (v: string): Date | null => {
  if (!v) return null;
  let parts: number[] | null = null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) parts = v.split('/').map(Number);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const p = v.split('-').map(Number); parts = [p[2], p[1], p[0]]; }
  else if (/^\d{2}-\d{2}-\d{4}$/.test(v)) parts = v.split('-').map(Number);
  if (!parts) return null;
  const d = new Date(parts[2], parts[1] - 1, parts[0]);
  return isNaN(d.getTime()) ? null : d;
};

const formatDateDisplay = (v: string): string => {
  if (!v) return 'Select Date';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const p = v.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
  if (/^\d{2}-\d{2}-\d{4}$/.test(v)) return v.replace(/-/g, '/');
  return v;
};

const formCache: Record<string, any> = {};
const CACHE_KEY = 'revenueForm';

export const RevenueTransactionFormScreen = () => {
  const route = useRoute<FormRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuth();
  const transactionId = route.params?.transactionId;
  const isEditing = !!transactionId;

  const cached = !transactionId ? formCache[CACHE_KEY] : null;

  const [transactionType, setTransactionType] = useState<RevenueTransactionType | null>(cached?.transactionType ?? null);
  const [category, setCategory] = useState<RevenueCategory | null>(cached?.category ?? null);
  const [amount, setAmount] = useState(cached?.amount ?? '');
  const [paymentMode, setPaymentMode] = useState<RevenuePaymentMode | null>(cached?.paymentMode ?? null);
  const [date, setDate] = useState(cached?.date ?? '');
  const [description, setDescription] = useState(cached?.description ?? '');
  const [customerName, setCustomerName] = useState(cached?.customerName ?? '');
  const [vendorName, setVendorName] = useState(cached?.vendorName ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(cached?.invoiceNumber ?? '');
  const [status, setStatus] = useState<RevenueStatus | null>(cached?.status ?? 'Pending');
  const [paidAmount, setPaidAmount] = useState(cached?.paidAmount ?? '');
  const [serviceSheetNumber, setServiceSheetNumber] = useState(cached?.serviceSheetNumber ?? '');
  const [customTransactionType, setCustomTransactionType] = useState(cached?.customTransactionType ?? '');
  const [customCategory, setCustomCategory] = useState(cached?.customCategory ?? '');
  const [customPaymentMode, setCustomPaymentMode] = useState(cached?.customPaymentMode ?? '');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dirty = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [customerSuggestions, setCustomerSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [sheetSuggestions, setSheetSuggestions] = useState<string[]>([]);
  const [showSheetDropdown, setShowSheetDropdown] = useState(false);

  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCache = (patch: Record<string, any>) => {
    if (!transactionId) {
      formCache[CACHE_KEY] = { ...(formCache[CACHE_KEY] || {}), ...patch };
    }
  };

  const markDirty = (patch?: Record<string, any>) => {
    dirty.current = true;
    if (patch) updateCache(patch);
  };

  const clearCache = () => { delete formCache[CACHE_KEY]; };

  const handleBack = () => {
    if (dirty.current) {
      if (Platform.OS === 'web') {
        if (window.confirm('Discard unsaved changes?')) { clearCache(); navigation.navigate('RevenueDashboard'); }
      } else {
        Alert.alert('Discard Changes?', 'You have unsaved changes. Discard them?', [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => { clearCache(); navigation.navigate('RevenueDashboard'); } },
        ]);
      }
    } else {
      navigation.navigate('RevenueDashboard');
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }
  }, [navigation, dirty.current]);

  useEffect(() => {
    if (status === 'Paid' && amount && !dirty.current) {
      setPaidAmount(amount);
    }
  }, [status, amount]);

  useEffect(() => {
    if (!transactionId) return;
    setLoading(true);
    fetchTransactionById(transactionId)
      .then((txn) => {
        setTransactionType(txn.transaction_type);
        setCategory(txn.category);
        setAmount(String(txn.amount));
        setPaymentMode(txn.payment_mode);
        setDate(toInputDate(txn.transaction_date));
        setDescription(txn.description || '');
        setCustomerName(txn.customer_name || '');
        setVendorName(txn.vendor_name || '');
        setInvoiceNumber(txn.invoice_number || '');
        setStatus(txn.status);
        setPaidAmount(txn.paid_amount ? String(txn.paid_amount) : '');
        setServiceSheetNumber(txn.service_sheet_number || '');
        setCustomTransactionType(txn.custom_transaction_type || '');
        setCustomCategory(txn.custom_category || '');
        setCustomPaymentMode(txn.custom_payment_mode || '');
      })
      .catch(() => {
        Alert.alert('Error', 'Failed to load transaction');
        navigation.navigate('RevenueDashboard');
      })
      .finally(() => setLoading(false));
  }, [transactionId]);

  const handleAmountChange = (v: string) => {
    const sanitized = sanitizeAmountInput(v);
    setAmount(sanitized);
    markDirty({ amount: sanitized });
    const result = validateAmount(sanitized);
    if (!sanitized) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    } else if (!result.valid) {
      setErrors((prev) => ({ ...prev, amount: result.error }));
    } else {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const handleCustomerSearch = useCallback((text: string) => {
    setCustomerName(text);
    markDirty({ customerName: text });
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (!text || text.trim().length < 1) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      return;
    }
    customerSearchTimer.current = setTimeout(async () => {
      try {
        const results = await searchCustomers(text.trim());
        setCustomerSuggestions(results.map((c) => ({ id: c.id, name: c.name })));
        setShowCustomerDropdown(results.length > 0);
      } catch { /* silent */ }
    }, 300);
  }, []);

  const handleCustomerSelect = (name: string) => {
    setCustomerName(name);
    setShowCustomerDropdown(false);
    setCustomerSuggestions([]);
    markDirty({ customerName: name });
  };

  const handleSheetSearch = useCallback((text: string) => {
    setServiceSheetNumber(text);
    markDirty({ serviceSheetNumber: text });
    if (sheetSearchTimer.current) clearTimeout(sheetSearchTimer.current);
    if (!text || text.trim().length < 1) {
      setSheetSuggestions([]);
      setShowSheetDropdown(false);
      return;
    }
    sheetSearchTimer.current = setTimeout(async () => {
      try {
        const sheets = await searchServiceSheetNumbers(text.trim());
        setSheetSuggestions(sheets);
        setShowSheetDropdown(sheets.length > 0);
      } catch { /* silent */ }
    }, 300);
  }, []);

  const handleSheetSelect = (val: string) => {
    setServiceSheetNumber(val);
    setShowSheetDropdown(false);
    setSheetSuggestions([]);
    markDirty({ serviceSheetNumber: val });
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!transactionType) e.transactionType = 'Transaction type is required';
    if (transactionType === 'Other' && !customTransactionType.trim()) e.customType = 'Custom transaction type is required';
    if (!category) e.category = 'Category is required';
    if (category === 'Other' && !customCategory.trim()) e.customCategory = 'Custom category is required';
    const amtResult = validateAmount(amount);
    if (!amtResult.valid) e.amount = amtResult.error;
    const dateResult = validateDate(date);
    if (!dateResult.valid) e.date = dateResult.error;
    if (paymentMode === 'Other' && !customPaymentMode.trim()) e.customPaymentMode = 'Custom payment mode is required';
    setErrors(e);
    if (Object.keys(e).length > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !profile) return;

    const amtResult = validateAmount(amount);
    if (!amtResult.valid) return;
    const amt = amtResult.numericValue;

    const paid = paidAmount ? parseFloat(sanitizeAmountInput(paidAmount)) : (status === 'Paid' ? amt : 0);

    const payload: Partial<RevenueTransaction> = {
      transaction_type: transactionType!,
      category: category!,
      amount: amt,
      payment_mode: paymentMode || 'Cash',
      transaction_date: validateDate(date).isoDate,
      description: description || null,
      customer_name: customerName || null,
      vendor_name: vendorName || null,
      invoice_number: invoiceNumber || null,
      status: status || 'Pending',
      paid_amount: paid,
      updated_by: profile.id,
      service_sheet_number: serviceSheetNumber || null,
      custom_transaction_type: transactionType === 'Other' ? customTransactionType || null : null,
      custom_category: category === 'Other' ? customCategory || null : null,
      custom_payment_mode: paymentMode === 'Other' ? customPaymentMode || null : null,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await updateTransaction(transactionId!, payload);
      } else {
        payload.created_by = profile.id;
        await createTransaction(payload);
      }
      clearCache();
      navigation.navigate('RevenueDashboard');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const showClient = transactionType && isIncomeType(transactionType) && !customerName;
  const showVendor = transactionType && isExpenseType(transactionType) && !customerName;

  if (loading) {
    return (
      <ScreenWrapper>
        <HeaderBar title={isEditing ? 'Edit Transaction' : 'New Transaction'} onBack={handleBack} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <HeaderBar title={isEditing ? 'Edit Transaction' : 'New Transaction'} onBack={handleBack} />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Basic Details</Text>

          <ChipGroup
            label="Transaction Type"
            required
            options={REVENUE_TRANSACTION_TYPES}
            selected={transactionType}
            onSelect={(v) => { setTransactionType(v); markDirty({ transactionType: v }); setErrors((p) => ({ ...p, transactionType: undefined })); }}
          />
          {errors.transactionType && <Text style={styles.errorText}>{errors.transactionType}</Text>}
          {transactionType === 'Other' && (
            <View style={styles.customField}>
              <Input
                label="Custom Transaction Type *"
                value={customTransactionType}
                onChangeText={(v) => { setCustomTransactionType(v); markDirty({ customTransactionType: v }); }}
                placeholder="Enter custom type"
                error={errors.customType}
              />
            </View>
          )}

          <ChipGroup
            label="Category"
            required
            options={REVENUE_CATEGORIES}
            selected={category}
            onSelect={(v) => { setCategory(v); markDirty({ category: v }); setErrors((p) => ({ ...p, category: undefined })); }}
          />
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          {category === 'Other' && (
            <View style={styles.customField}>
              <Input
                label="Custom Category *"
                value={customCategory}
                onChangeText={(v) => { setCustomCategory(v); markDirty({ customCategory: v }); }}
                placeholder="Enter custom category"
                error={errors.customCategory}
              />
            </View>
          )}

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Input
                label="Amount *"
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="phone-pad"
                error={errors.amount}
                placeholder="e.g. 1500.00"
              />
            </View>
            <View style={styles.fieldGap} />
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Date *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={date ? date.split('/').reverse().join('-') : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const [y, m, d] = val.split('-');
                      const formatted = `${d}/${m}/${y}`;
                      setDate(formatted);
                      markDirty({ date: formatted });
                      const result = validateDate(formatted);
                      setErrors((prev) => ({ ...prev, date: result.valid ? undefined : result.error }));
                    }
                  }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${errors.date ? colors.borderError : colors.border}`,
                    fontSize: '16px', backgroundColor: colors.surface, color: colors.textPrimary, boxSizing: 'border-box',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.datePickerBtn, errors.date && { borderColor: colors.borderError }]}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.datePickerText, !date && { color: colors.textTertiary }]}>
                      {formatDateDisplay(date) || 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={parseDateString(date) || new Date()}
                      mode="date"
                      display="default"
                      onChange={(_: any, d: Date | undefined) => {
                        setShowDatePicker(false);
                        if (d) {
                          const dd = String(d.getDate()).padStart(2, '0');
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const yyyy = d.getFullYear();
                          const formatted = `${dd}/${mm}/${yyyy}`;
                          setDate(formatted);
                          markDirty({ date: formatted });
                          const result = validateDate(formatted);
                          setErrors((prev) => ({ ...prev, date: result.valid ? undefined : result.error }));
                        }
                      }}
                    />
                  )}
                </>
              )}
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>
          </View>

          <ChipGroup
            label="Payment Mode"
            options={REVENUE_PAYMENT_MODES}
            selected={paymentMode}
            onSelect={(v) => { setPaymentMode(v); markDirty({ paymentMode: v }); }}
          />
          {paymentMode === 'Other' && (
            <View style={styles.customField}>
              <Input
                label="Custom Payment Mode *"
                value={customPaymentMode}
                onChangeText={(v) => { setCustomPaymentMode(v); markDirty({ customPaymentMode: v }); }}
                placeholder="Enter custom payment mode"
                error={errors.customPaymentMode}
              />
            </View>
          )}

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Customer & Reference</Text>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Customer Name</Text>
            <RNTextInput
              style={[styles.textInput, (showCustomerDropdown && customerSuggestions.length > 0) && styles.textInputFocused]}
              placeholder="Search customer..."
              placeholderTextColor={colors.textTertiary}
              value={customerName}
              onChangeText={handleCustomerSearch}
              onFocus={() => { if (customerSuggestions.length > 0) setShowCustomerDropdown(true); }}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
            />
            {showCustomerDropdown && customerSuggestions.length > 0 && (
              <View style={styles.dropdown}>
                {customerSuggestions.map((s) => (
                  <TouchableOpacity key={s.id} style={styles.dropdownItem} onPress={() => handleCustomerSelect(s.name)}>
                    <Text style={styles.dropdownText}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {showClient && (
            <Input
              label="Client ID"
              value={vendorName}
              onChangeText={(v) => { setVendorName(v); markDirty({ vendorName: v }); }}
              placeholder="Client ID"
            />
          )}
          {showVendor && (
            <Input
              label="Vendor Name"
              value={vendorName}
              onChangeText={(v) => { setVendorName(v); markDirty({ vendorName: v }); }}
              placeholder="Vendor name"
            />
          )}

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Service Sheet Number</Text>
            <RNTextInput
              style={[styles.textInput, (showSheetDropdown && sheetSuggestions.length > 0) && styles.textInputFocused]}
              placeholder="e.g. SH-10024"
              placeholderTextColor={colors.textTertiary}
              value={serviceSheetNumber}
              onChangeText={handleSheetSearch}
              onFocus={() => { if (sheetSuggestions.length > 0) setShowSheetDropdown(true); }}
              onBlur={() => setTimeout(() => setShowSheetDropdown(false), 200)}
            />
            {showSheetDropdown && sheetSuggestions.length > 0 && (
              <View style={styles.dropdown}>
                {sheetSuggestions.map((s) => (
                  <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => handleSheetSelect(s)}>
                    <Text style={styles.dropdownText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Input
            label="Invoice Number"
            value={invoiceNumber}
            onChangeText={(v) => { setInvoiceNumber(v); markDirty({ invoiceNumber: v }); }}
            placeholder="Invoice #"
          />

          <Input
            label="Description"
            value={description}
            onChangeText={(v) => { setDescription(v); markDirty({ description: v }); }}
            multiline
            placeholder="Transaction description"
          />

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Status & Payment</Text>

          <ChipGroup
            label="Status"
            options={REVENUE_STATUSES}
            selected={status}
            onSelect={(v) => { setStatus(v); markDirty({ status: v }); }}
          />

          {(status === 'Partially Paid' || (status === 'Paid' && !!paidAmount)) && (
            <Input
              label="Paid Amount"
              value={paidAmount}
              onChangeText={(v) => { setPaidAmount(sanitizeAmountInput(v)); markDirty({ paidAmount: sanitizeAmountInput(v) }); }}
              keyboardType="phone-pad"
            />
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.saveBtnText}>Save Transaction</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing['6xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: colors.textPrimary,
    marginBottom: spacing.md, marginTop: spacing.xs,
  },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  errorText: { ...typography.caption1, color: colors.error, marginTop: -spacing.sm, marginBottom: spacing.md, marginLeft: spacing.xs },
  customField: { marginTop: -spacing.md, marginBottom: spacing.sm },
  fieldWrapper: { marginBottom: spacing.lg, zIndex: 10 },
  fieldLabel: { ...typography.subhead, color: colors.textSecondary, marginBottom: spacing.sm },
  fieldRow: { flexDirection: 'row', marginBottom: 0 },
  fieldHalf: { flex: 1 },
  fieldGap: { width: spacing.md },
  datePickerBtn: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, minHeight: 48,
    justifyContent: 'center',
  },
  datePickerText: { fontSize: 16, color: colors.textPrimary },
  textInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.textPrimary,
  },
  textInputFocused: { borderColor: colors.borderFocus },
  dropdown: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginTop: spacing.xs, maxHeight: 200, overflow: 'hidden',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  dropdownItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dropdownText: { fontSize: 15, color: colors.textPrimary },
  buttonRow: {
    flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { ...typography.headline, fontWeight: '600', color: colors.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: spacing.lg, borderRadius: radius.md,
    backgroundColor: colors.headerBg, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { ...typography.headline, fontWeight: '700', color: colors.accent },
});
