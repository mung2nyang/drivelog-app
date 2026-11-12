import { EditIcon, DeleteIcon } from './icons.tsx'

export default function CardActionButtons({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) {
  return (
    <>
      <button type="button" className="action-icon-btn" title="수정" onClick={onEdit}>
        <EditIcon />
      </button>
      <button type="button" className="action-icon-btn del" title="삭제" onClick={onDelete}>
        <DeleteIcon />
      </button>
    </>
  )
}
