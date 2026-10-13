import { AuthScreen } from "@/components/auth/AuthScreen";
import { parseAuthMode } from "@/lib/auth/auth-mode";

export const metadata = { title: "Ingresar" };

export default async function BuyerSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; modo?: string | string[]; aviso?: string }>;
}) {
  const { next, modo, aviso } = await searchParams;
  return <AuthScreen role="buyer" mode={parseAuthMode(modo)} next={next} aviso={aviso} />;
}
