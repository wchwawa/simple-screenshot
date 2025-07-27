import { useState } from 'react'

function App(): React.JSX.Element {
  const [message, setMessage] = useState('App loaded successfully!')

  return (
    <div className="container">
      <div className="header">
        <h1>Simple Screenshot</h1>
        <p>{message}</p>
      </div>
      
      <div className="content">
        <p>Application is running in system tray.</p>
        <p>Use <code>Ctrl+A</code> (or Cmd+Shift+A on Mac) to take a screenshot.</p>
        
        <div className="actions">
          <button 
            className="btn btn-primary"
            onClick={() => setMessage('Button clicked!')}
          >
            Test Button
          </button>
        </div>
      </div>
    </div>
  )
}

export default App