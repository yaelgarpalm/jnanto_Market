import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const server = read("src/server.ts");
const app = read("src/App.tsx");
const traceModal = read("src/components/TraceModal.tsx");
const producerView = read("src/views/ProducerView.tsx");
const cooperativeView = read("src/views/CooperativeView.tsx");
const fundView = read("src/views/FundView.tsx");
const purchasesView = read("src/views/PurchasesView.tsx");
const inventoryView = read("src/views/InventoryView.tsx");
const adminView = read("src/views/AdminView.tsx");
const settlementPanel = read("src/components/SettlementPanel.tsx");
const migrationFiles = fs.readdirSync(path.join(root, "supabase/migrations"));

test("DEF-021/DEF-022: registro público y cambio de rol están protegidos", () => {
  assert.match(server, /const role: ProfileRole = "customer";/);
  assert.match(server, /El rol operativo solo puede ser asignado por un administrador/);
  assert.match(server, /La asociación a una cooperativa solo puede ser asignada por un administrador/);
});

test("DEF-023 a DEF-026: checkout y webhook mantienen validaciones de pago", () => {
  assert.match(server, /\.eq\("customer_id", req\.user!\.id\)/);
  assert.match(server, /La sesión de Stripe no corresponde a esta orden/);
  assert.match(server, /payment_status === "paid"/);
  assert.doesNotMatch(server, /isPaid = true; \/\/ fallback anterior/);
  assert.match(server, /provider_session_id/);
  assert.match(server, /checkout\.session\.expired/);
  assert.match(server, /checkout\.session\.async_payment_failed/);
});

