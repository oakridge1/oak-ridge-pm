'use client';

import { useState, useEffect, useRef } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';

// ── LabelSelector ─────────────────────────────────────────────────────────────
// Sticky navy banner shown at the top of each builder tab.
// Lets the user choose Bid Package / Area / Cost Code before adding assemblies.
// Broadcasts label + job context changes to the PDF Takeoff and Counter tools
// over the shared 'ore_tools' BroadcastChannel.

export function LabelSelector() {
  const { state, setActiveLabel, addLabel, removeLabel } = useEstimatorContext();

  const [newBidPackage, setNewBidPackage] = useState('');
  const [newArea,       setNewArea]       = useState('');
  const [newCostCode,   setNewCostCode]   = useState('');

  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('ore_tools');
    channelRef.current = channel;
    channel.onmessage = (e) => {
      if (e.data?.type === 'PING') {
        channel.postMessage({ type: 'PONG', payload: { source: 'estimator' } });
      }
    };
    return () => { channelRef.current = null; channel.close(); };
  }, []);

  // Broadcast label changes (also fires once on mount so tools get current state)
  useEffect(() => {
    channelRef.current?.postMessage({
      type: 'LABELS_CHANGED',
      payload: {
        activeBidPackage: state.activeBidPackage,
        activeArea:       state.activeArea,
        activeCostCode:   state.activeCostCode,
        labelsBidPackage: state.labelsBidPackage,
        labelsArea:       state.labelsArea,
        labelsCostCode:   state.labelsCostCode,
      },
    });
  }, [
    state.activeBidPackage, state.activeArea, state.activeCostCode,
    state.labelsBidPackage, state.labelsArea, state.labelsCostCode,
  ]);

  // Broadcast job context on mount and when the job changes
  useEffect(() => {
    channelRef.current?.postMessage({
      type: 'JOB_CONTEXT',
      payload: {
        estimateId: state.jobId || '',
        jobName:    state.jobName || '',
      },
    });
  }, [state.jobId, state.jobName]);

  function handleAdd(
    dimension: 'bidPackage' | 'area' | 'costCode',
    value: string,
    setValue: (v: string) => void,
  ) {
    const trimmed = value.trim();
    if (!trimmed) return;
    addLabel(dimension, trimmed);
    setActiveLabel(dimension, trimmed);
    setValue('');
  }

  const colClass = 'flex flex-col gap-1 min-w-0';

  return (
    <div className="sticky top-[88px] z-20 bg-[#1e3a8a] text-white rounded-t px-4 py-3 mb-0 shadow-sm">
      <div className="text-[10px] font-bold tracking-widest uppercase text-blue-200 mb-2">
        Active Labels — applies to all assemblies added below
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* ── Bid Package ── */}
        <div className={colClass}>
          <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wide">
            Bid Package
          </span>
          <div className="flex gap-1 flex-wrap">
            {state.labelsBidPackage.map(pkg => (
              <button
                key={pkg}
                onClick={() => setActiveLabel('bidPackage', pkg)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  state.activeBidPackage === pkg
                    ? 'bg-blue-400 border-blue-400 text-white font-semibold'
                    : 'bg-transparent border-blue-400/60 text-blue-200 hover:bg-blue-700'
                }`}
              >
                {pkg}
                {state.labelsBidPackage.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={e => { e.stopPropagation(); removeLabel('bidPackage', pkg); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); removeLabel('bidPackage', pkg); } }}
                    className="ml-1 opacity-60 hover:opacity-100 cursor-pointer"
                    aria-label={`Remove ${pkg}`}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={newBidPackage}
              onChange={e => setNewBidPackage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd('bidPackage', newBidPackage, setNewBidPackage); }}
              placeholder="+ Add package"
              className="flex-1 min-w-0 bg-[#0f2440] border border-blue-500/40 text-white placeholder-blue-400/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={() => handleAdd('bidPackage', newBidPackage, setNewBidPackage)}
              className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              +
            </button>
          </div>
        </div>

        {/* ── Area ── */}
        <div className={colClass}>
          <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wide">
            Area
          </span>
          <div className="flex gap-1 flex-wrap">
            {state.labelsArea.length === 0 && (
              <span className="text-xs text-blue-400/60 italic">None</span>
            )}
            {state.labelsArea.map(area => (
              <button
                key={area}
                onClick={() => setActiveLabel('area', area)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  state.activeArea === area
                    ? 'bg-purple-500 border-purple-500 text-white font-semibold'
                    : 'bg-transparent border-purple-400/60 text-purple-200 hover:bg-purple-800'
                }`}
              >
                {area}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); removeLabel('area', area); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); removeLabel('area', area); } }}
                  className="ml-1 opacity-60 hover:opacity-100 cursor-pointer"
                  aria-label={`Remove ${area}`}
                >
                  ×
                </span>
              </button>
            ))}
            {state.activeArea && !state.labelsArea.includes(state.activeArea) && (
              <button
                onClick={() => setActiveLabel('area', '')}
                className="px-2 py-0.5 text-xs rounded-full border border-purple-500 bg-purple-500 text-white font-semibold"
              >
                {state.activeArea}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); setActiveLabel('area', ''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setActiveLabel('area', ''); } }}
                  className="ml-1 opacity-60 hover:opacity-100 cursor-pointer"
                  aria-label="Clear area"
                >
                  ×
                </span>
              </button>
            )}
          </div>
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={newArea}
              onChange={e => setNewArea(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd('area', newArea, setNewArea); }}
              placeholder="+ Add area"
              className="flex-1 min-w-0 bg-[#0f2440] border border-purple-500/40 text-white placeholder-purple-400/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-purple-400"
            />
            <button
              onClick={() => handleAdd('area', newArea, setNewArea)}
              className="px-2 py-1 text-xs rounded bg-purple-700 hover:bg-purple-600 text-white font-semibold"
            >
              +
            </button>
          </div>
        </div>

        {/* ── Cost Code ── */}
        <div className={colClass}>
          <span className="text-[10px] font-semibold text-green-300 uppercase tracking-wide">
            Cost Code
          </span>
          <div className="flex gap-1 flex-wrap">
            {state.labelsCostCode.length === 0 && (
              <span className="text-xs text-blue-400/60 italic">None</span>
            )}
            {state.labelsCostCode.map(cc => (
              <button
                key={cc}
                onClick={() => setActiveLabel('costCode', cc)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  state.activeCostCode === cc
                    ? 'bg-green-600 border-green-600 text-white font-semibold'
                    : 'bg-transparent border-green-400/60 text-green-200 hover:bg-green-900'
                }`}
              >
                {cc}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); removeLabel('costCode', cc); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); removeLabel('costCode', cc); } }}
                  className="ml-1 opacity-60 hover:opacity-100 cursor-pointer"
                  aria-label={`Remove ${cc}`}
                >
                  ×
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={newCostCode}
              onChange={e => setNewCostCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd('costCode', newCostCode, setNewCostCode); }}
              placeholder="+ Add cost code"
              className="flex-1 min-w-0 bg-[#0f2440] border border-green-500/40 text-white placeholder-green-400/60 rounded px-2 py-1 text-xs focus:outline-none focus:border-green-400"
            />
            <button
              onClick={() => handleAdd('costCode', newCostCode, setNewCostCode)}
              className="px-2 py-1 text-xs rounded bg-green-800 hover:bg-green-700 text-white font-semibold"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
