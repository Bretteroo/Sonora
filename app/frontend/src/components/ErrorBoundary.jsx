import React from 'react'
import Splash from './Splash.jsx'

// A theme that throws while drawing took the whole page with it: React
// unmounts everything above the error, leaving a blank page and no way to
// pick another theme short of clearing the browser's storage (found in
// review). This catches it and shows the crash screen, which carries the
// theme picker. It is keyed by theme where it is used, so choosing another
// theme starts it afresh.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Sonora: the theme failed to draw', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return <Splash kind="crash" />
    }
    return this.props.children
  }
}
