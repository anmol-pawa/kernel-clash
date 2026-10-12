import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="font-pixel text-2xl text-[#ff5c8a] pixel-shadow">SEGFAULT</div>
      <p className="gb-box max-w-sm p-4 font-pixel text-[11px] leading-6">Page not mapped: this address has no valid page-table entry.</p>
      <Link href="/" className="font-pixel text-xs text-white underline">
        Back to title
      </Link>
    </main>
  );
}
