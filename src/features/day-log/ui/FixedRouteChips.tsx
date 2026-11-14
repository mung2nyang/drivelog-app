export type RoutePreset = {
  id: string
  loadLoc: string
  unloadLoc: string
}

type FixedRouteChipsProps = {
  routePresets: Array<RoutePreset>
  routeCounts: Record<string, number>
  isOff: boolean
  onRun: (routeId: string, delta: number) => void
}

export default function FixedRouteChips({ routePresets, routeCounts, isOff, onRun }: FixedRouteChipsProps) {
  if (routePresets.length === 0) return null
  return (
    <div className="fixed-route-quick-buttons" aria-label="자주 운행하는 노선 (누르면 운행 횟수 1회 추가)">
      {routePresets.map((route) => {
        const routeCount = routeCounts[route.id] || 0
        return (
          <span key={route.id} className="fixed-route-chip">
            <button
              type="button"
              className="fixed-route-chip-select"
              disabled={isOff}
              onClick={() => onRun(route.id, 1)}
            >
              {route.loadLoc} → {route.unloadLoc}
              {routeCount > 0 && <span className="fixed-route-chip-count">{routeCount}회</span>}
            </button>
            {routeCount > 0 && (
              <button
                type="button"
                className="fixed-route-chip-minus"
                title="한 번 취소"
                aria-label={`${route.loadLoc} → ${route.unloadLoc} 1회 취소`}
                disabled={isOff}
                onClick={() => onRun(route.id, -1)}
              >
                −
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
