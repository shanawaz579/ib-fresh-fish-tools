export default function PriceManager() {
  return (
    <div className="card p-8">
      <div className="flex items-center gap-3 mb-2">
        <svg width="28" height="28" fill="none" viewBox="0 0 28 28" stroke="currentColor" className="text-primary">
          <path strokeWidth="2" d="M12 8v8m0 0l-3-3m3 3l3-3" />
        </svg>
        <h2 className="text-2xl font-bold text-primary">Price Manager</h2>
      </div>
      <p className="mt-2 text-base text-zinc-600">Create and edit prices and price lists for species and regions.</p>
      <div className="mt-6 rounded bg-primary/10 p-6 text-primary">Coming soon: price editor & CSV import</div>
    </div>
  );
}
