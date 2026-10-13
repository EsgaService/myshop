import { AuthScreen } from "@/components/auth/AuthScreen";
import { parseAuthMode } from "@/lib/auth/auth-mode";

export const metadata = { title: "Ingresar como vendedor" };

export default async function SellerSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; modo?: string | string[]; aviso?: string }>;
}) {
  const { next, modo, aviso } = await searchParams;
  return <AuthScreen role="seller" mode={parseAuthMode(modo)} next={next} aviso={aviso} />;
}
