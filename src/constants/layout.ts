export const TAB_BAR_BASE_HEIGHT = 68;
export const TAB_BAR_FLOATING_OFFSET = 8;
export const TAB_SCREEN_BOTTOM_GAP = 24;
export const FLOATING_TAB_BAR_HEIGHT = TAB_BAR_BASE_HEIGHT + TAB_BAR_FLOATING_OFFSET;

export const getTabScreenBottomInset = (bottomInset: number) =>
  FLOATING_TAB_BAR_HEIGHT + bottomInset + TAB_SCREEN_BOTTOM_GAP;

export const getBottomSheetPadding = (bottomInset: number, extra = 16) =>
  Math.max(bottomInset + extra, extra);
