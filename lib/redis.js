import { createClient } from 'redis';

let client = null;

// Initialize Redis client
const getRedisClient = async () => {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('Connected to Redis');
    });

    await client.connect();
  }
  return client;
};

// Session management functions
export const SESSION_PREFIX = 'session:';
export const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

// Generate a random session token
export const generateSessionToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Create a new session
export const createSession = async (userId, userData = {}) => {
  try {
    const redis = await getRedisClient();
    const sessionToken = generateSessionToken();
    const sessionData = {
      userId,
      createdAt: new Date().toISOString(),
      ...userData
    };
    
    await redis.setEx(
      `${SESSION_PREFIX}${sessionToken}`, 
      SESSION_DURATION, 
      JSON.stringify(sessionData)
    );
    
    return sessionToken;
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

// Get session data
export const getSession = async (sessionToken) => {
  if (!sessionToken) return null;
  
  try {
    const redis = await getRedisClient();
    const sessionData = await redis.get(`${SESSION_PREFIX}${sessionToken}`);
    
    if (sessionData) {
      return JSON.parse(sessionData);
    }
    return null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

// Delete session (logout)
export const deleteSession = async (sessionToken) => {
  if (!sessionToken) return;
  
  try {
    const redis = await getRedisClient();
    await redis.del(`${SESSION_PREFIX}${sessionToken}`);
  } catch (error) {
    console.error('Error deleting session:', error);
  }
};

// Extend session duration
export const extendSession = async (sessionToken) => {
  if (!sessionToken) return false;
  
  try {
    const redis = await getRedisClient();
    const sessionData = await getSession(sessionToken);
    
    if (sessionData) {
      await redis.setEx(
        `${SESSION_PREFIX}${sessionToken}`, 
        SESSION_DURATION, 
        JSON.stringify(sessionData)
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error extending session:', error);
    return false;
  }
};

// Clean up expired sessions (optional background task)
export const cleanupSessions = async () => {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys(`${SESSION_PREFIX}*`);
    
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl <= 0) {
        await redis.del(key);
      }
    }
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
};

// Close Redis connection (for cleanup)
export const closeRedisConnection = async () => {
  if (client) {
    await client.quit();
    client = null;
  }
};