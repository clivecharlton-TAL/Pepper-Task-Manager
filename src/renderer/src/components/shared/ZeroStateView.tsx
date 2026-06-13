import { useState } from 'react'
import { useTaskStore } from '../../stores/taskStore'

import img01 from '../../assets/zero-state/01-milky-way-mountains.jpg'
import img02 from '../../assets/zero-state/02-iceland-volcanic-peaks.jpg'
import img03 from '../../assets/zero-state/03-aurora-mountains.jpg'
import img04 from '../../assets/zero-state/04-owl-fog.jpg'
import img05 from '../../assets/zero-state/05-bunker-tunnel.jpg'
import img06 from '../../assets/zero-state/06-viaduc-bridge.jpg'
import img07 from '../../assets/zero-state/07-corridor-red.jpg'

const IMAGES = [img01, img02, img03, img04, img05, img06, img07]

export default function ZeroStateView() {
  const [image] = useState(() => IMAGES[Math.floor(Math.random() * IMAGES.length)])
  const { activeLabel, activeStatus, activePriority, activeDue, searchQuery } = useTaskStore()
  const hasFilter = !!(activeLabel || activeStatus || activePriority || activeDue || searchQuery)

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />

      {/* Scrim — ensures text legibility across all images */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.42)' }} />

      {/* Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {hasFilter ? 'no results' : 'all clear'}
        </p>
        <h1 className="text-[28px] font-light tracking-[-0.02em]" style={{ color: 'rgba(255,255,255,0.82)' }}>
          {hasFilter ? 'Nothing here.' : "You're all done."}
        </h1>
        <p className="font-mono text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.22)' }}>
          {hasFilter ? 'Try adjusting your filters.' : 'Enjoy the view.'}
        </p>
      </div>
    </div>
  )
}
