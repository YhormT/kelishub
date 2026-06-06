const prisma = require('../config/db');

/** Push live wallet refresh after a top-up (best-effort WebSocket). */
const emitTopupBalanceUpdate = async (userId, type = 'TOPUP', amount = 0) => {
  try {
    const { io, userSockets } = require('../index');
    if (!io || !userSockets) return;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      select: { loanBalance: true, adminLoanBalance: true, hasLoan: true },
    });
    if (!user) return;
    const socketId = userSockets.get(String(userId)) || userSockets.get(parseInt(userId, 10));
    if (socketId) {
      io.to(socketId).emit('balance-updated', {
        loanBalance: user.loanBalance,
        adminLoanBalance: user.adminLoanBalance,
        hasLoan: user.hasLoan,
        type,
        amount,
      });
    }
  } catch (_) {
    /* best-effort */
  }
};

module.exports = { emitTopupBalanceUpdate };
