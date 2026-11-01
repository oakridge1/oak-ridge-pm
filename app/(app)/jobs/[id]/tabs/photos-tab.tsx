"use client";

import { useState, useTransition, useCallback } from "react";
import { Camera, Plus, Trash2, X, Upload, ChevronLeft, ChevronRight, Download, Check } from "lucide-react";
import { addPhotos, deletePhoto } from "./photos-tab-actions";
import { useUpload } from "@/lib/use-upload";
import { buildPhotoZip } from "@/lib/photo-zip";
import type { Role } from "@/app/generated/prisma/client";

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  createdAt: Date;
  user: { name: string | null };
};

interface PhotosTabProps {
  job: { id: string; jobNumber: string; jobName: string; photos: Photo[] };
  role: Role;
}

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const photo = photos[idx];

  function prev() { setIdx((i) => (i - 1 + photos.length) % photos.length); }
  function next() { setIdx((i) => (i + 1) % photos.length); }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
        <X className="w-6 h-6" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 text-white/70 hover:text-white p-2"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-12 text-white/70 hover:text-white p-2"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div className="max-w-5xl max-h-[90vh] flex flex-col items-center px-16" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.caption ?? "Photo"}
          className="max-h-[80vh] max-w-full object-contain rounded-lg"
        />
        <div className="mt-3 text-center">
          {photo.caption && <p className="text-white text-sm">{photo.caption}</p>}
          <p className="text-white/50 text-xs mt-1">
            {photo.user.name ?? "Unknown"} ·{" "}
            {new Date(photo.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <p className="text-white/30 text-xs mt-2">{idx + 1} / {photos.length}</p>
      </div>
    </div>
  );
}

