export const metadata = {
  title: "Image Management System",
  description: "Upload and search images",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // IMPORTANT: import AFTER the export, so Next includes it in the root
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-background">{children}</body>
    </html>
  );
}

// import global styles (Tailwind)
import "./global.css";
