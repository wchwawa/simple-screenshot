import { useState } from 'react'

function App(): JSX.Element {
  const [count, setCount] = useState(0)

  return (
    <div className="container">
      <div className="header">
        <h1>Simple Screenshot</h1>
        <p>The simplest and best screenshot tool</p>
      </div>
      
      <div className="content">
        <p>Application is running in system tray.</p>
        <p>Use <code>Ctrl+A</code> (or Cmd+Shift+A on Mac) to take a screenshot.</p>
        
        <div className="actions">
          <button 
            className="btn btn-primary"
            onClick={() => setCount(count + 1)}
          >
            Test Counter: {count}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App