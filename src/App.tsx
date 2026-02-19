import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { FileExplorer } from './components/FileExplorer';
import { Editor } from './components/Editor';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="app-layout">
      <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <FileExplorer />
      </div>
      <div className="editor-area">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
        <Editor />
      </div>
    </div>
  );
}

export default App;
