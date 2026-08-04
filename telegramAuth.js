const crypto = require('crypto');

// Verify Telegram Mini App initData using the bot token.
// See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Returns the parsed `user` object on success, or null if the signature is
// missing, malformed, forged, or older than maxAgeSeconds.
function verifyInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || typeof initData !== 'string' || !botToken) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  params.sort();

  let dataCheckString = '';
  for (const [key, value] of params.entries()) {
    dataCheckString += `${key}=${value}\n`;
  }
  dataCheckString = dataCheckString.slice(0, -1);

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const computed = Buffer.from(computedHash, 'hex');
  const provided = Buffer.from(hash, 'hex');
  if (computed.length !== provided.length || !crypto.timingSafeEqual(computed, provided)) {
    return null;
  }

  // Reject stale payloads to limit replay of a captured initData string.
  const authDate = parseInt(params.get('auth_date'), 10);
  if (authDate) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > maxAgeSeconds) return null;
  }

  const userJson = params.get('user');
  if (!userJson) return null;

  try {
    const user = JSON.parse(userJson);
    if (!user || user.id === undefined || user.id === null) return null;
    return user;
  } catch (err) {
    return null;
  }
}

// Express middleware: attaches the verified Telegram user to req.telegramUser,
// or rejects the request. Outside production, a fallback identity (from the
// request body or URL param) is accepted so the app can be exercised in a
// plain browser without a signed payload.
function requireTelegramAuth(req, res, next) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const initData = req.get('X-Telegram-Init-Data') || (req.body && req.body.initData);

  const verified = verifyInitData(initData, botToken);
  if (verified) {
    req.telegramUser = verified;
    return next();
  }

  if (process.env.NODE_ENV !== 'production') {
    const bodyUser = req.body && req.body.telegramUser;
    const devId =
      (bodyUser && bodyUser.id) ||
      (req.body && req.body.telegramId) ||
      (req.params && req.params.telegramId);
    if (devId) {
      req.telegramUser = bodyUser || { id: String(devId), first_name: 'Dev' };
      return next();
    }
  }

  return res.status(401).json({ error: 'Telegram authentication required' });
}

module.exports = { verifyInitData, requireTelegramAuth };
