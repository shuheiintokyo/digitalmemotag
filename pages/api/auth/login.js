import { createSession } from '../../../lib/redis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Simple authentication (you can enhance this)
  if (password === '1234') {
    try {
      // Create session with user data
      const sessionToken = await createSession('admin', {
        username: username || 'admin',
        role: 'admin',
        loginTime: new Date().toISOString()
      });

      // Set session token as httpOnly cookie
      res.setHeader('Set-Cookie', [
        `session=${sessionToken}; HttpOnly; Path=/; Max-Age=${24 * 60 * 60}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
      ]);

      return res.status(200).json({ 
        success: true, 
        message: 'Login successful',
        sessionToken // Also return token for immediate use
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
}