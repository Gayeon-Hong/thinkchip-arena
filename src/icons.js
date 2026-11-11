// Original, inline vector icons. No network requests or external assets.
export function icon(name, className = '') {
  const paths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    trophy:'<path d="M8 3h8v5c0 4-2 6-4 6S8 12 8 8V3Z"/><path d="M8 5H4v3c0 3 2 4 5 4M16 5h4v3c0 3-2 4-5 4M12 14v6M8 21h8"/>',
    chip:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m12 7 4.5 2.5v5L12 17l-4.5-2.5v-5L12 7Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z"/>',
    system:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    up:'<path d="M6 18 18 6M6 6h12v12"/>',
    back:'<path d="m14 5-7 7 7 7"/>',
    bot:'<rect x="4" y="7" width="16" height="14" rx="4"/><path d="M12 3v4M2 12v5M22 12v5M9 12v2M15 12v2M9 17h6"/><circle cx="12" cy="2" r="1"/>',
    duel:'<path d="m4 3 5 2 10 12-2 2L5 9 4 3ZM3 20l5-5M2 17l5 5M20 3l-5 2-2 3M16 11l3-3 1-5M16 15l5 5M17 22l5-5"/>',
    spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    bulb:'<path d="M8 17c0-3-3-3-3-8a7 7 0 0 1 14 0c0 5-3 5-3 8M8 18h8M9 21h6M10 14V9l2 2 2-2v5"/>',
    play:'<path d="m8 4 12 8-12 8V4Z"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  };
  return `<svg class="ui-icon ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}

