import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface State { hasError: boolean; error?: any }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{String(this.state.error?.message || 'Unknown error')}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset}> 
            <Text style={styles.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#121212' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12, color: '#fff' },
  message: { color: '#ccc', textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#6a5acd', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  btnText: { color: '#fff', fontWeight: '600' }
});

export default ErrorBoundary;
