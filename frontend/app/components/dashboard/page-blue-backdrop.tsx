/**
 * Light decorative blue tint behind dashboard-style pages (non-interactive).
 */
export function PageBlueBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-0 h-[min(260px,34vh)] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-[14%] rounded-full bg-blue-500/24 blur-[115px] dark:bg-blue-400/20" />
      <div className="absolute left-1/2 top-[min(6vh,56px)] h-[min(160px,22vh)] w-[min(75vw,560px)] -translate-x-1/2 rounded-full bg-sky-400/18 blur-[100px] dark:bg-sky-500/15" />
      <div className="absolute -left-[12%] top-[14%] h-[min(240px,32vh)] w-[min(320px,38vw)] rounded-full bg-blue-500/18 blur-[115px] dark:bg-blue-500/16" />
      <div className="absolute -right-[12%] top-[20%] h-[min(240px,32vh)] w-[min(320px,38vw)] rounded-full bg-sky-400/20 blur-[115px] dark:bg-sky-500/16" />
    </div>
  )
}
