"use client";

import { useState } from "react";
import {
  Info,
  Clock,
  Package,
  Camera,
  ClipboardList,
  Calendar,
  BarChart3,
  ClipboardCheck,
  HelpCircle,
  FolderOpen,
  ShoppingCart,
  Receipt,
  FileText,
  LayoutGrid,
} from "lucide-react";
import { JobInfoTab } from "./tabs/job-info-tab";
import { LaborTab } from "./tabs/labor-tab";
import { MaterialsTab } from "./tabs/materials-tab";
import { PhotosTab } from "./tabs/photos-tab";
import { SummaryTab } from "./tabs/summary-tab";
import { NotesTasksTab } from "./tabs/notes-tasks-tab";
import { CalendarTab } from "./tabs/calendar-tab";
import { InspectionsTab } from "./tabs/inspections-tab";
import { RfiTab } from "./tabs/rfi-tab";
import { DocumentsTab } from "./tabs/documents-tab";
import { CribTab } from "./tabs/crib-tab";
import { ReceiptsTab } from "./tabs/receipts-tab";
import { ReportsTab } from "./tabs/reports-tab";
import { PanelsTab } from "./tabs/panels-tab";
import type { Role } from "@/app/generated/prisma/client";

type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  hideFromTeammate?: boolean;
};

const TABS: Tab[] = [
  { id: "info", label: "Info", icon: <Info className="w-4 h-4" /> },
  { id: "labor", label: "Labor", icon: <Clock className="w-4 h-4" /> },
  { id: "invoices", label: "Purchase Orders", icon: <Package className="w-4 h-4" /> },
  { id: "crib", label: "The Crib", icon: <ShoppingCart className="w-4 h-4" /> },
  { id: "receipts", label: "Receipts", icon: <Receipt className="w-4 h-4" /> },
  { id: "photos", label: "Photos", icon: <Camera className="w-4 h-4" /> },
  {
    id: "notes-tasks",
    label: "Notes & Tasks",
    icon: <ClipboardList className="w-4 h-4" />,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    id: "inspections",
    label: "Inspections",
    icon: <ClipboardCheck className="w-4 h-4" />,
  },
  {
    id: "rfi",
    label: "RFI",
    icon: <HelpCircle className="w-4 h-4" />,
  },
  {
    id: "reports",
    label: "Reports",
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: "panels",
    label: "Panels",
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    id: "documents",
    label: "Documents",
    icon: <FolderOpen className="w-4 h-4" />,
  },
  {
    id: "summary",
    label: "Summary",
    icon: <BarChart3 className="w-4 h-4" />,
    hideFromTeammate: true,
  },
];

interface JobTabsProps {
  job: any;
  role: Role;
  currentUserId: string;
  currentUserName: string;
  fieldUsers: { id: string; name: string | null; role: Role }[];
  savedTasks: { id: string; title: string; description: string | null; sortOrder: number }[];
  allCalendarEvents?: any[];
  canViewSummary?: boolean;
  canAddInspections?: boolean;
  orderingPermissions?: { scope: string; jobId: string | null }[];
  companyRates?: { defaultBurden: number; bidRates: Record<string, number> } | null;
  overheadAllocation?: number;
}

export function JobTabs({
  job,
  role,
  currentUserId,
  currentUserName,
  fieldUsers,
  savedTasks,
  allCalendarEvents = [],
  canViewSummary = false,
  canAddInspections = false,
  orderingPermissions = [],
  companyRates = null,
  overheadAllocation = 0,
}: JobTabsProps) {
  const [activeTab, setActiveTab] = useState("info");

  const isEstimate = job.jobType === "ESTIMATE";

  const visibleTabs = TABS.filter((t) => {
    if (t.hideFromTeammate) {
      if (role === "TEAMMATE") return false;
      if (role === "FOREMAN" && !canViewSummary) return false;
      // Estimate financial data is admin-only (the tab renders a gate for non-admins,
      // but hide the tab entirely for non-admins on estimates)
      if (isEstimate && role !== "ADMIN") return false;
    }
    return true;
  });

  return (
    <div>
      {/* Tab bar — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 mb-0">
        <div className="flex gap-1 min-w-max border-b border-gray-200 pb-0">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 -mb-px ${
                  isActive
                    ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                    : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-b-xl rounded-tr-xl border border-t-0 border-gray-200 shadow-sm">
        {activeTab === "info" && (
          <JobInfoTab job={job} role={role} fieldUsers={fieldUsers} />
        )}
        {activeTab === "labor" && (
          <LaborTab
            job={job}
            role={role}
            fieldUsers={fieldUsers}
            currentUserId={currentUserId}
          />
        )}
        {activeTab === "invoices" && (
          <MaterialsTab job={job} role={role} />
        )}
        {activeTab === "crib" && (
          <CribTab job={job} role={role} currentUserId={currentUserId} />
        )}
        {activeTab === "receipts" && (
          <ReceiptsTab jobId={job.id} userId={currentUserId} userRole={role} />
        )}
        {activeTab === "photos" && (
          <PhotosTab job={job} role={role} />
        )}
        {activeTab === "notes-tasks" && (
          <NotesTasksTab
            job={job}
            role={role}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            fieldUsers={fieldUsers}
            savedTasks={savedTasks}
          />
        )}
        {activeTab === "calendar" && (
          <CalendarTab
            job={job}
            role={role}
            currentUserId={currentUserId}
            allCalendarEvents={allCalendarEvents}
          />
        )}
        {activeTab === "inspections" && (
          <InspectionsTab job={job} role={role} canAddInspections={canAddInspections} />
        )}
        {activeTab === "rfi" && (
          <RfiTab
            job={job}
            role={role}
            currentUserName={currentUserName}
          />
        )}
        {activeTab === "reports" && (
          <ReportsTab job={job} reports={job.reports ?? []} role={role} />
        )}
        {activeTab === "panels" && (
          <PanelsTab job={job} panels={job.panelSchedules ?? []} role={role} />
        )}
        {activeTab === "documents" && (
          <DocumentsTab job={job} role={role} />
        )}
        {activeTab === "summary" && (
          <SummaryTab job={job} role={role} companyRates={companyRates} overheadAllocation={overheadAllocation} />
        )}
      </div>
    </div>
  );
}
