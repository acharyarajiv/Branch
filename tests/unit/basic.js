// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2013, Microsoft Open Technologies, Inc.
//
// All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//     -             Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//     -             Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//     -             Neither the name of the Microsoft Open Technologies, Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

exports.Basic = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  basic = {},
  name = 'Basic',
  client = '',
  tester = {},
  server_pid = '',
  server_host = '',
  server_port = '',
  all_tests = '',
  client_pid = '';

  //public property
  basic.debug_mode = false;

  //public method
  basic.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'basic';
      var overrides = {};
      var args = {};
      args['name'] = name;
      args['tags'] = tags;
      args['overrides'] = overrides;
      server.start_server(client_pid, args, function (err, res) {
        if (err) {
          callback(err, null);
        }
        server_pid = res;
        client = g.srv[client_pid][server_pid]['client'];
        server_host = g.srv[client_pid][server_pid]['host'];
        server_port = g.srv[client_pid][server_pid]['port'];
        all_tests = Object.keys(tester);
        testEmitter.emit('next');
      });
    });
    testEmitter.on('next', function () {
      setTimeout(function () {
        var test_case_name = all_tests.shift();
        if (test_case_name) {
          tester[test_case_name](function (error) {
            ut.fail(error);
            testEmitter.emit('next');
          });
        } else {
          client.end();
          if (basic.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
          }
          testEmitter.emit('end');
        }
      }, ut.timeout);
    });
    testEmitter.on('end', function () {
      server.kill_server(client_pid, server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        }
        callback(null, true);
      });
    });
    if (basic.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  //private methods

  function assert_encoding(enc, key, callback) {
    client.object('encoding', key, function (error, res) {
      if (error) {
        callback(error, null);
      }
      var pattern = /( swapped at: )/;
      while (pattern.test(res)) {
        client.debug('swapin', key, function (err, res) {
          if (err) {
            callback(err, null);
          }
          client.debug('object', key, function (err, res) {
            if (err) {
              callback(err, null);
            }
          });
        });
      }
      var message = 'Encoding: Expected:' + enc + ', Actual:' + res + ' for key:' + key;
      try {
        if (!assert.equal(res, enc, 'Error: ' + message) && (!assert.ifError(error))) {
          callback(null, true);
        }
      } catch (e) {
        callback(e, null);
      }
    });
  }

  // test methods
  tester.Basic1 = function (errorCallback) {
    var test_case = 'DEL all keys to start with a clean DB';
    client.keys('*', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, res.length, function (loop) {
        var i = loop.iteration();
        client.del(res[i], function (err) {
          if (err) {
            errorCallback(err);
          }
          loop.next();
        });
      }, function () {
        client.dbsize(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 0, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic2 = function (errorCallback) {
    var test_case = 'SET and GET an item';
    client.set('x', 'foobar', function (err, res) {
      client.get('x', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 'foobar', test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic3 = function (errorCallback) {
    client.set('x', '', function (err, res) {
      var test_case = 'SET and GET an empty item';
      client.get('x', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, '', test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic4 = function (errorCallback) {
    var test_case = 'Del against a single item';
    client.del('x', function (err) {
      if (err) {
        errorCallback(err);
      }
      client.get('x', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, null, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic5 = function (errorCallback) {
    var test_case = 'Vararg Del';
    client.set('foo1', 'a', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('foo2', 'b', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.set('foo3', 'c', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.del('foo1', 'foo2', 'foo3', function (err, res1) {
            if (err) {
              errorCallback(err);
            }
            client.mget('foo1', 'foo2', 'foo3', function (err, res2) {
              if (err) {
                errorCallback(err);
              }
              ut.assertMany(
                [
                  ['equal', res1, 3],
                  ['deepequal', res2, [null, null, null]]
                ], test_case);

              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.Basic6 = function (errorCallback) {
    var test_case = 'KEYS with pattern';
    var keys = ['key_x', 'key_y', 'key_z', 'foo_a', 'foo_b', 'foo_c'];
    g.asyncFor(0, keys.length, function (loop) {
      client.set(keys[loop.iteration()], 'Hello', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        loop.next();
      });
    }, function () {
      client.keys('foo*', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(res.sort(ut.sortFunction), ['foo_a', 'foo_b', 'foo_c'], test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic7 = function (errorCallback) {
    var test_case = 'KEYS to get all keys';
    client.keys('*', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      res.sort(function (a, b) {
        return a - b
      });
      ut.assertDeepEqual(res.sort(ut.sortFunction), ['foo_a', 'foo_b', 'foo_c', 'key_x', 'key_y', 'key_z'], test_case);
      testEmitter.emit('next');
    });
  };

  tester.Basic8 = function (errorCallback) {
    var test_case = 'DBSIZE';
    client.dbsize(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 6, test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic9 = function (errorCallback) {
    var test_case = 'Del all keys';
    client.keys('*', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, res.length, function (loop) {
        client.del(res[loop.iteration()], function (err) {
          if (err) {
            errorCallback(err);
          }
          loop.next();
        });
      }, function () {
        client.dbsize(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 0, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic10 = function (errorCallback) {
    var test_case = 'Very big payload in GET/SET';
    var cli = redis.createClient(server_port, server_host, {
        return_buffers : true
      });
    if (basic.debug_mode) {
      log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
    }
    var buf = new Buffer(1000000);
    buf.fill('abcd');
    cli.set('foo', buf.toString(), function (err, res) {
      if (err) {
        errorCallback(err);
      }
      cli.get('foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertOk(buf.equals(res), true, test_case);
        cli.end();
        if (basic.debug_mode) {
          log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
        }
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic11_1 = function (errorCallback) {
    var test_case = 'Very big payload random access';
    var error = new Array();
    var payload = {};
    var cli = redis.createClient(server_port, server_host, {
        return_buffers : true
      });
    if (basic.debug_mode) {
      log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
    }
    async.series({
      one : function (cb) {
        g.asyncFor(0, 100, function (loop) {
          var j = loop.iteration();
          var size = g.randomInt(100000) + 1;
          var val = 'pl-' + j;
          var buf = new Buffer(size);
          buf.fill(val);
          payload[j] = buf;
          var key = 'bigpayload_' + j;
          cli.set(key, buf, function (err, res) {
            if (err) {
              cb(err);
            }
            loop.next();
          });
        }, function () {
          cb(null, true);
        });
      },
      two : function (cb) {
        g.asyncFor(0, 1000, function (loop) {
          var index = g.randomInt(100) - 1;
          var key = 'bigpayload_' + index;
          cli.get(key, function (err, buf) {
            if (err) {
              errorCallback(err);
            }
            if (!buf.equals(payload[index])) {
              error.push('Values Differ: I set ' + payload[index].toString() + ' but i read back ' + buf.toString());
              cb(new Error(error.shift()));
            }
            loop.next();
          });
        }, function () {
          cb(null, true);
        });
      },
    }, function (err, results) {
      if (err) {
        errorCallback(err);
      }
      ut.assertMany(
        [
          ['equal', results['one'], true],
          ['equal', results['two'], true]
        ], test_case);
      cli.end();
      if (basic.debug_mode) {
        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
      }
      testEmitter.emit('next');
    });
  };

  tester.Basic11_2 = function (errorCallback) {
    //tag slow
    var test_case = 'SET 10000 numeric keys and access all them in reverse order';
    var error = new Array();
    async.series({
      one : function (cb) {
        g.asyncFor(0, 10000, function (loop) {
          var i = loop.iteration();
          client.set(i, i, function (err, res) {
            if (err) {
              cb(err, null);
            }
            loop.next();
          });
        }, function () {
          cb(null, true);
        });
      },
      two : function (cb) {
        var sum = 0;
        g.asyncFor(0, 10000, function (loop) {
          var j = 10000 - (loop.iteration() + 1);
          client.get(j, function (err, res) {
            if (err) {
              cb(err, null);
            }
            if (j != res) {
              var str = 'Element at position ' + j + ' is ' + res + ' instead of ' + j;
              error.push(str);
              cb(new Error(error), null);
            }
            loop.next();
          });

        }, function () {
          cb(null, true);
        });
      },
    }, function (err, results) {
      if (err) {
        errorCallback(err);
      }
      ut.assertMany(
        [
          ['equal', results['one'], true],
          ['equal', results['two'], true],
          ['error', err]
        ], test_case);

      testEmitter.emit('next');
    });
  };

  tester.Basic11_3 = function (errorCallback) {
    var test_case = 'DBSIZE should be 10101 now';
    client.dbsize(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 10101, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Basic12 = function (errorCallback) {
    var test_case = 'INCR against non existing key';
    client.incr('nokey', function (err, res1) {
      if (err) {
        errorCallback(err);
      }
      client.get('nokey', function (err, res2) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res1 + res2, '11', test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic13 = function (errorCallback) {
    var test_case = 'INCR against key created by incr itself';
    client.incr('nokey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 2, test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic14 = function (errorCallback) {
    var test_case = 'INCR against key originally set with SET';
    client.set('nokey', 100, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incr('nokey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 101, test_case);
        testEmitter.emit('next');
      });
    });

  };
  tester.Basic15 = function (errorCallback) {
    var test_case = 'INCR over 32bit value';
    client.set('nokey', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incr('nokey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 17179869185, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic16 = function (errorCallback) {
    var test_case = 'INCRBY over 32bit value with over 32bit increment';
    client.set('nokey', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrby('nokey', 17179869184, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 34359738368, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic17_1 = function (errorCallback) {
    var test_case = 'INCR fails against key with spaces (left)';
    client.set('novar', '  11', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incr('novar', function (err, res) {
        ut.assertOk(err, null, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic17_2 = function (errorCallback) {
    var test_case = 'INCR fails against key with spaces (right)';
    client.set('novar', '11  ', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incr('novar', function (err, res) {
        ut.assertOk(err, null, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic17_3 = function (errorCallback) {
    var test_case = 'INCR fails against key with spaces (both)';
    client.set('novar', '  11  ', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incr('novar', function (err, res) {
        ut.assertOk(err, null, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic18 = function (errorCallback) {
    var test_case = 'INCR fails against a key holding a list';
    client.rpush('mylist', 1, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incr('mylist', function (err, res) {
        try {
          // error should be observed.
          if (!assert.ok(err, test_case)) {
            // pass this test after rpop works . see below
          }
        } catch (e) {
          ut.fail(e);
        }
        client.rpop('mylist', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.pass(test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Basic19 = function (errorCallback) {
    var test_case = 'DECRBY over 32bit value with over 32bit increment, negative res';
    client.set('nokey', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.decrby('nokey', 17179869185, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, -1, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_1 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT against non existing key';
    var arr = [];
    client.del('novar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('novar', 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        arr.push(ut.roundFloat(res));
        client.get('novar', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          arr.push(ut.roundFloat(res));
          client.incrbyfloat('novar', 0.25, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            arr.push(ut.roundFloat(res));
            client.get('novar', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              arr.push(ut.roundFloat(res));
              ut.assertDeepEqual(arr, [1, 1, 1.25, 1.25], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  tester.Basic19_2 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT against key originally set with SET';
    client.set('novar', 1.5, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('novar', 1.5, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(ut.roundFloat(res), 3, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_3 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT over 32bit value';
    client.set('novar', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('novar', 1.5, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(ut.roundFloat(res), 17179869185.5, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_4 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT over 32bit value with over 32bit increment';
    client.set('novar', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('novar', 17179869184, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(ut.roundFloat(res), 34359738368, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_5 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT fails against key with spaces (left)';
    client.set('novar', '  11', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('novar', 1.0, function (err, res) {
        ut.assertOk('not a valid', err, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_6 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT fails against key with spaces (right)';
    client.set('novar', '11  ', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('novar', 1.0, function (err, res) {
        ut.assertOk('not a valid', err, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_7 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT fails against key with spaces (both)';
    client.set('novar', '  11  ', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('novar', 1.0, function (err, res) {
        ut.assertOk('not a valid', err, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_8 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT fails against a key holding a list';
    client.del('mylist', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.rpush('mylist', 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.incrbyfloat('mylist', 1.0, function (err, res) {
          ut.assertOk('WRONGTYPE', err, test_case);
          client.del('mylist', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Basic19_9 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT does not allow NaN or Infinity';
    client.set('foo', 0, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('foo', '+inf', function (err, res) {
        //p.s. no way I can force NaN to test it from the API because
        //there is no way to increment / decrement by infinity nor to
        //perform divisions.
        ut.assertOk('would produce', err, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic19_10 = function (errorCallback) {
    var test_case = 'INCRBYFLOAT decrement';
    client.set('foo', 1, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.incrbyfloat('foo', -1.1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(ut.roundFloat(res), -0.1, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic20 = function (errorCallback) {
    var test_case = 'SETNX target key missing';
    client.del('nokey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setnx('nokey', 'foobared', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.get('nokey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 'foobared', test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Basic21 = function (errorCallback) {
    var test_case = 'SETNX target key exists';
    client.set('nokey', 'foobared', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setnx('nokey', 'blabla', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.get('nokey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 'foobared', test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Basic22 = function (errorCallback) {
    var test_case = 'SETNX against not-expired volatile key';
    client.set('x', 10, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.expire('x', 10000, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.setnx('x', 20, function (err, res1) {
          if (err) {
            errorCallback(err);
          }
          client.get('x', function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            ut.assertMany(
              [
                ['equal', res2, 10],
                ['equal', res1, 0]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Basic23 = function (errorCallback) {
    // Make it very unlikely for the key this test uses to be
    // expired by the active expiry cycle. This is tightly coupled
    // to the implementation of active expiry and dbAdd() but
    // currently the only way to test that SETNX expires a key when
    // it should have been.
    var test_case = 'SETNX against expired volatile key';
    g.asyncFor(0, 9999, function (loop) {
      var i = loop.iteration();
      client.setex('key-' + i, 3600, 'value', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        loop.next();
      });
    }, function () {
      // This will be one of 10000 expiring keys. A cycle is executed every
      // 100ms, sampling 10 keys for being expired or not.  This key will be
      // expired for at most 1s when we wait 2s, resulting in a total sample
      // of 100 keys. The probability of the success of this test being a
      // false positive is therefore approx. 1%.
      client.set('x', 10, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.expire('x', 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          // Wait for the key to expire
          setTimeout(function () {
            client.setnx('x', 20, function (err, res1) {
              if (err) {
                errorCallback(err);
              }
              client.get('x', function (err, res2) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany(
                  [
                    ['equal', res2, 20],
                    ['equal', res1, 1]
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          }, 2000);
        });
      });
    });
  };
  tester.Basic24 = function (errorCallback) {
    var test_case = 'EXISTS';
    var result_array = new Array();
    client.set('newkey', 'test', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.exists('newkey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.del('newkey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.exists('newkey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            ut.assertDeepEqual(result_array, [1, 0], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Basic25 = function (errorCallback) {
    var test_case = 'Zero length value in key. SET/GET/EXISTS';
    var result_array = new Array();
    client.set('emptykey', '', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.get('emptykey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.exists('emptykey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.del('emptykey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.exists('emptykey', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              ut.assertDeepEqual(result_array, [1, 0], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  tester.Basic26 = function (errorCallback) {
    var test_case = 'Commands pipelining';
    var result = [];
    var stream = net.createConnection(server_port, server_host);
    if (basic.debug_mode) {
      log.notice(name + ':Client connected listeting to socket : ' + server_host + ':' + server_port);
    }
    stream.on('connect', function () {
      stream.write('SET k1 xyzk\r\nGET k1\r\nPING\r\n');
    });
    stream.on('data', function (data) {
      var res = data.toString();
      ut.assertMany(
        [
          ['ok', 'OK*', res],
          ['ok', 'xyzk', res],
          ['ok', 'PONG*', res]
        ], test_case);
      stream.end();
    });
    stream.on('close', function () {
      if (basic.debug_mode) {
        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
      }
      testEmitter.emit('next');
    });
  };

  tester.Basic27 = function (errorCallback) {
    var test_case = 'Non existing command';
    try {
      client.foobaredcommand(function (err, res) {
        if (res) {
          ut.fail(test_case);
          errorCallback(test_case);
        }
      });
    } catch (e) {
      ut.pass(test_case);
      testEmitter.emit('next');
    }
  };
  tester.Basic28 = function (errorCallback) {
    var test_case = 'RENAME basic usage';
    client.set('mykey', 'hello', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.rename('mykey', 'mykey1', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.rename('mykey1', 'mykey2', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.get('mykey2', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.assertEqual(res, 'hello', test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Basic29 = function (errorCallback) {
    var test_case = 'RENAME source key should no longer exist';
    client.exists('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 0, test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic30 = function (errorCallback) {
    var test_case = 'RENAME against already existing key';
    var result_array = new Array();
    client.set('mykey', 'a', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('mykey2', 'b', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.rename('mykey2', 'mykey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.get('mykey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.exists('mykey2', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              ut.assertDeepEqual(result_array, ['b', '0'], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.Basic31 = function (errorCallback) {
    var test_case = 'RENAMENX basic usage';
    var result_array = new Array();
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.del('mykey2', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.set('mykey', 'foobar', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.renamenx('mykey', 'mykey2', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.get('mykey2', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.exists('mykey', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                ut.assertDeepEqual(result_array, ['foobar', '0'], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };
  tester.Basic32 = function (errorCallback) {
    var test_case = 'RENAMENX against already existing key (2)';
    var result_array = new Array();
    client.get('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result_array.push(res);
      client.get('mykey2', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        ut.assertDeepEqual(result_array, [null, 'foobar'], test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic33 = function (errorCallback) {
    var test_case = 'RENAME against non existing source key';
    client.rename('fhdfdfgdfg', 'foobar', function (err, res) {
      if (res != 'undefined') {
        ut.pass(test_case);
        testEmitter.emit('next');
      } else {
        ut.fail(e);
      }
    });
  };
  tester.Basic33_1 = function (errorCallback) {
    var test_case = 'RENAME where source and dest key is the same';
    client.rename('mykey', 'mykey', function (err, res) {
      if (res != 'undefined') {
        ut.pass(test_case);
        testEmitter.emit('next');
      } else {
        ut.fail(test_case);
        errorCallback(test_case);
      }
    });
  };
  tester.Basic34 = function (errorCallback) {
    var flag = 0;
    var test_case = 'RENAME with volatile key, should move the TTL as well';
    client.del('mykey', 'mykey2', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('mykey', 'foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.expire('mykey', 100, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.ttl('mykey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            try {
              if (!assert.ok(check(res), test_case)) {
                flag += 1;
              }
            } catch (e) {
              errorCallback(e);
            }
            client.rename('mykey', 'mykey2', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.ttl('mykey2', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                try {
                  if (!assert.ok(check(res), test_case)) {
                    flag += 1;
                  }
                } catch (e) {
                  errorCallback(e);
                }
                if (flag == 2) {
                  ut.pass(test_case);
                }
                testEmitter.emit('next');
              });
            });
            function check(res) {
              if (res > 95 && res <= 100)
                return true;
              else
                return false;
            }
          });
        });
      });
    });
  };
  tester.Basic35 = function (errorCallback) {
    var flag = 0;
    var test_case = 'RENAME with volatile key, should not inherit TTL of target key';
    client.del('mykey', 'mykey2', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('mykey', 'foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.set('mykey2', 'bar', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.expire('mykey2', 100, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.ttl('mykey', function (err, res1) {
              if (err) {
                errorCallback(err);
              }
              client.ttl('mykey2', function (err, res2) {
                if (err) {
                  errorCallback(err);
                }
                client.rename('mykey', 'mykey2', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.ttl('mykey2', function (err, res3) {
                    if (err) {
                      errorCallback(err);
                    }
                    try {
                      if ((!assert.equal(res3, -1, test_case)) && (!assert.ok(check(res1, res2), test_case))) {
                        ut.pass(test_case);
                      }
                    } catch (e) {
                      ut.fail(e);
                    }
                    testEmitter.emit('next');
                  });
                });
                function check(res1, res2) {
                  if (res1 == -1 && res2 > 0)
                    return true;
                  else
                    return false;
                }
              });
            });
          });
        });
      });
    });
  };
  tester.Basic36 = function (errorCallback) {
    var test_case = 'DEL all keys again (DB 0)';
    client.keys('*', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, res.length, function (loop) {
        var i = loop.iteration();
        client.del(res[i], function (err) {
          if (err) {
            errorCallback(err);
          }
          loop.next();
        });
      }, function () {
        client.dbsize(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 0, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic37 = function (errorCallback) {
    var test_case = 'DEL all keys again (DB 1)';
    client.select(10, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.keys('*', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        g.asyncFor(0, res.length, function (loop) {
          var i = loop.iteration();
          client.del(res[i], function (err) {
            if (err) {
              errorCallback(err);
            }
            loop.next();
          });
        }, function () {
          client.dbsize(function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.assertEqual(res, 0, test_case);
            client.select(9);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Basic38 = function (errorCallback) {
    var test_case = 'MOVE basic usage';
    var result_array = new Array();
    client.set('mykey', 'foobar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.move('mykey', 10, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.exists('mykey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.dbsize(function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.select(10, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.get('mykey', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.dbsize(function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  client.select(9);
                  ut.assertDeepEqual(result_array, [0, 0, 'foobar', 1], test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic39 = function (errorCallback) {
    var test_case = 'MOVE against key existing in the target DB';
    client.set('mykey', 'hello', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.move('mykey', 10, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 0, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic40 = function (errorCallback) {
    var test_case = 'SET/GET keys in different DBs';
    var result_array = new Array();
    client.set('a', 'hello', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('b', 'world', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.select(10);
        client.set('a', 'foo', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.set('b', 'bared', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.select(9);
            client.get('a', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.get('b', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.select(10);
                client.get('a', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  client.get('b', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    ut.assertDeepEqual(result_array, ['hello', 'world', 'foo', 'bared'], test_case);
                    testEmitter.emit('next');
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic41 = function (errorCallback) {
    var test_case = 'MGET';
    client.flushdb();
    client.set('foo', 'BAR', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('bar', 'FOO', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        multi = client.multi();
        multi.mget('foo', 'bar', function (err, res) {
          if (err) {
            errorCallback(err);
          }
        });
        multi.exec(function (err, replies) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(replies, [['BAR', 'FOO']], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic42 = function (errorCallback) {
    var test_case = 'MGET against non existing key';
    multi = client.multi();
    multi.mget('foo', 'baazz', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
    });
    multi.exec(function (err, replies) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(replies, [['BAR', null, 'FOO']], test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic43 = function (errorCallback) {
    var test_case = 'MGET against non-string key';
    client.sadd('myset', 'ciao', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 'bau', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        multi = client.multi();
        multi.mget('foo', 'baazz', 'bar', 'myset', function (err, res) {
          if (err) {
            errorCallback(err);
          }
        });
        multi.exec(function (err, replies) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(replies, [['BAR', null, 'FOO', null]], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Basic44 = function (errorCallback) {
    var test_case = 'RANDOMKEY';
    var result = new Array();
    var foo_seen = 0;
    var bar_seen = 0;
    client.flushdb(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('foo', 'x', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.set('bar', 'y', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          g.asyncFor(0, 100, function (loop) {
            client.randomkey(function (err, rkey) {
              if (err) {
                errorCallback(err);
              }
              if (rkey == 'foo') {
                foo_seen = 1;
              }
              if (rkey == 'bar') {
                bar_seen = 1;
              }
              result[0] = foo_seen;
              result[1] = bar_seen;
              loop.next();
            });
          }, function () {
            ut.assertDeepEqual(result, [1, 1], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Basic45 = function (errorCallback) {
    var test_case = 'RANDOMKEY against empty DB';
    client.flushdb();
    client.randomkey(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, null, test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic46 = function (errorCallback) {
    var test_case = 'RANDOMKEY regression 1';
    client.flushdb();
    client.set('x', 10, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.del('x', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.randomkey(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, null, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic47 = function (errorCallback) {
    var test_case = 'GETSET (set new value)';
    var result_array = new Array();
    client.getset('foo', 'xyz', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result_array.push(res);
      client.get('foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        ut.assertDeepEqual(result_array, [null, 'xyz'], test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic48 = function (errorCallback) {
    var test_case = 'GETSET (replace old value)';
    var result_array = new Array();
    client.set('foo', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getset('foo', 'xyz', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.get('foo', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          ut.assertDeepEqual(result_array, ['bar', 'xyz'], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic49 = function (errorCallback) {
    var test_case = 'MSET base case';
    client.multi()
    .mset('x', 10, 'y', 'foo bar', 'z', 'x x x x x x x\n\n\r\n')
    .mget('x', 'y', 'z')
    .exec(function (err, replies) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(replies, ['OK', [10, 'foo bar', 'x x x x x x x\n\n\r\n']], test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic50 = function (errorCallback) {
    var test_case = 'MSET wrong number of args';
    client.multi()
    .mset('x', 10, 'y', 'foo bar', 'z')
    .exec(function (err, replies) {
      ut.assertOk(replies, null, test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic51 = function (errorCallback) {
    var test_case = 'MSETNX with already existent key';
    client.multi()
    .msetnx('x1', 'xxx', 'y2', 'yyy', 'x', 20)
    .exists('x1')
    .exists('y2')
    .exec(function (err, replies) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(replies, [0, 0, 0], test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic52 = function (errorCallback) {
    var test_case = 'STRLEN against non-existing key';
    client.strlen('notakey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 0, test_case);
      testEmitter.emit('next');
    });
  };
  tester.Basic53 = function (errorCallback) {
    var test_case = 'STRLEN against integer-encoded value';
    client.set('myinteger', -555, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.strlen('myinteger', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 4, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic53 = function (errorCallback) {
    var test_case = 'STRLEN against plain string';
    client.set('mystring', 'foozzz0123456789 baz', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.strlen('mystring', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 20, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic54 = function (errorCallback) {
    var test_case = 'SETBIT against non-existing key';
    var result_array = new Array();
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setbit('mykey', 1, 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.get('mykey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          // Ascii '@' is integer 64 = 01 00 00 00
          // the result should be 01000000
          result_array.push(res);
          ut.assertDeepEqual(result_array, [0, '@'], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic55 = function (errorCallback) {
    var test_case = 'SETBIT against string-encoded key';
    var result_array = new Array();
    client.set('mykey', '@', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setbit('mykey', 2, 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.get('mykey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.setbit('mykey', 1, 0, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.get('mykey', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              ut.assertDeepEqual(result_array, [0, '`', 1, ' '], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.Basic56 = function (errorCallback) {
    var test_case = 'SETBIT against integer-encoded key';
    // Ascii '1' is integer 49 = 00 11 00 01
    var result_array = new Array();
    client.set('mykey', 1, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('int', 'mykey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.setbit('mykey', 6, 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.get('mykey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.setbit('mykey', 2, 0, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.get('mykey', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                ut.assertDeepEqual(result_array, [0, '3', 1, '\u0013'], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };
  tester.Basic57 = function (errorCallback) {
    var test_case = 'SETBIT against key with wrong type';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.lpush('mykey', 'foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.setbit('mykey', 0, 1, function (err, res) {
          if (res) {
            errorCallback(res);
          }
          ut.assertOk('WRONGTYPE', err, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic58 = function (errorCallback) {
    var test_case = 'SETBIT with out of range bit offset';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var range = 4 * 1024 * 1024 * 1024;
      client.setbit('mykey', range, 1, function (err1, res) {
        if (res) {
          errorCallback(res);
        }
        client.setbit('mykey', -1, 1, function (err2, res) {
          if (res) {
            errorCallback(res);
          }
          ut.assertMany(
            [
              ['ok', err1, null],
              ['ok', err2, null]
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic59 = function (errorCallback) {
    var test_case = 'SETBIT with non-bit argument';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setbit('mykey', 0, -1, function (err1, res) {
        if (res) {
          errorCallback(res);
        }
        client.setbit('mykey', 0, 2, function (err2, res) {
          if (res) {
            errorCallback(res);
          }
          client.setbit('mykey', 0, 10, function (err3, res) {
            if (res) {
              errorCallback(res);
            }
            client.setbit('mykey', 0, 10, function (err4, res) {
              if (res) {
                errorCallback(res);
              }
              ut.assertMany(
                [
                  ['ok', err1, null],
                  ['ok', err2, null],
                  ['ok', err3, null],
                  ['ok', err4, null]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  tester.Basic61 = function (errorCallback) {
    var test_case = 'GETBIT against non-existing key';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getbit('mykey', 0, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 0, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Basic62 = function (errorCallback) {
    var test_case = 'GETBIT against string-encoded key';
    var result_array = new Array();
    client.set('mykey', '`', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getbit('mykey', 0, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.getbit('mykey', 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.getbit('mykey', 2, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.getbit('mykey', 3, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.getbit('mykey', 8, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.getbit('mykey', 100, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  client.getbit('mykey', 1000, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    ut.assertDeepEqual(result_array, [0, 1, 1, 0, 0, 0, 0], test_case);
                    testEmitter.emit('next');
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic62 = function (errorCallback) {
    var test_case = 'GETBIT against integer-encoded key';
    var result_array = new Array();
    client.set('mykey', 1, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('int', 'mykey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        // Ascii '1' is integer 49 = 00 11 00 01
        client.getbit('mykey', 0, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.getbit('mykey', 1, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.getbit('mykey', 2, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.getbit('mykey', 3, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.getbit('mykey', 8, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  client.getbit('mykey', 100, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    client.getbit('mykey', 1000, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      result_array.push(res);
                      ut.assertDeepEqual(result_array, [0, 0, 1, 1, 0, 0, 0], test_case);
                      testEmitter.emit('next');
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic63 = function (errorCallback) {
    var test_case = 'SETRANGE against non-existing key';
    var result_array = new Array();
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setrange('mykey', 0, 'foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.get('mykey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.del('mykey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.setrange('mykey', 0, '', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.exists('mykey', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.del('mykey', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.setrange('mykey', 1, 'foo', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    client.get('mykey', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      result_array.push(res);
                      ut.assertDeepEqual(result_array, [3, 'foo', 0, 0, 4, '\000foo'], test_case);
                      testEmitter.emit('next');
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic64 = function (errorCallback) {
    var test_case = 'SETRANGE against string-encoded key';
    var result_array = new Array();
    client.set('mykey', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setrange('mykey', 0, 'b', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.get('mykey', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.set('mykey', 'foo', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.setrange('mykey', 0, '', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.get('mykey', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.set('mykey', 'foo', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.setrange('mykey', 1, 'b', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    client.get('mykey', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      result_array.push(res);
                      client.set('mykey', 'foo', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        client.setrange('mykey', 4, 'bar', function (err, res) {
                          if (err) {
                            errorCallback(err);
                          }
                          result_array.push(res);
                          client.get('mykey', function (err, res) {
                            if (err) {
                              errorCallback(err);
                            }
                            result_array.push(res);
                            ut.assertDeepEqual(result_array, [3, 'boo', 3, 'foo', 3, 'fbo', 7, 'foo\000bar'], test_case);
                            testEmitter.emit('next');
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic64 = function (errorCallback) {
    var test_case = 'SETRANGE against integer-encoded key';
    var result_array = new Array();
    client.set('mykey', 1234, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('int', 'mykey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.setrange('mykey', 0, 2, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          assert_encoding('raw', 'mykey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.get('mykey', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              // Shouldn't change encoding when nothing is set
              client.set('mykey', 1234, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                assert_encoding('int', 'mykey', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.setrange('mykey', 0, '', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    assert_encoding('int', 'mykey', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.get('mykey', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        result_array.push(res);
                        client.set('mykey', 'foo', function (err, res) {
                          if (err) {
                            errorCallback(err);
                          }
                          client.set('mykey', 1234, function (err, res) {
                            if (err) {
                              errorCallback(err);
                            }
                            assert_encoding('int', 'mykey', function (err, res) {
                              if (err) {
                                errorCallback(err);
                              }
                              client.setrange('mykey', 1, 3, function (err, res) {
                                if (err) {
                                  errorCallback(err);
                                }
                                result_array.push(res);
                                assert_encoding('raw', 'mykey', function (err, res) {
                                  if (err) {
                                    errorCallback(err);
                                  }
                                  client.get('mykey', function (err, res) {
                                    if (err) {
                                      errorCallback(err);
                                    }
                                    result_array.push(res);
                                    client.set('mykey', 1234, function (err, res) {
                                      if (err) {
                                        errorCallback(err);
                                      }
                                      client.setrange('mykey', 5, 2, function (err, res) {
                                        if (err) {
                                          errorCallback(err);
                                        }
                                        result_array.push(res);
                                        assert_encoding('raw', 'mykey', function (err, res) {
                                          if (err) {
                                            errorCallback(err);
                                          }
                                          client.get('mykey', function (err, res) {
                                            if (err) {
                                              errorCallback(err);
                                            }
                                            result_array.push(res);
                                            ut.assertDeepEqual(result_array, [4, 2234, 4, 1234, 4, 1334, 6, '1234\0002'], test_case);
                                            testEmitter.emit('next');
                                          });
                                        });
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic65 = function (errorCallback) {
    var test_case = 'SETRANGE against key with wrong type';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.lpush('mykey', 'foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.setrange('mykey', 0, 'bar', function (err, res) {
          if (res) {
            errorCallback(res);
          }
          ut.assertOk('WRONGTYPE', err, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Basic66 = function (errorCallback) {
    var test_case = 'SETRANGE with out of range offset';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var range = 512 * 1024 * 1024 - 4;
      client.setrange('mykey', range, 'world', function (err1, res) {
        if (res) {
          errorCallback(res);
        }
        client.set('mykey', 'hello', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.setrange('mykey', -1, 'world', function (err2, res) {
            if (res) {
              errorCallback(res);
            }
            client.setrange('mykey', range, 'world', function (err3, res) {
              if (res) {
                errorCallback(res);
              }
              ut.assertMany(
                [
                  ['ok', err1, null],
                  ['ok', err2, null],
                  ['ok', err3, null]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.Basic67 = function (errorCallback) {
    var test_case = 'GETRANGE against non-existing key';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getrange('mykey', 0, -1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, '', test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Basic68 = function (errorCallback) {
    var test_case = 'GETBIT against string-encoded key';
    var result_array = new Array();
    client.set('mykey', 'Hello World', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getrange('mykey', 0, 3, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.getrange('mykey', 0, -1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.getrange('mykey', -4, -1, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.getrange('mykey', 5, 3, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.getrange('mykey', 5, 5000, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.getrange('mykey', -5000, 10000, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  ut.assertDeepEqual(result_array, ['Hell', 'Hello World', 'orld', '', ' World', 'Hello World'], test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic69 = function (errorCallback) {
    var test_case = 'GETRANGE against integer-encoded value';
    var result_array = new Array();
    client.set('mykey', 1234, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getrange('mykey', 0, 2, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.getrange('mykey', 0, -1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.getrange('mykey', -3, -1, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.getrange('mykey', 5, 3, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.getrange('mykey', 3, 5000, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.getrange('mykey', -5000, 10000, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  ut.assertDeepEqual(result_array, [123, 1234, 234, '', 4, 1234], test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  };
  tester.Basic70 = function (errorCallback) {
    var test_case = 'GETRANGE fuzzing';
    var error = null;
    var cli = redis.createClient(server_port, server_host, {
        return_buffers : true
      });
    if (basic.debug_mode) {
      log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
    }
    g.asyncFor(0, 1000, function (loop) {
      var i = loop.iteration();
      var buf = new Buffer(1024);
      var len = buf.write(ut.randstring(0, 1024, 'binary'), 'binary');
      cli.set('bin', buf, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        // Buffer.slice() cannot go beyond start and end.
        var _start = start = g.randomInt(1023);
        var _end = end = g.randomInt(1023);
        _start = _start > _end ? _end + 1 : _start;

        cli.getrange('bin', start, end, function (err, result) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.ok(result.equals(buf.slice(_start, _end + 1)), test_case)) {
              loop.next();
            }
          } catch (e) {
            error = e;
            loop.break();
          }
        });
      });
    }, function () {
      if (error) {
        cli.end();
        if (basic.debug_mode) {
          log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
        }
        errorCallback(error);
      } else {
        ut.pass(test_case);
        cli.end();
        if (basic.debug_mode) {
          log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
        }
        testEmitter.emit('next');
      }
    });
  };

  tester.basic71 = function (errorCallback) {
    var test_case = 'EXPIRES after a reload (snapshot + append only file)';
    var cli = redis.createClient(server_port, server_host, {
        no_ready_check : true
      });
    if (basic.debug_mode) {
      log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
    }
    var e = new Array();
    cli.flushdb(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      cli.set('x', 10, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        cli.expire('x', 1000, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          cli.save(function (err, res) {
            if (err) {
              errorCallback(err);
            }
            cli.debug('reload', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              cli.ttl('x', function (err, ttl) {
                if (err) {
                  errorCallback(err);
                }
                if (ttl > 900 && ttl <= 1000)
                  e.push(1);
                else
                  e.push(0);
                cli.bgrewriteaof(function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  ut.waitForBgrewriteaof(cli, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    setInterval(function () {
                      cli.debug('loadaof', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        cli.ttl('x', function (err, ttl) {
                          if (err) {
                            errorCallback(err);
                          }
                          if (ttl > 900 && ttl <= 1000)
                            e.push(1);
                          else
                            e.push(0);
                          ut.assertDeepEqual(e, [1, 1], test_case);
                          cli.end();
                          if (basic.debug_mode) {
                            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                          }
                          testEmitter.emit('next');
                        });
                      });
                    }, 1000);
                  });
                });
              });
            });
          });
        });
      });
    });
  };

  tester.basic72 = function (errorCallback) {
    var test_case = 'Basic INCRBY and DECR';
    var res_Array = [];
    client.set('foo', 1);
    client.incrby('foo', 1);
    client.get('foo', function (err, res) {
      res_Array.push(res);
      client.incrby('foo', -1);
      client.get('foo', function (err, res) {
        res_Array.push(res);
        client.decr('foo');
        client.get('foo', function (err, res) {
          res_Array.push(res);
          client.incrby('foo', 'a', function (err, res) {
            ut.assertMany(
              [
                ['deepequal', res_Array, [2, 1, 0]],
                ['ok', 'ERR', err]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  }

  tester.basic73 = function (errorCallback) {
    var test_case = 'SETBIT throw Error for bits out of range';
    var res_Array = [];
    client.setbit('mykey', 1, 0xffffffff, function (err1, res) {
      client.setbit('mykey', 1, 1e100, function (err2, res) {
        ut.assertMany(
          [
            ['ok', 'out of range', err1],
            ['ok', 'out of range', err2]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.basic74 = function (errorCallback) {
    var test_case = 'GETBIT throw Error for bits out of range';
    var res_Array = [];
    client.getbit('mykey', -1, function (err1, res) {
      ut.assertOk('out of range', err1, test_case);
      testEmitter.emit('next');
    });
  }

  tester.basic75 = function (errorCallback) {
    var test_case = 'SETRANGE and GETRANGE throw Error for bits out of range';
    var res_Array = [];
    client.setrange('mykey', -1e-100, 'foo', function (err1, res) {
      client.getrange('mykey', -1e-100, 0, function (err2, res) {
        client.getrange('mykey', 0, -1e-100, function (err3, res) {
          ut.assertMany(
            [
              ['ok', 'out of range', err1],
              ['ok', 'out of range', err2],
              ['ok', 'out of range', err3]
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  tester.basic76 = function (errorCallback) {
    var test_case = 'KEYS * two times with long key, Github issue #1208';
    client.flushdb();
    client.set('dlskeriewrioeuwqoirueioqwrueoqwrueqw', 'test', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.keys('*', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        client.keys('*', function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          ut.assertEqual(res, 'dlskeriewrioeuwqoirueioqwrueoqwrueqw', test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  return basic;

}
  ());