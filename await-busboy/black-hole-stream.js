const { Writable } = require('node:stream')

/**
 * A Stream which silently drops all incoming data
 * similar to /dev/null on linux/unix
 */
class BlackHoleStream extends Writable {
    constructor() {
        super();
    }

    _write(chunk, encoding, cb) {
        cb();
    }
}

module.exports = BlackHoleStream;
