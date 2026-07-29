import { supabase } from './supabase';
import { Customer, CustomerLedgerEntry, CustomerSummary, OutstandingCustomer } from '../types';

const CUSTOMER_TABLE = 'customers';
const LEDGER_TABLE = 'customer_ledger';
const TXN_TABLE = 'revenue_transactions';

const normalize = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

export const searchCustomers = async (query: string, limit = 10): Promise<Customer[]> => {
  if (!query || query.length < 1) return [];
  const q = normalize(query);
  const { data, error } = await supabase
    .from(CUSTOMER_TABLE)
    .select('*')
    .ilike('name_normalized', `%${q}%`)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data as Customer[];
};

export const getCustomerByExactName = async (name: string): Promise<Customer | null> => {
  const n = normalize(name);
  const { data, error } = await supabase
    .from(CUSTOMER_TABLE)
    .select('*')
    .eq('name_normalized', n)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
};

export const createCustomer = async (name: string): Promise<Customer> => {
  const n = normalize(name);
  const existing = await getCustomerByExactName(n);
  if (existing) return existing;
  const { data, error } = await supabase
    .from(CUSTOMER_TABLE)
    .insert({ name: name.trim(), name_normalized: n })
    .select()
    .single();
  if (error) throw error;
  return data as Customer;
};

export const getOrCreateCustomer = async (name: string): Promise<Customer> => createCustomer(name);

export const getCustomerById = async (id: string): Promise<Customer | null> => {
  const { data, error } = await supabase
    .from(CUSTOMER_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
};

export const searchServiceSheetNumbers = async (query: string, limit = 10): Promise<string[]> => {
  if (!query || query.length < 1) return [];
  const { data, error } = await supabase
    .from(TXN_TABLE)
    .select('service_sheet_number')
    .not('service_sheet_number', 'is', null)
    .ilike('service_sheet_number', `%${query}%`)
    .order('service_sheet_number')
    .limit(limit);
  if (error) throw error;
  return [...new Set((data as any[]).map((r: any) => r.service_sheet_number).filter(Boolean))] as string[];
};

export const addLedgerEntry = async (
  customerId: string,
  transactionId: string | null,
  entryType: CustomerLedgerEntry['entry_type'],
  direction: CustomerLedgerEntry['direction'],
  amount: number,
  description: string | null,
): Promise<void> => {
  const { data: lastEntry } = await supabase
    .from(LEDGER_TABLE)
    .select('running_balance')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevBalance = lastEntry ? (lastEntry as any).running_balance : 0;
  const runningBalance = direction === 'debit' ? prevBalance + amount : Math.max(0, prevBalance - amount);

  const { error } = await supabase.from(LEDGER_TABLE).insert({
    customer_id: customerId,
    transaction_id: transactionId,
    entry_type: entryType,
    direction,
    amount,
    running_balance: runningBalance,
    description,
  });
  if (error) throw error;
};

export const getCustomerLedger = async (customerId: string): Promise<CustomerLedgerEntry[]> => {
  const { data, error } = await supabase
    .from(LEDGER_TABLE)
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as CustomerLedgerEntry[];
};

export const getCustomerSummary = async (customerId: string): Promise<CustomerSummary | null> => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
  let finalId = customerId;
  let customerName = '';

  if (!isUuid) {
    const cust = await getCustomerByExactName(customerId);
    if (!cust) return null;
    finalId = cust.id;
    customerName = cust.name;
  }

  const { data: customer, error: cErr } = await supabase
    .from(CUSTOMER_TABLE)
    .select('*')
    .eq('id', finalId)
    .single();
  if (cErr || !customer) return null;

  if (!customerName) customerName = (customer as Customer).name;

  const { data: txns, error: tErr } = await supabase
    .from(TXN_TABLE)
    .select('*')
    .eq('customer_name', customerName)
    .is('deleted_at', null);
  if (tErr) throw tErr;

  const incomeTypes = ['Income', 'Client Payment', 'Refund', 'Adjustment'];
  const expenseTypes = ['Expense', 'Amount Given', 'Bills', 'Vendor Payment'];

  const total_revenue = (txns as any[]).filter((t: any) => incomeTypes.includes(t.transaction_type))
    .reduce((s: number, t: any) => s + t.amount, 0);
  const total_paid = (txns as any[]).filter((t: any) => t.status === 'Paid')
    .reduce((s: number, t: any) => s + t.amount, 0);
  const total_outstanding = (txns as any[]).filter((t: any) => t.status !== 'Paid' && t.status !== 'Cancelled')
    .reduce((s: number, t: any) => s + t.remaining_amount, 0);
  const pending_amount = (txns as any[]).filter((t: any) => t.status === 'Pending')
    .reduce((s: number, t: any) => s + t.remaining_amount, 0);
  const paidTxns = (txns as any[]).filter((t: any) => t.status === 'Paid');
  const last_payment_date = paidTxns.length > 0
    ? paidTxns.sort((a: any, b: any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())[0].transaction_date
    : null;
  const last_transaction_date = txns.length > 0
    ? (txns as any[]).sort((a: any, b: any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())[0].transaction_date
    : null;

  return {
    customer: customer as Customer,
    total_revenue,
    total_outstanding,
    total_paid,
    pending_amount,
    transaction_count: txns.length,
    last_payment_date,
    last_transaction_date,
  };
};

export const getOutstandingCustomers = async (): Promise<OutstandingCustomer[]> => {
  const { data: txns, error } = await supabase
    .from(TXN_TABLE)
    .select('*')
    .not('customer_name', 'is', null)
    .is('deleted_at', null)
    .neq('status', 'Cancelled')
    .order('transaction_date', { ascending: false });
  if (error) throw error;

  const customerMap = new Map<string, any[]>();
  for (const txn of (txns as any[])) {
    const key = txn.customer_name.trim().toLowerCase();
    if (!customerMap.has(key)) customerMap.set(key, []);
    customerMap.get(key)!.push(txn);
  }

  const incomeTypes = ['Income', 'Client Payment', 'Refund', 'Adjustment'];
  const result: OutstandingCustomer[] = [];

  for (const [_, customerTxns] of customerMap) {
    const name = customerTxns[0].customer_name;
    const total_revenue = customerTxns.filter((t: any) => incomeTypes.includes(t.transaction_type))
      .reduce((s: number, t: any) => s + t.amount, 0);
    const total_paid = customerTxns.filter((t: any) => t.status === 'Paid')
      .reduce((s: number, t: any) => s + t.amount, 0);
    const total_outstanding = customerTxns.filter((t: any) => t.status !== 'Paid')
      .reduce((s: number, t: any) => s + t.remaining_amount, 0);
    const pending_amount = customerTxns.filter((t: any) => t.status === 'Pending')
      .reduce((s: number, t: any) => s + t.remaining_amount, 0);
    const paidTxns = customerTxns.filter((t: any) => t.status === 'Paid');
    const last_payment_date = paidTxns.length > 0 ? paidTxns[0].transaction_date : null;
    const last_transaction_date = customerTxns[0].transaction_date;

    if (total_outstanding === 0 && pending_amount === 0) continue;

    const status: OutstandingCustomer['status'] = total_outstanding > 0 ? 'critical' : pending_amount > 0 ? 'warning' : 'good';

    result.push({
      customer: { id: '', name, name_normalized: name.trim().toLowerCase(), created_at: '' },
      total_revenue, total_outstanding, total_paid, pending_amount,
      transaction_count: customerTxns.length, last_payment_date, last_transaction_date, status,
    });
  }

  return result.sort((a, b) => b.total_outstanding - a.total_outstanding);
};
