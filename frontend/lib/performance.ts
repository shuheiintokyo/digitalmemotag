// Performance monitoring and analytics utilities

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.setupObservers();
  }

  private setupObservers() {
    // Web Vitals monitoring
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      this.observeMetric('largest-contentful-paint', (entries) => {
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('LCP', lastEntry.startTime, {
          element: lastEntry.element?.tagName,
          url: lastEntry.url
        });
      });

      // First Input Delay (FID)
      this.observeMetric('first-input', (entries) => {
        const firstEntry = entries[0];
        this.recordMetric('FID', firstEntry.processingStart - firstEntry.startTime, {
          eventType: firstEntry.name
        });
      });

      // Cumulative Layout Shift (CLS)
      this.observeMetric('layout-shift', (entries) => {
        let clsValue = 0;
        for (const entry of entries) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.recordMetric('CLS', clsValue);
      });
    }
  }

  private observeMetric(type: string, callback: (entries: any[]) => void) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error);
    }
  }

  public recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };
    
    this.metrics.push(metric);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Send to analytics (implement as needed)
    this.sendToAnalytics(metric);
  }

  private sendToAnalytics(metric: PerformanceMetric) {
    // Implementation depends on your analytics service
    if (process.env.NODE_ENV === 'production') {
      // Example: Google Analytics, Mixpanel, custom endpoint
      console.log('Performance metric:', metric);
    }
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Timing utilities
export class Timer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
  }

  public end(): number {
    const duration = performance.now() - this.startTime;
    console.log(`${this.label}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  public static measure<T>(label: string, fn: () => T): T {
    const timer = new Timer(label);
    const result = fn();
    timer.end();
    return result;
  }

  public static async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const timer = new Timer(label);
    const result = await fn();
    timer.end();
    return result;
  }
}

// Memory monitoring
export const memoryMonitor = {
  getMemoryUsage() {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      };
    }
    return null;
  },

  logMemoryUsage() {
    const usage = this.getMemoryUsage();
    if (usage) {
      console.log(`Memory usage: ${usage.used}MB / ${usage.limit}MB`);
    }
  }
};

// Network monitoring
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isOnline: boolean = true;
  private connectionType: string = 'unknown';
  private callbacks: Array<(isOnline: boolean) => void> = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      this.setupListeners();
      this.detectConnectionType();
    }
  }

  public static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyCallbacks();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyCallbacks();
    });
  }

  private detectConnectionType() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.connectionType = connection.effectiveType || 'unknown';
    }
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.isOnline));
  }

  public onConnectionChange(callback: (isOnline: boolean) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  public getStatus() {
    return {
      isOnline: this.isOnline,
      connectionType: this.connectionType
    };
  }
}

// Error tracking
export class ErrorTracker {
  private static errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
    url: string;
    userAgent: string;
  }> = [];

  public static captureError(error: Error, context?: any) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
      context
    };

    this.errors.push(errorInfo);

    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }

    // Send to error tracking service
    this.sendToErrorService(errorInfo);
  }

  private static sendToErrorService(errorInfo: any) {
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry, Bugsnag, custom endpoint
      console.error('Error captured:', errorInfo);
    }
  }

  public static getErrors() {
    return [...this.errors];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceMonitor.disconnect();
  });
}

export default {
  performanceMonitor,
  Timer,
  memoryMonitor,
  NetworkMonitor,
  ErrorTracker
};