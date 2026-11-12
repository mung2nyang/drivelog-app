export const SERVER_SAVE_FAIL = '저장에 실패했습니다. 네트워크 상태를 확인해 주세요.'

export const DEVICE_SAVE_FAIL = '저장에 실패했습니다. 휴대폰 저장 공간을 확인해 주세요.'

export const SESSION_CHANGED_FAIL = '로그인 정보가 바뀌어 저장하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'

export const NO_VEHICLE_SAVE_FAIL = '메인 차량이 없어 저장하지 못했습니다. 차량 관리에서 메인 차량을 등록해 주세요.'

export function saveFailMessage(onServer: boolean) {
  return onServer ? SERVER_SAVE_FAIL : DEVICE_SAVE_FAIL
}

const FAILURE_WORDS = ['실패', '못했', '수 없', '지원하지 않', '올바르지 않', '맞지 않', '손상', '오류', '다시 시도']

export function isFailureMessage(message: string) {
  return FAILURE_WORDS.some((word) => message.includes(word))
}
