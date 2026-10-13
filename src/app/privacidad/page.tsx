import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY } from "@/lib/legal/content";

export const metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
