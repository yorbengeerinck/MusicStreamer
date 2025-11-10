import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(_error: any) { /* geen console.log */ }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 16 }}>Er ging iets mis. Herlaad de pagina a.u.b.</div>;
    }
    return this.props.children;
  }
}