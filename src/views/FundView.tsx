import React, { FormEvent } from "react";
import { CircleDollarSign, FileText } from "lucide-react";
import { CommunityFundMovement } from "../types";

interface FundViewProps {
  balance: number;
  movements: CommunityFundMovement[];
  canManage: boolean;
  onExpense: (event: FormEvent<HTMLFormElement>) => void;
  onConfirmExpense: (movementId: string) => void;
  onDownloadReport: () => void;
}

export default function FundView({ balance, movements, canManage, onExpense, onConfirmExpense }: FundViewProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs">
        <h2 className="mb-4 text-lg font-serif font-bold text-[#2D2D2A]">Transparencia de Recursos Comunitarios</h2>

        <div className="mb-5 rounded-2xl bg-[#2D2D2A] p-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#CFCAC2] font-mono">Fondo Comunal Acumulado</p>
            <p className="text-3xl font-black mt-1 font-sans">${balance.toLocaleString("es-MX")} MXN</p>
          </div>
          <button
            type="button"
            onClick={onDownloadReport}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#2D2D2A] hover:bg-[#FAF8F5] transition-all"
          >
            <FileText className="h-4 w-4" />
            Descargar Reporte PDF
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          <h3 className="font-serif font-bold text-[#2D2D2A] text-xs mb-3">Historial de Ingresos y Egresos</h3>
          {movements.length === 0 ? (
            <p className="text-xs text-[#6B665F] italic">No se han registrado aportaciones o egresos todavía.</p>
          ) : (
            movements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[#2D2D2A]">{movement.description}</p>
                    {movement.type === "expense" && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        movement.approval_status === "confirmed"
                          ? "bg-emerald-50 text-[#5A6A42]"
                          : "bg-[#FFF7ED] text-[#C2845D]"
                      }`}>
                        {movement.approval_status === "confirmed" ? "Confirmado" : "Pendiente"}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#6B665F] mt-0.5">
                    Responsable: {movement.responsible || "Sistema"} · {new Date(movement.created_at).toLocaleDateString()}
                  </p>
                  {canManage && movement.type === "expense" && movement.approval_status !== "confirmed" && (
                    <button
                      type="button"
                      onClick={() => onConfirmExpense(movement.id)}
                      className="mt-2 rounded-lg border border-[#C2845D]/30 bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#C2845D] hover:bg-[#FFF7ED] cursor-pointer"
                    >
                      Confirmar gasto
                    </button>
                  )}
                </div>
                <span className={`font-mono font-bold text-sm ${movement.type === "income" ? "text-[#5A6A42]" : "text-[#A44A3F]"}`}>
                  {movement.type === "income" ? "+" : "-"}${movement.amount.toLocaleString()} MXN
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {canManage && (
        <form onSubmit={onExpense} className="rounded-2xl border border-[#E6E2DA] bg-white p-4 text-xs space-y-2 shadow-xs h-fit">
          <div className="mb-4 flex gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FAF8F5] text-[#5A6A42] border border-[#E6E2DA]/50">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#2D2D2A]">Registrar Gasto de Apoyo</h2>
              <p className="text-[10px] text-[#6B665F] font-normal leading-tight">Registra egresos autorizados del fondo comunal.</p>
            </div>
          </div>

          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Descripción del Gasto
            <input
              name="description"
              required
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. Compra de empaques biodegradables"
            />
          </label>
          <label className="block font-bold uppercase tracking-wider text-[#6B665F]">
            Monto del Egreso ($)
            <input
              name="amount"
              required
              type="number"
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            />
          </label>
          <button className="w-full rounded-xl bg-[#2D2D2A] hover:bg-[#A44A3F] py-2 text-xs font-bold text-white transition-all cursor-pointer">
            Registrar Egreso
          </button>
        </form>
      )}
    </div>
  );
}