function UploadForm({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previews, setPreviews] = useState<string[]>([]);

  const { startUpload } = useUpload("jobPhoto");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) { setError("Select at least one photo."); return; }
    setError(null);
    setUploading(true);

    let uploaded: { url: string }[] = [];
    try {
      const res = await startUpload(files);
      if (!res?.length) throw new Error("Upload returned no results.");
      uploaded = res.map((r) => ({ url: r.ufsUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — check the browser console for details.");
      setUploading(false);
      return;
    }
    setUploading(false);

    startTransition(async () => {
      try {
        await addPhotos(jobId, uploaded.map((u) => ({ url: u.url, caption })));
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save photos.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#1e3a8a]" />
          Upload Photos
        </h3>
        <button type="button" onClick={onDone} className="p-1 text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{error}</p>}

      {/* Drop zone */}
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-[#1e3a8a] hover:bg-blue-50/30 transition-colors">
        <Upload className="w-8 h-8 text-gray-300" />
        <div className="text-center">
          <span className="text-sm font-medium text-[#1e3a8a]">Choose photos</span>
          <span className="text-sm text-gray-500"> or drag and drop</span>
        </div>
        <span className="text-xs text-gray-400">{files.length > 0 ? `${files.length} file(s) selected` : "JPG, PNG, HEIC up to 16MB each"}</span>
        <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFileChange} />
      </label>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((p, i) => (
            <img key={i} src={p} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Caption (optional)</label>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Describe what's in these photos…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button type="submit" disabled={pending || uploading || !files.length}
          className="bg-[#1e3a8a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors">
          {uploading ? "Uploading…" : pending ? "Saving…" : `Upload ${files.length || ""} Photo${files.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}

export function PhotosTab({ job, role }: PhotosTabProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zipping, setZipping] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  const photos = job.photos.map((p) => ({ ...p, createdAt: new Date(p.createdAt) }));

  function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    startTransition(() => deletePhoto(id, job.id));
    setConfirmDelete(null);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Count only photos that still exist (a deleted photo can't stay selected).
  const selectedCount = photos.filter((p) => selected.has(p.id)).length;

  async function handleDownload(which: "all" | "selected") {
    const list = which === "all" ? photos : photos.filter((p) => selected.has(p.id));
    if (!list.length || zipping) return;
    setZipping(true);
    setZipError(null);
    setZipStatus(`Preparing 0 of ${list.length}…`);
    try {
      const result = await buildPhotoZip({
        photos: list,
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        onProgress: (done, total) => setZipStatus(`Preparing ${done} of ${total}…`),
      });
      if (result.failed >= result.total) {
        setZipError("None of the photos could be downloaded. Please try again.");
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (result.failed > 0) {
        setZipError(
          `${result.failed} of ${result.total} photo${result.total !== 1 ? "s" : ""} could not be downloaded and ${result.failed !== 1 ? "were" : "was"} left out. The rest are in the ZIP (the notes file lists what is missing).`,
        );
      }
    } catch (err) {
      console.error(err);
      setZipError("Could not build the ZIP. Please try again.");
    } finally {
      setZipping(false);
      setZipStatus(null);
    }
  }

  return (
    <div className="p-5">
      {lightboxIdx !== null && (
        <Lightbox photos={photos} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      {/* Upload form */}
      {showUpload ? (
        <UploadForm jobId={job.id} onDone={() => setShowUpload(false)} />
      ) : (
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 text-sm text-[#1e3a8a] hover:text-[#003d99] font-medium transition-colors mb-6"
        >
          <Plus className="w-4 h-4" />
          Upload Photos
        </button>
      )}

      {/* Photo count + download / select controls */}
      {photos.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-400 mr-auto">
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
              {selectMode && ` · ${selectedCount} selected`}
            </p>
            {selectMode && (
              <>
                <button
                  onClick={() => setSelected(new Set(photos.map((p) => p.id)))}
                  className="text-xs text-[#1e3a8a] hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Clear
                </button>
              </>
            )}
            <button
              onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }}
              className="text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
            >
              {selectMode ? "Done" : "Select"}
            </button>
            <button
              onClick={() => handleDownload("selected")}
              disabled={zipping || selectedCount === 0}
              className="flex items-center gap-1.5 text-xs font-medium border border-[#1e3a8a]/30 rounded-lg px-2.5 py-1.5 text-[#1e3a8a] hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> Download Selected ({selectedCount})
            </button>
            <button
              onClick={() => handleDownload("all")}
              disabled={zipping}
              className="flex items-center gap-1.5 text-xs font-medium bg-[#1e3a8a] text-white rounded-lg px-2.5 py-1.5 hover:bg-[#003d99] disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" /> Download All
            </button>
          </div>
          {zipStatus && <p className="text-xs text-gray-500">{zipStatus}</p>}
          {zipError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{zipError}</p>
          )}
        </div>
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No photos yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="relative group">
              <button
                className="w-full aspect-square overflow-hidden rounded-xl border border-gray-200 shadow-sm block"
                onClick={() => (selectMode ? toggleSelected(photo.id) : setLightboxIdx(idx))}
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? "Job photo"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </button>

              {/* Caption overlay */}
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl px-2 py-1.5 pointer-events-none">
                  <p className="text-white text-[10px] truncate">{photo.caption}</p>
                </div>
              )}

              {/* Select-mode checkbox (clicking the tile toggles it) */}
              {selectMode && (
                <div
                  className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-md border-2 flex items-center justify-center pointer-events-none ${
                    selected.has(photo.id)
                      ? "bg-[#1e3a8a] border-[#1e3a8a] text-white"
                      : "bg-white/80 border-gray-400"
                  }`}
                  aria-hidden
                >
                  {selected.has(photo.id) && <Check className="w-4 h-4" />}
                </div>
              )}

              {/* Uploader + date on hover */}
              {!selectMode && (
                <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {photo.user.name ?? "?"}
                  </span>
                </div>
              )}

              {/* Delete button — ADMIN only */}
              {role === "ADMIN" && (
                <button
                  onClick={() => handleDelete(photo.id)}
                  onBlur={() => setConfirmDelete(null)}
                  className={`absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-xs font-medium ${
                    confirmDelete === photo.id
                      ? "bg-red-600 text-white px-2"
                      : "bg-black/50 text-white hover:bg-red-600"
                  }`}
                >
                  {confirmDelete === photo.id ? "Delete?" : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
