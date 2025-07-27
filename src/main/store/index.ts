import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

interface AppConfig {
  shortcuts: {
    screenshot: string
  }
  permissions: {
    screenCapture: boolean
    lastChecked: number
  }
  ui: {
    theme: 'light' | 'dark' | 'system'
    language: 'zh' | 'en'
  }
  screenshot: {
    defaultPath: string
    format: 'png' | 'jpg' | 'heif'
    quality: number
    autoSave: boolean
    autoCopy: boolean
  }
}

const DEFAULT_CONFIG: AppConfig = {
  shortcuts: {
    screenshot: 'Ctrl+A'
  },
  permissions: {
    screenCapture: false,
    lastChecked: 0
  },
  ui: {
    theme: 'system',
    language: 'zh'
  },
  screenshot: {
    defaultPath: join(app.getPath('desktop'), 'Screenshots'),
    format: 'png',
    quality: 90,
    autoSave: true,
    autoCopy: true
  }
}

class ConfigStore {
  private static instance: ConfigStore
  private config!: AppConfig
  private readonly configPath!: string

  constructor() {
    if (ConfigStore.instance) {
      return ConfigStore.instance
    }

    ConfigStore.instance = this
    
    // 设置配置文件路径
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    
    this.configPath = join(userDataPath, 'config.json')
    this.config = this.loadConfig()
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): AppConfig {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, 'utf-8')
        const loadedConfig = JSON.parse(configData)
        
        // 合并默认配置和加载的配置，确保新字段有默认值
        return this.mergeConfig(DEFAULT_CONFIG, loadedConfig)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
    
    return { ...DEFAULT_CONFIG }
  }

  /**
   * 深度合并配置对象
   */
  private mergeConfig(defaultConfig: any, loadedConfig: any): any {
    const result = { ...defaultConfig }
    
    for (const key in loadedConfig) {
      if (loadedConfig.hasOwnProperty(key)) {
        if (typeof loadedConfig[key] === 'object' && loadedConfig[key] !== null && !Array.isArray(loadedConfig[key])) {
          result[key] = this.mergeConfig(defaultConfig[key] || {}, loadedConfig[key])
        } else {
          result[key] = loadedConfig[key]
        }
      }
    }
    
    return result
  }

  /**
   * 保存配置到文件
   */
  private saveConfig(): void {
    try {
      const configData = JSON.stringify(this.config, null, 2)
      writeFileSync(this.configPath, configData, 'utf-8')
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  /**
   * 获取配置值
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key]
  }

  /**
   * 设置配置值
   */
  public set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value
    this.saveConfig()
  }

  /**
   * 获取嵌套配置值
   */
  public getNested<T>(path: string): T | undefined {
    const keys = path.split('.')
    let current: any = this.config
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return undefined
      }
    }
    
    return current as T
  }

  /**
   * 设置嵌套配置值
   */
  public setNested(path: string, value: any): void {
    const keys = path.split('.')
    let current: any = this.config
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }
    
    current[keys[keys.length - 1]] = value
    this.saveConfig()
  }

  /**
   * 重置配置为默认值
   */
  public reset(): void {
    this.config = { ...DEFAULT_CONFIG }
    this.saveConfig()
  }

  /**
   * 获取完整配置对象的副本
   */
  public getAll(): AppConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * 更新配置对象
   */
  public update(updates: Partial<AppConfig>): void {
    this.config = this.mergeConfig(this.config, updates)
    this.saveConfig()
  }

  /**
   * 检查配置文件是否存在
   */
  public exists(): boolean {
    return existsSync(this.configPath)
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.configPath
  }

  /**
   * 备份当前配置
   */
  public backup(): string {
    const backupPath = `${this.configPath}.backup.${Date.now()}`
    try {
      const configData = JSON.stringify(this.config, null, 2)
      writeFileSync(backupPath, configData, 'utf-8')
      return backupPath
    } catch (error) {
      console.error('Failed to backup config:', error)
      throw error
    }
  }

  /**
   * 从备份恢复配置
   */
  public restore(backupPath: string): void {
    try {
      const backupData = readFileSync(backupPath, 'utf-8')
      const backupConfig = JSON.parse(backupData)
      this.config = this.mergeConfig(DEFAULT_CONFIG, backupConfig)
      this.saveConfig()
    } catch (error) {
      console.error('Failed to restore config:', error)
      throw error
    }
  }
}

// 导出单例实例
export const configStore = new ConfigStore()
export default ConfigStore