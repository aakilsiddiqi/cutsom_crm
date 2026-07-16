import { JobSheetStatus } from '../types';

export const STANDARD_MODELS = ['3DX', '3CX', '4CX', 'JS205', 'JS220', '530-110', '535-125'];

export const STATUS_OPTIONS = [
  { label: 'In Queue', value: 'In Queue' as JobSheetStatus, color: '#FFF3CD', border: '#ffeeba', text: '#856404' },
  { label: 'In Progress', value: 'In Progress' as JobSheetStatus, color: '#CCE5FF', border: '#b8daff', text: '#004085' },
  { label: 'Completed', value: 'Completed' as JobSheetStatus, color: '#D4EDDA', border: '#c3e6cb', text: '#155724' },
  { label: 'On Hold', value: 'On Hold' as JobSheetStatus, color: '#F8D7DA', border: '#f5c6cb', text: '#721c24' },
];

export const getStatusColors = (status: string): { bg: string; text: string } => {
  switch (status) {
    case 'In Queue': return { bg: '#FFF3CD', text: '#856404' };
    case 'In Progress': return { bg: '#CCE5FF', text: '#004085' };
    case 'Completed': return { bg: '#D4EDDA', text: '#155724' };
    case 'On Hold': return { bg: '#F8D7DA', text: '#721c24' };
    default: return { bg: '#e2e3e5', text: '#383d41' };
  }
};

export const getStatusBgColor = (status: string): string => {
  switch (status) {
    case 'In Queue': return '#FFF3CD';
    case 'In Progress': return '#CCE5FF';
    case 'Completed': return '#D4EDDA';
    case 'On Hold': return '#F8D7DA';
    default: return '#eee';
  }
};

export const getStatusTextColor = (status: string): string => {
  switch (status) {
    case 'In Queue': return '#856404';
    case 'In Progress': return '#004085';
    case 'Completed': return '#155724';
    case 'On Hold': return '#721c24';
    default: return '#333';
  }
};

export const FILTER_OPTIONS = ['All', 'In Queue', 'In Progress', 'On Hold', 'Completed'] as const;
