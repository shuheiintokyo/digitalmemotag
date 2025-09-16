import { getSession, extendSession } from '../../../lib/redis';
import { parse } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get session token from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.session;

    if (!sessionToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'No session found' 
      });
    }

    // Get session data from Redis
    const sessionData = await getSession(sessionToken);

    if (!sessionData) {
      // Session expired or doesn't exist
      res.setHeader('Set-Cookie', [
        'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
      ]);
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired' 
      });
    }

    // Extend session for active users
    await extendSession(sessionToken);

    return res.status(200).json({ 
      success: true, 
      user: sessionData,
      message: 'Session valid'
    });
  } catch (error) {
    console.error('Session check error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}