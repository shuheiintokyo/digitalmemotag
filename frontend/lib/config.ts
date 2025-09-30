// Environment configuration and constants
interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
  version: string;
  features: {
    realTimeUpdates: boolean;
    offlineSupport: boolean;
    pushNotifications: boolean;
  };
}

const getConfig = (): AppConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // API URL configuration
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
    (isDevelopment ? 'http://localhost:8000' : 'https://your-production-api.com');
  
  // WebSocket URL configuration
  const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
  const wsUrl = apiUrl.replace(/^https?/, wsProtocol);
  
  return {
    apiUrl,
    wsUrl,
    isDevelopment,
    isProduction,
    version: process.env.NEXT_PUBLIC_VERSION || '1.0.0',
    features: {
      realTimeUpdates: process.env.NEXT_PUBLIC_ENABLE_REALTIME === 'true',
      offlineSupport: process.env.NEXT_PUBLIC_ENABLE_OFFLINE === 'true',
      pushNotifications: process.env.NEXT_PUBLIC_ENABLE_PUSH === 'true',
    }
  };
};

export const config = getConfig();

// Validation utilities
export const validateEnvironment = () => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_API_URL'
  ];
  
  const missing = requiredEnvVars.filter(
    envVar => !process.env[envVar]
  );
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
};

// Security headers and CSP
export const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Rate limiting configuration
export const rateLimits = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
  },
  messages: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 message posts per minute
  },
};

// Constants
export const constants = {
  MESSAGE_TYPES: {
    GENERAL: 'general',
    ISSUE: 'issue',
    FIXED: 'fixed',
    QUESTION: 'question',
    STATUS_UPDATE: 'status_update',
  } as const,
  
  ITEM_STATUSES: {
    WORKING: 'Working',
    NEEDS_MAINTENANCE: 'Needs Maintenance',
    OUT_OF_ORDER: 'Out of Order',
  } as const,
  
  WEBSOCKET_EVENTS: {
    NEW_MESSAGE: 'new_message',
    STATUS_UPDATE: 'status_update',
    USER_JOINED: 'user_joined',
    USER_LEFT: 'user_left',
  } as const,
  
  STORAGE_KEYS: {
    AUTH_TOKEN: 'authToken',
    USER_PREFERENCES: 'userPreferences',
    OFFLINE_MESSAGES: 'offlineMessages',
  } as const,
};

// Feature flags
export const features = {
  enableRealTimeUpdates: config.features.realTimeUpdates,
  enableOfflineSupport: config.features.offlineSupport,
  enablePushNotifications: config.features.pushNotifications,
  enableDarkMode: false, // Future feature
  enableAnalytics: config.isProduction,
};

export default config;