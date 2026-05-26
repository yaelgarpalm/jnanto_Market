import React from "react";
import { ChevronDown, Filter, Heart, Search, SlidersHorizontal, Sparkles, Truck } from "lucide-react";
import { Product } from "../types";
import ProductCard from "../components/ProductCard";

interface MarketplaceViewProps {
  loading: boolean;
  products: Product[];
  category: string;
  search: string;
  filters: {
    sort: "recent" | "price_asc" | "price_desc" | "stock_desc";
    maxPrice: "all" | "500" | "1000" | "1500";
    material: "all" | string;
    onlyAvailable: boolean;
    minProducerShare: "all" | "60" | "70";
  };
  setCategory: (value: string) => void;
  setSearch: (value: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<MarketplaceViewProps["filters"]>>;
  onSelect: (product: Product) => void;
  onAdd: (product: Product) => void;
}

const categories = [
  "Todos",
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

const FALLBACK_IMAGE = "https://liviaes.com/wp-content/uploads/2022/10/Blusa-azul-borado-de-cadenilla-y-flores.jpg";

function repeatProducts(products: Product[], count: number) {
  if (products.length === 0) return [];
  return Array.from({ length: count }, (_, index) => products[index % products.length]);
}

export default function MarketplaceView({
  loading,
  products,
  category,
  search,
  filters,
  setCategory,
  setSearch,
  setFilters,
  onSelect,
  onAdd,
}: MarketplaceViewProps) {
  const featuredProduct = products[0];
  const catalogProducts = products.slice(0, 8);
  const similarItems = repeatProducts(products.slice(1).length ? products.slice(1) : products, 4);
  const recentlyViewed = repeatProducts(products, 4);
  const materialOptions = Array.from(new Set(products.flatMap((product) => product.materials))).filter(Boolean).slice(0, 8);
  const hasActiveFilters = Boolean(
    category !== "Todos" ||
    search.trim() ||
    filters.maxPrice !== "all" ||
    filters.material !== "all" ||
    filters.onlyAvailable ||
    filters.minProducerShare !== "all" ||
    filters.sort !== "recent",
  );

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-md bg-[#f8eadb]">
        <div className="grid min-h-[300px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-[#004d32]">
              <Sparkles className="h-3.5 w-3.5 text-[#f0a51f]" />
              Comercio justo certificado
            </div>
            <h2 className="mt-6 max-w-xl text-4xl font-black leading-[1.05] tracking-normal text-[#004d32] sm:text-5xl">
              Hasta 50% en piezas seleccionadas
            </h2>
            <p className="mt-4 max-w-lg text-sm font-medium leading-6 text-[#5a625d]">
              Artesania Jnatjo con origen verificable, stock real y pago directo al productor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#catalogo"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#004d32] px-7 text-sm font-black text-white transition hover:bg-[#063f2c]"
              >
                Comprar ahora
              </a>
              <button className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#101815] transition hover:bg-[#f8f8f4]">
                <Truck className="h-4 w-4 text-[#d47827]" />
                Entrega segura
              </button>
            </div>
          </div>

          <div className="relative min-h-[300px] bg-[#f4dfce]">
            {featuredProduct ? (
              <>
                <div className="absolute inset-y-8 right-8 left-8 rounded-full bg-white/45" />
                <img
                  src={featuredProduct.image}
                  alt={featuredProduct.name}
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    if (event.currentTarget.src !== FALLBACK_IMAGE) event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                  className="relative z-10 h-full w-full object-cover object-center"
                />
                <div className="absolute bottom-6 left-6 right-6 z-20 rounded-md bg-white/92 p-4 shadow-[0_20px_45px_rgba(16,24,21,0.12)] sm:left-auto sm:w-[320px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase text-[#f0a51f]">Producto destacado</p>
                      <h3 className="mt-1 line-clamp-1 text-lg font-black text-[#101815]">{featuredProduct.name}</h3>
                    </div>
                    <span className="text-lg font-black text-[#101815]">${featuredProduct.price.toLocaleString("es-MX")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(featuredProduct)}
                    className="mt-4 h-10 w-full rounded-full bg-[#004d32] text-sm font-black text-white transition hover:bg-[#063f2c]"
                  >
                    Agregar al carrito
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-bold text-[#5a625d]">
                Catalogo en preparacion
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="catalogo" className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[#101815]">Piezas para ti</h2>
            <p className="mt-1 text-sm font-medium text-[#69736d]">{products.length} productos disponibles</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block sm:w-[280px] lg:hidden">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69736d]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-full border border-black/10 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-[#101815] outline-none transition focus:border-[#004d32]"
                placeholder="Buscar producto"
              />
            </label>
            <select
              value={filters.sort}
              onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value as typeof filters.sort }))}
              className="h-11 rounded-full border border-black/10 bg-white px-4 text-sm font-black text-[#101815] outline-none transition focus:border-[#004d32]"
            >
              <option value="recent">Orden reciente</option>
              <option value="price_asc">Precio menor</option>
              <option value="price_desc">Precio mayor</option>
              <option value="stock_desc">Más existencias</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("Todos");
                setFilters({
                  sort: "recent",
                  maxPrice: "all",
                  material: "all",
                  onlyAvailable: false,
                  minProducerShare: "all",
                });
              }}
              disabled={!hasActiveFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-black text-[#101815] transition hover:border-[#004d32] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Limpiar filtros
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-full border border-transparent bg-[#eef0ed] px-4 text-xs font-black text-[#101815] outline-none transition focus:border-[#004d32] focus:bg-white"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filters.maxPrice}
            onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value as typeof filters.maxPrice }))}
            className="h-10 rounded-full border border-transparent bg-[#eef0ed] px-4 text-xs font-black text-[#101815] outline-none transition focus:border-[#004d32] focus:bg-white"
          >
            <option value="all">Todos los precios</option>
            <option value="500">Hasta $500</option>
            <option value="1000">Hasta $1,000</option>
            <option value="1500">Hasta $1,500</option>
          </select>

