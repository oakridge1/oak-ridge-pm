import { Construction } from "lucide-react";

interface PlaceholderTabProps {
  title: string;
  description: string;
}

export function PlaceholderTab({ title, description }: PlaceholderTabProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Construction className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-700 text-lg">{title}</h3>
      <p className="text-sm text-gray-400 mt-2 max-w-xs leading-relaxed">
        {description}
      </p>
      <div className="mt-6 px-4 py-2 bg-[#002D72]/10 text-[#002D72] text-xs font-medium rounded-full">
        Phase 2
      </div>
    </div>
  );
}
