import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Fingerprint, MapPin, ShieldCheck } from "lucide-react";
import { Product } from "../types";

interface NfcOpenCardProps {
  product: Product;
  onOpen: () => void;
}

export default function NfcOpenCard({ product, onOpen }: NfcOpenCardProps) {
  const image = product.images?.[0] || product.image;
  const [seconds, setSeconds] = useState(2);

  useEffect(() => {
    const started = window.setTimeout(() => onOpen(), 2400);
    const tick = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => {
      window.clearTimeout(started);
      window.clearInterval(tick);
    };
  }, [onOpen]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#101815]/35 px-3 pb-3 pt-10 backdrop-blur-[3px] sm:items-center sm:p-5 animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_28px_80px_rgba(16,24,21,0.26)] animate-slide-up">
        <div className="px-5 pb-3 pt-5">
          <div className="mx-auto h-1.5 w-11 rounded-full bg-black/10" />
          <div className="mt-4 flex items-center gap-2 text-[#004d32]">
            <Fingerprint className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Etiqueta NFC detectada</span>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-[#f6f4ef]">
            {image ? (
              <img src={image} alt={product.name} className="h-52 w-full object-cover sm:h-60" />
            ) : (
              <div className="flex h-52 items-center justify-center text-sm font-semibold text-[#69736d]">Sin imagen</div>
            )}

            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#eaf3ed] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#004d32]">
                  Producto verificado
                </span>
                {product.status === "verified" && <ShieldCheck className="h-4 w-4 text-[#004d32]" />}
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-[#101815]">{product.name}</h1>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#69736d]">
                {product.description || "Conoce el origen, productor y trazabilidad de esta pieza."}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a938d]">Artesano</p>
                  <p className="mt-1 truncate text-sm font-bold text-[#101815]">{product.producerName}</p>
                </div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a938d]">Comunidad</p>
                  <div className="mt-1 flex items-center gap-1 text-sm font-bold text-[#101815]">
                    <MapPin className="h-3.5 w-3.5 text-[#C2845D]" />
                    <span className="truncate">{product.community}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#004d32] px-5 py-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(0,77,50,0.22)] transition hover:bg-[#003c27] active:scale-[0.99]"
          >
            Abrir producto {seconds > 0 ? `· ${seconds}s` : ""}
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#8a938d]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#004d32]" />
            Ver trazabilidad y origen del producto
          </p>
        </div>
      </div>
    </div>
  );
}
