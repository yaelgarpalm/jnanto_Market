import React from "react";
import { Download, FileText } from "lucide-react";

interface ReportCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  onDownload: () => void;
}

export default function ReportCard({ title, description, buttonLabel, onDownload }: ReportCardProps) {
  return (
    <section className="rounded-2xl border border-[#E6E2DA] bg-white p-4 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] text-[#5A6A42]">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif text-sm font-bold text-[#2D2D2A]">{title}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-[#6B665F]">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#2D2D2A] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-[#5A6A42]"
        >
          <Download className="h-3.5 w-3.5" />
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}
