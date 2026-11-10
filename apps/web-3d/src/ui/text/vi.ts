export const vi = {
  app: {
    title: 'Netverse 3D',
    description: 'Tiệm net 3D của Netverse',
    stageLabel: 'Tiệm net 3D',
  },
  hud: {
    fps: 'FPS',
    calls: 'lời gọi vẽ',
    triangles: 'tam giác',
    shop: 'Tiệm',
    quality: 'Chất lượng',
  },
  quality: {
    low: 'thấp',
    medium: 'vừa',
    high: 'cao',
  },
  seat: {
    key: 'E',
    prompt: 'Nhấn E để ngồi vào máy',
    sit: 'Ngồi vào máy',
    standPrompt: 'Nhấn E để đứng dậy',
    stand: 'Đứng dậy',
    denied: {
      occupied: 'Máy này đang có người ngồi',
      too_far: 'Đứng gần máy hơn rồi thử lại',
      no_balance: 'Không đủ số dư để thuê máy',
    },
    roomError: 'Phòng chưa nhận được yêu cầu, thử lại sau',
  },
  status: {
    loading: 'Đang tải tiệm…',
    ready: 'Sẵn sàng',
    restored: 'Đã dựng lại sau khi mất ngữ cảnh',
    lost: 'Mất ngữ cảnh WebGL, đang chờ khôi phục',
    error: (reason: string) => `Không vẽ được tiệm: ${reason}`,
  },
} as const;
