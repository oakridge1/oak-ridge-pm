export function PrintButton({ href, fileName }: { href: string; fileName: string }) {
  return (
    <a
      href={href}
      download={fileName}
      className="bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors"
    >
      Download PDF
    </a>
  );
}
