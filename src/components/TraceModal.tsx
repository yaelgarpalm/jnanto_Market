import React from "react";
import { Fingerprint, Images, Lock, PackageCheck, QrCode, ShieldCheck, Tag, Users, Wallet } from "lucide-react";
import { BlockchainAnchor, Product, TraceabilityStage } from "../types";

interface TraceModalProps {
  product: Product;
  stages: TraceabilityStage[];
  anchors: BlockchainAnchor[];
  qrDataUrl: string | null;
  onClose: () => void;
  onNfc: () => void;
  onAnchor: () => void;
  canManageTraceability: boolean;
}

export default function TraceModal({
  product,
  stages,
  anchors,
  qrDataUrl,
  onClose,
  onNfc,
  onAnchor,
  canManageTraceability,
}: TraceModalProps) {
  const producerPay = product.breakdown.materialsCost + product.breakdown.laborCost;
  const gallery = product.images?.length ? product.images : product.image ? [product.image] : [];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 backdrop-blur-xs p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl border border-[#E6E2DA] max-h-[90vh] overflow-y-auto flex flex-col justify-between">
        <div>
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#E6E2DA] pb-4">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#C2845D] font-mono bg-[#FAF8F5] border border-[#E6E2DA] px-2.5 py-0.5 rounded-full">
                CÓDIGO: {product.traceCode}
              </span>
              <h2 className="text-xl font-serif font-bold text-[#2D2D2A] mt-2">{product.name}</h2>
              <p className="text-xs text-[#6B665F]">
                Elaborado por <span className="font-bold text-[#2D2D2A]">{product.producerName}</span> en la comunidad de {product.community}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-[#E6E2DA] bg-white px-3 py-1.5 text-xs font-bold text-[#6B665F] hover:bg-[#FAF8F5] hover:text-[#2D2D2A] transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {/* Left Column: Metrics & Timeline */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#E6E2DA] bg-[#FAF8F5] p-3">
                <div className="mb-3 flex items-center gap-2 text-[#2D2D2A]">
                  <Images className="h-4 w-4 text-[#5A6A42]" />
                  <h3 className="font-serif text-sm font-bold">Detalles del producto</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                  <div className="overflow-hidden rounded-xl border border-[#E6E2DA] bg-white">
                    {gallery[0] ? (
                      <img src={gallery[0]} alt={product.name} className="h-52 w-full object-cover" />
                    ) : (
                      <div className="flex h-52 items-center justify-center text-xs font-semibold text-[#8A847C]">
                        Sin imagen
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-[#6B665F]">{product.description || "Sin descripción registrada."}</p>
                    <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                      <div className="rounded-xl border border-[#E6E2DA] bg-white p-2">
                        <span className="flex items-center gap-1 font-bold uppercase text-[#8A847C]">
                          <Tag className="h-3 w-3" />
                          Categoría
                        </span>
                        <p className="mt-1 font-bold text-[#2D2D2A]">{product.category}</p>
                      </div>
                      <div className="rounded-xl border border-[#E6E2DA] bg-white p-2">
                        <span className="flex items-center gap-1 font-bold uppercase text-[#8A847C]">
                          <PackageCheck className="h-3 w-3" />
                          Existencias
                        </span>
                        <p className="mt-1 font-bold text-[#2D2D2A]">{product.stock}</p>
                      </div>
                      <div className="rounded-xl border border-[#E6E2DA] bg-white p-2 sm:col-span-2">
                        <span className="font-bold uppercase text-[#8A847C]">Materiales</span>
                        <p className="mt-1 font-semibold text-[#2D2D2A]">{product.materials.join(", ") || "Sin materiales registrados"}</p>
                      </div>
                    </div>
                    {gallery.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {gallery.slice(1, 5).map((imageUrl, index) => (
                          <img
                            key={`${imageUrl}-${index}`}
                            src={imageUrl}
                            alt={`${product.name} detalle ${index + 2}`}
                            className="h-16 w-full rounded-lg border border-[#E6E2DA] object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 grid-cols-3">
                <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1.5 text-[#5A6A42]">
                    <Wallet className="h-3.5 w-3.5" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Al Artesano</span>
                  </div>
                  <p className="font-bold text-sm text-[#2D2D2A]">${producerPay.toLocaleString()} MXN</p>
                </div>
                <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1.5 text-[#C2845D]">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Fondo Comunal</span>
                  </div>
                  <p className="font-bold text-sm text-[#2D2D2A]">${product.breakdown.communityFund.toLocaleString()} MXN</p>
                </div>
                <div className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-center">
                  <div className="mb-1 flex items-center justify-center gap-1.5 text-[#2D2D2A]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Auditoría</span>
                  </div>
                  <p className="font-bold text-xs uppercase text-[#5A6A42]">{product.status === "verified" ? "Verificado" : "Pendiente"}</p>
                </div>
              </div>

              {/* Sequential Timeline */}
              <div className="space-y-5 border-l border-[#E6E2DA] ml-3 pl-5">
                {stages.map((stage) => (
                  <div key={stage.id} className="relative group">
                    <span className="absolute -left-[27px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#5A6A42] bg-white group-hover:scale-125 transition-transform" />
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-[#2D2D2A]">{stage.stage_label}</h4>
                      <span className="text-[10px] text-[#8A847C] font-mono bg-[#FAF8F5] border border-[#E6E2DA]/50 px-2 py-0.5 rounded-md">
                        {stage.date}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B665F] mt-1 leading-relaxed">{stage.description}</p>
                    <p className="mt-1 break-all font-mono text-[9px] text-[#8A847C] leading-none uppercase">
                      HASH: {stage.hash_actual.slice(0, 16)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: QR/NFC & Blockchain Anchors */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E6E2DA] bg-[#FAF8F5] p-4 text-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Trazabilidad" className="mx-auto h-40 w-40 object-contain" />
                ) : (
                  <QrCode className="mx-auto h-32 w-32 stroke-[1.1] text-[#8A847C]" />
                )}
                <p className="mt-2 text-[10px] text-[#6B665F] font-serif italic">Escanea con tu celular para auditar el origen</p>
              </div>

              {canManageTraceability && (
                <>
                  <button
                    onClick={onNfc}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2D2A] hover:bg-[#C2845D] py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-xs"
                  >
                    <Fingerprint className="h-4 w-4" />
                    Escribir Etiqueta NFC
                  </button>

                  <button
                    onClick={onAnchor}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5A6A42] hover:bg-[#2D2D2A] py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-xs"
                  >
                    <Lock className="h-4 w-4" />
                    Anclar Historial Blockchain
                  </button>
                </>
              )}

              <div className="rounded-xl border border-[#E6E2DA] p-3 text-[10px] space-y-1.5 max-h-36 overflow-y-auto bg-[#FAF8F5]">
                <p className="font-serif font-bold text-[#2D2D2A] border-b border-[#E6E2DA] pb-1">Ledger Blockchain</p>
                {anchors.length === 0 ? (
                  <p className="text-[#8A847C] italic">Sin anclajes en bloque todavía.</p>
                ) : (
                  anchors.map((anchor) => (
                    <div key={anchor.id} className="text-[#6B665F] leading-tight break-all border-b border-[#E6E2DA]/30 pb-1 last:border-0 last:pb-0">
                      <span className="font-bold text-[#5A6A42] block uppercase">{anchor.status}</span>
                      <span className="font-mono text-[9px] block text-[#8A847C]">{anchor.tx_hash || anchor.anchor_hash}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
