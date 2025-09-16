import { kv } from '@vercel/kv';

// Session management functions
export const SESSION_PREFIX = 'session:';
export const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

// Generate a random session token
export const generateSessionToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Create a new session
export const createSession = async (userId, userData = {}) => {
  const sessionToken = generateSessionToken();
  const sessionData = {
    userId,
    createdAt: new Date().toISOString(),
    ...userData
  };
  
  await kv.set(`${SESSION_PREFIX}${sessionToken}`, sessionData, { ex: SESSION_DURATION });
  return sessionToken;
};

// Get session data
export const getSession = async (sessionToken) => {
  if (!sessionToken) return null;
  
  try {
    const sessionData = await kv.get(`${SESSION_PREFIX}${sessionToken}`);
    return sessionData;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

// Delete session (logout)
export const deleteSession = async (sessionToken) => {
  if (!sessionToken) return;
  
  try {
    await kv.del(`${SESSION_PREFIX}${sessionToken}`);
  } catch (error) {
    console.error('Error deleting session:', error);
  }
};

// Extend session duration
export const extendSession = async (sessionToken) => {
  if (!sessionToken) return false;
  
  try {
    const sessionData = await getSession(sessionToken);
    if (sessionData) {
      await kv.set(`${SESSION_PREFIX}${sessionToken}`, sessionData, { ex: SESSION_DURATION });
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
  // This would be implemented if you need to manually clean up sessions
  // KV automatically handles expiration with the 'ex' parameter
};