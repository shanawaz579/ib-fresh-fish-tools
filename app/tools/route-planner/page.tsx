export default function RoutePlanner() {
  return (
    <div className="card p-8">
      <div className="flex items-center gap-3 mb-2">
        <svg width="28" height="28" fill="none" viewBox="0 0 28 28" stroke="currentColor" className="text-primary">
          <circle cx="6" cy="6" r="3" strokeWidth="2" />
          <circle cx="18" cy="18" r="3" strokeWidth="2" />
          <path strokeWidth="2" d="M6 9v6a6 6 0 006 6" />
        </svg>
        <h2 className="text-2xl font-bold text-primary">Route Planner</h2>
      </div>
      <p className="mt-2 text-base text-zinc-600">Plan pickup and delivery routes with time estimates.</p>
      <div className="mt-6 rounded bg-primary/10 p-6 text-primary">Coming soon: route map and optimization settings</div>
    </div>
  );
}
