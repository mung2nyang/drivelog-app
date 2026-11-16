import SwitchRow from '../../../shared/ui/SwitchRow.tsx'
import RoutePresetEditor from './RoutePresetEditor.tsx'
import RunCountChips from './RunCountChips.tsx'
import FixedRouteClientLink from './FixedRouteClientLink.tsx'
import type { SettingsPatch } from '../../../data/sync/settingsSave.ts'
import type { FinanceSettings } from '../../../domain/financeTypes.ts'

type FixedRouteBlockProps = {
  scope: 'main'|'sub'
  clientScopeKey: string
  settings: FinanceSettings
  onPatch: (patch: SettingsPatch) => void|Promise<void>
}

export default function FixedRouteBlock({ scope, clientScopeKey, settings, onPatch }: FixedRouteBlockProps) {
  const isSub = scope === 'sub'
  const fixedOn = isSub ? settings.subFixedOn : settings.fixedOn
  const routeOn = isSub ? settings.subFixedRouteOn : settings.fixedRouteOn
  const runOn = isSub ? settings.subRunCountToggle : settings.runCountToggle

  return (
    <>
      <SwitchRow
        id={isSub ? 'subFixedToggle' : 'fixedToggle'}
        label="고정 노선 사용"
        checked={!!fixedOn}
        onChange={(checked) => onPatch(isSub ? { subFixedOn: checked } : { fixedOn: checked })}
      />
      {fixedOn && (
        <div className="tree-line-group">
          <FixedRouteClientLink scopeKey={clientScopeKey} />
          <SwitchRow
            id={isSub ? 'subFixedRouteToggle' : 'fixedRouteToggle'}
            label="상하차지 사용"
            checked={!!routeOn}
            onChange={(checked) => onPatch(isSub ? { subFixedRouteOn: checked } : { fixedRouteOn: checked })}
          />
          {routeOn && <RoutePresetEditor scope={scope} settings={settings} onPatch={onPatch} />}
          <SwitchRow
            id={isSub ? 'subRunCountToggle' : 'runCountToggle'}
            label="운행 횟수 버튼 사용"
            checked={!!runOn}
            onChange={(checked) => onPatch(isSub ? { subRunCountToggle: checked } : { runCountToggle: checked })}
          />
          {runOn && <RunCountChips scope={scope} settings={settings} onPatch={onPatch} />}
        </div>
      )}
    </>
  )
}
