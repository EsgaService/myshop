import type { PaymentKind } from "./types";

export type ReturnState = "approved" | "pending" | "declined" | "problem" | "unfulfilled" | "unknown" | "unavailable";

export type ReturnView = {
  tone: "success" | "pending" | "danger";
  title: string;
  message: string;
  /** Where the primary link goes: the purchased book, the subscription page, or nowhere. */
  link: "book" | "subscription" | "none";
  autoRefresh: boolean;
};

/** What the payment return page shows for each reconciliation state (UI copy in Spanish). */
export function decideReturnView(input: { state: ReturnState; kind?: PaymentKind }): ReturnView {
  const link: ReturnView["link"] = input.kind === "subscription" ? "subscription" : input.kind === "purchase" ? "book" : "none";
  const isSubscription = input.kind === "subscription";

  switch (input.state) {
    case "approved":
      return {
        tone: "success",
        title: "Pago aprobado",
        message: isSubscription ? "Tu suscripción ya está activa." : "Tu compra quedó registrada y ya puedes abrir tu recetario.",
        link,
        autoRefresh: false,
      };
    case "pending":
      return {
        tone: "pending",
        title: "Estamos confirmando tu pago",
        message: "Tu banco aún no responde. Esta página se actualiza sola; no hace falta que pagues de nuevo.",
        link,
        autoRefresh: true,
      };
    case "unavailable":
      return {
        tone: "pending",
        title: "Estamos confirmando tu pago",
        message: "No pudimos consultar el estado todavía. Esta página se actualiza sola en unos segundos.",
        link,
        autoRefresh: true,
      };
    case "declined":
      return {
        tone: "danger",
        title: "El pago no fue aprobado",
        message: "No se realizó ningún cobro. Puedes intentarlo de nuevo con otro medio de pago.",
        link,
        autoRefresh: false,
      };
    case "unfulfilled":
      return {
        tone: "danger",
        title: "Recibimos tu pago, pero no pudimos habilitar el acceso",
        message: "El producto ya no está disponible. Contacta a soporte con el correo de tu cuenta: te haremos el reembolso. No pagues de nuevo.",
        link: "none",
        autoRefresh: false,
      };
    case "problem":
      return {
        tone: "danger",
        title: "No pudimos verificar tu pago",
        message: "Los datos del pago no coinciden con tu compra. No pagues de nuevo: contacta a soporte con el correo de tu cuenta.",
        link,
        autoRefresh: false,
      };
    default:
      return {
        tone: "danger",
        title: "No encontramos este pago",
        message: "El enlace no corresponde a un pago de tu cuenta. Si acabas de pagar, revisa tu correo o vuelve a abrir el enlace desde Wompi.",
        link: "none",
        autoRefresh: false,
      };
  }
}
