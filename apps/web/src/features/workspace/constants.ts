export const LAYOUT_STORAGE_KEY = 'archsim:layout';

export const PANEL_LAYOUT = {
  blocks: {
    id: 'blocks',
    defaultSize: '16rem',
    minSize: '12rem',
    maxSize: '28rem',
  },
  canvas: { id: 'canvas', minSize: '30%' },
  params: {
    id: 'params',
    defaultSize: '18rem',
    minSize: '15rem',
    maxSize: '30rem',
  },
} as const;

export const CANVAS_LAYOUT_STORAGE_KEY = 'archsim:layout:canvas';

export const CANVAS_LAYOUT = {
  diagram: { id: 'diagram', minSize: '30%' },
  simulation: {
    id: 'simulation',
    defaultSize: '13rem',
    minSize: '13rem',
    maxSize: '24rem',
  },
} as const;

export const PANEL_COLLAPSED_SIZE = 0;
