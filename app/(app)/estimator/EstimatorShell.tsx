'use client';

import { useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
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

const TABS = [
  { id: 'takeoff',     label: 'Takeoff'         },
  { id: 'assemblies',  label: 'Assembly Library' },
  { id: 'fixtures',    label: 'Fixture Builder'  },
  { id: 'panel',       label: 'Panel Builder'    },
  { id: 'items',       label: 'Audit Trail'      },
  { id: 'gear',        label: 'Gear Builder'     },
  { id: 'permits',     label: 'Permits & Subs'   },
  { id: 'bom',         label: 'BOM Reference'    },
  { id: 'summary',     label: 'Bid Summary'      },
  { id: 'proposal',    label: 'Proposal'         },
  { id: 'settings',    label: 'Settings'         },
];

export function EstimatorShell() {
  const { state, setTab } = useEstimatorContext();
  const tab = state.tab;
  const [jobsOpen,     setJobsOpen]     = useState(false);
  const [counterOpen,  setCounterOpen]  = useState(false);
  const showTools = !['summary', 'settings'].includes(state.tab);

  return (
    <div className="-mx-4 -my-6 flex flex-col min-h-screen">
      {/* Tool header */}
      <div className="bg-[#002D72] text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm tracking-wide">
            Oak Ridge Electrical — Estimating Tool
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
                  onClick={() => window.open('/pdf-takeoff.html', '_blank')}
                  className="px-3 py-1.5 text-sm font-semibold rounded border-2 border-white text-white hover:bg-white hover:text-[#1a3a5c] transition-colors flex items-center gap-1.5 whitespace-nowrap"
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
                  ? 'border-[#002D72] text-[#002D72]'
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
            <div className="bg-[#1a3a5c] text-white px-4 py-2 flex justify-between items-center">
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 mb-4">
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
        ) : tab === 'panel' ? (
          <PanelBuilderTab />
        ) : tab === 'gear' ? (
          <GearBuilderTab />
        ) : tab === 'permits' ? (
          <PermitsSubsTab />
        ) : tab === 'bom' ? (
          <BOMReferenceTab />
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
