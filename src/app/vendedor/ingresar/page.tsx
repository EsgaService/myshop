import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata = { title: "Ingresar como vendedor" };

export default async function SellerSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthScreen role="seller" next={next} />;
}