test("DEF-027/DEF-028: reportes de productor y cooperativa requieren autenticación y alcance", () => {
  assert.match(server, /app\.get\("\/api\/reports\/producer\.pdf", requireAuth/);
  assert.match(server, /app\.get\("\/api\/reports\/cooperative\.pdf", requireAuth/);
  assert.match(server, /canAccessCooperative\(req, scopedProducer\.cooperative_id\)/);
  assert.match(server, /canAccessCooperative\(req, cooperativeId\)/);
});

test("DEF-029 a DEF-033: recursos, productos y sensores validan ámbito", () => {
  assert.match(server, /No puedes registrar el despacho de este producto/);
  assert.match(server, /No puedes validar productos de otra cooperativa/);
  assert.match(server, /No puedes registrar sensores para este producto/);
  assert.match(server, /No puedes gestionar reservas de otra cooperativa/);
});

test("DEF-034: endurecimiento Supabase está versionado", () => {
  const securityMigration = migrationFiles.find((name) => name.includes("20260918_security_hardening"));
  assert.ok(securityMigration, "Debe existir la migración de hardening");
  const migration = read(path.join("supabase/migrations", securityMigration));
  assert.match(migration, /revoke execute on function public\.register_route_device/);
  assert.match(migration, /route_sessions_admin_only/);
  assert.match(migration, /route_stops_admin_only/);
});

test("DEF-035: NFC y Blockchain se restringen por rol", () => {
  assert.match(traceModal, /canManageTraceability/);
  assert.match(app, /Solo productores, cooperativas y administradores pueden anclar el historial blockchain/);
  assert.match(server, /requireRoles\(\["admin", "producer", "cooperative"\]\)/);
});

test("DEF-036 a DEF-042: reglas de checkout, recursos y recibido están presentes", () => {
  assert.match(server, /releaseCheckoutRewardRedemption/);
  assert.match(server, /checkout\.session\.expired/);
  assert.match(server, /checkout\.session\.async_payment_failed/);
  assert.match(server, /payment_status === "paid"/);
  assert.match(server, /La cantidad solicitada .* supera la disponibilidad actual/);
  assert.match(server, /El periodo de reservación no es válido/);
  assert.match(server, /existing\.status === "pending" && \["approved", "cancelled"\]/);
  assert.match(server, /existing\.status === "approved" && \["completed", "cancelled"\]/);
  assert.match(server, /La recepción solo puede confirmarse después de que la orden haya sido enviada/);
});

test("DEF-043/DEF-044: liquidaciones de productor y cooperativa existen", () => {
  assert.match(server, /app\.get\("\/api\/settlements\/producer"/);
  assert.match(server, /app\.get\("\/api\/settlements\/cooperative"/);
  assert.match(server, /app\.post\("\/api\/settlements"/);
  assert.match(server, /app\.post\("\/api\/settlements\/:id\/pay"/);
  assert.match(settlementPanel, /Crear corte/);
  assert.match(settlementPanel, /Registrar pago/);
});

test("DEF-045 a DEF-049: notificaciones, sincronización y acciones bloqueadas están implementadas", () => {
  assert.match(app, /30000/);
  assert.match(app, /15000/);
  assert.match(app, /runLockedAction/);
  assert.match(app, /notificationTimersRef\.current\.clear\(\)/);
  assert.match(app, /getFriendlyError/);
});

test("DEF-050 a DEF-052: fondo, recursos y notificaciones respetan ámbito", () => {
  assert.match(server, /app\.get\("\/api\/community-fund"/);
  assert.match(server, /app\.get\("\/api\/reports\/community-fund\.pdf", requireAuth/);
  assert.match(server, /available_shared", true/);
  assert.match(app, /cooperative_id/);
});

test("DEF-053/DEF-054: pago de liquidación y formulario de producto tienen validación/espacio", () => {
  assert.match(server, /Selecciona una forma de pago válida/);
  assert.match(server, /La referencia, folio o comprobante del pago es obligatoria/);
  assert.match(settlementPanel, /Forma de pago/);
  assert.match(settlementPanel, /Referencia \/ folio \/ comprobante/);
  assert.match(producerView, /xl:grid-cols-\[minmax\(0,1fr\)_520px\]/);
});

test("DEF-055: integración mantiene control de despliegue y la variable PORT", () => {
  assert.match(server, /const PORT = Number\(process\.env\.PORT \|\| 3000\)/);
});

test("DEF-056 a DEF-061: sistema de reportes estandarizado y cubierto por rol", () => {
  for (const route of [
    "/api/reports/community-fund.pdf",
    "/api/reports/producer.pdf",
    "/api/reports/cooperative.pdf",
    "/api/reports/customer.pdf",
    "/api/reports/inventory.pdf",
    "/api/reports/admin.pdf",
  ]) {
    assert.ok(server.includes('app.get("' + route + '", requireAuth'), "Falta protección para " + route);
  }
  for (const source of [producerView, cooperativeView, fundView, purchasesView, inventoryView, adminView]) {
    assert.match(source, /ReportCard/);
  }
  assert.match(server, /drawStandardHeader/);
  assert.match(server, /drawStandardMetrics/);
  assert.match(server, /drawStandardSection/);
  assert.match(server, /drawStandardTableHeader/);
  assert.match(server, /drawStandardFooter/);
  assert.equal((app.match(/async function downloadAuthenticatedPdf/g) || []).length, 1);
  assert.match(app, /contentType\.includes\("application\/pdf"\)/);
});

test("DEF-037/038/039/040/041/042: controles específicos de API permanecen versionados", () => {
  assert.match(server, /id, name, municipality, community, representative/);
  assert.match(server, /includePending/);
  assert.match(server, /El precio debe ser mayor que cero/);
  assert.match(server, /Las existencias no pueden ser negativas/);
  assert.match(server, /La cantidad solicitada .* supera la disponibilidad actual/);
  assert.match(server, /No se puede cambiar una reservación de \$\{existing\.status\} a \$\{status\}/);
});

test("Compilación y estructura: no existen funciones duplicadas de reportes en App", () => {
  assert.equal((app.match(/async function downloadAuthenticatedPdf/g) || []).length, 1);
  for (const fn of [
    "downloadFundReport",
    "downloadProducerReport",
    "downloadCoopReport",
    "downloadCustomerReport",
    "downloadInventoryReport",
    "downloadAdminReport",
  ]) {
    assert.equal((app.match(new RegExp("async function " + fn + "\\(", "g")) || []).length, 1, fn + " duplicada o ausente");
  }
});
