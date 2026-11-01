import './globals.css';

export const metadata = {
  title: 'FJ-TECH | Intelligent AI Command Center',
  description:
    'Next-Generation White-Label AI Voice Call Agents & Omnichannel Chatbot Command Center by FJ-Tech Solutions'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-[#635BFF] selection:text-white">
        {children}
      </body>
    </html>
  );
}

