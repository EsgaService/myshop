import { LegalPage } from "@/components/legal/LegalPage";
import { TERMS } from "@/lib/legal/content";

export const metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
