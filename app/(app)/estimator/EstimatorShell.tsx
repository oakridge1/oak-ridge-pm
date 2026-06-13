'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import type { SavedAssembly } from '@/lib/estimator/constants';
import { JobsModal } from '@/components/estimator/JobsModal';
import { ConduitRunBuilder }     from '@/components/estimator/ConduitRunBuilder';
import { StrutRackBuilder }      from '@/components/estimator/StrutRackBuilder';
import { MCHomeRunBuilder }      from '@/components/estimator/MCHomeRunBuilder';
import { ThreeWayBuilder }       from '@/components/estimator/ThreeWayBuilder';
import { DataBuilder }           from '@/components/estimator/DataBuilder';
import { FireAlarmBuilder }      from '@/components/estimator/FireAlarmBuilder';
import { PullCanBuilder }        from '@/components/estimator/PullCanBuilder';
import { LVBuilder }             from '@/components/estimator/LVBuilder';
import { HighAmpReceptBuilder }  from '@/components/estimator/HighAmpReceptBuilder';
import { FloorBoxBuilder }       from '@/components/estimator/FloorBoxBuilder';
import { TMBuilder }             from '@/components/estimator/TMBuilder';
import { BidItemsTab }          from '@/components/estimator/BidItemsTab';
import { PermitsSubsTab }       from '@/components/estimator/PermitsSubsTab';
import { BidSummaryTab }        from '@/components/estimator/BidSummaryTab';
import { SettingsTab }          from '@/components/estimator/SettingsTab';
import { BOMReferenceTab }      from '@/components/estimator/BOMReferenceTab';
import { FixtureBuilderTab }    from '@/components/estimator/FixtureBuilderTab';
import { PanelBuilderTab }      from '@/components/estimator/PanelBuilderTab';
import { GearBuilderTab }       from '@/components/estimator/GearBuilderTab';
import { ProposalTab }          from '@/components/estimator/ProposalTab';
import { TakeoffTab }           from '@/components/estimator/TakeoffTab';
import { CounterTool }         from '@/components/estimator/CounterTool';
import { LightingScheduleTab } from '@/components/estimator/LightingScheduleTab';
import { GearScheduleTab }     from '@/components/estimator/GearScheduleTab';
import { LabelSelector }       from '@/components/estimator/LabelSelector';
import { CustomAssemblyBuilder } from '@/components/estimator/CustomAssemblyBuilder';

const TABS = [
  { id: 'takeoff',     label: 'Takeoff'         },
  { id: 'assemblies',  label: 'Assembly Library' },
  { id: 'fixtures',    label: 'Fixture Builder'  },
  { id: 'custom_asm',  label: 'Custom Assembly'  },
  { id: 'panel',       label: 'Panel Builder'    },
  { id: 'items',       label: 'Audit Trail'      },
  { id: 'gear',        label: 'Gear Builder'     },
  { id: 'permits',     label: 'Permits & Subs'   },
  { id: 'bom',         label: 'BOM Reference'    },
  { id: 'lighting',    label: 'Lighting Schedule'},
  { id: 'gear_sched',  label: 'Gear Schedule'    },
  { id: 'summary',     label: 'Bid Summary'      },
  { id: 'proposal',    label: 'Proposal'         },
  { id: 'settings',    label: 'Settings'         },
];

// ── Ridge List helpers ─────────────────────────────────────────────────────────

function inferCategory(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('receptacle') || l.includes('gfci') ||
      l.includes('switch')     || l.includes('dimmer')) return 'Devices';
  if (l.includes('fixture') || l.includes('led') ||
      l.includes('light')   || l.includes('can')) return 'Fixtures';
  if (l.includes('emt') || l.includes('conduit') || l.includes('mc ')) return 'Conduit';
  if (l.includes('smoke') || l.includes('pull') ||
      l.includes('horn')  || l.includes('alarm')) return 'FA';
  if (l.includes('camera') || l.includes('data') || l.includes('lv')) return 'LV';
  if (l.includes('panel')) return 'Gear';
  return 'Custom';
}

