import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata = { title: "Ingresar" };

export default async function BuyerSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthScreen role="buyer" next={next} />;
}
