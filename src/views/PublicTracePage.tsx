import React, { FormEvent, useState } from "react";
import { Award, CheckCircle2, MapPin, PackageCheck, RefreshCw, Star, Users } from "lucide-react";
import { BlockchainAnchor, Product, Profile, TraceabilityStage } from "../types";

interface PublicTracePageProps {
  traceCode: string;
  data: { product: Product; stages: TraceabilityStage[]; anchors: BlockchainAnchor[] } | null;
  message: string | null;
  profile: Profile | null;
  onBack: () => void;
  onConfirmReceipt: (productId: string, input: { producerRating: number; deliveryRating: number; comments: string }) => Promise<{ rewardPoints: number; alreadyConfirmed?: boolean; updatedReview?: boolean }>;
}

export default function PublicTracePage({ traceCode, data, message, profile, onBack, onConfirmReceipt }: PublicTracePageProps) {
  const [producerRating, setProducerRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [comments, setComments] = useState("");
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] p-4 text-xs">
        <div className="rounded-2xl border border-[#E6E2DA] bg-white p-6 text-center max-w-sm w-full shadow-xs">
          <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-[#5A6A42]" />
          <p className="text-[#2D2D2A] font-bold">Leyendo código de trazabilidad...</p>
          <p className="text-[10px] text-[#6B665F] mt-1 font-mono">{traceCode}</p>
          {message && <p className="text-red-800 bg-red-50 p-2.5 rounded-lg border border-red-200/50 mt-3">{message}</p>}
        </div>
      </div>
    );
  }

  const { product, stages, anchors } = data;
  const receivedStage = stages.find((stage) => stage.stage_key === "received");
  const receivedPayload = receivedStage?.payload || {};
  const rewardPoints = typeof receivedPayload.rewardPoints === "number" ? receivedPayload.rewardPoints : null;
  const canEditReceipt = Boolean(profile && (!receivedPayload.customerId || receivedPayload.customerId === profile.id));

  async function handleReceipt(event: FormEvent) {
    event.preventDefault();
    if (!profile) {
      setReceiptMessage("Inicia sesión con la cuenta que hizo la compra para confirmar recibido y reclamar recompensa.");
      return;
    }
    setSubmitting(true);
    setReceiptMessage(null);
    try {
      const result = await onConfirmReceipt(product.id, { producerRating, deliveryRating, comments });
      setReceiptMessage(
        result.updatedReview
          ? `Reseña actualizada. Recompensa registrada: ${result.rewardPoints} puntos.`
          : result.alreadyConfirmed
            ? `Esta pieza ya fue confirmada. Recompensa registrada: ${result.rewardPoints} puntos.`
          : `Recibido confirmado. Ganaste ${result.rewardPoints} puntos Jñatjo.`,
      );
    } catch (error) {
      setReceiptMessage(error instanceof Error ? error.message : "No se pudo confirmar recibido.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] p-4 font-sans text-xs text-[#2D2D2A]">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs space-y-6">
        <button
          onClick={onBack}
          className="rounded-xl border border-[#E6E2DA] bg-white px-3 py-1.5 font-bold text-[#6B665F] hover:bg-[#FAF8F5] hover:text-[#2D2D2A] transition-all cursor-pointer"
        >
          ← Volver a la Tienda
        </button>

        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <img src={product.image} alt={product.name} className="aspect-square w-full rounded-xl object-cover border border-[#E6E2DA]" />
          <div className="space-y-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#C2845D] font-mono bg-[#FAF8F5] border border-[#E6E2DA]/50 px-2 py-0.5 rounded-full">
              Código Único: {traceCode}
            </span>
            <h1 className="text-xl font-serif font-bold text-[#2D2D2A] mt-1.5">{product.name}</h1>
            <p className="text-[#6B665F] leading-relaxed text-xs">{product.description}</p>
            <div className="grid gap-2 grid-cols-2 pt-2 border-t border-[#E6E2DA]/50">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#C2845D]" />
                <div>
                  <span className="text-[8px] text-[#8A847C] uppercase block">Comunidad</span>
                  <span className="font-bold">{product.community}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#5A6A42]" />
                <div>
                  <span className="text-[8px] text-[#8A847C] uppercase block">Artesano</span>
                  <span className="font-bold">{product.producerName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-[#2D2D2A]" />
                <div>
                  <span className="text-[8px] text-[#8A847C] uppercase block">Cooperativa</span>
                  <span className="font-bold">{product.cooperativeName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#5A6A42]" />
                <div>
                  <span className="text-[8px] text-[#8A847C] uppercase block">Estatus</span>
                  <span className="font-bold text-[#5A6A42] uppercase">{product.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleReceipt} className="rounded-2xl border border-[#E6E2DA] bg-[#FAF8F5] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#5A6A42] border border-[#E6E2DA]">
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-base font-bold text-[#2D2D2A]">Confirmar recibido y reclamar recompensa</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#6B665F]">
                Si compraste esta pieza, confirma la entrega desde el QR físico. Tu calificación queda ligada a la trazabilidad.
              </p>
            </div>
          </div>

          {receivedStage && !canEditReceipt ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-[#5A6A42]">
              <p className="font-bold">Recibido confirmado.</p>
              <p className="mt-1">Recompensa registrada: {rewardPoints ?? "varios"} puntos Jñatjo.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {receivedStage && (
                <p className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-[#5A6A42]">
                  Ya confirmaste recibido. Puedes actualizar tu calificación de productor y entrega.
                </p>
              )}
              <RatingField label="Productor" value={producerRating} onChange={setProducerRating} />
              <RatingField label="Entrega" value={deliveryRating} onChange={setDeliveryRating} />
              <label className="sm:col-span-2 block text-[10px] font-bold uppercase tracking-widest text-[#6B665F]">
                Comentario opcional
                <textarea
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-white p-3 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#C2845D]"
                  placeholder="Cuéntanos cómo llegó la pieza y cómo fue tu experiencia..."
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="sm:col-span-2 rounded-xl bg-[#2D2D2A] px-4 py-2.5 text-xs font-bold uppercase text-white transition-colors hover:bg-[#5A6A42] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? "Guardando..." : receivedStage ? "Actualizar reseña" : "Confirmar recibido"}
              </button>
            </div>
          )}

          {receiptMessage && (
            <p className="mt-3 rounded-xl border border-[#E6E2DA] bg-white p-3 text-xs text-[#6B665F]">
              {receiptMessage}
            </p>
          )}
        </form>

        {/* Timeline */}
        <div className="pt-4 border-t border-[#E6E2DA]">
          <h3 className="font-serif font-bold text-[#2D2D2A] text-sm mb-4">Línea de Tiempo Social del Producto</h3>
          <div className="space-y-4 border-l border-[#E6E2DA] ml-3 pl-5">
            {stages.map((stage) => (
              <div key={stage.id} className="relative group">
                <span className="absolute -left-[27px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#5A6A42] bg-white group-hover:scale-125 transition-transform" />
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-[#2D2D2A]">{stage.stage_label}</h4>
                  <span className="text-[9px] text-[#8A847C] font-mono bg-[#FAF8F5] border border-[#E6E2DA]/50 px-2 py-0.5 rounded-md">
                    {stage.date}
                  </span>
                </div>
                <p className="text-xs text-[#6B665F] mt-1 leading-relaxed">{stage.description}</p>
                {stage.stage_key === "received" && (
                  <div className="mt-2 rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-2 text-[10px] text-[#6B665F]">
                    <span className="font-bold text-[#C2845D]">Productor: {String(stage.payload?.producerRating || "-")}★</span>
                    {" · "}
                    <span className="font-bold text-[#C2845D]">Entrega: {String(stage.payload?.deliveryRating || "-")}★</span>
                    {stage.payload?.comments ? (
                      <p className="mt-1 italic">"{String(stage.payload.comments)}"</p>
                    ) : null}
                  </div>
                )}
                <p className="text-[9px] text-[#8A847C] mt-1 font-mono uppercase">
                  Responsable: {stage.responsible}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Ledger Evidence */}
        <div className="rounded-xl bg-[#FAF8F5] border border-[#E6E2DA] p-3 text-[10px] space-y-1.5">
          <p className="font-serif font-bold text-[#2D2D2A] border-b border-[#E6E2DA] pb-1">Evidencia Blockchain Amoy</p>
          {anchors.length === 0 ? (
            <p className="text-[#8A847C] italic">Sin anclajes en bloque registrados todavía.</p>
          ) : (
            anchors.map((a) => (
              <div key={a.id} className="text-[#6B665F] break-all leading-tight">
                <span className="font-bold text-[#5A6A42] block uppercase">{a.status}</span>
                <span className="font-mono text-[9px] block text-[#8A847C]">{a.tx_hash || a.anchor_hash}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RatingField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#6B665F]">{label}</p>
      <div className="flex gap-1 rounded-xl border border-[#E6E2DA] bg-white p-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className="rounded-lg p-1 text-[#C2845D] hover:bg-[#FFF7ED] cursor-pointer"
            title={`${score} estrellas`}
          >
            <Star className={`h-5 w-5 ${score <= value ? "fill-[#C2845D]" : ""}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
