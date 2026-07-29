import { supabase } from './supabase';
import { RevenueTransaction, RevenueAuditLog, RevenueStatus } from '../types';
import { getOrCreateCustomer, addLedgerEntry } from './customer';

const TABLE = 'revenue_transactions';
const AUDIT_TABLE = 'revenue_audit_log';

export const validateAmount = (value: string): { valid: boolean; numericValue: number; error?: string } => {
  if (!value || value.trim() === '') return { valid: false, numericValue: 0, error: 'Amount is required' };
  if (/[^0-9.]/.test(value)) return { valid: false, numericValue: 0, error: 'Only numbers and decimal point allowed' };
  const dots = value.split('.').length - 1;
  if (dots > 1) return { valid: false, numericValue: 0, error: 'Invalid decimal format' };
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, numericValue: 0, error: 'Invalid number' };
  if (num <= 0) return { valid: false, numericValue: 0, error: 'Amount must be greater than 0' };
  if (num > 999999999.99) return { valid: false, numericValue: 0, error: 'Amount too large' };
  return { valid: true, numericValue: num };
};

export const validateDate = (value: string): { valid: boolean; isoDate: string; error?: string } => {
  if (!value || value.trim() === '') return { valid: true, isoDate: new Date().toISOString() };
  const trimmed = value.trim();
  let day: number, month: number, year: number;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    day = parseInt(trimmed.substring(0, 2), 10);
    month = parseInt(trimmed.substring(3, 5), 10);
    year = parseInt(trimmed.substring(6, 10), 10);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    year = parseInt(trimmed.substring(0, 4), 10);
    month = parseInt(trimmed.substring(5, 7), 10);
    day = parseInt(trimmed.substring(8, 10), 10);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    day = parseInt(trimmed.substring(0, 2), 10);
    month = parseInt(trimmed.substring(3, 5), 10);
    year = parseInt(trimmed.substring(6, 10), 10);
  } else {
    return { valid: false, isoDate: '', error: 'Use DD/MM/YYYY or YYYY-MM-DD' };
  }
  if (month < 1 || month > 12) return { valid: false, isoDate: '', error: 'Invalid month' };
  if (day < 1 || day > 31) return { valid: false, isoDate: '', error: 'Invalid day' };
  const dateObj = new Date(year, month - 1, day);
  if (dateObj.getDate() !== day || dateObj.getMonth() !== month - 1 || dateObj.getFullYear() !== year) {
    return { valid: false, isoDate: '', error: 'Invalid date' };
  }
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  return { valid: true, isoDate: iso };
};

export const sanitizeAmountInput = (value: string): string =>
  value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

export type RevenueFilters = {
  transaction_type?: string;
  category?: string;
  status?: string;
  client_id?: string;
  vendor_name?: string;
  payment_mode?: string;
  invoice_number?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
  customer_name?: string;
  service_sheet_number?: string;
};

export type RevenueSummary = {
  total_income: number;
  total_expense: number;
  net_profit: number;
  profit_margin: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  pending_bills: number;
  total_transactions: number;
  collection_rate: number;
};

