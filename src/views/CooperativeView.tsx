import React from "react";
import { CheckCircle2, Download, FileText, PackageCheck, QrCode, ShieldAlert } from "lucide-react";
import { Order, Product, Profile, ResourceReservation } from "../types";

interface CooperativeViewProps {
  profile: Profile | null;
  products: Product[];
  reservations: ResourceReservation[];
  orders: Order[];
  onValidate: (id: string) => void;
  onReservation: (id: string, status: "approved" | "completed" | "cancelled") => void;
  onFulfillment: (id: string, status: "preparing" | "shipped" | "delivered" | "cancelled") => void;
  onTrace: (product: Product) => void;
  onDownloadQr: (product: Product, orderId?: string) => void;
  onDownloadReport: () => void;
}

export default function CooperativeView({
  profile,
  products,
  reservations,
  orders,
  onValidate,
  onReservation,
  onFulfillment,
  onTrace,
  onDownloadQr,
  onDownloadReport,
}: CooperativeViewProps) {
  const isCoopOrStaff = Boolean(profile && ["cooperative", "verifier", "inventory_manager", "admin"].includes(profile.role));
  const pending = products.filter((item) => item.status === "pending");
  const paidOrders = orders.filter((order) => ["paid", "shipped", "delivered"].includes(order.status));

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {/* Report download bar */}
      <div className="xl:col-span-2 flex justify-end">
        <button
          type="button"
          onClick={onDownloadReport}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#C2845D] hover:bg-[#2D2D2A] px-4 py-2 text-[10px] font-bold uppercase text-white transition-all cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          Descargar Reporte de Cooperativa (PDF)
          <Download className="h-3 w-3" />
        </button>
      </div>

      {/* Product Origin Verification */}
      <div className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="mb-4 flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F5] text-[#5A6A42] border border-[#E6E2DA]/50">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-[#2D2D2A] text-sm">Validación Comunitaria de Origen</h2>
              <p className="text-xs text-[#6B665F]">Confirma que las piezas artesanales registradas son locales y de comercio justo.</p>
            </div>
          </div>

          {!profile && (
            <p className="mb-4 rounded-xl bg-[#FFF7ED] border border-[#C2845D]/30 p-3 text-xs text-[#C2845D]">
              Debe iniciar sesión como miembro de cooperativa para validar piezas.
            </p>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {pending.length === 0 ? (
              <p className="text-xs text-[#6B665F] italic">No hay productos pendientes de validación de origen.</p>
            ) : (
              pending.map((product) => (
                <div key={product.id} className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-xs text-[#2D2D2A]">{product.name}</span>
                      <span className="text-[10px] text-[#6B665F] font-mono">{product.category}</span>
                    </div>
                    <p className="text-[11px] text-[#6B665F] mt-1">
                      Elaborador: <span className="font-bold text-[#2D2D2A]">{product.producerName}</span> ({product.community})
                    </p>
                    <p className="text-[10px] text-[#8A847C] font-mono uppercase mt-1 leading-none">
                      Horas: {product.craftHours} hrs · Precio: ${product.price} MXN
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onValidate(product.id)}
                      disabled={!isCoopOrStaff}
                      className="rounded-xl bg-[#5A6A42] hover:bg-[#2D2D2A] px-3 py-1.5 text-[10px] font-bold text-white transition-all disabled:bg-[#CFCAC2] disabled:cursor-not-allowed cursor-pointer"
                    >
                      Validar Origen y Comercio Justo
                    </button>
                    <button
                      onClick={() => onTrace(product)}
                      className="rounded-xl border border-[#E6E2DA] bg-white px-3 py-1.5 text-[10px] font-bold text-[#6B665F] hover:bg-[#FAF8F5] hover:text-[#2D2D2A] transition-all cursor-pointer"
                    >
                      Revisar Detalles
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="mb-4 flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F5] text-[#5A6A42] border border-[#E6E2DA]/50">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-[#2D2D2A] text-sm">Seguimiento de Compras</h2>
              <p className="text-xs text-[#6B665F]">Actualiza preparación, envío y entrega para que el cliente vea su estado.</p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {paidOrders.length === 0 ? (
              <p className="text-xs text-[#6B665F] italic">No hay compras pagadas para preparar todavía.</p>
            ) : (
              paidOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-mono text-[10px] font-bold text-[#8A847C]">Orden #{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="font-bold text-[#2D2D2A]">{order.customer_name || order.customer_email}</p>
                      <p className="text-[10px] text-[#6B665F] mt-1">
                        {order.shipping_address}, {order.shipping_city}, {order.shipping_state} C.P. {order.shipping_postal_code}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-[#5A6A42]">
                      {order.fulfillment_status || "pending"}
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-[#6B665F]">
                    {(order.order_items || []).map((item) => (
                      <div key={item.id} className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5">
                        <p>
                          {item.quantity} x {item.product_name}
                          {item.review?.deliveryRating ? ` · Entrega ${item.review.deliveryRating}★` : ""}
                        </p>
                        {item.product && (
                          <button
                            type="button"
                            onClick={() => onDownloadQr(item.product!, order.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#2D2D2A] px-2.5 py-1 text-[9px] font-bold uppercase text-white hover:bg-[#5A6A42] cursor-pointer"
                          >
                            <QrCode className="h-3 w-3" />
                            Generar QR
                            <Download className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#E6E2DA]/50 pt-2">
                    {(["preparing", "shipped", "delivered", "cancelled"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => onFulfillment(order.id, status)}
                        disabled={!isCoopOrStaff}
                        className="rounded-lg border border-[#E6E2DA] bg-white px-2.5 py-1 text-[9px] font-bold uppercase text-[#6B665F] hover:bg-[#2D2D2A] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Machinery Bookings management */}
      <div className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div className="mb-4 flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F5] text-[#C2845D] border border-[#E6E2DA]/50">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-[#2D2D2A] text-sm">Préstamo de Maquinaria y Herramientas</h2>
              <p className="text-xs text-[#6B665F]">Aprueba o cancela reservas de recursos compartidos de la comunidad.</p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {reservations.length === 0 ? (
              <p className="text-xs text-[#6B665F] italic">No hay solicitudes de préstamo registradas.</p>
            ) : (
              reservations.map((reservation) => (
                <div key={reservation.id} className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-[#2D2D2A]">{reservation.resource_name}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        reservation.status === "approved" ? "bg-emerald-50 text-[#5A6A42]" :
                        reservation.status === "completed" ? "bg-blue-50 text-blue-800" :
                        reservation.status === "cancelled" ? "bg-red-50 text-[#A44A3F]" : "bg-orange-50 text-[#C2845D]"
                      }`}>
                        {reservation.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B665F] mt-1">
                      Solicitante: <span className="font-bold text-[#2D2D2A]">{reservation.user_name}</span>
                    </p>
                    <p className="text-[10px] text-[#8A847C] font-mono mt-1">
                      Inicio: {new Date(reservation.start_date).toLocaleString("es-MX")}
                      <br />
                      Fin: {new Date(reservation.end_date).toLocaleString("es-MX")}
                    </p>
                    <p className="text-[10px] font-bold text-[#2D2D2A] mt-1">
                      Cantidad: {reservation.quantity ?? 1}
                    </p>
                    {reservation.notes && (
                      <p className="text-[10px] text-[#6B665F] bg-white rounded-lg p-2 border border-[#E6E2DA]/50 mt-2 font-serif italic">
                        "{reservation.notes}"
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-[#E6E2DA]/50">
                    <button
                      onClick={() => onReservation(reservation.id, "approved")}
                      disabled={!isCoopOrStaff || reservation.status !== "pending"}
                      className="rounded-lg bg-[#5A6A42] hover:bg-[#2D2D2A] px-2.5 py-1 text-[9px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => onReservation(reservation.id, "completed")}
                      disabled={!isCoopOrStaff || reservation.status !== "approved"}
                      className="rounded-lg bg-[#2D2D2A] hover:bg-[#5A6A42] px-2.5 py-1 text-[9px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Completar
                    </button>
                    <button
                      onClick={() => onReservation(reservation.id, "cancelled")}
                      disabled={!isCoopOrStaff || ["completed", "cancelled"].includes(reservation.status)}
                      className="rounded-lg border border-[#E6E2DA] bg-white px-2.5 py-1 text-[9px] font-bold text-[#6B665F] hover:bg-[#FAF8F5] hover:text-[#2D2D2A] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Rechazar / Cancelar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
