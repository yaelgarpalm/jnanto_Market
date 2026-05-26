import React from "react";
import { ShoppingBag, Trash2 } from "lucide-react";
import { Product } from "../types";

interface CartPanelProps {
  cart: { product: Product; quantity: number }[];
  setCart: React.Dispatch<React.SetStateAction<{ product: Product; quantity: number }[]>>;
  total: number;
  shippingForm: any;
  setShippingForm: React.Dispatch<React.SetStateAction<any>>;
  saveDeliveryInfo: boolean;
  setSaveDeliveryInfo: React.Dispatch<React.SetStateAction<boolean>>;
  rewardBalance: number;
  rewardDiscount: number;
  useRewardPoints: boolean;
  setUseRewardPoints: React.Dispatch<React.SetStateAction<boolean>>;
  onCheckout: () => void;
}

export default function CartPanel({
  cart,
  setCart,
  total,
  shippingForm,
  setShippingForm,
  saveDeliveryInfo,
  setSaveDeliveryInfo,
  rewardBalance,
  rewardDiscount,
  useRewardPoints,
  setUseRewardPoints,
  onCheckout,
}: CartPanelProps) {
  const hasShipping = shippingForm.name && shippingForm.phone && shippingForm.address && shippingForm.city && shippingForm.state && shippingForm.postalCode;
  const payableTotal = Math.max(total - rewardDiscount, 0);

  return (
    <div className="rounded-2xl border border-[#E6E2DA] bg-white p-4 shadow-xs space-y-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif font-bold text-[#2D2D2A] text-sm flex items-center gap-1.5">
          <ShoppingBag className="h-4 w-4 text-[#C2845D]" />
          Tu Carrito
        </h3>
        {cart.length > 0 && (
          <span className="bg-[#C2845D]/10 text-[#C2845D] text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} piezas
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <p className="text-xs text-[#6B665F]">No hay productos seleccionados.</p>
        ) : (
          cart.map((item) => (
            <div key={item.product.id} className="rounded-xl bg-[#FAF8F5] border border-[#E6E2DA]/50 p-2.5 text-xs flex justify-between gap-3 items-center">
              <div className="min-w-0 flex-1">
                <span className="font-bold text-[#2D2D2A] block truncate">{item.product.name}</span>
                <span className="text-[10px] text-[#6B665F] font-mono block mt-0.5">
                  Cant. {item.quantity} · Stock {item.product.stock} · ${(item.product.price * item.quantity).toLocaleString()} MXN
                </span>
              </div>
              <button
                onClick={() => setCart((rows) => rows.filter((row) => row.product.id !== item.product.id))}
                className="text-[#8A847C] hover:text-[#A44A3F] p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                title="Eliminar del carrito"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-[#E6E2DA] pt-3">
        <h3 className="mb-2 font-serif font-bold text-[#2D2D2A] text-sm">Datos de entrega</h3>
        <div className="grid gap-2 text-xs">
          <input
            value={shippingForm.name}
            onChange={(e) => setShippingForm((p: any) => ({ ...p, name: e.target.value }))}
            className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#C2845D]"
            placeholder="Nombre de quien recibe"
          />
          <input
            value={shippingForm.phone}
            onChange={(e) => setShippingForm((p: any) => ({ ...p, phone: e.target.value }))}
            className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#C2845D]"
            placeholder="Teléfono"
          />
          <input
            value={shippingForm.address}
            onChange={(e) => setShippingForm((p: any) => ({ ...p, address: e.target.value }))}
            className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#C2845D]"
            placeholder="Calle, número, colonia"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={shippingForm.city}
              onChange={(e) => setShippingForm((p: any) => ({ ...p, city: e.target.value }))}
              className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#C2845D]"
              placeholder="Municipio"
            />
            <input
              value={shippingForm.postalCode}
              onChange={(e) => setShippingForm((p: any) => ({ ...p, postalCode: e.target.value }))}
              className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#C2845D]"
              placeholder="C.P."
            />
          </div>
          <input
            value={shippingForm.state}
            onChange={(e) => setShippingForm((p: any) => ({ ...p, state: e.target.value }))}
            className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#C2845D]"
            placeholder="Estado"
          />
          <input
            value={shippingForm.notes}
            onChange={(e) => setShippingForm((p: any) => ({ ...p, notes: e.target.value }))}
            className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 outline-none focus:border-[#C2845D]"
            placeholder="Referencias de entrega"
          />
          <label className="flex items-center gap-2 rounded-xl border border-[#E6E2DA] bg-white px-3 py-2 text-[11px] font-semibold text-[#6B665F]">
            <input
              type="checkbox"
              checked={saveDeliveryInfo}
              onChange={(e) => setSaveDeliveryInfo(e.target.checked)}
              className="h-4 w-4 accent-[#5A6A42]"
            />
            Guardar esta información de entrega para mi cuenta
          </label>
        </div>
      </div>

      <div className="mt-3 border-t border-[#E6E2DA] pt-3">
        <div className="mb-3 rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[#2D2D2A]">Puntos Jnatjo</p>
              <p className="mt-0.5 text-[10px] text-[#6B665F]">
                Disponibles: {rewardBalance} puntos. Usa hasta 20% de descuento.
              </p>
            </div>
            <input
              type="checkbox"
              checked={useRewardPoints}
              disabled={rewardBalance <= 0 || total <= 0}
              onChange={(e) => setUseRewardPoints(e.target.checked)}
              className="h-4 w-4 accent-[#5A6A42] disabled:opacity-40"
              aria-label="Usar puntos como descuento"
            />
          </div>
          {rewardDiscount > 0 && (
            <p className="mt-2 font-bold text-[#5A6A42]">
              Descuento aplicado: -${rewardDiscount.toLocaleString("es-MX")} MXN
            </p>
          )}
        </div>
        <div className="flex justify-between text-xs font-serif font-bold text-[#2D2D2A]">
          <span>Total de Venta</span>
          <span className="text-sm font-sans font-extrabold text-[#5A6A42]">
            ${payableTotal.toLocaleString("es-MX")} MXN
          </span>
        </div>
        <button
          disabled={cart.length === 0 || !hasShipping}
          onClick={onCheckout}
          className="mt-3 w-full rounded-xl bg-[#5A6A42] hover:bg-[#2D2D2A] py-2.5 text-xs font-bold text-white transition-all shadow-xs disabled:cursor-not-allowed disabled:bg-[#CFCAC2] cursor-pointer text-center"
        >
          {hasShipping ? "Proceder al Pago con Stripe" : "Completa entrega"}
        </button>
      </div>
    </div>
  );
}
