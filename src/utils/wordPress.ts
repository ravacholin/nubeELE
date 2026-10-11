/** Distinguish opening a word card from holding to keep or renew that word. */
export function createWordPress(onHold: (id: string) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: { id: string; x: number; y: number; held: boolean; moved: boolean } | null = null;
  let suppressClick = false;
  const end = () => {
    clearTimeout(timer);
    active = null;
  };

  return {
    start(id: string, x: number, y: number) {
      end();
      suppressClick = false;
      const press = { id, x, y, held: false, moved: false };
      active = press;
      timer = setTimeout(() => {
        if (active !== press || press.moved) return;
        press.held = true;
        suppressClick = true;
        onHold(id);
      }, 500);
    },
    move(x: number, y: number) {
      if (!active) return false;
      if (Math.hypot(x - active.x, y - active.y) > 10) {
        active.moved = true;
        suppressClick = true;
        clearTimeout(timer);
      }
      return active.moved && !active.held;
    },
    end,
    cancel() {
      if (active) suppressClick = true;
      end();
    },
    allowClick() {
      const allowed = !suppressClick;
      suppressClick = false;
      return allowed;
    },
  };
}
