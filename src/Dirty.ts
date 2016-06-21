import * as util from 'util';
import * as fs from 'fs';
import * as events from 'events';
import EventEmitter = events.EventEmitter;

//if (global.GENTLY) require = GENTLY.hijack(require);
export class Dirty extends EventEmitter {

  writeBundle = 1000;
  _docs = {};
  _keys = [];
  _queue = [];
  _readStream = null;
  _writeStream = null;
  _fdRead = null;
  _fdWrite = null;

  constructor(private path) {
    
    super();

    this.writeBundle = 1000;

    this._docs = {};
    this._keys = [];
    this._queue = [];
    this._readStream = null;
    this._writeStream = null;
    this._fdRead = null;
    this._fdWrite = null;

    this._load();
  }

  // Called when a dirty connection is instantiated
  _load =() => {
    var self = this, buffer = '', length = 0;

    if (!this.path) {
      process.nextTick(function () {
        self.emit('load', 0);
      });
      return;
    }

    this._readStream = fs.createReadStream(this.path, {
      encoding: 'utf-8',
      flags: 'r'
    });

    this._readStream
      .on('error', function (err) {
        if (err.code === 'ENOENT') {
          self.emit('load', 0);
          return;
        }

        self.emit('error', err);
      })
      .on('data', function (chunk) {
        buffer += chunk;
        if (chunk.lastIndexOf('\n') == -1) return;
        var arr = buffer.split('\n');
        buffer = arr.pop();
        arr.forEach(function (rowStr) {
          if (!rowStr) {
            self.emit('error', new Error('Empty lines never appear in a healthy database'));
            return;
          }

          var row;
          try {
            row = JSON.parse(rowStr);
            if (!('key' in row)) {
              throw new Error();
            }
          } catch (e) {
            self.emit('error', new Error('Could not load corrupted row: ' + rowStr));
            return '';
          }

          if (row.val === undefined) {
            if (row.key in self._docs) {
              length--;
            }
            delete self._docs[row.key];
          } else {
            if (!(row.key in self._docs)) {
              if (self._keys.indexOf(row.key) === -1) {
                self._keys.push(row.key);
              }
              length++;
            }
            self._docs[row.key] = row.val;
          }
          return '';
        });
      })
      .on('end', function () {
        if (buffer.length) {
          self.emit('error', new Error('Corrupted row at the end of the db: ' + buffer));
        }
        self.emit('load', length);
      })
      .on('open', function (fd) {
        self._fdRead = fd;
      });

    this._writeStream = fs.createWriteStream(this.path, {
      encoding: 'utf-8',
      flags: 'a'
    });

    this._writeStream.on('drain', function () {
      self._writeDrain();
    });

    this._writeStream.on('open', function (fd) {
      self._fdWrite = fd;
    });
  };

  flushing = false;

  _writeDrain = () => {
    this.flushing = false;

    if (!this._queue.length) {
      this.emit('drain');
    } else {
      this._maybeFlush();
    }
  }

  _maybeFlush = () => {
    if (this.flushing || !this._queue.length) {
      return;
    }

    this._flush();
  };

  _flush =() => {
    var self = this,
      length = this._queue.length,
      bundleLength = 0,
      bundleStr = '',
      key,
      cbs = [];

    this.flushing = true;

    function callbacks(err, cbs) {
      while (cbs.length) {
        cbs.shift()(err);
      }
    }

    for (var i = 0; i < length; i++) {
      key = this._queue[i];
      if (Array.isArray(key)) {
        cbs.push(key[1]);
        key = key[0];
      }

      bundleStr += JSON.stringify({ key: key, val: this._docs[key] }) + '\n';
      bundleLength++;

      if (bundleLength < this.writeBundle && i < length - 1) {
        continue;
      }

      (function (cbs) {
        var isDrained;

        if (!self.path) {
          process.nextTick(function () {
            callbacks(null, cbs);
            self._writeDrain();
          });
          return;
        }

        isDrained = self._writeStream.write(bundleStr, function (err) {
          if (isDrained) {
            self._writeDrain();
          }

          if (!cbs.length && err) {
            self.emit('error', err);
            return;
          }

          callbacks(err, cbs);
        });

      })(cbs);

      bundleStr = '';
      bundleLength = 0;
      cbs = [];
    }

    this._queue = [];
  }

  /**
  * set() stores a JSON object in the database at key
  * cb is fired when the data is persisted.
  * In memory, this is immediate- on disk, it will take some time.
  */
  set = (key:any, val:any, cb?) => {
    if (val === undefined) {
      this._keys.splice(this._keys.indexOf(key), 1);
      delete this._docs[key];
    } else {
      if (this._keys.indexOf(key) === -1) {
        this._keys.push(key);
      }
      this._docs[key] = val;
    }

    if (!cb) {
      this._queue.push(key);
    } else {
      this._queue.push([key, cb]);
    }

    this._maybeFlush();
  }

  /**
  * Get the value stored at a key in the database
  * This is synchronous since a cache is maintained in-memory
  */
  get = (key) => {
    return this._docs[key];
  };

  /**
  * Get total number of stored keys
  */
  size = () => {
    return this._keys.length;
  };

  /**
  * Remove a key and the value stored there
  */
  rm = (key, cb) => {
    this.set(key, undefined, cb);
  };

  /**
  * Iterate over keys, applying match function
  */
  forEach =  (fn) => {

    for (var i = 0; i < this._keys.length; i++) {
      var key = this._keys[i];
      if (fn(key, this._docs[key]) === false) {
        break;
      }
    }

  };

  /**
   * Close dirty db file stream, release file handle
   */
  close = () => {

    if (!this.path) {
      return;
    }

    this._maybeFlush();

    var self = this;
    if (this._fdRead) {
      fs.close(this._fdRead, function () {
        self.emit('read_close');
      });
    }
    if (this._fdWrite) {
      fs.close(this._fdWrite, function () {
        self.emit('write_close');
      });
    }
  }
}


