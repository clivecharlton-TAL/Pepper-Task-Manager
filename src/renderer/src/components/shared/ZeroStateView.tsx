import { useTaskStore } from '../../stores/taskStore'

// Deterministic star field using golden-ratio (Halton sequence)
const STARS = Array.from({ length: 75 }, (_, i) => ({
  cx: ((i * 0.6180339887498949) % 1) * 1185 + 7,
  cy: ((i * 0.3819660112501051) % 1) * 268 + 8,
  r:  [0.45, 0.65, 0.85, 1.05, 1.45][i % 5],
  opacity: [0.25, 0.45, 0.65, 0.85, 1.0][i % 5],
  twinkle: i % 8 === 3,
  delay: `${(i % 5) * 0.9}s`,
}))

export default function ZeroStateView() {
  const { activeLabel, activeStatus, activePriority, activeDue, searchQuery } = useTaskStore()
  const hasFilter = !!(activeLabel || activeStatus || activePriority || activeDue || searchQuery)

  return (
    <div className="flex-1 relative overflow-hidden">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <linearGradient id="zs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#05070e" />
            <stop offset="55%"  stopColor="#080c18" />
            <stop offset="100%" stopColor="#0b1020" />
          </linearGradient>
          <radialGradient id="zs-moon-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#c8d4e8" stopOpacity="0.85" />
            <stop offset="28%"  stopColor="#98b0d0" stopOpacity="0.40" />
            <stop offset="65%"  stopColor="#6090c0" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#4a9eca" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="zs-aurora-g" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#4caf82" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#4caf82" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="zs-aurora-b" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#4a9eca" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#4a9eca" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sky gradient */}
        <rect width="1200" height="600" fill="url(#zs-sky)" />

        {/* Aurora glows */}
        <ellipse cx="480" cy="340" rx="400" ry="170" fill="url(#zs-aurora-g)" className="zero-aurora-a" />
        <ellipse cx="760" cy="300" rx="340" ry="140" fill="url(#zs-aurora-b)" className="zero-aurora-b" />

        {/* Stars */}
        {STARS.map((s, i) =>
          s.twinkle
            ? <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#dde4ed" className="zero-twinkle" style={{ animationDelay: s.delay }} />
            : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#dde4ed" opacity={s.opacity} />
        )}

        {/* Moon: soft halo + disc */}
        <circle cx="598" cy="142" r="88"  fill="url(#zs-moon-halo)" />
        <circle cx="598" cy="142" r="26"  fill="#d8dfe8" opacity="0.80" />

        {/* Mountain range — back (most distant) */}
        <path
          d="M0,600 L0,320 L40,308 L90,285 L130,255 L175,275 L220,240 L265,260
             L310,220 L355,205 L400,195 L445,208 L490,175 L540,162 L580,170
             L620,155 L660,168 L700,148 L745,140 L790,155 L830,138 L875,148
             L920,128 L965,142 L1015,120 L1060,125 L1100,140 L1140,118
             L1175,135 L1200,148 L1200,600 Z"
          fill="#141a26"
        />

        {/* Mountain range — mid */}
        <path
          d="M0,600 L0,430 L55,408 L115,390 L170,408 L225,375 L280,395
             L335,358 L390,380 L445,345 L500,365 L555,332 L605,352 L650,318
             L695,335 L740,305 L785,325 L830,292 L875,312 L920,280 L960,298
             L1005,268 L1050,285 L1095,260 L1140,278 L1180,250 L1200,265
             L1200,600 Z"
          fill="#0c1018"
        />

        {/* Mountain range — front (closest) */}
        <path
          d="M0,600 L0,492 L65,468 L125,480 L185,455 L245,470 L305,442
             L365,458 L425,428 L475,445 L530,415 L585,432 L640,402 L695,420
             L750,392 L800,408 L855,380 L905,397 L958,368 L1010,388
             L1060,360 L1110,378 L1160,352 L1200,370 L1200,600 Z"
          fill="#07080f"
        />
      </svg>

      {/* Overlay text — floats in the clear sky above the mountains */}
      <div className="absolute inset-0 flex flex-col items-center" style={{ paddingTop: '26%' }}>
        <p className="font-mono text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: '#3d4f6a' }}>
          {hasFilter ? 'no results' : 'all clear'}
        </p>
        <h1 className="text-[28px] font-light tracking-[-0.02em]" style={{ color: '#8a98ae' }}>
          {hasFilter ? 'Nothing here.' : "You're all done."}
        </h1>
        <p className="font-mono text-[10px] mt-3" style={{ color: '#242e40' }}>
          {hasFilter ? 'Try adjusting your filters.' : 'Enjoy the view.'}
        </p>
      </div>
    </div>
  )
}
