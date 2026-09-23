import type { Metadata } from "next";
import "@/app/globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

const themeScript = `
(function() {
  var v = localStorage.getItem('crm-theme');
  if (v === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
})();
`;

export const metadata: Metadata = {
  title: "CRM",
  description: "CRM para gestão de leads e atendimento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
