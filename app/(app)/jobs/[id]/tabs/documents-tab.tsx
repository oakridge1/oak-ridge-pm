"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  X,
  FileText,
} from "lucide-react";
import { createDocument, deleteDocument } from "./documents-tab-actions";
import { useUpload } from "@/lib/use-upload";
import type { Role, DocumentCategory } from "@/app/generated/prisma/client";

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "PLANS", label: "Plans" },
  { value: "SPECIFICATIONS", label: "Specs" },
  { value: "PERMITS", label: "Permits" },
  { value: "SUBMITTALS", label: "Submittals" },
  { value: "SUBCONTRACTS", label: "Subcontracts" },
  { value: "INSPECTION_REPORTS", label: "Inspection Reports" },
  { value: "CLOSEOUT", label: "Closeout" },
  { value: "MATERIAL_RECEIPTS", label: "Material Receipts" },
  { value: "OTHER", label: "Other" },
];

type CustomCategory = {
  id: string;
  name: string;
  slug: string;
  scope: string;
};

type AllCategory = {
  value: string;
  label: string;
  isCustom?: boolean;
};

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Document = {
  id: string;
  category: DocumentCategory;
  customCategory?: string | null;
  name: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  createdAt: Date;
  uploadedBy: { name: string | null };
};

interface DocumentsTabProps {
  job: { id: string; jobNumber: string; documents: Document[] };
  role: Role;
}

