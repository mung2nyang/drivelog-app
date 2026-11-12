// @ts-check
import { assetPath } from '../../shared/utils/assetPath.ts'

const BANNER = assetPath('/images/banner_image.png')

/**
 * @param {Object} props
 * @param {boolean} [props.inline]
 */
export default function LoadingScreen({ inline = false }) {
  return (
    <div className={`boot-loading${inline ? ' boot-loading-inline' : ''}`} role="status" aria-label="불러오는 중">
      <img src={BANNER} alt="" />
      <span className="boot-loading-name">운행일지</span>
      <span className="boot-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>
    </div>
  )
}
