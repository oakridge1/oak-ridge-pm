"use client";

import { Camera, FolderOpen, LayoutGrid, X } from "lucide-react";

// Shown after an invoice download starts. Purely a reminder: nothing is
// required, nothing is saved, and it never touches the download itself.
export function CloseoutReminder({
  onClose,
  onGoToTab,
}: {
  onClose: () => void;
  // Switches the job page to another tab (id as used by JobTabs). Omit to hide
  // the shortcuts and show only the dismiss button.
  onGoToTab?: (tabId: "photos" | "documents" | "panels") => void;
}) {
  function go(tabId: "photos" | "documents" | "panels") {
    onClose();
    onGoToTab?.(tabId);
  }

  const options: {
    tab: "photos" | "documents" | "panels";
    label: string;
    sub?: string;
    icon: React.ReactNode;
  }[] = [
    { tab: "photos", label: "Photos", icon: <Camera className="w-4 h-4" /> },
    {
      tab: "documents",
      label: "Documents",
      sub: "Submittals, Warranty, Closeout, Plans",
      icon: <FolderOpen className="w-4 h-4" />,
    },
    { tab: "panels", label: "Panel Schedules", icon: <LayoutGrid className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="closeout-reminder-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 id="closeout-reminder-title" className="font-bold text-[#1e3a8a]">
            Closeout items for this invoice?
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -mr-1 text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Do you need to send any of these with the invoice?
        </p>

        {onGoToTab && (
          <div className="space-y-2 mb-4">
            {options.map((o) => (
              <button
                key={o.tab}
                type="button"
                onClick={() => go(o.tab)}
                className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-[#1e3a8a]/40 hover:bg-blue-50 transition-colors"
              >
                <span className="text-[#1e3a8a] shrink-0">{o.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{o.label}</span>
                  {o.sub && <span className="block text-xs text-gray-400">{o.sub}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Not this time
        </button>
      </div>
    </div>
  );
}
