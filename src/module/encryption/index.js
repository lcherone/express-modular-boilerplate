const crypto = require("crypto");

/**
 * AES CBC Encryption helper
 *
 * Usage:
 * ``` javascript
//
const encryption = require('module/encryption');

// encrypt
let enc = encryption.encrypt({
    foo: 'some value',
    bar: 'value xyz'
  }, 
  process.env.ENCRYPTION_KEY || 'SecretKey123'
);

// decrypt
let dec = encryption.decrypt(
  enc, 
  process.env.ENCRYPTION_KEY || 'SecretKey123'
);

// hash
let hashed = encryption.hash('sha512', 'hashme');

// random string
let hashed = encryption.randomString(10);
```
 *
 */

let Encryption = {};

/**
 * Create a random hex string using crypto.randomBytes
 * - Encryption.randomString(10);
 *
 * @return {string}
 */
Encryption.randomString = length =>
  crypto
    .randomBytes(length)
    .toString("hex")
    .substr(0, length);

/**
 * Create a hash
 * - Encryption.hash('sha256', 'data to hash');
 *
 * @return {Buffer}
 */
Encryption.hash = (algo, data) =>
  crypto
    .createHash(algo)
    .update(data)
    .digest();

/**
 * Encrypt
 * - Encryption.encrypt(<string>, 'secret key');
 *
 * @return {string}
 */
Encryption.encrypt = (data, key) => {
  let iv = crypto.randomBytes(16);
  let cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Encryption.hash("sha256", key),
    iv
  );
  return (
    iv.toString("hex") +
    ":" +
    Buffer.concat([
      cipher.update(JSON.stringify(data)),
      cipher.final()
    ]).toString("hex")
  );
};

/**
 * Decrypt data
 * - Encryption.decrypt(<string>, 'secret key');
 *
 * @return {mixed}
 */
Encryption.decrypt = (data, key) => {
  let parts = data.split(":");
  let iv = Buffer.from(parts.shift(), "hex");
  let decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Encryption.hash("sha256", key),
    iv
  );
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(parts.join(":"), "hex")),
      decipher.final()
    ]).toString()
  );
};

module.exports = Encryption;
