import { StarIcon } from '../../../shared/ui/icons.tsx'
import './location-shortcuts.css'

type LocationShortcutsProps = {
  locations: Array<string>
  pinnedLocations: Array<string>
  onSelect: (location: string) => void
  onTogglePin: (location: string) => void
}

export default function LocationShortcuts({ locations, pinnedLocations, onSelect, onTogglePin }: LocationShortcutsProps) {
  if (!locations.length) return null
  const pinned = new Set(pinnedLocations)

  return (
    <div className="location-shortcuts">
      {locations.map((location) => {
        const isPinned = pinned.has(location)
        return (
          <span key={location} className={`location-chip${isPinned ? ' pinned' : ''}`}>
            <button type="button" className="location-chip-select" onClick={() => onSelect(location)}>
              {location}
            </button>
            <button
              type="button"
              className="location-chip-pin"
              title={isPinned ? '고정 해제' : '장소 고정'}
              aria-label={`${location} ${isPinned ? '고정 해제' : '장소 고정'}`}
              onClick={() => onTogglePin(location)}
            >
              <StarIcon filled={isPinned} />
            </button>
          </span>
        )
      })}
    </div>
  )
}
