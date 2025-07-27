import { useState, useEffect } from 'react'
import type { ScreenshotResult, PermissionResult } from '../../shared/types'

function App(): React.JSX.Element {
  const [count, setCount] = useState(0)
  const [version, setVersion] = useState<string>('')
  const [screenshotResult, setScreenshotResult] = useState<ScreenshotResult | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<PermissionResult | null>(null)
  const [apiAvailable, setApiAvailable] = useState(false)

  useEffect(() => {
    let retryCount = 0
    const maxRetries = 20 // 最多重试20次，约2秒
    
    // 延迟检查 API 是否可用
    const checkApi = () => {
      try {
        console.log(`Checking window.api availability... (attempt ${retryCount + 1}/${maxRetries})`)
        
        // 安全地检查 window.api
        const hasApi = typeof window !== 'undefined' && 
                      window.api && 
                      typeof window.api === 'object'
        
        console.log('window.api exists:', hasApi)
        
        if (hasApi) {
          console.log('API is available, calling functions...')
          setApiAvailable(true)
          
          // 获取应用版本
          if (window.api.app && window.api.app.getVersion) {
            window.api.app.getVersion()
              .then(version => {
                console.log('Got version:', version)
                setVersion(version)
              })
              .catch(error => {
                console.error('Version error:', error)
              })
          }
          
          // 检查权限状态
          if (window.api.permission && window.api.permission.check) {
            window.api.permission.check()
              .then(status => {
                console.log('Got permission status:', status)
                setPermissionStatus(status)
              })
              .catch(error => {
                console.error('Permission error:', error)
              })
          }
        } else {
          console.log('window.api is not available yet, retrying...')
          setApiAvailable(false)
          retryCount++
          
          if (retryCount < maxRetries) {
            setTimeout(checkApi, 100)
          } else {
            console.error('Max retries reached, window.api is not available')
          }
        }
      } catch (error) {
        console.error('Error checking API:', error)
        setApiAvailable(false)
        retryCount++
        
        if (retryCount < maxRetries) {
          setTimeout(checkApi, 500)
        }
      }
    }
    
    // 稍微延迟启动以确保 preload 脚本已执行
    setTimeout(checkApi, 50)
  }, [])

  const handleTakeScreenshot = async () => {
    try {
      if (!window.api || !window.api.screenshot || !window.api.screenshot.take) {
        console.error('window.api.screenshot.take is not available')
        setScreenshotResult({ 
          success: false, 
          error: 'Screenshot API not available' 
        })
        return
      }

      console.log('Taking screenshot via IPC...')
      const result = await window.api.screenshot.take()
      console.log('Screenshot result:', result)
      setScreenshotResult(result)
    } catch (error) {
      console.error('Screenshot failed:', error)
      setScreenshotResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  }

  const handleCheckPermission = async () => {
    try {
      if (!window.api || !window.api.permission || !window.api.permission.check) {
        console.error('window.api.permission.check is not available')
        return
      }

      const result = await window.api.permission.check()
      console.log('Permission check result:', result)
      setPermissionStatus(result)
    } catch (error) {
      console.error('Permission check failed:', error)
    }
  }

  const handleQuitApp = async () => {
    try {
      if (!window.api || !window.api.app || !window.api.app.quit) {
        console.error('window.api.app.quit is not available')
        return
      }

      await window.api.app.quit()
    } catch (error) {
      console.error('Quit app failed:', error)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Simple Screenshot</h1>
        <p>The simplest and best screenshot tool</p>
        {version && <p><small>Version: {version}</small></p>}
        <p><small>API Status: {apiAvailable ? '✅ Available' : '❌ Not Available'}</small></p>
      </div>
      
      <div className="content">
        <p>Application is running in system tray.</p>
        <p>Use <code>Ctrl+A</code> (or Cmd+Shift+A on Mac) to take a screenshot.</p>
        
        <div className="actions">
          <button 
            className="btn btn-primary"
            onClick={handleTakeScreenshot}
          >
            Take Screenshot (IPC)
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={handleCheckPermission}
          >
            Check Permissions
          </button>
          
          <button 
            className="btn btn-secondary"
            onClick={() => setCount(count + 1)}
          >
            Test Counter: {count}
          </button>
          
          <button 
            className="btn btn-danger"
            onClick={handleQuitApp}
          >
            Quit App
          </button>
        </div>
        
        {screenshotResult && (
          <div className="result">
            <h3>Screenshot Result:</h3>
            <pre>{JSON.stringify(screenshotResult, null, 2)}</pre>
          </div>
        )}
        
        {permissionStatus && (
          <div className="permission-status">
            <h3>Permission Status:</h3>
            <pre>{JSON.stringify(permissionStatus, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default App