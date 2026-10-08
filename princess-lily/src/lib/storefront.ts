import "server-only";
import { effectivePaymentMode } from "./orders";
import { emailConfig } from "./config";

/** Чи активна автоматична видача PDF (провайдер з вебхуком + email). Від цього залежать тексти FAQ. */
export async function pdfDeliveryMode(): Promise<"auto" | "manual"> {
  return (await effectivePaymentMode()) === "provider" && emailConfig().provider !== "none" ? "auto" : "manual";
}
