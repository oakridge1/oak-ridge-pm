"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors"
    >
      Download PDF
    </button>
  );
}