          <select
            value={filters.material}
            onChange={(event) => setFilters((prev) => ({ ...prev, material: event.target.value }))}
            className="h-10 rounded-full border border-transparent bg-[#eef0ed] px-4 text-xs font-black text-[#101815] outline-none transition focus:border-[#004d32] focus:bg-white"
          >
            <option value="all">Todos los materiales</option>
            {materialOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filters.minProducerShare}
            onChange={(event) => setFilters((prev) => ({ ...prev, minProducerShare: event.target.value as typeof filters.minProducerShare }))}
            className="h-10 rounded-full border border-transparent bg-[#eef0ed] px-4 text-xs font-black text-[#101815] outline-none transition focus:border-[#004d32] focus:bg-white"
          >
            <option value="all">Todos los pagos</option>
            <option value="60">60% o más</option>
            <option value="70">70% o más</option>
          </select>

          <label
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-black transition ${
              filters.onlyAvailable ? "bg-[#004d32] text-white" : "bg-[#eef0ed] text-[#101815]"
            }`}
          >
            <input
              type="checkbox"
              checked={filters.onlyAvailable}
              onChange={(event) => setFilters((prev) => ({ ...prev, onlyAvailable: event.target.checked }))}
              className="h-3.5 w-3.5 accent-[#004d32]"
            />
            Disponibles
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-md border border-black/10 bg-white py-16 text-xs font-black uppercase tracking-wide text-[#69736d]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#004d32] border-t-transparent" />
            Cargando catalogo
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-md border border-black/10 bg-white p-10 text-center">
            <Filter className="mx-auto h-8 w-8 text-[#004d32]" />
            <p className="mt-3 text-sm font-bold text-[#101815]">No se encontraron productos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
            {catalogProducts.map((product, index) => (
              <ProductCard
                key={`${product.id}-${index}`}
                product={product}
                onSelect={onSelect}
                onAddToCart={onAdd}
              />
            ))}
          </div>
        )}
      </section>

      {products.length > 0 && (
        <section className="space-y-12 border-t border-black/10 pt-10">
          <div>
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-[#101815]">Similar que te puede gustar</h2>
              <Heart className="h-5 w-5 text-[#004d32]" />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
              {similarItems.map((product, index) => (
                <ProductCard
                  key={`similar-${product.id}-${index}`}
                  product={product}
                  onSelect={onSelect}
                  onAddToCart={onAdd}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-6 text-2xl font-black text-[#101815]">Vistos recientemente</h2>
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
              {recentlyViewed.map((product, index) => (
                <ProductCard
                  key={`recent-${product.id}-${index}`}
                  product={product}
                  onSelect={onSelect}
                  onAddToCart={onAdd}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
