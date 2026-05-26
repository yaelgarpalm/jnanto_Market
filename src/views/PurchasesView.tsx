import React from "react";
import { PackageCheck, QrCode, ReceiptText } from "lucide-react";
import { Order, Product, Profile } from "../types";

interface PurchasesViewProps {
  profile: Profile | null;
  orders: Order[];
  products: Product[];
  onTrace: (product: Product) => void;
}

export default function PurchasesView({ profile, orders, products, onTrace }: PurchasesViewProps) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const totalPoints = orders.reduce((sum, order) => sum + Number(order.reward_points || 0), 0);
  const statusLabel: Record<string, string> = {
    pending: "Pendiente",
    paid: "Pagado",
    preparing: "Preparando",
    shipped: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F5] text-[#5A6A42] border border-[#E6E2DA]/50">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-[#2D2D2A]">Mis compras y trazabilidad</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6B665F]">
              Consulta tus piezas adquiridas, su estado de pago y la ficha de origen con QR/NFC.
            </p>
            {profile && (
              <p className="mt-2 inline-flex rounded-full bg-[#5A6A42]/10 px-3 py-1 text-[11px] font-bold text-[#5A6A42]">
                {totalPoints} puntos Jñatjo acumulados
              </p>
            )}
          </div>
        </div>
      </div>

      {!profile ? (
        <div className="rounded-2xl border border-[#C2845D]/30 bg-[#FFF7ED] p-5 text-xs text-[#C2845D]">
          Inicia sesión para ver tus compras confirmadas.
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E2DA] bg-white p-10 text-center text-xs text-[#6B665F]">
          Aún no tienes compras registradas. Cuando inicies un checkout, aparecerá aquí su estado.
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs">
              {(() => {
                const fulfillment = order.fulfillment_status || "pending";
                const visibleStatus = fulfillment === "delivered" || order.status === "delivered" ? "delivered" : order.status;
                return (
                  <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8A847C]">
                    Orden #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <h3 className="mt-1 font-serif text-base font-bold text-[#2D2D2A]">
                    {visibleStatus === "delivered" ? "Compra entregada" : order.status === "paid" ? "Compra confirmada" : "Compra en proceso"}
                  </h3>
                  <p className="mt-1 text-[11px] text-[#6B665F]">
                    Entrega: <span className="font-bold uppercase">{statusLabel[fulfillment] || fulfillment || "Pendiente"}</span>
                    {order.shipping_city ? ` · ${order.shipping_city}, ${order.shipping_state}` : ""}
                  </p>
                  {Number(order.reward_points || 0) > 0 && (
                    <p className="mt-1 text-[11px] font-bold text-[#5A6A42]">
                      Recompensas de esta orden: {order.reward_points} puntos
                    </p>
                  )}
                  {Number(order.reward_points_redeemed || 0) > 0 && (
                    <p className="mt-1 text-[11px] font-bold text-[#C2845D]">
                      Usaste {order.reward_points_redeemed} puntos: -${Number(order.reward_discount || 0).toLocaleString("es-MX")} MXN
                    </p>
                  )}
                </div>
                <div className="text-right text-xs">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                    visibleStatus === "paid" || visibleStatus === "delivered" ? "bg-emerald-50 text-[#5A6A42]" : "bg-orange-50 text-[#C2845D]"
                  }`}>
                    {statusLabel[visibleStatus] || visibleStatus}
                  </span>
                  <p className="mt-1 font-bold text-[#2D2D2A]">${order.subtotal.toLocaleString("es-MX")} MXN</p>
                </div>
              </div>
                  </>
                );
              })()}

              <div className="grid gap-2">
                {(order.order_items || []).map((item) => {
                  const product = item.product || productById.get(item.product_id);
                  return (
                    <div key={item.id} className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[#2D2D2A]">{item.product_name}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-[#6B665F]">
                            Cant. {item.quantity} · ${item.unit_price.toLocaleString("es-MX")} MXN
                          </p>
                          {(item.rewardPoints || item.review?.rewardPoints) ? (
                            <p className="mt-1 text-[10px] font-bold text-[#5A6A42]">
                              +{item.rewardPoints || item.review?.rewardPoints} puntos reclamados
                            </p>
                          ) : (order.fulfillment_status === "delivered" ? (
                            <p className="mt-1 text-[10px] font-bold text-[#C2845D]">
                              Confirma recibido en trazabilidad para reclamar puntos.
                            </p>
                          ) : null)}
                        </div>
                        {product && ["paid", "shipped", "delivered"].includes(order.status) ? (
                          <button
                            type="button"
                            onClick={() => onTrace(product)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D2D2A] px-3 py-2 text-[10px] font-bold uppercase text-white transition-colors hover:bg-[#5A6A42] cursor-pointer"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            Ver trazabilidad
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E2DA] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#8A847C]">
                            <ReceiptText className="h-3.5 w-3.5" />
                            Sin ficha local
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
