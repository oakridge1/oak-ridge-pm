"use client";

import { useState, useTransition } from "react";
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

function catLabel(cat: DocumentCategory) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

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
  name: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  createdAt: Date;
  uploadedBy: { name: string | null };
};

interface DocumentsTabProps {
  job: { id: string; documents: Document[] };
  role: Role;
}

function UploadForm({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const { startUpload } = useUpload("jobDocument");
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { setError("Please select a file."); return; }

    const fd = new FormData(e.currentTarget);
    const category = fd.get("category") as DocumentCategory;
    const name = (fd.get("name") as string).trim();
    if (!name) { setError("Document name is required."); return; }

    setError(null);
    setUploading(true);

    try {
      const results = await startUpload([selectedFile]);
      const uploaded = results[0];

      startTransition(async () => {
        try {
          await createDocument(jobId, {
            category,
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
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
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
}: {
  doc: Document;
  role: Role;
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
  const [showForm, setShowForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | "ALL">("ALL");

  const filteredDocs =
    activeCategory === "ALL"
      ? job.documents
      : job.documents.filter((d) => d.category === activeCategory);

  // Only show category tabs that have documents (plus ALL)
  const usedCategories = Array.from(new Set(job.documents.map((d) => d.category)));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-[#002D72]" />
          <h2 className="font-semibold text-[#002D72]">Document Vault</h2>
          <span className="text-xs text-gray-400">({job.documents.length})</span>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 hover:border-[#002D72] px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Upload
          </button>
        )}
      </div>

      {showForm && (
        <UploadForm jobId={job.id} onClose={() => setShowForm(false)} />
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
          {usedCategories.map((cat) => {
            const count = job.documents.filter((d) => d.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-[#002D72] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {catLabel(cat)} ({count})
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
            <DocumentRow key={doc.id} doc={doc} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}
