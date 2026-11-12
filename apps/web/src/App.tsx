import { useEffect, useState } from 'react';
import { BLOCK_TYPES, type HealthResponse } from '@sds/shared';
import './App.css';

type ApiStatus = HealthResponse['status'] | 'checking' | 'unreachable';

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then((body) => setApiStatus(body.status))
      .catch(() => {
        if (!controller.signal.aborted) setApiStatus('unreachable');
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>System Design Sandbox</h1>
      <p>API: {apiStatus}</p>
      <h2>Blocks</h2>
      <ul>
        {BLOCK_TYPES.map((type) => (
          <li key={type}>{type}</li>
        ))}
      </ul>
    </main>
  );
}

export default App;