function categoryColor(label: string): string {
  const colors: Record<string, string> = {
    Devices:  '#e03a3a',
    Fixtures: '#4a9eff',
    Conduit:  '#888888',
    FA:       '#ff6b35',
    LV:       '#9b59b6',
    Gear:     '#27ae60',
    Custom:   '#f39c12',
  };
  return colors[inferCategory(label)] ?? '#888888';
}

export function EstimatorShell({ isAdmin = false }: { isAdmin?: boolean }) {
  const { state, setTab, addPrebuiltAssembly } = useEstimatorContext();
  const tab = state.tab;
  const [jobsOpen,     setJobsOpen]     = useState(false);
  const [counterOpen,  setCounterOpen]  = useState(false);
  const showTools = !['summary', 'settings'].includes(state.tab);

  // ── Ridge List: live assembly broadcast to the PDF tool ─────────────────────
  const channelRef = useRef<BroadcastChannel | null>(null);

  const broadcastRidgeList = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const allAsms: SavedAssembly[] = [
      ...(state.savedRuns      ?? []), ...(state.savedRacks     ?? []),
      ...(state.savedMCHR      ?? []), ...(state.savedThreeWay  ?? []),
      ...(state.savedData      ?? []), ...(state.savedFA        ?? []),
      ...(state.savedCans      ?? []), ...(state.savedGear      ?? []),
      ...(state.savedCustomDev ?? []), ...(state.savedTM        ?? []),
      ...(state.savedLV        ?? []), ...(state.savedCustomAsm ?? []),
      ...(state.savedHAR       ?? []), ...(state.savedFloorBox  ?? []),
      ...(state.asms           ?? []), ...(state.savedPanels    ?? []),
    ];
    // Deduplicate by label — keep first occurrence
    const seen = new Set<string>();
    const unique = allAsms.filter(a => {
      if (seen.has(a.label)) return false;
      seen.add(a.label);
      return true;
    });
    const items = unique.map((a, i) => ({
      id:         `rl_${i}_${a.label.replace(/\s+/g, '_')}`,
      label:      a.label,
      mat:        a.mat,
      lab:        a.lab,
      lines:      a.lines,
      bidPackage: a.bidPackage || '',
      area:       a.area       || '',
      costCode:   a.costCode   || '',
      category:   inferCategory(a.label),
      color:      categoryColor(a.label),
    }));
    channel.postMessage({
      type: 'RIDGE_LIST_UPDATE',
      payload: {
        assemblies: items,
        estimateId: state.jobId || '',
        jobName:    state.jobName || '',
      },
    });
  }, [
    state.savedRuns, state.savedRacks, state.savedMCHR, state.savedThreeWay,
    state.savedData, state.savedFA, state.savedCans, state.savedGear,
    state.savedCustomDev, state.savedTM, state.savedLV, state.savedCustomAsm,
    state.savedHAR, state.savedFloorBox, state.asms, state.savedPanels,
    state.jobId, state.jobName,
  ]);

  // Keep latest callbacks reachable from the long-lived channel listener
  const broadcastRef = useRef(broadcastRidgeList);
  broadcastRef.current = broadcastRidgeList;
  const addPrebuiltRef = useRef(addPrebuiltAssembly);
  addPrebuiltRef.current = addPrebuiltAssembly;

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('ore_tools');
    channelRef.current = channel;
    channel.onmessage = (e) => {
      const msg = e.data ?? {};
      if (msg.type === 'ASSEMBLY_PLACED' && msg.payload?.assembly) {
        addPrebuiltRef.current(msg.payload.assembly as SavedAssembly);
      }
      if (msg.type === 'PING' || msg.type === 'PONG') {
        // Tool (re)connected — send it the current Ridge List
        broadcastRef.current();
      }
    };
    return () => { channelRef.current = null; channel.close(); };
  }, []);

  // Broadcast whenever assemblies (or job context) change — and once on mount
  useEffect(() => { broadcastRidgeList(); }, [broadcastRidgeList]);

  return (
    <div className="-mx-4 -my-6 flex flex-col min-h-screen">
      {/* Tool header */}
      <div className="bg-[#1e3a8a] text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <img
              src="/White-ridge-logo.png"
              alt="Ridgeline"
              style={{ height: '32px', width: 'auto' }}
            />
            <span className="text-xs text-blue-200 tracking-widest uppercase">Estimator</span>
          </span>
          <span className="text-xs text-blue-200">
            ${state.settings.labor.toFixed(2)}/hr · NECA
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm text-blue-100 truncate mr-2">{state.jobName}</span>
          <div className="flex items-center gap-2 shrink-0">
            {showTools && (
              <>
                <button
                  onClick={() => window.open(
                    `/pdf-takeoff.html?estimateId=${state.jobId || ''}`,
                    'ore_pdf_takeoff',
                    'width=1400,height=900,resizable=yes',
                  )}
                  className="px-3 py-1.5 text-sm font-semibold rounded border-2 border-white text-white hover:bg-white hover:text-[#1e3a8a] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  ↗ Takeoff
                </button>
                <button
                  onClick={() => setCounterOpen(true)}
                  className="px-3 py-1.5 text-sm font-semibold rounded border-2 border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  ↗ Counter
                </button>
              </>
            )}
            <button
              onClick={() => setJobsOpen(true)}
              className="text-xs border border-blue-300/60 text-blue-100 px-2 py-0.5 rounded hover:bg-blue-700 transition-colors"
            >
              Jobs
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-[#1e3a8a] text-[#1e3a8a]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs modal */}
      <JobsModal open={jobsOpen} onClose={() => setJobsOpen(false)} />

      {/* Counter tool slide-over */}
      {counterOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setCounterOpen(false)}
          />
          <div className="w-full max-w-sm bg-gray-100 flex flex-col h-full shadow-2xl">
            <div className="bg-[#1e3a8a] text-white px-4 py-2 flex justify-between items-center">
              <span className="font-bold text-sm">TAKEOFF COUNTER</span>
              <button
                onClick={() => setCounterOpen(false)}
                className="text-white/70 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <CounterTool />
            </div>
          </div>
        </div>
      )}

      {/* Pane */}
      <div className="flex-1 bg-gray-50 px-4 py-4">
        {tab === 'takeoff' ? (
          <TakeoffTab />
        ) : tab === 'assemblies' ? (
          <div className="max-w-5xl">
            <LabelSelector />
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 mb-4 mt-3">
              Assemblies auto-explode to full material + labor. Home runs always separate.
              Underground: qty = linear feet.
            </div>
            <ConduitRunBuilder />
            <StrutRackBuilder />
            <MCHomeRunBuilder />
            <ThreeWayBuilder />
            <DataBuilder />
            <FireAlarmBuilder />
            <PullCanBuilder />
            <LVBuilder />
            <HighAmpReceptBuilder />
            <FloorBoxBuilder />
            <TMBuilder />
          </div>
        ) : tab === 'items' ? (
          <BidItemsTab />
        ) : tab === 'fixtures' ? (
          <FixtureBuilderTab />
        ) : tab === 'custom_asm' ? (
          <CustomAssemblyBuilder />
        ) : tab === 'panel' ? (
          <PanelBuilderTab />
        ) : tab === 'gear' ? (
          <GearBuilderTab />
        ) : tab === 'permits' ? (
          <PermitsSubsTab />
        ) : tab === 'bom' ? (
          <BOMReferenceTab isAdmin={isAdmin} />
        ) : tab === 'lighting' ? (
          <LightingScheduleTab />
        ) : tab === 'gear_sched' ? (
          <GearScheduleTab />
        ) : tab === 'summary' ? (
          <BidSummaryTab />
        ) : tab === 'proposal' ? (
          <ProposalTab />
        ) : tab === 'settings' ? (
          <SettingsTab />
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            {TABS.find(t => t.id === tab)?.label ?? tab} — coming soon
          </div>
        )}
      </div>
    </div>
  );
}
