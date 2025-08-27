module.exports = (err, req, res, _next) => {
  console.error('[error]', req.id, err.stack || err.message || err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Internal Error',
    requestId: req.id,
  });
};
