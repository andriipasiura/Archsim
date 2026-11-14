import { ReactFlowProvider } from '@xyflow/react';
import { Editor } from '@/features/workspace';

function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

export default App;
