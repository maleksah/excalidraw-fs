import { FileExplorer } from './components/FileExplorer';
import { Editor } from './components/Editor';

function App() {
  return (
    <div className="app-layout">
      <div className="sidebar">
        <FileExplorer />
      </div>
      <div className="editor-area">
        <Editor />
      </div>
    </div>
  );
}

export default App;
