import { deleteSession } from '../../../lib/redis';
import { parse } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get session token from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.session;

    if (sessionToken) {
      // Delete session from Redis
      await deleteSession(sessionToken);
    }

    // Clear the session cookie
    res.setHeader('Set-Cookie', [
      'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
    ]);

    return res.status(200).json({ 
      success: true, 
      message: 'Logout successful' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}