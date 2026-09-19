import React, { useState } from "react";
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
  onPaySettlement?: (settlementId: string, paymentMethod: SettlementPaymentMethod, paymentReference: string, notes: string) => Promise<void> | void;
}

function money(value: number) {
  return Number(value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function shiftDate(base: string, days: number) {
  const date = new Date(base + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

type SettlementPaymentMethod = "transferencia" | "efectivo" | "deposito" | "otro";

const settlementPaymentMethodLabels: Record<SettlementPaymentMethod, string> = {
  transferencia: "Transferencia bancaria",
  efectivo: "Efectivo",
  deposito: "Depósito bancario",
  otro: "Otro",
};

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
  const [paymentSettlement, setPaymentSettlement] = useState<ProducerSettlement | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<SettlementPaymentMethod>("transferencia");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  function openPaymentDialog(settlement: ProducerSettlement) {
    setPaymentSettlement(settlement);
    setPaymentMethod("transferencia");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentError("");
  }

  function closePaymentDialog() {
    if (savingPayment) return;
    setPaymentSettlement(null);
    setPaymentError("");
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentSettlement || !onPaySettlement) return;
    const reference = paymentReference.trim();
    if (!reference) {
      setPaymentError("La referencia, folio o comprobante es obligatoria para registrar el pago.");
      return;
    }

    setSavingPayment(true);
    setPaymentError("");
    try {
      await onPaySettlement(paymentSettlement.id, paymentMethod, reference, paymentNotes.trim());
      setPaymentSettlement(null);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "No se pudo registrar el pago.");
    } finally {
      setSavingPayment(false);
    }
  }

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

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => {
          const today = new Date().toISOString().slice(0, 10);
          setPeriod({ from: shiftDate(today, -6), to: today });
        }} className="rounded-full border border-[#E6E2DA] bg-white px-3 py-1 text-[9px] font-bold uppercase text-[#6B665F] hover:bg-[#FAF8F5]">Semana</button>
        <button type="button" onClick={() => {
          const today = new Date().toISOString().slice(0, 10);
          setPeriod({ from: shiftDate(today, -14), to: today });
        }} className="rounded-full border border-[#E6E2DA] bg-white px-3 py-1 text-[9px] font-bold uppercase text-[#6B665F] hover:bg-[#FAF8F5]">Quincena</button>
        <button type="button" onClick={() => {
          const now = new Date();
          const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          const to = now.toISOString().slice(0, 10);
          setPeriod({ from, to });
        }} className="rounded-full border border-[#E6E2DA] bg-white px-3 py-1 text-[9px] font-bold uppercase text-[#6B665F] hover:bg-[#FAF8F5]">Mes</button>
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
                      {item.status === "pending" && <button type="button" onClick={() => openPaymentDialog(item)}
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
      {paymentSettlement && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="settlement-payment-title">
          <form onSubmit={submitPayment} className="w-full max-w-lg rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="settlement-payment-title" className="font-serif text-base font-bold text-[#2D2D2A]">Registrar pago de liquidación</h3>
                <p className="mt-1 text-[11px] text-[#6B665F]">
                  {paymentSettlement.period_start} → {paymentSettlement.period_end} · {money(paymentSettlement.amount)}
                </p>
              </div>
              <button type="button" onClick={closePaymentDialog} disabled={savingPayment} className="rounded-lg border border-[#E6E2DA] px-2.5 py-1 text-xs font-bold text-[#6B665F] hover:bg-[#FAF8F5] disabled:opacity-40">Cerrar</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B665F]">
                Forma de pago
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as SettlementPaymentMethod)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E6E2DA] bg-[#FAF8F5] px-3 text-xs text-[#2D2D2A] outline-none focus:border-[#C2845D]"
                  required
                >
                  {Object.entries(settlementPaymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B665F]">
                Referencia / folio / comprobante
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E6E2DA] bg-[#FAF8F5] px-3 text-xs text-[#2D2D2A] outline-none focus:border-[#C2845D]"
                  placeholder="Ej. TRANSF-56666"
                  required
                />
              </label>

              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B665F] sm:col-span-2">
                Notas del pago (opcional)
                <textarea
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs text-[#2D2D2A] outline-none focus:border-[#C2845D]"
                  placeholder="Observaciones, folio interno o datos adicionales."
                />
              </label>
            </div>

            {paymentError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] font-semibold text-[#A44A3F]">{paymentError}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closePaymentDialog} disabled={savingPayment} className="rounded-lg border border-[#E6E2DA] bg-white px-4 py-2 text-[10px] font-bold uppercase text-[#6B665F] hover:bg-[#FAF8F5] disabled:opacity-40">Cancelar</button>
              <button type="submit" disabled={savingPayment || !paymentReference.trim()} className="rounded-lg bg-[#2D2D2A] px-4 py-2 text-[10px] font-bold uppercase text-white hover:bg-[#5A6A42] disabled:cursor-not-allowed disabled:opacity-40">
                {savingPayment ? "Registrando..." : "Confirmar pago"}
              </button>
            </div>
          </form>
        </div>
      )}

    </section>
  );
}
