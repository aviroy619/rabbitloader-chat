const { ulid } = require('ulid');
module.exports = (req, _res, next) => {
  req.id = req.headers['x-request-id'] || ulid();
  next();
};
