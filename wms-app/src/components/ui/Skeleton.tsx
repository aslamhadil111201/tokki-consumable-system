// @ts-nocheck
import "./Skeleton.css";

/** Single shimmer block */
export function SkeletonBox({
  h = 14,
  w = "100%",
  br = 7,
  mb = 0,
}: {
  h?: number;
  w?: string | number;
  br?: number;
  mb?: number;
}) {
  return (
    <div
      className="skel-box"
      style={{ height: h, width: w, borderRadius: br, marginBottom: mb }}
    />
  );
}

/** Stat card skeleton */
export function SkeletonCard({ h = 90 }: { h?: number }) {
  return (
    <div className="skel-card" style={{ height: h }}>
      <div className="skel-box" style={{ height: 10, width: "50%", borderRadius: 5, marginBottom: 10 }} />
      <div className="skel-box" style={{ height: 28, width: "40%", borderRadius: 7, marginBottom: 8 }} />
      <div className="skel-box" style={{ height: 9, width: "65%", borderRadius: 5 }} />
    </div>
  );
}

/** Dashboard full skeleton */
export function DashboardSkeleton() {
  return (
    <div className="skel-dashboard">
      {/* Hero bar */}
      <div className="skel-hero">
        <div style={{ flex: 1 }}>
          <div className="skel-box" style={{ height: 11, width: "30%", borderRadius: 5, marginBottom: 10 }} />
          <div className="skel-box" style={{ height: 22, width: "55%", borderRadius: 7, marginBottom: 8 }} />
          <div className="skel-box" style={{ height: 10, width: "45%", borderRadius: 5 }} />
        </div>
        <div className="skel-box" style={{ height: 38, width: 160, borderRadius: 12 }} />
      </div>

      {/* 3-col chart area */}
      <div className="skel-charts-g">
        {[1, 2, 3].map(i => (
          <div key={i} className="skel-chart-card">
            <div className="skel-box" style={{ height: 14, width: "50%", borderRadius: 6, marginBottom: 16 }} />
            <div className="skel-box" style={{ height: 110, width: "100%", borderRadius: 10, marginBottom: 10 }} />
            <div className="skel-box" style={{ height: 10, width: "35%", borderRadius: 5 }} />
          </div>
        ))}
      </div>

      {/* 2-col tables */}
      <div className="skel-tables-g">
        {[1, 2].map(panel => (
          <div key={panel} className="skel-table-card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div className="skel-box" style={{ height: 14, width: "45%", borderRadius: 6 }} />
              <div className="skel-box" style={{ height: 18, width: 60, borderRadius: 20 }} />
            </div>
            <div className="skel-row-hdr">
              {[1, 2, 3, 4].map(c => (
                <div key={c} className="skel-box" style={{ height: 10, flex: c === 1 ? 2 : 1, borderRadius: 5 }} />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, r) => (
              <div key={r} className="skel-row">
                <div className="skel-box" style={{ height: 30, width: 30, borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div className="skel-box" style={{ height: 12, width: "75%", borderRadius: 5 }} />
                  <div className="skel-box" style={{ height: 9, width: "50%", borderRadius: 4 }} />
                </div>
                <div className="skel-box" style={{ height: 12, flex: 1, borderRadius: 5 }} />
                <div className="skel-box" style={{ height: 12, flex: 1, borderRadius: 5 }} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer 3-col */}
      <div className="skel-footer-g">
        {[1, 2, 3].map(i => (
          <SkeletonCard key={i} h={80} />
        ))}
      </div>
    </div>
  );
}

/** Delivery (Surat Jalan) table skeleton */
export function DeliverySkeleton() {
  return (
    <div className="skel-delivery">
      {/* Header toolbar */}
      <div className="skel-delivery-hdr">
        <div className="skel-box" style={{ height: 20, width: 260, borderRadius: 7 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {[100, 110, 120, 130].map(w => (
            <div key={w} className="skel-box" style={{ height: 34, width: w, borderRadius: 8 }} />
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="skel-dn-stats">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skel-dn-stat">
            <div className="skel-box" style={{ height: 10, width: "65%", borderRadius: 5, marginBottom: 8 }} />
            <div className="skel-box" style={{ height: 28, width: "40%", borderRadius: 7, marginBottom: 6 }} />
            <div className="skel-box" style={{ height: 9, width: "80%", borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Search + filter toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div className="skel-box" style={{ height: 38, flex: 1, borderRadius: 9 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {[70, 60, 60, 60, 60].map((w, i) => (
            <div key={i} className="skel-box" style={{ height: 38, width: w, borderRadius: 8 }} />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="skel-dn-table">
        {/* thead */}
        <div className="skel-dn-thead">
          {["BATCH NO.", "KATEGORI", "TANGGAL", "TUJUAN", "PROJECT NO.", "DESKRIPSI BARANG", "AKSI"].map((col, i) => (
            <div key={i} className="skel-box" style={{ height: 10, borderRadius: 5 }} />
          ))}
        </div>
        {/* rows */}
        {Array.from({ length: 12 }).map((_, r) => (
          <div key={r} className="skel-dn-row">
            {[1, 1, 1, 2, 1, 3, 0.6].map((flex, c) => (
              <div
                key={c}
                className="skel-box"
                style={{ height: 14, flex, borderRadius: 6, width: c === 0 ? 80 : undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stock page grid of card skeletons */
export function StockSkeleton() {
  return (
    <div className="skel-stock">
      {/* Filter bar */}
      <div className="skel-stock-filter">
        <div className="skel-box" style={{ height: 38, flex: 1, borderRadius: 9 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skel-box" style={{ height: 38, width: 130, borderRadius: 9 }} />
          <div className="skel-box" style={{ height: 38, width: 130, borderRadius: 9 }} />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[70, 60, 80, 70, 60].map((w, i) => (
          <div key={i} className="skel-box" style={{ height: 34, width: w, borderRadius: 20 }} />
        ))}
      </div>

      {/* Summary bar */}
      <div className="skel-stock-summary">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
            <div className="skel-box" style={{ height: 11, width: 70, borderRadius: 5 }} />
            <div className="skel-box" style={{ height: 18, width: 50, borderRadius: 6 }} />
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div className="skel-stock-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skel-stock-card">
            <div className="skel-box" style={{ height: 90, width: "100%", borderRadius: 10, marginBottom: 10 }} />
            <div className="skel-box" style={{ height: 14, width: "80%", borderRadius: 6, marginBottom: 6 }} />
            <div className="skel-box" style={{ height: 10, width: "55%", borderRadius: 5, marginBottom: 10 }} />
            <div style={{ height: 1, background: "var(--t-border)", marginBottom: 10 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div className="skel-box" style={{ height: 20, width: 60, borderRadius: 6 }} />
              <div className="skel-box" style={{ height: 20, width: 55, borderRadius: 20 }} />
            </div>
            <div className="skel-box" style={{ height: 8, width: "100%", borderRadius: 99, marginBottom: 6 }} />
            <div className="skel-box" style={{ height: 9, width: "65%", borderRadius: 5, marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div className="skel-box" style={{ height: 30, flex: 1, borderRadius: 8 }} />
              <div className="skel-box" style={{ height: 30, flex: 1, borderRadius: 8 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skel-box" style={{ height: 34, flex: 1, borderRadius: 10 }} />
              <div className="skel-box" style={{ height: 34, flex: 1, borderRadius: 10 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic table-based page skeleton (Transaction, History, Report) */
export function TablePageSkeleton({
  rows = 6,
  statCount = 4,
  showTabs = false,
}: {
  rows?: number;
  statCount?: number;
  showTabs?: boolean;
}) {
  return (
    <div className="skel-table-page">
      {/* Header */}
      <div className="skel-tp-header">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skel-box" style={{ height: 14, width: 220, borderRadius: 7 }} />
          <div className="skel-box" style={{ height: 10, width: 300, borderRadius: 5 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[100, 90, 130, 140].slice(0, statCount > 3 ? 4 : 3).map((w, i) => (
            <div key={i} className="skel-box" style={{ height: 36, width: w, borderRadius: 10 }} />
          ))}
        </div>
      </div>

      {/* Optional tabs */}
      {showTabs && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "var(--t-surface)", padding: 4, borderRadius: 12, border: "1px solid var(--t-border)" }}>
          {[120, 130, 110, 120, 100].map((w, i) => (
            <div key={i} className="skel-box" style={{ height: 34, width: w, borderRadius: 9, flexShrink: 0 }} />
          ))}
        </div>
      )}

      {/* Stat cards */}
      {statCount > 0 && (
        <div className="skel-tp-stats" style={{ gridTemplateColumns: `repeat(${statCount}, 1fr)` }}>
          {Array.from({ length: statCount }).map((_, i) => (
            <div key={i} className="skel-tp-stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div className="skel-box" style={{ height: 34, width: 34, borderRadius: 10 }} />
                <div className="skel-box" style={{ height: 8, width: 8, borderRadius: "50%" }} />
              </div>
              <div className="skel-box" style={{ height: 10, width: "70%", borderRadius: 5, marginBottom: 8 }} />
              <div className="skel-box" style={{ height: 26, width: "50%", borderRadius: 7, marginBottom: 6 }} />
              <div className="skel-box" style={{ height: 9, width: "60%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="skel-box" style={{ height: 38, flex: 1, minWidth: 180, borderRadius: 9 }} />
        <div className="skel-box" style={{ height: 38, width: 160, borderRadius: 9 }} />
        <div className="skel-box" style={{ height: 38, width: 120, borderRadius: 9 }} />
        <div className="skel-box" style={{ height: 38, width: 90, borderRadius: 9 }} />
      </div>

      {/* Card list */}
      <div className="skel-tp-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skel-tp-row">
            <div className="skel-tp-avatar">
              <div className="skel-box" style={{ height: 48, width: 48, borderRadius: "50%" }} />
              <div className="skel-box" style={{ height: 9, width: 40, borderRadius: 4, marginTop: 4 }} />
            </div>
            <div className="skel-tp-content">
              <div className="skel-box" style={{ height: 14, width: "40%", borderRadius: 6, marginBottom: 5 }} />
              <div className="skel-box" style={{ height: 10, width: "60%", borderRadius: 5, marginBottom: 5 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skel-box" style={{ height: 20, width: 80, borderRadius: 20 }} />
                <div className="skel-box" style={{ height: 20, width: 70, borderRadius: 20 }} />
              </div>
            </div>
            <div className="skel-tp-meta">
              <div className="skel-box" style={{ height: 22, width: 50, borderRadius: 6, marginBottom: 5 }} />
              <div className="skel-box" style={{ height: 11, width: 40, borderRadius: 4 }} />
            </div>
            <div className="skel-tp-meta">
              <div className="skel-box" style={{ height: 22, width: 70, borderRadius: 6, marginBottom: 5 }} />
              <div className="skel-box" style={{ height: 11, width: 55, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
