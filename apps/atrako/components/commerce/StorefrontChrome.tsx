"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Headphones,
  Instagram,
  MessageCircle,
  Package,
  ShoppingCart,
  User,
} from "lucide-react";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { SearchInput } from "@/components/ui/search-input";
import { cartCount, readStoreCart, type StoreCartLineClient } from "@/lib/commerce/cart-client";
import {
  asStoreTheme,
  instagramHref,
  instagramLabel,
  whatsappHref,
  type StoreTheme,
} from "@/lib/commerce/theme";
import "@/app/loja/storefront.css";

export function StorefrontChrome({
  storeId,
  storeSlug,
  storeName,
  primaryColor,
  categories = [],
  onSearch,
  searchValue,
  freeShippingMinCents,
  theme,
  hero,
  children,
}: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  primaryColor?: string | null;
  categories?: { id: string; name: string; slug: string }[];
  onSearch?: (value: string) => void;
  searchValue?: string;
  freeShippingMinCents?: number | null;
  theme?: StoreTheme | null;
  /** Conteúdo full-bleed entre o header e o conteúdo (ex.: banners). */
  hero?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<StoreCartLineClient[]>([]);
  const [localQ, setLocalQ] = useState(searchValue ?? "");

  useEffect(() => {
    function refresh() {
      setLines(readStoreCart(storeId));
    }
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("atrako-store-cart", onStorage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("atrako-store-cart", onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [storeId]);

  useEffect(() => {
    if (searchValue !== undefined) setLocalQ(searchValue);
  }, [searchValue]);

  const count = cartCount(lines);
  const pathname = usePathname();
  const homeHref = `/loja/${storeSlug}`;
  const todosActive = pathname === homeHref;
  const look = asStoreTheme(theme);
  const freeLabel =
    freeShippingMinCents != null && freeShippingMinCents > 0
      ? `acima de ${(freeShippingMinCents / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}`
      : "em regiões selecionadas";
  const announce = look.announce || `Frete grátis ${freeLabel} · Entrega para todo o Brasil`;
  const instagram = instagramHref(look.instagram);
  const instagramName = instagramLabel(look.instagram);
  const whatsapp = whatsappHref(look.whatsapp);

  return (
    <BrandThemeScope primaryColor={primaryColor} className="store-shell">
      <div className="store-announce">
        <p>{announce}</p>
        <a href={`#vantagens`}>Saiba mais</a>
      </div>

      <header className="store-header">
        <div className="store-header__row">
          <Link href={`/loja/${storeSlug}`} className="store-logo">
            {look.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={look.logoUrl} alt={storeName} />
            ) : (
              storeName
            )}
          </Link>
          <div className="store-search">
            <SearchInput
              size="field"
              value={localQ}
              onChange={(e) => {
                setLocalQ(e.target.value);
                onSearch?.(e.target.value);
              }}
              placeholder="O que deseja procurar?"
              aria-label="Buscar produtos"
            />
          </div>
          <div className="store-utils">
            <a className="store-util" href="#atendimento">
              <Headphones className="h-5 w-5" strokeWidth={1.75} />
              <span>Atendimento</span>
            </a>
            <a className="store-util" href="#atendimento">
              <Package className="h-5 w-5" strokeWidth={1.75} />
              <span>Rastrear pedido</span>
            </a>
            <a className="store-util" href="#atendimento">
              <User className="h-5 w-5" strokeWidth={1.75} />
              <span>Minha Conta</span>
            </a>
            <Link
              href={`/loja/${storeSlug}/carrinho`}
              className="store-util store-util__cart"
              aria-label={`Carrinho com ${count} itens`}
            >
              <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
              <span>Carrinho</span>
              {count > 0 ? <span className="store-util__badge">{count}</span> : null}
            </Link>
          </div>
        </div>
        {categories.length > 0 ? (
          <nav className="store-nav" aria-label="Categorias">
            <div className="store-nav__inner">
              <Link href={homeHref} className={todosActive ? "is-active" : undefined}>
                Todos
              </Link>
              {categories.map((c) => {
                const href = `${homeHref}/c/${c.slug}`;
                return (
                  <Link key={c.id} href={href} className={pathname === href ? "is-active" : undefined}>
                    {c.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      {hero ? <div className="store-hero-bleed">{hero}</div> : null}

      <main className="store-main">{children}</main>

      <footer className="store-footer">
        {instagram && instagramName ? (
          <div className="store-footer__ig">
            Fique por dentro das novidades, nos siga no Instagram! <strong>{instagramName}</strong>
          </div>
        ) : null}
        <div className="store-footer__grid">
          <div>
            <p className="store-footer__brand">{storeName}</p>
            {look.about ? <p>{look.about}</p> : null}
          </div>
          <div>
            <h3>Institucional</h3>
            <ul>
              <li>
                <a href="#atendimento">Sobre a empresa</a>
              </li>
              <li>
                <a href="#vantagens">Como comprar</a>
              </li>
              <li>
                <a href="#vantagens">Envio</a>
              </li>
              <li>
                <a href="#vantagens">Pagamento</a>
              </li>
              <li>
                <a href="#atendimento">Trocas e devoluções</a>
              </li>
              <li>
                <a href="#atendimento">Fale conosco</a>
              </li>
            </ul>
          </div>
          <div id="atendimento">
            <h3>Atendimento</h3>
            <ul>
              {whatsapp ? (
                <li>
                  <a href={whatsapp} target="_blank" rel="noreferrer">
                    WhatsApp · vendas e suporte
                  </a>
                </li>
              ) : null}
              {look.email ? (
                <li>
                  <a href={`mailto:${look.email}`}>E-mail · {look.email}</a>
                </li>
              ) : null}
            </ul>
            {look.hours ? (
              <p style={{ marginTop: "0.75rem" }}>
                <strong style={{ color: "var(--ink)" }}>Horário</strong>
                <br />
                {look.hours}
              </p>
            ) : null}
          </div>
          <div>
            <h3>Formas de pagamento</h3>
            <p>Pix, cartão em até 3x sem juros (via Mercado Pago).</p>
            <h3 style={{ marginTop: "1rem" }}>Segurança</h3>
            <p>Checkout Atrako com Mercado Pago conectado à loja.</p>
          </div>
        </div>
        <div className="store-footer__bar">
          {storeName}. E-commerce especializado · Tecnologia Atrako
        </div>
      </footer>

      {instagram ? (
        <a
          className="store-float store-float--ig"
          href={instagram}
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
        >
          <Instagram className="h-5 w-5" strokeWidth={1.75} />
        </a>
      ) : null}
      {whatsapp ? (
        <a
          className="store-float store-float--wa"
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-5 w-5" strokeWidth={1.75} color="#fff" fill="#fff" />
        </a>
      ) : null}
    </BrandThemeScope>
  );
}
