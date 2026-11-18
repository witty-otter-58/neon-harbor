// Keyboard + mouse input, shared by the live game and the screenshot autopilot.
export function createInput(canvas) {
  const input = {
    up: false, down: false, left: false, right: false,
    action: false, mouseDown: false, interact: false, reload: false,
    mouseX: null, mouseY: null,
    onKey: null,
  };
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    sync();
    if (e.code === 'KeyE') input.interact = true;
    if (e.code === 'KeyR') input.reload = true;
    if (e.code === 'Space') { input.action = true; e.preventDefault(); }
    if (input.onKey) input.onKey(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    sync();
  });
  function sync() {
    input.up = !!(keys.KeyW || keys.ArrowUp);
    input.down = !!(keys.KeyS || keys.ArrowDown);
    input.left = !!(keys.KeyA || keys.ArrowLeft);
    input.right = !!(keys.KeyD || keys.ArrowRight);
  }
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouseDown = true;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
