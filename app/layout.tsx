import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "Linux Policy Platform",
  description: "CMMC-style policy panel for Linux"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
