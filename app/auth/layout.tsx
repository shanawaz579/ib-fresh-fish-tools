import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fish Trading Tools - Auth",
  description: "Authentication",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
