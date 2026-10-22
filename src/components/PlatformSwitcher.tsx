import { useState, useEffect } from 'react';

const Icons = {
  loggen: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" />
      <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" />
      <line x1="8" y1="13" x2="13" y2="13" stroke="currentColor" opacity="0.4" />
    </svg>
  ),
  fish: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c3-6 11-6 14.5-1" stroke="currentColor" />
      <path d="M6.5 12c3 6 11 6 14.5 1" stroke="currentColor" />
      <circle cx="17" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <path d="M2 10s2 1 3.5 2S2 14 2 14" stroke="currentColor" />
      <path d="M10 8.5c.5 1.5.5 5 0 7" stroke="currentColor" opacity="0.4" />
    </svg>
  ),
  calendar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" />
      <circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  waves: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="currentColor" />
      <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="currentColor" />
      <path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="currentColor" opacity="0.4" />
    </svg>
  ),
  alert: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 20h20L12 3z" stroke="currentColor" />
      <line x1="12" y1="10" x2="12" y2="14" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" stroke="currentColor" />
      <path d="M12 7.5V12l3 1.8" stroke="currentColor" />
    </svg>
  ),
  grid: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" />
      <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" />
      <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" />
      <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// Delad modul-lista — håll identisk i alla moduler. Endast `current`-flaggan
// (vilken modul man står i) skiljer per app.
const PLATFORMS = [
  { label: 'FISH', desc: 'Underhåll & rutiner', url: 'https://fish2.redcodeteam.com', icon: Icons.fish, color: '#0ea5e9', colorDark: '#0369a1' },
  { label: 'Personal', desc: 'Schema & bemanning', url: 'https://schema.redcodeteam.com', icon: Icons.calendar, color: '#14b8a6', colorDark: '#0d9488' },
  { label: 'Simschema', desc: 'Skolsim & bokning', url: 'https://poolportalen.redcodeteam.com/simschema', icon: Icons.waves, color: '#8b5cf6', colorDark: '#7c3aed' },
  { label: 'Loggen', desc: 'Information & möten', url: 'https://loggen.redcodeteam.com', icon: Icons.loggen, color: '#6366f1', colorDark: '#4f46e5', current: true },
  // hidden: dolda i menyn tills modulerna är i bruk — flagga av för att visa igen.
  { label: 'Incident', desc: 'Tillbud & rapporter', url: 'https://incidentrapport.redcodeteam.com', icon: Icons.alert, color: '#f97316', colorDark: '#ea580c', hidden: true },
  { label: 'Öppettider', desc: 'Tider & helgdagar', url: 'https://oppettider.redcodeteam.com', icon: Icons.clock, color: '#c4632a', colorDark: '#a85222', hidden: true },
];

const ACTIVE = PLATFORMS.find((p) => p.current) || PLATFORMS[0];

export default function PlatformSwitcher() {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
    } else {
      const t = setTimeout(() => setRendered(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
      <div style={{ position: 'fixed', bottom: '18px', left: '18px', zIndex: 9999 }}>
        {rendered && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: '60px',
              minWidth: '240px',
              padding: '8px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.2) inset',
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.92)',
              transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transformOrigin: 'bottom left',
            }}
          >
            {PLATFORMS.filter((p) => !p.hidden).map((p, i) => (
              <a
                key={p.label}
                href={p.current ? undefined : p.url}
                onClick={p.current ? (e: React.MouseEvent) => { e.preventDefault(); setOpen(false); } : undefined}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: p.current ? `${p.color}10` : 'transparent',
                  cursor: p.current ? 'default' : 'pointer',
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 0.2s ease ${i * 0.05 + 0.1}s, transform 0.2s ease ${i * 0.05 + 0.1}s, background 0.15s`,
                }}
                onMouseEnter={(e) => { if (!p.current) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={(e) => { if (!p.current) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Icon circle */}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: p.current
                      ? `linear-gradient(135deg, ${p.color}20, ${p.color}35)`
                      : 'rgba(0, 0, 0, 0.04)',
                    color: p.current ? p.color : '#64748b',
                    flexShrink: 0,
                  }}
                >
                  {p.icon}
                </div>

                {/* Text */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: p.current ? 600 : 500,
                    color: p.current ? p.color : '#1e293b',
                    lineHeight: 1.2,
                  }}>
                    {p.label}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: p.current ? `${p.color}99` : '#94a3b8',
                    lineHeight: 1.3,
                    marginTop: '1px',
                  }}>
                    {p.desc}
                  </div>
                </div>

                {/* Active dot */}
                {p.current && (
                  <div style={{
                    marginLeft: 'auto',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: p.color,
                    boxShadow: `0 0 8px ${p.color}60`,
                    flexShrink: 0,
                  }} />
                )}
              </a>
            ))}
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setOpen(!open)}
          aria-label="Snabbmeny"
          title="Snabbmeny"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: '1px',
            borderStyle: 'solid',
            cursor: 'pointer',
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${ACTIVE.color} 0%, ${ACTIVE.colorDark} 100%)`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderColor: 'rgba(255,255,255,0.25)',
            boxShadow: `0 4px 16px ${ACTIVE.color}59, 0 0 0 1px rgba(255,255,255,0.1) inset`,
            color: 'white',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {open ? Icons.close : Icons.grid}
        </button>
      </div>

      {/* Backdrop */}
      {rendered && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: open ? 'rgba(0,0,0,0.05)' : 'transparent',
            backdropFilter: open ? 'blur(2px)' : 'none',
            WebkitBackdropFilter: open ? 'blur(2px)' : 'none',
            transition: 'all 0.25s ease',
            pointerEvents: open ? 'auto' : 'none',
          }}
        />
      )}
    </>
  );
}
