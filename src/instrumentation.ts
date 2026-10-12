import { paymentsBootIssue } from "@/lib/payments/boot-check";

/**
 * Runs once on server boot. Logs loudly instead of crashing, so a misconfigured
 * environment fails closed (payments refused) without taking the whole site down.
 */
export function register() {
  const issue = paymentsBootIssue(process.env);
  if (issue) console.error(`[config] ${issue}`);
}
