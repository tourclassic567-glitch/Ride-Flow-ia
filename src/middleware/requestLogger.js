module.exports = function requestLogger(req, _res, next) {
  console.log(JSON.stringify({
    event: 'request_received',
    input: {
      method: req.method,
      path: req.originalUrl,
      body: req.body || {}
    },
    output: {},
    status: 'success',
    timestamp: new Date().toISOString()
  }));

  next();
};
