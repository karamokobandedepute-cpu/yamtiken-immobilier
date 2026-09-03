import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '', errorStack: '' }
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      errorMessage: error?.message || 'Erreur inconnue',
      errorStack: error?.stack || ''
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '', errorStack: '' })
  }

  handleHome = () => {
    this.setState({ hasError: false, errorMessage: '', errorStack: '' })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV
      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0D3B1F 0%, #1A6B35 100%)',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#0D3B1F', marginBottom: '8px', fontSize: '20px', fontWeight: '700' }}>
              Une erreur est survenue
            </h2>
            <p style={{ color: '#6B7280', marginBottom: '24px', fontSize: '14px' }}>
              Une erreur inattendue a été détectée. Vous pouvez réessayer ou retourner à l'accueil.
            </p>
            {isDev && this.state.errorMessage && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                textAlign: 'left'
              }}>
                <p style={{ color: '#DC2626', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-word', margin: 0 }}>
                  {this.state.errorMessage}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  background: '#F3F4F6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Réessayer
              </button>
              <button
                onClick={this.handleHome}
                style={{
                  background: '#1A6B35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
