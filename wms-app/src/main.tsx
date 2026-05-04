import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  errorMessage: string
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Terjadi error tidak terduga.',
    }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Fatal UI error captured by AppErrorBoundary:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'linear-gradient(135deg, #03120a 0%, #041a10 55%, #062416 100%)',
          color: '#ecfdf5',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: 'min(560px, 100%)',
            borderRadius: '18px',
            border: '1px solid rgba(16,185,129,0.35)',
            background: 'rgba(3, 20, 12, 0.86)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
            padding: '28px 24px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.08em', color: '#6ee7b7', textTransform: 'uppercase' }}>
            Tokki WMS
          </div>
          <h1 style={{ margin: '10px 0 8px', fontSize: '24px', lineHeight: 1.25, color: '#ecfdf5' }}>
            Aplikasi mengalami gangguan
          </h1>
          <p style={{ margin: '0 0 14px', fontSize: '14px', lineHeight: 1.6, color: '#a7f3d0' }}>
            Sistem menangkap error agar layar tidak blank. Klik tombol di bawah untuk memuat ulang aplikasi.
          </p>
          <p
            style={{
              margin: '0 0 18px',
              fontSize: '12px',
              color: '#fcd34d',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: '10px',
              padding: '8px 10px',
              wordBreak: 'break-word',
            }}
          >
            Detail: {this.state.errorMessage || 'Unknown error'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 'none',
              borderRadius: '12px',
              background: 'linear-gradient(135deg,#10b981,#34d399)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 700,
              padding: '11px 16px',
              cursor: 'pointer',
            }}
          >
            Muat Ulang Aplikasi
          </button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
