import React, { FormEvent, useState } from "react";
import { AlertTriangle, Boxes, CalendarClock } from "lucide-react";
import { CommunityResource, ResourceReservation, Profile } from "../types";

interface InventoryViewProps {
  resources: CommunityResource[];
  reservations: ResourceReservation[];
  movements: any[];
  profile: Profile | null;
  reservationForm: any;
  setReservationForm: React.Dispatch<React.SetStateAction<any>>;
  resourceForm: any;
  setResourceForm: React.Dispatch<React.SetStateAction<any>>;
  onReserve: (event: FormEvent) => void;
  onCreateResource: (event: FormEvent) => void;
  onRegisterMovement: (resourceId: string, type: "in" | "out", quantity: number, notes: string) => void;
}

export default function InventoryView({
  resources,
  reservations,
  movements,
  profile,
  reservationForm,
  setReservationForm,
  resourceForm,
  setResourceForm,
  onReserve,
  onCreateResource,
  onRegisterMovement,
}: InventoryViewProps) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    quantity: 10,
    type: "in" as "in" | "out",
    notes: "Ajuste de inventario",
  });

  const canManage = Boolean(profile && ["admin", "cooperative", "inventory_manager"].includes(profile.role));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Panel title="Inventario comunitario">
          <div className="grid gap-3 md:grid-cols-2">
            {resources.map((resource) => (
              <div key={resource.id} className="rounded-lg border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-base">{resource.name}</p>
                      <p className="text-xs text-[#6B665F] uppercase font-mono tracking-wider mt-0.5">{resource.type} · <span className="font-bold text-[#2D2D2A]">{resource.quantity}</span> {resource.unit}</p>
                    </div>
                    {resource.quantity <= resource.low_stock_threshold && (
                      <span className="flex items-center gap-1 bg-[#FFF7ED] border border-[#C2845D]/30 text-[#C2845D] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase shadow-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Stock Bajo
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[#6B665F] leading-relaxed">{resource.description}</p>
                </div>

                {canManage && (
                  <div className="mt-4 pt-3 border-t border-[#E6E2DA] flex flex-col gap-2">
                    {selectedResourceId === resource.id ? (
                      <div className="bg-white rounded-lg p-2 border border-[#E6E2DA] space-y-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setAdjustmentForm((prev) => ({ ...prev, type: "in" }))}
                            className={`flex-1 py-1 rounded-md text-xs font-bold ${adjustmentForm.type === "in" ? "bg-[#5A6A42] text-white" : "border border-[#E6E2DA] text-[#6B665F]"}`}
                          >
                            Entrada
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustmentForm((prev) => ({ ...prev, type: "out" }))}
                            className={`flex-1 py-1 rounded-md text-xs font-bold ${adjustmentForm.type === "out" ? "bg-[#A44A3F] text-white" : "border border-[#E6E2DA] text-[#6B665F]"}`}
                          >
                            Salida
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={adjustmentForm.quantity}
                            onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                            className="w-20 rounded-md border border-[#E6E2DA] px-2 py-1 text-xs outline-none"
                            placeholder="Cant."
                          />
                          <input
                            type="text"
                            value={adjustmentForm.notes}
                            onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, notes: e.target.value }))}
                            className="flex-1 rounded-md border border-[#E6E2DA] px-2 py-1 text-xs outline-none"
                            placeholder="Notas / Motivo"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onRegisterMovement(resource.id, adjustmentForm.type, adjustmentForm.quantity, adjustmentForm.notes);
                              setSelectedResourceId(null);
                            }}
                            className="flex-1 bg-[#2D2D2A] hover:bg-[#5A6A42] text-white py-1 rounded-md text-xs font-bold cursor-pointer"
                          >
                            Registrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedResourceId(null)}
                            className="border border-[#E6E2DA] px-2 py-1 rounded-md text-xs font-bold cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedResourceId(resource.id);
                          setAdjustmentForm({ quantity: 10, type: "in", notes: "Ajuste de inventario" });
                        }}
                        className="w-full rounded-lg border border-[#E6E2DA] hover:bg-[#FAF8F5] text-[#2D2D2A] py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Ajustar Stock (Entrada/Salida)
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Bitácora de movimientos (Auditoría)">
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {movements.length === 0 ? (
              <p className="text-xs text-[#6B665F]">No se han registrado movimientos de inventario todavía.</p>
            ) : (
              movements.map((move) => {
                const resource = resources.find((r) => r.id === move.resource_id);
                return (
                  <div key={move.id} className="flex justify-between items-center rounded-lg border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs">
                    <div>
                      <p className="font-bold text-sm text-[#2D2D2A]">{resource?.name || "Recurso eliminado"}</p>
                      <p className="text-stone-500 mt-0.5">{move.notes || "Ajuste de inventario"} · {new Date(move.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`font-mono font-bold text-sm px-2.5 py-1 rounded-full ${move.type === "in" ? "bg-emerald-50 text-[#5A6A42]" : "bg-red-50 text-[#A44A3F]"}`}>
                      {move.type === "in" ? "+" : "-"}{move.quantity} {resource?.unit || ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <form onSubmit={onReserve} className="rounded-lg border border-[#E6E2DA] bg-white p-4 text-xs space-y-2">
          <SectionTitle icon={<CalendarClock />} title="Reservar recurso" text="Solicita maquinaria o herramientas comunitarias." />
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Recurso
            <select
              value={reservationForm.resourceId}
              onChange={(e) => setReservationForm((p: any) => ({ ...p, resourceId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.type})
                </option>
              ))}
            </select>
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Inicio de Préstamo
            <input
              type="datetime-local"
              value={reservationForm.startDate}
              onChange={(e) => setReservationForm((p: any) => ({ ...p, startDate: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            />
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Fin de Préstamo
            <input
              type="datetime-local"
              value={reservationForm.endDate}
              onChange={(e) => setReservationForm((p: any) => ({ ...p, endDate: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            />
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Cantidad Solicitada
            <input
              type="number"
              min="1"
              required
              value={reservationForm.quantity}
              onChange={(e) => setReservationForm((p: any) => ({ ...p, quantity: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. 5"
            />
            <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-[#8A847C]">
              Para maquinaria usa 1. Para materias primas indica las unidades que necesitas.
            </span>
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Notas / Uso Planificado
            <input
              value={reservationForm.notes}
              onChange={(e) => setReservationForm((p: any) => ({ ...p, notes: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. Confección de fajas tradicionales"
            />
          </label>
          <button className="mt-3 w-full rounded-xl bg-[#2D2D2A] hover:bg-[#5A6A42] py-2 text-xs font-bold text-white transition-all cursor-pointer">
            Solicitar Reserva
          </button>
        </form>

        <form onSubmit={onCreateResource} className="rounded-lg border border-[#E6E2DA] bg-white p-4 text-xs space-y-2">
          <SectionTitle icon={<Boxes />} title="Alta de recurso" text="Registra inventario o maquinaria compartida." />
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Nombre del Recurso
            <input
              required
              value={resourceForm.name}
              onChange={(e) => setResourceForm((p: any) => ({ ...p, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. Madera de cedro"
            />
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Tipo
            <select
              value={resourceForm.type}
              onChange={(e) => setResourceForm((p: any) => ({ ...p, type: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            >
              <option value="insumo">Insumo / Material</option>
              <option value="maquinaria">Maquinaria / Herramienta</option>
            </select>
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Cantidad Inicial
            <input
              type="number"
              required
              value={resourceForm.quantity}
              onChange={(e) => setResourceForm((p: any) => ({ ...p, quantity: Number(e.target.value) }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            />
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Unidad de Medida
            <input
              required
              value={resourceForm.unit}
              onChange={(e) => setResourceForm((p: any) => ({ ...p, unit: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. metros, madejas, piezas"
            />
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Descripción del Recurso
            <input
              required
              value={resourceForm.description}
              onChange={(e) => setResourceForm((p: any) => ({ ...p, description: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. Madera de cedro rojo curada en horno..."
            />
          </label>
          <button className="mt-3 w-full rounded-xl bg-[#5A6A42] hover:bg-[#2D2D2A] py-2 text-xs font-bold text-white transition-all cursor-pointer">
            Guardar Recurso en Bodega
          </button>
        </form>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs">
      <h2 className="mb-4 text-lg font-serif font-bold text-[#2D2D2A]">{title}</h2>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mb-4 flex gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FAF8F5] text-[#5A6A42] border border-[#E6E2DA]/50">{icon}</div>
      <div>
        <h2 className="font-bold text-sm text-[#2D2D2A]">{title}</h2>
        <p className="text-[10px] text-[#6B665F] font-normal leading-tight">{text}</p>
      </div>
    </div>
  );
}
