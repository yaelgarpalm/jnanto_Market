import React, { FormEvent, useEffect, useState } from "react";
import { AtSign, LockKeyhole, LogOut, UserPlus, Users } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Cooperative, Profile, UserRole } from "../types";

interface AuthPanelProps {
  session: Session | null;
  profile: Profile | null;
  authMode: "login" | "register";
  authForm: any;
  setAuthMode: (mode: "login" | "register") => void;
  setAuthForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (event: FormEvent) => void;
  onSignOut: () => void;
  onProfileUpdate: (next: { role: UserRole; community: string; cooperativeId: string }) => void;
  cooperatives: Cooperative[];
}

function roleLabel(role?: UserRole) {
  const labels: Record<UserRole, string> = {
    customer: "Cliente",
    producer: "Productor",
    cooperative: "Cooperativa",
    verifier: "Verificador",
    inventory_manager: "Gestor de Inventario",
    logistics: "Logística",
    admin: "Administrador",
  };
  return role ? labels[role] : "Visitante";
}

function roleBadgeColor(role?: UserRole) {
  if (role === "admin") return "bg-purple-50 text-purple-700 border-purple-200";
  if (role === "cooperative" || role === "verifier") return "bg-amber-50 text-amber-700 border-amber-200";
  if (role === "producer") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-[#FAF8F5] text-[#6B665F] border-[#E6E2DA]";
}

export default function AuthPanel({
  session,
  profile,
  authMode,
  authForm,
  setAuthMode,
  setAuthForm,
  onSubmit,
  onSignOut,
  onProfileUpdate,
  cooperatives,
}: AuthPanelProps) {
  const [profileForm, setProfileForm] = useState({
    community: "San Felipe del Progreso",
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        community: profile.community || "San Felipe del Progreso",
      });
    }
  }, [profile]);

  if (session && profile) {
    return (
      <div className="rounded-2xl border border-[#E6E2DA] bg-white p-4 shadow-xs animate-fade-in space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5A6A42] text-white">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-sm text-[#2D2D2A]">{profile.full_name}</p>
              <p className="text-xs text-[#6B665F]">
                {profile.community || "San Felipe"}
              </p>
              <span className={`inline-block mt-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${roleBadgeColor(profile.role)}`}>
                {roleLabel(profile.role)}
              </span>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="rounded-xl border border-[#E6E2DA] p-2 text-[#6B665F] hover:bg-[#FAF8F5] hover:text-[#2D2D2A] transition-all cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {profile.role !== "admin" && (
          <div className="border-t border-[#E6E2DA] pt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A847C]">Perfil operativo</p>
            <input
              value={profileForm.community}
              onChange={(e) => setProfileForm((p) => ({ ...p, community: e.target.value }))}
              className="w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Comunidad"
            />
            <button
              type="button"
              onClick={() => onProfileUpdate({ role: profile.role, community: profileForm.community, cooperativeId: profile.cooperative_id || "" })}
              className="w-full rounded-xl bg-[#2D2D2A] hover:bg-[#5A6A42] py-2 text-xs font-bold text-white transition-all cursor-pointer"
            >
              Guardar asociación
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <form onSubmit={onSubmit} className="overflow-hidden rounded-2xl border border-[#E6E2DA] bg-white shadow-sm">
        <div className="border-b border-[#E6E2DA] bg-[#FAF8F5] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E6E2DA] bg-white text-[#004d32]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#2D2D2A]">
                {authMode === "login" ? "Ingresar a Jnatjo" : "Crear cuenta"}
              </h3>
              <p className="mt-1 text-xs font-medium text-[#6B665F]">
                {authMode === "login"
                  ? "Accede a compras, trazabilidad y paneles operativos."
                  : "Elige tu rol para entrar directo al panel correspondiente."}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4">
        <div className="flex rounded-xl bg-[#FAF8F5] p-1 border border-[#E6E2DA]/50">
          <button
            type="button"
            onClick={() => setAuthMode("login")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
              authMode === "login" ? "bg-white text-[#2d2d2a] shadow-xs" : "text-[#8A847C]"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("register")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
              authMode === "register" ? "bg-white text-[#2d2d2a] shadow-xs" : "text-[#8A847C]"
            }`}
          >
            Crear Cuenta
          </button>
        </div>
        <div className="space-y-2">
          {authMode === "register" && (
            <input
              className="w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Nombre completo"
              value={authForm.fullName}
              onChange={(e) => setAuthForm((p: any) => ({ ...p, fullName: e.target.value }))}
              required
            />
          )}
          <label className="relative block">
            <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A847C]" />
            <input
              className="w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-9 py-2.5 text-sm outline-none focus:border-[#C2845D] focus:bg-white"
              placeholder="Correo electrónico"
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm((p: any) => ({ ...p, email: e.target.value }))}
              required
            />
          </label>
          <label className="relative block">
            <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A847C]" />
            <input
              type="password"
              className="w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-9 py-2.5 text-sm outline-none focus:border-[#C2845D] focus:bg-white"
              placeholder="Contraseña"
              value={authForm.password}
              onChange={(e) => setAuthForm((p: any) => ({ ...p, password: e.target.value }))}
              required
            />
          </label>
          {authMode === "register" && (
            <>
              <input
                className="w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
                placeholder="Comunidad de residencia"
                value={authForm.community}
                onChange={(e) => setAuthForm((p: any) => ({ ...p, community: e.target.value }))}
              />
            </>
          )}
          <button className="w-full rounded-xl bg-[#2D2D2A] hover:bg-[#5A6A42] py-3 text-sm font-bold text-white transition-all cursor-pointer">
            {authMode === "login" ? "Ingresar" : "Completar Registro"}
          </button>
        </div>
        </div>
      </form>

    </div>
  );
}
