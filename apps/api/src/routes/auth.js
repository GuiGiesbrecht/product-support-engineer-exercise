const { Router } = require('express');
const { login, issueToken } = require('../lib/auth');

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const user = await login(email, password);
  if (!user) {
    res.locals.errorMessage = 'invalid credentials';
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  return res.json({
    token: issueToken(user),
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      customerId: user.customer_id,
    },
  });
});

module.exports = router;
