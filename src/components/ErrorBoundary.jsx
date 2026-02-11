import React from 'react';

/**
 * P3 FIX: Error boundary to catch app crashes and prevent silent data loss
 * Shows user an error message and recovery options
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error('App error caught by boundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearData = () => {
    if (confirm('Clear all app data and reload? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  handleBackupRestore = () => {
    const backup = localStorage.getItem('workouts');
    if (backup) {
      try {
        const parsed = JSON.parse(backup);
        alert(`Backup found: ${parsed.length || 0} workouts. Try reloading.`);
      } catch (e) {
        alert('Backup data seems corrupted.');
      }
    } else {
      alert('No backup found in storage.');
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white flex items-center justify-center p-6">
          <div className="bg-slate-900/80 border border-red-500/30 rounded-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">⚠️</div>
              <h1 className="text-2xl font-black mb-2">App Error</h1>
              <p className="text-slate-400 text-sm">The app encountered an unexpected error.</p>
            </div>

            <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-xs font-mono text-red-300 break-words">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/20"
              >
                Reload Appץ
              </button>
              
              <button
                onClick={this.handleBackupRestore}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 text-slate-300 hover:text-white font-semibold text-sm transition-all"
              >
                Check Backup
              </button>
              
              <button
                onClick={this.handleClearData}
                className="w-full px-4 py-3 rounded-lg bg-red-950/30 hover:bg-red-900/30 border border-red-600/50 text-red-300 hover:text-red-200 font-semibold text-sm transition-all"
              >
                Clear Data & Reload
              </button>
            </div>

            <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/30 rounded-lg">
              <p className="text-xs text-slate-400">
                💡 <strong>Tip:</strong> Your workout data is auto-saved to your device. If the error persists, try reloading or clearing data.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
