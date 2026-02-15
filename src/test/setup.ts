import '@testing-library/jest-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false
  })
});

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    clearRect: () => undefined,
    setTransform: () => undefined,
    beginPath: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    ellipse: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    fillText: () => undefined,
    strokeText: () => undefined,
    measureText: () => ({ width: 10 }),
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    setLineDash: () => undefined,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  })
});


class ResizeObserver {
  observe() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserver
});


class Path2D {
  moveTo() { return undefined; }
  lineTo() { return undefined; }
  rect() { return undefined; }
  arc() { return undefined; }
  closePath() { return undefined; }
}

Object.defineProperty(window, 'Path2D', {
  writable: true,
  value: Path2D
});
