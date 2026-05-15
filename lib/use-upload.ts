"use client";

type Endpoint = "jobPhoto" | "materialAttachment" | "jobDocument";

export function useUpload(_endpoint: Endpoint) {
  async function startUpload(
    files: File[]
  ): Promise<{ ufsUrl: string; name: string }[]> {
    const results: { ufsUrl: string; name: string }[] = [];

    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("endpoint", _endpoint);

      const res = await fetch("/api/upload", { method: "POST", body: fd });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "Upload failed");
      }

      const data: { url: string } = await res.json();
      results.push({ ufsUrl: data.url, name: file.name });
    }

    return results;
  }

  return { startUpload };
}
