import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[60vh] w-full">
      <main className="mx-auto max-w-5xl p-8">
        <div className="flex items-center gap-6 pb-4">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow">
            {/* Brand icon */}
            <svg width="28" height="28" fill="none" viewBox="0 0 28 28" stroke="white">
              <circle cx="14" cy="14" r="13" strokeWidth="2" />
              <path strokeWidth="2" d="M8 16c2-2 6-2 8 0" />
              <path strokeWidth="2" d="M14 10v4" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">IB Fresh Fish — Tools Platform</h1>
            <p className="mt-1 text-base text-gray-600 dark:text-gray-400">Nellore freshwater fish trading and logistics tools.</p>
          </div>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <a href="/tools/price-manager" className="card group flex flex-col gap-2 p-6 hover:shadow-lg hover:scale-105 transition">
            <h3 className="text-xl font-semibold group-hover:text-primary transition">Price Manager</h3>
            <p className="text-sm text-gray-500">Manage prices per species and destination</p>
            <span className="mt-2 inline-block w-fit rounded bg-primary/10 px-3 py-1 text-xs text-primary">Coming soon</span>
          </a>

          <a href="/tools/route-planner" className="card group flex flex-col gap-2 p-6 hover:shadow-lg hover:scale-105 transition">
            <h3 className="text-xl font-semibold group-hover:text-primary transition">Route Planner</h3>
            <p className="text-sm text-gray-500">Plan pickups and delivery routes.</p>
            <span className="mt-2 inline-block w-fit rounded bg-primary/10 px-3 py-1 text-xs text-primary">Coming soon</span>
          </a>

          <a href="/tools/inventory" className="card group flex flex-col gap-2 p-6 hover:shadow-lg hover:scale-105 transition">
            <h3 className="text-xl font-semibold group-hover:text-primary transition">Inventory</h3>
            <p className="text-sm text-gray-500">Track stock at ponds and warehouses.</p>
            <span className="mt-2 inline-block w-fit rounded bg-primary/10 px-3 py-1 text-xs text-primary">Coming soon</span>
          </a>
        </div>
      </main>
    </div>
  );
}
