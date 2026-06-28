/**
 * Middleware di autenticazione per le rotte admin.
 * Verifica la presenza di una sessione admin valida.
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.status(401).json({ error: 'Non autorizzato. Effettua il login.' });
}

module.exports = { requireAdmin };