function UploadForm({
  jobId,
  customCategories,
  onCategoryAdded,
  onClose,
}: {
  jobId: string;
  customCategories: CustomCategory[];
  onCategoryAdded: (cat: CustomCategory) => void;
  onClose: () => void;
}) {
  const { startUpload } = useUpload("jobDocument");
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatScope, setNewCatScope] = useState<"job" | "permanent">("job");

  const allCategories: AllCategory[] = [
    ...CATEGORIES,
    ...customCategories.map((c) => ({
      value: c.slug,
      label: c.name,
      isCustom: true,
    })),
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { setError("Please select a file."); return; }

    const fd = new FormData(e.currentTarget);
    const rawCategory = fd.get("category") as string;
    const name = (fd.get("name") as string).trim();
    if (!name) { setError("Document name is required."); return; }

    // Determine if the selected category is a custom one
    const isCustomCat = customCategories.some((c) => c.slug === rawCategory);
    const category = (isCustomCat ? "OTHER" : rawCategory) as DocumentCategory;
    const customCategory = isCustomCat ? rawCategory : null;

    setError(null);
    setUploading(true);

    try {
      const results = await startUpload([selectedFile]);
      const uploaded = results[0];

      startTransition(async () => {
        try {
          await createDocument(jobId, {
            category,
            customCategory: customCategory ?? undefined,
            name,
            fileUrl: uploaded.ufsUrl,
            fileName: uploaded.name,
            fileSize: selectedFile.size,
          });
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save document.");
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const res = await fetch(`/api/jobs/${jobId}/documents/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), scope: newCatScope }),
    });
    if (res.ok) {
      const cat = await res.json();
      onCategoryAdded(cat);
      setNewCatName("");
      setShowAddCategory(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3"
    >
      <h3 className="font-semibold text-[#002D72] text-sm">Upload Document</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select
            name="category"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
          >
            {allCategories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAddCategory((v) => !v)}
            className="text-xs text-blue-500 hover:text-blue-700 mt-1"
          >
            + Add custom category
          </button>

          {showAddCategory && (
            <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 space-y-2">
              <input
                type="text"
                placeholder="Category name (e.g. Safety)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                {(["job", "permanent"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setNewCatScope(scope)}
                    className={`px-3 py-1 text-xs font-semibold rounded border transition-colors ${
                      newCatScope === scope
                        ? "bg-[#002D72] text-white border-[#002D72]"
                        : "bg-white text-gray-700 border-gray-300"
                    }`}
                  >
                    {scope === "job" ? "This Job Only" : "Permanent"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-3 py-1.5 text-sm font-semibold rounded bg-[#002D72] text-white hover:bg-[#003d99]"
                >
                  Save Category
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Document Name *</label>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Electrical Plans Rev 2"
            defaultValue={selectedFile?.name.replace(/\.[^.]+$/, "") ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">File *</label>
          {selectedFile ? (
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <FileText className="w-4 h-4 text-[#002D72] shrink-0" />
              <span className="text-sm text-gray-700 truncate flex-1">{selectedFile.name}</span>
              <span className="text-xs text-gray-400">{fmtSize(selectedFile.size)}</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-[#002D72]/50 transition-colors">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Choose file…</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || uploading}
          className="px-4 py-2 bg-[#002D72] text-white text-sm font-medium rounded-lg hover:bg-[#003d99] disabled:opacity-50"
        >
          {uploading ? "Uploading…" : isPending ? "Saving…" : "Upload"}
        </button>
      </div>
    </form>
  );
}

function DocumentRow({
  doc,
  role,
  onMove,
}: {
  doc: Document;
  role: Role;
  onMove: () => void;
}) {
  const [isDeleting, startDelete] = useTransition();

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <FileText className="w-5 h-5 text-[#002D72] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
        <p className="text-xs text-gray-400">
          {doc.uploadedBy.name ?? "Unknown"} · {fmt(doc.createdAt)}
          {doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onMove}
          className="text-xs text-gray-400 hover:text-blue-500 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          title="Move or copy to another category"
        >
          ⇄ Move
        </button>
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={doc.fileName}
          className="flex items-center gap-1 text-xs font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/20 hover:border-[#002D72]/50 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </a>
        {role === "ADMIN" && (
          <button
            onClick={() =>
              startDelete(async () => {
                if (!confirm("Delete this document?")) return;
                await deleteDocument(doc.id);
              })
            }
            disabled={isDeleting}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DocumentsTab({ job, role }: DocumentsTabProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingDocId, setMovingDocId] = useState<string | null>(null);
  const [zipDownloading, setZipDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${job.id}/documents/categories`)
      .then((r) => r.json())
      .then(setCustomCategories)
      .catch(console.error);
  }, [job.id]);

  const allCategories: AllCategory[] = [
    ...CATEGORIES,
    ...customCategories.map((c) => ({
      value: c.slug,
      label: c.name,
      isCustom: true,
    })),
  ];

  // Effective category key per doc: custom slug if set, otherwise enum value
  function docCatKey(doc: Document) {
    return doc.customCategory ?? doc.category;
  }

  function catLabelForKey(key: string) {
    const custom = customCategories.find((c) => c.slug === key);
    if (custom) return custom.name;
    return CATEGORIES.find((c) => c.value === key)?.label ?? key;
  }

  const filteredDocs =
    activeCategory === "ALL"
      ? job.documents
      : job.documents.filter((d) => docCatKey(d) === activeCategory);

  const usedCategoryKeys = Array.from(
    new Set(job.documents.map(docCatKey))
  );

  async function handleMove(
    documentId: string,
    cat: AllCategory,
    action: "move" | "copy"
  ) {
    await fetch(`/api/jobs/${job.id}/documents/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        toCategory: cat.isCustom ? "OTHER" : cat.value,
        toCustomCategory: cat.isCustom ? cat.value : undefined,
        action,
      }),
    });
    setShowMoveModal(false);
    router.refresh();
  }

  async function handleZipDownload() {
    setZipDownloading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/documents/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludeCategories: ["RECEIPTS", "MATERIAL_RECEIPTS", "STOCK_ORDERS"],
        }),
      });
      if (!res.ok) throw new Error("ZIP failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.jobNumber}_Documents.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to generate ZIP.");
    } finally {
      setZipDownloading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-[#002D72]" />
          <h2 className="font-semibold text-[#002D72]">Document Vault</h2>
          <span className="text-xs text-gray-400">({job.documents.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {job.documents.length > 0 && (
            <button
              onClick={handleZipDownload}
              disabled={zipDownloading}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {zipDownloading ? "⏳ Building…" : "⬇ ZIP"}
            </button>
          )}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 hover:border-[#002D72] px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Upload
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <UploadForm
          jobId={job.id}
          customCategories={customCategories}
          onCategoryAdded={(cat) => setCustomCategories((prev) => [...prev, cat])}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Category filter */}
      {job.documents.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === "ALL"
                ? "bg-[#002D72] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({job.documents.length})
          </button>
          {usedCategoryKeys.map((key) => {
            const count = job.documents.filter((d) => docCatKey(d) === key).length;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === key
                    ? "bg-[#002D72] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {catLabelForKey(key)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {filteredDocs.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 py-6 text-center">
          {job.documents.length === 0
            ? "No documents uploaded yet."
            : "No documents in this category."}
        </p>
      )}

      {filteredDocs.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {filteredDocs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              role={role}
              onMove={() => {
                setMovingDocId(doc.id);
                setShowMoveModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Move / Copy modal */}
      {showMoveModal && movingDocId && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowMoveModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-[#002D72] mb-4">Move or Copy Document</h3>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {allCategories.map((cat) => (
                <div key={cat.value} className="flex gap-2">
                  <button
                    onClick={() => handleMove(movingDocId, cat, "move")}
                    className="flex-1 text-left px-3 py-2 text-sm rounded hover:bg-blue-50 border border-gray-200"
                  >
                    Move to {cat.label}
                  </button>
                  <button
                    onClick={() => handleMove(movingDocId, cat, "copy")}
                    className="px-3 py-2 text-sm rounded hover:bg-green-50 border border-gray-200 text-gray-500"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowMoveModal(false)}
              className="w-full py-2 text-sm rounded border border-gray-300 text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
