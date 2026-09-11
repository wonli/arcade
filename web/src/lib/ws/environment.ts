/**
 * 环境配置管理
 * 根据当前环境自动切换配置
 */

// 环境类型定义
type Environment = "development" | "production";

// 环境配置类型
interface EnvironmentConfig {
  wsUrl: string;
  apiUrl: string;
  env: Environment;
}

// 环境覆盖配置类型
interface EnvOverrides {
  env?: Environment;
}

// 获取当前环境
const getEnvironment = (): Environment => {
  // 检查是否为开发环境
  if (typeof window !== "undefined") {
    // 浏览器环境
    const hostname = window.location.hostname;
    const port = window.location.port;

    // 开发环境判断
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      port === "5173" ||
      port === "5174"
    ) {
      return "development";
    }

    // 生产环境
    return "production";
  }

  // 默认开发环境
  return "development" as Environment;
};

// 基础环境配置
const baseConfig: Record<Environment, EnvironmentConfig> = {
  development: {
    wsUrl: "ws://127.0.0.1:2035/ws?appId=console&platform=web",
    apiUrl: "http://127.0.0.1:2035",
    env: "development",
  },
  production: {
    wsUrl: "ws://127.0.0.1:2035/ws?appId=console&platform=web",
    apiUrl: "http://127.0.0.1:2035",
    env: "production",
  },
};

// 获取环境覆盖配置
const getEnvOverrides = (): EnvOverrides => {
  const overrides: EnvOverrides = {};

  // 1. 支持通过localStorage覆盖环境key（开发环境，最低优先级）
  if (typeof window !== "undefined" && getEnvironment() === "development") {
    const storedEnvKey = localStorage.getItem("env") as Environment;
    if (storedEnvKey && baseConfig[storedEnvKey]) {
      overrides.env = storedEnvKey;
    }
  }

  // 2. 支持通过Vite环境变量覆盖配置（中等优先级）
  if (import.meta.env.VITE_ENV_OVERRIDE) {
    const envOverride = import.meta.env.VITE_ENV_OVERRIDE as Environment;
    if (envOverride && baseConfig[envOverride]) {
      overrides.env = envOverride;
    }
  }

  return overrides;
};

// 获取当前环境配置
const getConfig = (): EnvironmentConfig => {
  const env = getEnvironment();
  const base = baseConfig[env] || baseConfig.development;
  const overrides = getEnvOverrides();

  // 如果有环境覆盖，使用覆盖的环境配置
  if (overrides.env && baseConfig[overrides.env]) {
    return baseConfig[overrides.env];
  }

  return base;
};

// 导出配置
export const environment = getEnvironment();
export const wsUrl = getConfig().wsUrl;
export const apiUrl = getConfig().apiUrl;
export const currentEnv = getConfig().env;

// 导出配置管理函数
export const setEnvironmentConfig = (
  config: Environment | EnvironmentConfig,
) => {
  if (typeof window !== "undefined" && environment === "development") {
    // 如果传入的是环境key，直接保存
    if (typeof config === "string" && baseConfig[config]) {
      localStorage.setItem("env", config);
      console.log("🌍 环境配置已更新:", config);
      console.log("💡 请刷新页面以应用新的配置");
    }
    // 如果传入的是完整配置对象，提取环境key
    else if (
      typeof config === "object" &&
      config.env &&
      baseConfig[config.env]
    ) {
      localStorage.setItem("env", config.env);
      console.log("🌍 环境配置已更新:", config.env);
      console.log("💡 请刷新页面以应用新的配置");
    }
  }
};

export const clearEnvironmentConfig = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("env");
    console.log("🌍 环境配置已清除");
    console.log("💡 请刷新页面以应用新的配置");
  }
};

export const getEnvironmentInfo = () => {
  const config = getConfig();
  return {
    environment: getEnvironment(),
    wsUrl: config.wsUrl,
    apiUrl: config.apiUrl,
    currentEnv: config.env,
    hasOverrides: Object.keys(getEnvOverrides()).length > 0,
    storedEnvKey:
      typeof window !== "undefined" ? localStorage.getItem("env") : null,
  };
};

// 扩展 Window 接口
declare global {
  interface Window {
    taskflowConfig?: {
      set: typeof setEnvironmentConfig;
      clear: typeof clearEnvironmentConfig;
      info: typeof getEnvironmentInfo;
    };
  }
}

// 调试信息
if (typeof window !== "undefined" && environment === "development") {
  console.log("🌍 环境配置:", getEnvironmentInfo());

  // 在开发环境中提供全局配置管理
  if (environment === "development") {
    window.taskflowConfig = {
      set: setEnvironmentConfig,
      clear: clearEnvironmentConfig,
      info: getEnvironmentInfo,
    };
  }
}
