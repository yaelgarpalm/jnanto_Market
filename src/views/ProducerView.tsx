import React, { FormEvent } from "react";
import { Download, ImageUp, PackageCheck, Plus, QrCode, ReceiptText, Trash2 } from "lucide-react";
import { MaterialItem, Order, Producer, Product, Profile } from "../types";

interface ProducerViewProps {
  profile: Profile | null;
  products: Product[];
  salesOrders: Order[];
  producers: Producer[];
  productForm: any;
  setProductForm: React.Dispatch<React.SetStateAction<any>>;
  onCreate: (event: FormEvent) => void;
  onTrace: (product: Product) => void;
  onRestock: (productId: string, amount: number) => void;
  onImageUpload: (files: File[]) => void;
  onDownloadQr: (product: Product, orderId?: string) => void;
}

const categories = [
  "Textiles bordados",
  "Ropa artesanal",
  "Munecas tradicionales",
  "Alfareria",
  "Joyeria artesanal",
  "Productos agricolas",
  "Alimentos locales",
  "Decoracion",
  "Arte comunitario",
];

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ProducerView({
  profile,
  products,
  salesOrders,
  producers,
  productForm,
  setProductForm,
  onCreate,
  onTrace,
  onRestock,
  onImageUpload,
  onDownloadQr,
}: ProducerViewProps) {
  const isProducerOrStaff = Boolean(profile && ["producer", "cooperative", "admin"].includes(profile.role));
  const isProducer = profile?.role === "producer";
  const producerOptions = isProducer && profile
    ? [{ id: profile.id, name: profile.full_name, community: profile.community || "Sin comunidad" }]
    : producers;
  const producerSelectValue = isProducer && profile ? profile.id : productForm.producerId;
  const visibleProducts = profile?.role === "producer"
    ? products.filter((product) => product.producerId === profile.id || normalizeName(product.producerName) === normalizeName(profile.full_name))
    : products;
  const productById = new Map(products.map((product) => [product.id, product]));
  const soldItems = salesOrders.flatMap((order) =>
    (order.order_items || []).map((item) => ({
      order,
      item,
      product: item.product || productById.get(item.product_id),
    })),
  );
  const materialItems: MaterialItem[] = Array.isArray(productForm.materialItems) ? productForm.materialItems : [];
  const imageUrls: string[] = Array.isArray(productForm.images)
    ? productForm.images
    : productForm.image
      ? [productForm.image]
      : [];
  const materialsCost = materialItems.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const platformCommission = Math.round(Number(productForm.price || 0) * 0.15);
  const producerPay = Math.max(
    Number(productForm.price || 0) - Number(productForm.communityFund || 0) - platformCommission,
    0,
  );
  const laborCost = Math.max(producerPay - materialsCost, 0);

  function updateMaterial(index: number, patch: Partial<MaterialItem>) {
    setProductForm((prev: any) => {
      const next = [...(Array.isArray(prev.materialItems) ? prev.materialItems : [])];
      next[index] = { ...next[index], ...patch };
      return {
        ...prev,
        materialItems: next,
        materials: next.map((item) => item.name).filter(Boolean).join(", "),
        materialsCost: next.reduce((sum, item) => sum + Number(item.cost || 0), 0),
      };
    });
  }

  function addMaterial() {
    setProductForm((prev: any) => ({
      ...prev,
      materialItems: [...(Array.isArray(prev.materialItems) ? prev.materialItems : []), { name: "", cost: "" }],
    }));
  }

  function removeMaterial(index: number) {
    setProductForm((prev: any) => {
      const next = (Array.isArray(prev.materialItems) ? prev.materialItems : []).filter((_: MaterialItem, i: number) => i !== index);
      return {
        ...prev,
        materialItems: next,
        materials: next.map((item: MaterialItem) => item.name).filter(Boolean).join(", "),
        materialsCost: next.reduce((sum: number, item: MaterialItem) => sum + Number(item.cost || 0), 0),
      };
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <form onSubmit={onCreate} className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs">
        <div className="mb-4 flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F5] text-[#5A6A42] border border-[#E6E2DA]/50">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-[#2D2D2A] text-sm">Registrar Nueva Pieza Artesanal</h2>
            <p className="text-xs text-[#6B665F]">Detalla materiales, horas de trabajo y costos para certificar tu pago justo.</p>
          </div>
        </div>

        {!profile && (
          <p className="mb-4 rounded-xl bg-[#FFF7ED] border border-[#C2845D]/30 p-3 text-xs text-[#C2845D]">
            Debe iniciar sesión para poder registrar y publicar productos.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2 text-xs">
          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Nombre del Producto
            <input
              required
              value={productForm.name}
              onChange={(e) => setProductForm((p: any) => ({ ...p, name: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. Blusa bordada de lino"
            />
          </label>

          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Categoría del Producto
            <select
              value={productForm.category}
              onChange={(e) => setProductForm((p: any) => ({ ...p, category: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Precio de Venta Final (MXN)
            <input
              type="number"
              required
              min="1"
              value={productForm.price}
              onChange={(e) => setProductForm((p: any) => ({ ...p, price: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. 850"
            />
          </label>

          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Horas de Trabajo Invertidas
            <input
              type="number"
              required
              min="1"
              value={productForm.craftHours}
              onChange={(e) => setProductForm((p: any) => ({ ...p, craftHours: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. 40"
            />
          </label>

          <div className="md:col-span-2 rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[#6B665F] font-bold uppercase tracking-wider">Materiales utilizados</span>
              <button
                type="button"
                onClick={addMaterial}
                className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-[#5A6A42] border border-[#E6E2DA] cursor-pointer"
              >
                Agregar material
              </button>
            </div>
            <div className="space-y-2">
              {materialItems.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <input
                    required
                    value={item.name}
                    onChange={(e) => updateMaterial(index, { name: e.target.value })}
                    className="rounded-lg border border-[#E6E2DA] bg-white px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
                    placeholder="Material"
                  />
                  <input
                    type="number"
                    min="0"
                    value={item.cost}
                    onChange={(e) => updateMaterial(index, { cost: e.target.value as any })}
                    className="rounded-lg border border-[#E6E2DA] bg-white px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
                    placeholder="Ej. 80"
                  />
                  <button
                    type="button"
                    onClick={() => removeMaterial(index)}
                    className="rounded-lg border border-[#E6E2DA] bg-white px-2 text-[10px] font-bold text-[#A44A3F] cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Productor o Artesano Elaborador
            <select
              value={producerSelectValue}
              disabled={isProducer}
              onChange={(e) => setProductForm((p: any) => ({ ...p, producerId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D] disabled:text-[#2D2D2A] disabled:opacity-100"
            >
              {producerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.community})
                </option>
              ))}
            </select>
            {isProducer && (
              <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-[#8A847C]">
                Las piezas que registres quedan firmadas con tu cuenta.
              </span>
            )}
          </label>

          <div className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Costo de los Materiales ($)
            <div className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#EFEDE7] px-3 py-2 text-xs text-[#2D2D2A]">
              ${materialsCost.toLocaleString("es-MX")} MXN
            </div>
          </div>

          <div className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Pago al productor calculado ($)
            <div className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#EFEDE7] px-3 py-2 text-xs text-[#2D2D2A]">
              ${producerPay.toLocaleString("es-MX")} MXN
              <span className="ml-2 font-normal normal-case tracking-normal text-[#8A847C]">
                Mano de obra: ${laborCost.toLocaleString("es-MX")}
              </span>
            </div>
          </div>

          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Aportación a Fondo Comunitario ($)
            <input
              type="number"
              value={productForm.communityFund}
              min="0"
              onChange={(e) => setProductForm((p: any) => ({ ...p, communityFund: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. 85"
            />
          </label>

          <div className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Comisión de Operación Plataforma (15%)
            <div className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#EFEDE7] px-3 py-2 text-xs text-[#2D2D2A]">
              ${platformCommission.toLocaleString("es-MX")} MXN
            </div>
          </div>

          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Cantidad disponible (Stock)
            <input
              type="number"
              value={productForm.stock}
              min="0"
              onChange={(e) => setProductForm((p: any) => ({ ...p, stock: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
              placeholder="Ej. 3"
            />
          </label>

          <label className="block text-[#6B665F] font-bold uppercase tracking-wider">
            Fotografía del Producto
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []) as File[];
                if (files.length > 0) onImageUpload(files);
                e.currentTarget.value = "";
              }}
              className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] px-3 py-2 text-xs outline-none focus:border-[#C2845D]"
            />
            {imageUrls.length > 0 && (
              <span className="mt-1 flex items-center gap-1 text-[10px] font-normal normal-case tracking-normal text-[#5A6A42]">
                <ImageUp className="h-3 w-3" />
                {imageUrls.length} foto(s) cargada(s) en Supabase
              </span>
            )}
          </label>

          <div className="md:col-span-2 rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[#6B665F] font-bold uppercase tracking-wider">Vista previa</span>
              {imageUrls.length > 0 && (
                <button
                  type="button"
                  onClick={() => setProductForm((p: any) => ({ ...p, image: "", images: [] }))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E6E2DA] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-normal text-[#A44A3F] transition hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Borrar imágenes
                </button>
              )}
            </div>
            <div className="relative overflow-hidden rounded-xl border border-[#E6E2DA] bg-white">
              {imageUrls.length > 0 ? (
                <div className="grid gap-2 p-2 sm:grid-cols-[1.4fr_1fr]">
                  <img
                    src={imageUrls[0]}
                    alt={`Vista previa principal de ${productForm.name || "producto"}`}
                    className="h-64 w-full rounded-lg object-cover"
                  />
                  <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                    {imageUrls.map((imageUrl, index) => (
                      <div key={`${imageUrl}-${index}`} className="relative overflow-hidden rounded-lg border border-[#E6E2DA] bg-[#FAF8F5]">
                        <img
                          src={imageUrl}
                          alt={`Vista previa ${index + 1} de ${productForm.name || "producto"}`}
                          className="h-28 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setProductForm((p: any) => {
                              const nextImages = imageUrls.filter((_, imageIndex) => imageIndex !== index);
                              return { ...p, images: nextImages, image: nextImages[0] || "" };
                            })
                          }
                          className="absolute right-1 top-1 rounded-full bg-white/95 p-1 text-[#A44A3F] shadow-sm transition hover:bg-red-50"
                          aria-label={`Borrar imagen ${index + 1}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 rounded-full bg-[#004d32] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                            Portada
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-[#8A847C]">
                  <ImageUp className="h-8 w-8" />
                  <span className="text-xs font-semibold normal-case tracking-normal">
                    Sube una fotografía para revisar cómo se verá en la tienda.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <label className="mt-3 block text-xs text-[#6B665F] font-bold uppercase tracking-wider">
          Descripción de Elaboración
          <textarea
            required
            value={productForm.description}
            onChange={(e) => setProductForm((p: any) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="mt-1 w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs outline-none font-sans font-normal tracking-normal normal-case focus:border-[#C2845D]"
            placeholder="Describe la simbología, los materiales o algún detalle de la historia de esta pieza..."
          />
        </label>

        <button
          type="submit"
          disabled={!isProducerOrStaff}
          className="mt-4 rounded-xl bg-[#2D2D2A] hover:bg-[#5A6A42] px-4 py-2.5 text-xs font-bold text-white transition-all shadow-xs disabled:cursor-not-allowed disabled:bg-[#CFCAC2] cursor-pointer"
        >
          Registrar Producto
        </button>
      </form>

      <div className="rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xs space-y-3">
        <h3 className="font-serif font-bold text-[#2D2D2A] text-sm">Mis Registros de Piezas</h3>
        <p className="text-[11px] text-[#6B665F] leading-tight">Haz clic en tu pieza registrada para consultar su código de trazabilidad y auditar su línea de tiempo.</p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {visibleProducts.length === 0 ? (
            <p className="text-xs text-[#8A847C] italic">No has registrado piezas todavía.</p>
          ) : (
            visibleProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onTrace(product)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onTrace(product);
                }}
                className="w-full rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-left hover:bg-[#FAF8F5] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-xs text-[#2D2D2A] line-clamp-1">{product.name}</span>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    product.status === "verified" ? "bg-emerald-50 text-[#5A6A42]" : "bg-orange-50 text-[#C2845D]"
                  }`}>
                    {product.status === "verified" ? "Verificado" : "Pendiente"}
                  </span>
                </div>
                <span className="block font-mono text-[9px] text-[#6B665F] mt-1.5 leading-none">
                  TRAZA: {product.traceCode}
                </span>
                <span className={`block mt-1 text-[10px] font-bold ${product.stock > 0 ? "text-[#5A6A42]" : "text-[#A44A3F]"}`}>
                  Existencias: {product.stock}
                </span>
                {product.stock <= 1 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRestock(product.id, 1);
                    }}
                    className="mt-2 rounded-lg bg-[#5A6A42] px-2.5 py-1.5 text-[10px] font-bold text-white cursor-pointer"
                  >
                    Abastecer +1
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[#E6E2DA] pt-4">
          <h3 className="font-serif font-bold text-[#2D2D2A] text-sm flex items-center gap-1.5">
            <ReceiptText className="h-4 w-4 text-[#5A6A42]" />
            Productos que me compraron
          </h3>
          <p className="mt-1 text-[11px] text-[#6B665F] leading-tight">
            Ventas confirmadas por Stripe con pago al productor y acceso a trazabilidad.
          </p>
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
            {soldItems.length === 0 ? (
              <p className="text-xs text-[#8A847C] italic">Aún no hay compras confirmadas de tus piezas.</p>
            ) : (
              soldItems.map(({ order, item, product }) => (
                <div key={`${order.id}-${item.id}`} className="rounded-xl border border-[#E6E2DA] bg-[#FAF8F5] p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#2D2D2A] line-clamp-1">{item.product_name}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-[#6B665F]">
                        Orden #{order.id.slice(0, 8).toUpperCase()} · Cant. {item.quantity}
                      </p>
                      <p className="mt-1 text-[10px] text-[#6B665F]">
                        Cliente: <span className="font-bold text-[#2D2D2A]">{order.customer_name || order.customer_email}</span>
                      </p>
                      {item.review ? (
                        <p className="mt-1 text-[10px] text-[#6B665F]">
                          Productor: <span className="font-bold text-[#C2845D]">{item.review.producerRating || "-"}★</span>
                          {" · "}
                          Entrega: <span className="font-bold text-[#C2845D]">{item.review.deliveryRating || "-"}★</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] text-[#8A847C]">Pendiente de confirmación del cliente</p>
                      )}
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-[#5A6A42]">
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-bold text-[#5A6A42]">${item.producer_pay.toLocaleString("es-MX")} MXN</span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {product && (
                        <>
                          <button
                            type="button"
                            onClick={() => onTrace(product)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E6E2DA] bg-white px-2.5 py-1.5 text-[9px] font-bold uppercase text-[#2D2D2A] hover:bg-[#FAF8F5] cursor-pointer"
                          >
                            <PackageCheck className="h-3 w-3" />
                            Trazabilidad
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadQr(product, order.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#2D2D2A] px-2.5 py-1.5 text-[9px] font-bold uppercase text-white hover:bg-[#5A6A42] cursor-pointer"
                          >
                            <QrCode className="h-3 w-3" />
                            Generar QR
                            <Download className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
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
