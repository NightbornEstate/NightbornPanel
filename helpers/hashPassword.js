module.exports = (pw) => {
  const crypto = require('crypto');
  var hash = crypto.createHash('sha256');
  
  hash.update(pw);
  return hash.digest('hex');
}