import React from "react";
import { CircleDollarSign, CheckCircle2, CalendarRange, Banknote } from "lucide-react";
import { CooperativeSettlementProducerSummary, ProducerSettlement, ProducerSettlementSummary } from "../types";

interface SettlementPanelProps {
  mode: "producer" | "cooperative";
  period: { from: string; to: string };
  setPeriod: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>;
  producerSummary?: ProducerSettlementSummary | null;
  cooperativeSummary?: {
    period_start: string;
    period_end: string;
    producers: CooperativeSettlementProducerSummary[];
    settlements: ProducerSettlement[];
  } | null;
  onReload: () => void;
  onCreateSettlement?: (producerId: string) => void;
  onPaySettlement?: (settlementId: string) => void;
}

function money(value: number) {
  return Number(value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function statusLabel(status: ProducerSettlement["status"]) {
  if (status === "paid") return "Pagada";
  if (status === "cancelled") return "Cancelada";
  return "Pendiente";
}

export default function SettlementPanel({
  mode,
  period,
  setPeriod,
  producerSummary,
  cooperativeSummary,
  onReload,
  onCreateSettlement,
  onPaySettlement,
}: SettlementPanelProps) {
  return (
    <section className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-[#5A6A42]" />
            <h2 className="font-serif text-base font-bold text-[#2D2D2A]">
              {mode === "producer" ? "Mis liquidaciones" : "Liquidaciones a productores"}
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-[#6B665F]">
            {mode === "producer"
              ? "Consulta cuánto has generado y cuánto sigue pendiente de entrega."
              : "Genera cortes de pago y registra cuándo la cooperativa entrega el dinero."}
          </p>
        </div>
        <button
          type="button"
          onClick={onReload}
          className="rounded-lg border border-[#E6E2DA] bg-white px-3 py-1.5 text-[10px] font-bold uppercase text-[#6B665F] hover:bg-[#FAF8F5]"
        >
          Actualizar
        </button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B665F]">
          Desde
          <input type="date" value={period.from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            className="mt-1 h-9 w-full rounded-lg border border-[#E6E2DA] bg-[#FAF8F5] px-2 text-xs text-[#2D2D2A]" />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B665F]">
          Hasta
          <input type="date" value={period.to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            className="mt-1 h-9 w-full rounded-lg border border-[#E6E2DA] bg-[#FAF8F5] px-2 text-xs text-[#2D2D2A]" />
        </label>
        <button type="button" onClick={onReload}
          className="h-9 rounded-lg bg-[#2D2D2A] px-4 text-[10px] font-bold uppercase text-white hover:bg-[#5A6A42]">
          Consultar
        </button>
      </div>

      {mode === "producer" && producerSummary && (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3"><p className="text-[9px] font-bold uppercase text-[#8A847C]">Ventas</p><p className="mt-1 text-lg font-black text-[#2D2D2A]">{money(producerSummary.gross_sales)}</p></div>
            <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3"><p className="text-[9px] font-bold uppercase text-[#8A847C]">Por liquidar</p><p className="mt-1 text-lg font-black text-[#A44A3F]">{money(producerSummary.pending_amount)}</p></div>
            <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3"><p className="text-[9px] font-bold uppercase text-[#8A847C]">Pagado</p><p className="mt-1 text-lg font-black text-[#5A6A42]">{money(producerSummary.paid_amount)}</p></div>
            <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3"><p className="text-[9px] font-bold uppercase text-[#8A847C]">Ventas incluidas</p><p className="mt-1 text-lg font-black text-[#2D2D2A]">{producerSummary.sale_count}</p></div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#2D2D2A]"><CalendarRange className="h-4 w-4 text-[#C2845D]" />Cortes registrados</div>
            {producerSummary.settlements.length === 0 ? (
              <p className="rounded-xl bg-[#FAF8F5] p-3 text-[11px] text-[#6B665F]">Aún no existe una liquidación para este periodo.</p>
            ) : (
              <div className="space-y-2">
                {producerSummary.settlements.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E2DA] p-3">
                    <div>
                      <p className="text-xs font-bold text-[#2D2D2A]">{item.period_start} → {item.period_end}</p>
                      <p className="text-[10px] text-[#6B665F]">{statusLabel(item.status)}{item.payment_method ? " · " + item.payment_method : ""}{item.payment_reference ? " · Ref. " + item.payment_reference : ""}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-[#5A6A42]">{money(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {mode === "cooperative" && cooperativeSummary && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2D2D2A]"><Banknote className="h-4 w-4 text-[#5A6A42]" />Cortes del periodo {cooperativeSummary.period_start} → {cooperativeSummary.period_end}</div>
          </div>
          {cooperativeSummary.producers.map((producer) => (
            <div key={producer.producer_id} className="rounded-xl border border-[#E6E2DA] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#2D2D2A]">{producer.producer_name}</p>
                  <p className="text-[10px] text-[#6B665F]">{producer.sale_count} venta(s) · {producer.eligible_item_count} pieza(s) · Por liquidar: {money(producer.eligible_amount)}</p>
                </div>
                <button type="button" disabled={!onCreateSettlement || producer.eligible_amount <= 0}
                  onClick={() => onCreateSettlement?.(producer.producer_id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#5A6A42] px-3 py-2 text-[10px] font-bold uppercase text-white hover:bg-[#2D2D2A] disabled:cursor-not-allowed disabled:opacity-40">
                  Crear corte
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <h3 className="mb-2 text-xs font-bold text-[#2D2D2A]">Liquidaciones registradas</h3>
            {cooperativeSummary.settlements.length === 0 ? (
              <p className="rounded-xl bg-[#FAF8F5] p-3 text-[11px] text-[#6B665F]">No hay cortes registrados.</p>
            ) : (
              <div className="space-y-2">
                {cooperativeSummary.settlements.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3">
                    <div><p className="text-xs font-bold text-[#2D2D2A]">{item.period_start} → {item.period_end}</p><p className="text-[10px] text-[#6B665F]">{statusLabel(item.status)}</p></div>
                    <div className="flex items-center gap-2"><span className="font-mono text-sm font-bold text-[#5A6A42]">{money(item.amount)}</span>
                      {item.status === "pending" && <button type="button" onClick={() => onPaySettlement?.(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#2D2D2A] px-3 py-2 text-[10px] font-bold uppercase text-white hover:bg-[#5A6A42]">
                        <CheckCircle2 className="h-3 w-3" />Registrar pago
                      </button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