export const fetchTransactions = async (filters: RevenueFilters = {}) => {
  const page = filters.page || 1;
  const pageSize = filters.page_size || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false })
    .range(from, to);

  if (filters.transaction_type) query = query.eq('transaction_type', filters.transaction_type);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.client_id) query = query.eq('client_id', filters.client_id);
  if (filters.vendor_name) query = query.ilike('vendor_name', `%${filters.vendor_name}%`);
  if (filters.payment_mode) query = query.eq('payment_mode', filters.payment_mode);
  if (filters.invoice_number) query = query.ilike('invoice_number', `%${filters.invoice_number}%`);
  if (filters.customer_name) query = query.ilike('customer_name', `%${filters.customer_name}%`);
  if (filters.service_sheet_number) query = query.ilike('service_sheet_number', `%${filters.service_sheet_number}%`);
  if (filters.from_date) query = query.gte('transaction_date', filters.from_date);
  if (filters.to_date) query = query.lte('transaction_date', filters.to_date);
  if (filters.search) {
    query = query.or(
      `description.ilike.%${filters.search}%,invoice_number.ilike.%${filters.search}%,vendor_name.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,service_sheet_number.ilike.%${filters.search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as RevenueTransaction[], count: count || 0 };
};

export const fetchTransactionById = async (id: string) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as RevenueTransaction;
};

export const createTransaction = async (txn: Partial<RevenueTransaction>) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...txn,
      total_amount: txn.amount,
      paid_amount: txn.status === 'Paid' ? txn.amount : txn.paid_amount || 0,
      remaining_amount: txn.status === 'Paid' ? 0 : (txn.amount || 0) - (txn.paid_amount || 0),
      customer_name: txn.customer_name || null,
      service_sheet_number: txn.service_sheet_number || null,
      custom_transaction_type: txn.custom_transaction_type || null,
      custom_category: txn.custom_category || null,
      custom_payment_mode: txn.custom_payment_mode || null,
    })
    .select()
    .single();
  if (error) throw error;
  await insertAuditLog(data.id, 'create', null, data);
  if (data.customer_name) {
    const customer = await getOrCreateCustomer(data.customer_name);
    const incomeTypes = ['Income', 'Client Payment', 'Refund', 'Adjustment'];
    const direction = incomeTypes.includes(data.transaction_type) ? 'credit' as const : 'debit' as const;
    await addLedgerEntry(
      customer.id, data.id, 'invoice', direction, data.amount,
      `${data.transaction_type}: ${data.description || data.invoice_number || ''}`,
    );
  }
  return data as RevenueTransaction;
};

export const updateTransaction = async (id: string, txn: Partial<RevenueTransaction>) => {
  const old = await fetchTransactionById(id);
  const paid = txn.paid_amount !== undefined ? txn.paid_amount : old.paid_amount;
  const total = txn.total_amount || old.total_amount;
  const remaining = Math.max(0, total - paid);
  let status: RevenueStatus = old.status;
  if (paid >= total) status = 'Paid';
  else if (paid > 0) status = 'Partially Paid';
  else status = 'Pending';

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...txn,
      paid_amount: paid,
      remaining_amount: remaining,
      status,
      updated_by: txn.updated_by,
      customer_name: txn.customer_name || old.customer_name,
      service_sheet_number: txn.service_sheet_number !== undefined ? txn.service_sheet_number : old.service_sheet_number,
      custom_transaction_type: txn.custom_transaction_type !== undefined ? txn.custom_transaction_type : old.custom_transaction_type,
      custom_category: txn.custom_category !== undefined ? txn.custom_category : old.custom_category,
      custom_payment_mode: txn.custom_payment_mode !== undefined ? txn.custom_payment_mode : old.custom_payment_mode,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await insertAuditLog(id, 'update', old, data);
  return data as RevenueTransaction;
};

export const recordPayment = async (parentId: string, payment: Partial<RevenueTransaction>, userId: string) => {
  const parent = await fetchTransactionById(parentId);
  if (parent.status === 'Paid' || parent.status === 'Cancelled') throw new Error('Cannot pay a completed transaction');

  const newPaid = parent.paid_amount + (payment.amount || 0);
  const newRemaining = Math.max(0, parent.total_amount - newPaid);
  const newStatus: RevenueStatus = newPaid >= parent.total_amount ? 'Paid' : 'Partially Paid';

  const { data: child, error: childError } = await supabase
    .from(TABLE)
    .insert({
      parent_id: parentId,
      transaction_date: payment.transaction_date || new Date().toISOString(),
      transaction_type: payment.transaction_type || parent.transaction_type,
      amount: payment.amount,
      payment_mode: payment.payment_mode || parent.payment_mode,
      category: parent.category,
      description: payment.description || `Payment for ${parent.description || parent.invoice_number || parentId}`,
      client_id: parent.client_id,
      vendor_name: parent.vendor_name,
      invoice_number: parent.invoice_number,
      status: 'Paid' as RevenueStatus,
      total_amount: payment.amount || 0,
      paid_amount: payment.amount || 0,
      remaining_amount: 0,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();
  if (childError) throw childError;

  const { data: updated, error: updateError } = await supabase
    .from(TABLE)
    .update({ paid_amount: newPaid, remaining_amount: newRemaining, status: newStatus, updated_by: userId })
    .eq('id', parentId)
    .select()
    .single();
  if (updateError) throw updateError;

  await insertAuditLog(parentId, 'payment', parent, updated);
  if (parent.customer_name) {
    const customer = await getOrCreateCustomer(parent.customer_name);
    await addLedgerEntry(
      customer.id, child.id, 'payment', 'credit', payment.amount || 0,
      `Payment for ${parent.description || parent.invoice_number || parentId}`,
    );
  }
  return { parent: updated as RevenueTransaction, child: child as RevenueTransaction };
};

const recalculateParentAmounts = async (parentId: string, userId: string, action: string = 'update') => {
  const parent = await fetchTransactionById(parentId);
  const { data: children } = await supabase
    .from(TABLE)
    .select('amount')
    .eq('parent_id', parentId)
    .is('deleted_at', null);
  const totalPaid = (children || []).reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  const newRemaining = Math.max(0, parent.total_amount - totalPaid);
  const newStatus: RevenueStatus = totalPaid >= parent.total_amount ? 'Paid' : totalPaid > 0 ? 'Partially Paid' : 'Pending';

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({ paid_amount: totalPaid, remaining_amount: newRemaining, status: newStatus, updated_by: userId })
    .eq('id', parentId)
    .select()
    .single();
  if (!error && updated) {
    await insertAuditLog(parentId, action === 'soft_delete' ? 'payment_deleted' : action === 'restore' ? 'payment_restored' : 'update', parent, updated);
    return updated as RevenueTransaction;
  }
  return null;
};

const ledgerReversePayment = async (childId: string, parentId: string, amount: number, direction: 'debit' | 'credit') => {
  const parent = await fetchTransactionById(parentId).catch(() => null);
  if (!parent || !parent.customer_name) return;
  try {
    const customer = await getOrCreateCustomer(parent.customer_name);
    const entryType = direction === 'debit' ? 'adjustment' : 'payment';
    const desc = direction === 'debit'
      ? `Reversal: payment deleted for ${parent.description || parent.invoice_number || parentId}`
      : `Payment restored for ${parent.description || parent.invoice_number || parentId}`;
    await addLedgerEntry(customer.id, childId, entryType as any, direction, amount, desc);
  } catch {}
};

export const softDeleteTransaction = async (id: string, userId: string) => {
  const { data: children } = await supabase
    .from(TABLE)
    .select('id')
    .eq('parent_id', id)
    .is('deleted_at', null);
  if (children && children.length > 0) {
    throw new Error('Cannot delete transaction with linked payments. Delete child payments first.');
  }

  const old = await fetchTransactionById(id);
  const { data, error } = await supabase
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await insertAuditLog(id, 'soft_delete', old, data);

  let updatedParent: RevenueTransaction | null = null;
  if (old.parent_id) {
    updatedParent = await recalculateParentAmounts(old.parent_id, userId, 'soft_delete');
    await ledgerReversePayment(id, old.parent_id, old.amount, 'debit');
  }

  const result = data as RevenueTransaction;
  (result as any).updatedParent = updatedParent;
  return result;
};

export const restoreTransaction = async (id: string, userId: string) => {
  const old = await fetchTransactionById(id);
  const { data, error } = await supabase
    .from(TABLE)
    .update({ deleted_at: null, updated_by: userId })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await insertAuditLog(id, 'restore', old, data);

  if (data.parent_id) {
    await recalculateParentAmounts(data.parent_id, userId, 'restore');
    await ledgerReversePayment(id, data.parent_id, data.amount, 'credit');
  }

  return data as RevenueTransaction;
};

export const fetchChildren = async (parentId: string) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('parent_id', parentId)
    .is('deleted_at', null)
    .order('transaction_date', { ascending: true });
  if (error) throw error;
  return data as RevenueTransaction[];
};

export const fetchSummary = async (fromDate?: string, toDate?: string): Promise<RevenueSummary> => {
  let query = supabase
    .from(TABLE)
    .select('*')
    .is('deleted_at', null);

  if (fromDate) query = query.gte('transaction_date', fromDate);
  if (toDate) query = query.lte('transaction_date', toDate);

  const { data, error } = await query;
  if (error) throw error;
  const txns = data as RevenueTransaction[];

  const isIncome = (t: RevenueTransaction) =>
    ['Income', 'Client Payment', 'Refund', 'Adjustment'].includes(t.transaction_type);
  const isExpense = (t: RevenueTransaction) =>
    ['Expense', 'Amount Given', 'Bills', 'Vendor Payment'].includes(t.transaction_type);

  const total_income = txns.filter(isIncome).reduce((s, t) => s + t.amount, 0);
  const total_expense = txns.filter(isExpense).reduce((s, t) => s + t.amount, 0);
  const net_profit = total_income - total_expense;
  const profit_margin = total_income > 0 ? (net_profit / total_income) * 100 : 0;

  const paidCount = txns.filter(t => t.status === 'Paid').length;
  const collection_rate = txns.length > 0 ? (paidCount / txns.length) * 100 : 0;

  const { data: allTxns, error: allErr } = await supabase
    .from(TABLE)
    .select('transaction_type, status, remaining_amount')
    .is('deleted_at', null);
  if (allErr) throw allErr;
  const all = (allTxns || []) as any[];

  const outstanding_receivables = all
    .filter(t => isIncome(t as RevenueTransaction) && t.status !== 'Paid' && t.status !== 'Cancelled')
    .reduce((s: number, t: any) => s + t.remaining_amount, 0);
  const outstanding_payables = all
    .filter(t => isExpense(t as RevenueTransaction) && t.status !== 'Paid' && t.status !== 'Cancelled')
    .reduce((s: number, t: any) => s + t.remaining_amount, 0);
  const pending_bills = all.filter(t => t.status === 'Pending').length;

  return {
    total_income, total_expense, net_profit, profit_margin,
    outstanding_receivables, outstanding_payables, pending_bills,
    total_transactions: txns.length, collection_rate,
  };
};

export const fetchPeriodBreakdown = async (fromDate: string, toDate: string) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .is('deleted_at', null)
    .gte('transaction_date', fromDate)
    .lte('transaction_date', toDate);
  if (error) throw error;
  return data as RevenueTransaction[];
};

export const fetchAuditLog = async (transactionId: string) => {
  const { data, error } = await supabase
    .from(AUDIT_TABLE)
    .select('*')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as RevenueAuditLog[];
};

const insertAuditLog = async (transactionId: string, action: string, oldData: any, newData: any) => {
  await supabase.from(AUDIT_TABLE).insert({
    transaction_id: transactionId,
    action,
    old_data: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
    new_data: newData ? JSON.parse(JSON.stringify(newData)) : null,
  });
};
