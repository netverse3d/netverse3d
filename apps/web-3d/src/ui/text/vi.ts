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
  status: {
    loading: 'Đang tải tiệm…',
    ready: 'Sẵn sàng',
    restored: 'Đã dựng lại sau khi mất ngữ cảnh',
    lost: 'Mất ngữ cảnh WebGL, đang chờ khôi phục',
    error: (reason: string) => `Không vẽ được tiệm: ${reason}`,
  },
} as const;
