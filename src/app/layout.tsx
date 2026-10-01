import './globals.css';

export const metadata = {
  title: 'Recall — Anki for LeetCode',
  description: 'Spaced repetition system for DSA problems',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
