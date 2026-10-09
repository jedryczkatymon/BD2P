import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { Header } from "~/components/header";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
	title: "Biblioteka miejska",
	description: "Katalog i wypożyczenia biblioteczne",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${geist.variable}`} lang="pl">
			<body className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
				<TRPCReactProvider>
					<Header />
					{children}
				</TRPCReactProvider>
			</body>
		</html>
	);
}
