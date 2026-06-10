"use client";

import { useState, useTransition, useCallback } from "react";
import { Camera, Plus, Trash2, X, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { addPhotos, deletePhoto } from "./photos-tab-actions";
import { useUpload } from "@/lib/use-upload";
import type { Role } from "@/app/generated/prisma/client";

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  createdAt: Date;
  user: { name: string | null };
};

interface PhotosTabProps {
  job: { id: string; photos: Photo[] };
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

  const photos = job.photos.map((p) => ({ ...p, createdAt: new Date(p.createdAt) }));

  function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    startTransition(() => deletePhoto(id, job.id));
    setConfirmDelete(null);
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

      {/* Photo count */}
      {photos.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
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
                onClick={() => setLightboxIdx(idx)}
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

              {/* Uploader + date on hover */}
              <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {photo.user.name ?? "?"}
                </span>
              </div>

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
