let holders = 0;

export const holdSwipe = () => {
  holders += 1;
};

export const releaseSwipe = () => {
  holders = Math.max(0, holders - 1);
};

export const swipeHeld = () => holders > 0;
