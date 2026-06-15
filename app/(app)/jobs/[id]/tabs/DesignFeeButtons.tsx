'use client';

import { useState, useTransition } from 'react';
import { approveDesignFee, recordDesignFeePayment } from '@/app/(app)/actions';

const fmt$ = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function ApproveDesignFeeButton({ jobId }: { jobId: string; amount: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => approveDesignFee(jobId))}
      disabled={pending}
      className="w-full mt-1 px-3 py-1.5 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#003d99] disabled:opacity-50 transition-colors"
    >
      {pending ? 'Approving…' : '✓ Approve Design Fee'}
    </button>
  );
}

export function DesignFeePaymentButton({
  jobId, amount, paid,
}: { jobId: string; amount: number; paid: number }) {
  const [pending, start] = useTransition();
  const [val, setVal] = useState(String(paid || ''));

  if (paid >= amount && amount > 0) {
    return <div className="text-sm font-medium text-green-600">Paid in Full</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Paid: {fmt$(paid)}</span>
      <input
        type="number"
        min={0}
        max={amount}
        step="0.01"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="0.00"
        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right font-mono"
      />
      <button
        onClick={() => start(() => recordDesignFeePayment(jobId, parseFloat(val) || 0))}
        disabled={pending}
        className="px-3 py-1 text-xs font-semibold rounded border border-[#1e3a8a] text-[#1e3a8a] hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Saving…' : 'Record Payment'}
      </button>
    </div>
  );
}
