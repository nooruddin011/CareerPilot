import './globals.css';
import './editorial.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'CareerPilot — Your next move, mapped.', description: 'An AI-powered career pivot coach.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
