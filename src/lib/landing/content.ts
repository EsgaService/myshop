import { formatPrice } from "@/lib/format";
import { roleHome } from "@/lib/account/decide-post-login";
import type { AccountRole } from "@/lib/account/decide-role";
import { LEGAL_OWNER } from "@/lib/legal/content";
import { SELLER_PLAN } from "@/lib/seller/decide-subscription";

export type Cta = { label: string; href: string };
type Item = { title: string; text: string };

/**
 * Landing copy (neutral Spanish, tuteo). Payments are described generically as
 * "pasarelas de pago": never name a specific gateway or claim a live integration.
 */
export const LANDING = {
  ctas: {
    sell: { label: "Quiero vender", href: "/vendedor/ingresar" } satisfies Cta,
    login: { label: "Iniciar sesión", href: "/ingresar" } satisfies Cta,
  },
  nav: [
    { label: "Explorar", href: "/explorar" },
    { label: "Precios", href: "#precios" },
  ] satisfies Cta[],
  hero: {
    eyebrow: "Infoproductos digitales",
    title: "Convierte tus recetas en recetarios interactivos y véndelos",
    text: "Sube tu PDF, la IA lo transforma en un recetario interactivo y tú cobras a través de pasarelas de pago, sin montar nada técnico.",
  },
  marquee: ["Cócteles", "Micheladas", "Repostería", "Cocina del día a día", "Panadería", "Platos fuertes", "Bebidas sin alcohol"],
  stepsTitle: "Cómo funciona",
  steps: [
    { title: "Sube tu PDF", text: "Carga el PDF con tus recetas. Cada archivo se convierte en un producto." },
    { title: "La IA lo convierte", text: "Organizamos categorías, ingredientes y pasos en un recetario interactivo listo para leer." },
    { title: "Pon precio y comparte", text: "Define cuánto cuesta, publícalo y comparte tu enlace para empezar a vender." },
  ] satisfies Item[],
  benefitsTitle: "Todo lo que necesitas para vender",
  benefits: [
    { title: "Recetario interactivo", text: "Ingredientes escalables por porciones y lectura cómoda en el celular." },
    { title: "Tu propio enlace", text: "Una tienda con tu nombre y un enlace por cada producto para compartir." },
    { title: "Biblioteca para tus clientes", text: "Quien compra accede siempre a sus recetarios desde su cuenta." },
    { title: "Cobros con pasarelas de pago", text: "Recibe pagos a través de pasarelas de pago, sin configuración técnica." },
    { title: "Sin complicaciones", text: "No necesitas programar ni diseñar: nosotros nos encargamos del formato." },
  ] satisfies Item[],
  pricing: {
    id: "precios",
    eyebrow: "Plan vendedor",
    title: "Un plan simple para vender",
    priceText: `${formatPrice(SELLER_PLAN.amountCents, SELLER_PLAN.currency)} al mes`,
    text: "Hasta 12 productos. Puedes preparar tu tienda antes de suscribirte; para publicar necesitas el plan activo.",
  },
  finalCta: {
    title: "Empieza a vender tus recetarios hoy",
    text: "Crea tu cuenta con Google en segundos.",
  },
  footer: {
    links: [
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Términos y condiciones", href: "/terminos" },
    ] satisfies Cta[],
    owner: {
      text: `Sitio administrado por ${LEGAL_OWNER.name} · CC ${LEGAL_OWNER.documentNumber} · ${LEGAL_OWNER.email}`,
      href: "/terminos",
    },
  },
} as const;

/** Header auth slot: login for anonymous visitors, the role panel otherwise. */
export function landingHomeFor(role: AccountRole | null): Cta {
  if (!role) return LANDING.ctas.login;
  return { label: "Ir a mi panel", href: roleHome(role) };
}
