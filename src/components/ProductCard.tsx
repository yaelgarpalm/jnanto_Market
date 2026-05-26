import React, { useState } from "react";
import { Heart, Leaf, ShoppingCart, Star } from "lucide-react";
import { Product } from "../types";

interface ProductCardProps {
  key?: string | number;
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  featured?: boolean;
}

const FALLBACK_IMAGE = "https://liviaes.com/wp-content/uploads/2022/10/Blusa-azul-borado-de-cadenilla-y-flores.jpg";

export default function ProductCard({ product, onSelect, onAddToCart, featured = false }: ProductCardProps) {
  const [liked, setLiked] = useState(false);
  const producerShare = product.breakdown.materialsCost + product.breakdown.laborCost;
  const producerPercent = Math.round((producerShare / product.price) * 100);
  const rating = Number(product.rating || 0);
  const reviewCount = Number(product.reviewCount || 0);
  const roundedRating = Math.round(rating);

  return (
    <article
      id={`product-card-${product.id}`}
      className={`group grid h-full content-start gap-3 ${featured ? "sm:grid-cols-[180px_1fr] sm:items-center" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(product)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onSelect(product);
        }}
        className={`relative w-full overflow-hidden rounded-md bg-[#f5f5f3] transition duration-300 group-hover:bg-[#f0f1ee] ${
          featured ? "aspect-square" : "aspect-[1.08/1]"
        }`}
        aria-label={`Ver origen de ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          onError={(event) => {
            if (event.currentTarget.src !== FALLBACK_IMAGE) event.currentTarget.src = FALLBACK_IMAGE;
          }}
          className="h-full w-full object-cover p-5 transition duration-500 group-hover:scale-[1.035]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black text-[#004d32] shadow-sm">
          {product.stock > 0 ? `${product.stock} disp.` : "Agotado"}
        </span>
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#4d5b55] shadow-sm">
          <Leaf className="h-3 w-3 text-[#11a652]" />
          {producerPercent}% directo
        </span>
        <button
          type="button"
          id={`like-btn-${product.id}`}
          onClick={(event) => {
            event.stopPropagation();
            setLiked((value) => !value);
          }}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#101815] shadow-sm transition hover:text-[#004d32]"
          aria-label={liked ? "Quitar favorito" : "Agregar favorito"}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-[#004d32] text-[#004d32]" : ""}`} />
        </button>
      </div>

      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="line-clamp-1 text-left text-base font-black leading-tight text-[#101815] transition hover:text-[#004d32]"
            >
              {product.name}
            </button>
            <p className="mt-1 line-clamp-1 text-xs font-medium text-[#5e6963]">{product.description}</p>
          </div>
          <span className="shrink-0 text-sm font-black text-[#101815]">${product.price.toLocaleString("es-MX")}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[#11a652]" aria-label={reviewCount > 0 ? `Calificacion ${rating} estrellas` : "Sin reseñas"}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className={`h-3.5 w-3.5 ${index < roundedRating ? "fill-current" : "text-[#c8cec9]"}`} />
            ))}
            <span className="ml-1 text-[11px] font-semibold text-[#5e6963]">
              {reviewCount > 0 ? `${rating.toFixed(1)} (${reviewCount})` : "Sin reseñas"}
            </span>
          </div>
          <span className="rounded-full bg-[#f4f5f3] px-2 py-1 text-[10px] font-bold text-[#5e6963]">
            {product.category}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            id={`detail-btn-${product.id}`}
            onClick={() => onSelect(product)}
            className="text-xs font-bold text-[#004d32] underline-offset-4 transition hover:underline"
          >
            Ver origen
          </button>
          <button
            type="button"
            id={`buy-btn-${product.id}`}
            disabled={product.stock === 0}
            onClick={() => onAddToCart(product)}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-black transition ${
              product.stock === 0
                ? "cursor-not-allowed border-[#d8d8d2] bg-[#eeeeea] text-[#9b9f99]"
                : "border-[#101815] bg-white text-[#101815] hover:border-[#004d32] hover:bg-[#004d32] hover:text-white"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Agregar
          </button>
        </div>
      </div>
    </article>
  );
}
