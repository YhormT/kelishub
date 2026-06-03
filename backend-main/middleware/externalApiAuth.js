const prisma = require('../config/db');

const extractApiKey = (req) => {
  const headerKey = req.headers['x-api-key'];
  if (headerKey) return headerKey;

  const auth = req.headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return req.headers['x-clerk-api-key'] || null;
};

const externalApiAuth = async (req, res, next) => {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'Missing API key. Include x-api-key or Authorization: Bearer <key> header.',
      });
    }

    const keyRecord = await prisma.externalApiKey.findUnique({
      where: { apiKey },
      include: { agent: { select: { id: true, name: true, isSuspended: true, role: true } } },
    });

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.',
      });
    }

    if (!keyRecord.isActive) {
      return res.status(403).json({
        success: false,
        message: 'API key has been revoked.',
      });
    }

    if (!keyRecord.agentId || !keyRecord.agent) {
      return res.status(403).json({
        success: false,
        message:
          'This API key is not linked to an agent wallet. Ask admin to create a new key and select an agent.',
      });
    }

    if (keyRecord.agent.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'The agent linked to this API key is suspended.',
      });
    }

    prisma.externalApiKey
      .update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    req.partner = {
      id: keyRecord.id,
      name: keyRecord.partnerName,
      agentId: keyRecord.agentId,
      agentName: keyRecord.agent.name,
    };

    next();
  } catch (error) {
    console.error('External API auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

module.exports = externalApiAuth;
