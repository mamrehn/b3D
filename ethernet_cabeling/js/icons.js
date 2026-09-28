// Inline-SVG-Icons (Linien-Stil, 24×24) – ersetzen die plattformabhängigen Emojis.

const P = {
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    restart: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    star: '<path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.49l-5.87 3.09 1.12-6.54L2.5 9.41l6.56-.95z"/>',
    terminal: '<rect x="2" y="3" width="20" height="18" rx="2.5"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    rack: '<rect x="5" y="2" width="14" height="20" rx="1.5"/><path d="M8 6h8"/><path d="M8 10h8"/><path d="M8 14h8"/><circle cx="8.5" cy="18" r=".6"/>',
    duct: '<rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M2 12h20"/><path d="M7 14.5c2 0 3-1 5-1s3 1 5 1"/>',
    socket: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M6 15v-3h1v-1.5h3V12h1v3z"/><path d="M13 15v-3h1v-1.5h3V12h1v3z"/>',
    network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
    port: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 16v-4.5H9V9.5h6v2h1.5V16z"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    focus: '<circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    success: '<circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/>',
    error: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22"/><path d="M14 14.7V17c0 .6.5 1 1 1.2 1.2.6 2 2 2 3.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0z"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    coil: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M20 12h2.5"/>',
    mouse: '<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 6.5v3.5"/>',
    touch: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.9-2.5L3.4 14.8a1.5 1.5 0 0 1 2.3-1.9L9 16"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    lock: '<rect width="16" height="11" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cable: '<path d="M4 20V14a4 4 0 0 1 4-4h8a4 4 0 0 0 4-4V4"/><rect x="2" y="18" width="4" height="4" rx=".5"/><rect x="18" y="2" width="4" height="4" rx=".5"/>'
};

export function icon(name, cls = '') {
    const body = P[name] || P.info;
    const filled = name === 'star' || name === 'play';
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${filled ? 1.2 : 2}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
