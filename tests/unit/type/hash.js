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

exports.Hash = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  hash = {},
  name = 'Hash',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {},
  bighash = {},
  smallhash = {};

  //public property
  hash.debug_mode = false;

  //public method
  hash.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'hash';
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
          if (hash.debug_mode) {
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
        } else if (res) {
          callback(null, true);
        }
      });
    });

    if (hash.debug_mode) {
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

  tester.Hash1 = function (errorCallback) {
    var test_case = 'HSET/HLEN - Small hash creation';
    g.asyncFor(0, 8, function (loop) {
      var key = ut.randstring(0, 8, 'alpha');
      var val = ut.randstring(0, 8, 'alpha');
      if (!smallhash.hasOwnProperty(key)) {
        smallhash[key] = val;
        client.hset('smallhash', key, val, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          loop.next();
        });
      } else {
        loop.decrease(1);
        loop.next();
      }
    }, function () {
      client.hlen('smallhash', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 8, test_case);
        testEmitter.emit('next');
      });

    });
  };

  tester.Hash2 = function (errorCallback) {
    var test_case = 'Is the small hash encoded with a ziplist?';
    assert_encoding('ziplist', 'smallhash', function (err, res) {
      if (err) {
        errorCallback(err);
      } else {
        ut.assertOk(res, null, test_case);
        testEmitter.emit('next');
      }
    });

  };

  tester.Hash3 = function (errorCallback) {
    var test_case = 'HSET/HLEN - Big hash creation';
    g.asyncFor(0, 1024, function (loop) {
      var key = ut.randstring(0, 8, 'alpha');
      var val = ut.randstring(0, 8, 'alpha');
      if (!bighash.hasOwnProperty(key)) {
        bighash[key] = val;
        client.hset('bighash', key, val, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          loop.next();
        });
      } else {
        loop.decrease(1);
        loop.next();
      }
    }, function () {
      client.hlen('bighash', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 1024, test_case);
        testEmitter.emit('next');
      });

    });
  };

  tester.Hash4 = function (errorCallback) {
    var test_case = 'Is the big hash encoded with a ziplist?';
    assert_encoding('hashtable', 'bighash', function (err, res) {
      ut.assertOk(res, null, test_case);
      testEmitter.emit('next');
    });

  };

  tester.Hash5 = function (errorCallback) {
    var test_case = 'HGET against the small hash';
    var error_array = new Array();
    var c = 0;
    var keys = Object.keys(smallhash);
    g.asyncFor(0, keys.length, function (loop) {
      c = loop.iteration();
      client.hget('smallhash', keys[c], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        if (smallhash[keys[c]] !== res) {
          var str = smallhash[keys[c]] + ' != ' + res;
          error_array.push(str);
        }
        loop.next();
      });
    }, function () {
      ut.assertEqual(error_array.length, 0, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash6 = function (errorCallback) {
    var test_case = 'HGET against the big hash';
    var error_array = new Array();
    var c = 0;
    var keys = Object.keys(bighash);
    g.asyncFor(0, keys.length, function (loop) {
      c = loop.iteration();
      client.hget('bighash', keys[c], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        if (bighash[keys[c]] !== res) {
          var str = bighash[keys[c]] + ' != ' + res;
          error_array.push(str);
        }
        loop.next();
      });
    }, function () {
      ut.assertEqual(error_array.length, 0, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash7 = function (errorCallback) {
    var test_case = 'HGET against non existing key';
    var rv = new Array();
    client.hget('smallhash', '__123123123__', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      rv.push(res);
      client.hget('bighash', '__123123123__', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        rv.push(res);
        ut.assertDeepEqual(rv, [null, null], test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Hash8 = function (errorCallback) {
    var test_case = 'HSET in update and insert mode';
    var rv = new Array();
    var k = Object.keys(smallhash)[0];
    client.hset('smallhash', k, 'newval1', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      rv.push(res);
      smallhash[k] = 'newval1';
      client.hget('smallhash', k, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        rv.push(res);
        client.hset('smallhash', '__foobar123__', 'newval', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          k = Object.keys(bighash)[0];
          client.hset('bighash', k, 'newval2', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            bighash[k] = 'newval2';
            client.hget('bighash', k, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              rv.push(res);
              client.hset('bighash', '__foobar123__', 'newval', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                rv.push(res);
                client.hdel('smallhash', '__foobar123__', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  rv.push(res);
                  client.hdel('bighash', '__foobar123__', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    rv.push(res);
                    ut.assertDeepEqual(rv, [0, 'newval1', 1, 0, 'newval2', 1, 1, 1], test_case);
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

  tester.Hash9 = function (errorCallback) {
    var test_case = 'HSETNX target key missing - small hash';
    client.hsetnx('smallhash', '__123123123__', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hget('smallhash', '__123123123__', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 'foo', test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Hash10 = function (errorCallback) {
    var test_case = 'HSETNX target key exists - small hash';
    client.hsetnx('smallhash', '__123123123__', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hget('smallhash', '__123123123__', function (err, result) {
        if (err) {
          errorCallback(err);
        }
        client.hdel('smallhash', '__123123123__', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(result, 'foo', test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Hash11 = function (errorCallback) {
    var test_case = 'HSETNX target key missing - big hash';
    client.hsetnx('bighash', '__123123123__', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hget('bighash', '__123123123__', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 'foo', test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Hash12 = function (errorCallback) {
    var test_case = 'HSETNX target key exists - big hash';
    client.hsetnx('bighash', '__123123123__', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hget('bighash', '__123123123__', function (err, result) {
        if (err) {
          errorCallback(err);
        }
        client.hdel('bighash', '__123123123__', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(result, 'foo', test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Hash13 = function (errorCallback) {
    var test_case = 'HMSET wrong number of args';
    client.hmset('smallhash', 'key1', 'val1', 'key2', function (err, res) {
      if (!res) {
        ut.assertOk('wrong number', err, test_case);
        testEmitter.emit('next');
      }
    });
  };

  tester.Hash14 = function (errorCallback) {
    var test_case = 'HMSET - small hash';
    var args = new Array();
    for (key in smallhash) {
      var newval = ut.randstring(0, 8, 'alpha');
      smallhash[key] = newval;
      args[key] = newval;
    }
    client.hmset('smallhash', args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 'OK', test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash15 = function (errorCallback) {
    var test_case = 'HMSET - big hash';
    var args = new Array();
    for (key in bighash) {
      var newval = ut.randstring(0, 8, 'alpha');
      bighash[key] = newval;
      args[key] = newval;
    }
    client.hmset('bighash', args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 'OK', test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash16 = function (errorCallback) {
    var test_case = 'HMGET against non existing key and fields';
    var rv = new Array();
    client.hmget('doesntexist', '__123123123__', '__456456456__', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      rv.push(res);
      client.hmget('smallhash', '__123123123__', '__456456456__', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        rv.push(res);
        client.hmget('bighash', '__123123123__', '__456456456__', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          ut.assertDeepEqual(rv, [[null, null], [null, null], [null, null]], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Hash17 = function (errorCallback) {
    var test_case = 'HMGET against wrong type';
    client.set('wrongtype', 'somevalue', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hmget('wrongtype', 'field1', 'field2', function (err, res) {
        if (!res) {
          ut.assertOk('wrong', err, test_case);
          testEmitter.emit('next');
        }
      });
    });
  };

  tester.Hash18 = function (errorCallback) {
    var test_case = 'HMGET - small hash';
    var keys = new Array();
    var vals = new Array();
    var errors = new Array();
    for (key in smallhash) {
      keys.push(key);
      vals.push(smallhash[key]);
    }
    client.hmget('smallhash', keys, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      if (res.length == vals.length) {
        for (k in res) {
          if (res[k] != vals[k]) {
            var str = vals[k] + ' != ' + res[k];
            errors.push(str);
          }
        }
      }
      ut.assertDeepEqual(errors, [], test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash19 = function (errorCallback) {
    var test_case = 'HMGET - big hash';
    var keys = new Array();
    var vals = new Array();
    var errors = new Array();
    for (key in bighash) {
      keys.push(key);
      vals.push(bighash[key]);
    }
    client.hmget('bighash', keys, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      if (res.length == vals.length) {
        for (k in res) {
          if (res[k] != vals[k]) {
            var str = vals[k] + ' != ' + res[k];
            errors.push(str);
          }
        }
      }
      ut.assertDeepEqual(errors, [], test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash20 = function (errorCallback) {
    var test_case = 'HKEYS - small hash';
    var keys = Object.keys(smallhash);
    client.hkeys('smallhash', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var result_array = res.sort(ut.sortFunction);
      var keys_array = keys.sort(ut.sortFunction);
      ut.assertDeepEqual(result_array, keys_array, test_case);
      testEmitter.emit('next');
    });
  };

  tester.hash21 = function (errorcallback) {
    var test_case = 'hkeys - big hash';
    var keys = Object.keys(bighash);
    client.hkeys('bighash', function (err, res) {
      if (err) {
        errorcallback(err);
      }
      var result_array = res.sort(ut.sortFunction);
      var keys_array = keys.sort(ut.sortFunction);
      ut.assertDeepEqual(result_array, keys_array, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash22 = function (errorCallback) {
    var test_case = 'HVALS - small hash';
    var vals = new Array();
    for (key in smallhash) {
      vals.push(smallhash[key]);
    }
    client.hvals('smallhash', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var result_array = res.sort(ut.sortFunction);
      var vals_array = vals.sort(ut.sortFunction);
      ut.assertDeepEqual(result_array, vals_array, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash23 = function (errorCallback) {
    var test_case = 'HVALS - big hash';
    var vals = new Array();
    for (key in bighash) {
      vals.push(bighash[key]);
    }
    client.hvals('bighash', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var result_array = res.sort(ut.sortFunction);
      var vals_array = vals.sort(ut.sortFunction);
      ut.assertDeepEqual(result_array, vals_array, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash24 = function (errorCallback) {
    var test_case = 'HGETALL - small hash';
    var full = new Array();
    var result = new Array();
    for (key in smallhash) {
      full.push(key);
      full.push(smallhash[key]);
    }
    client.hgetall('smallhash', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      for (k in res) {
        result.push(k);
        result.push(res[k]);
      }
      var result_array = result.sort(ut.sortFunction);
      var full_array = full.sort(ut.sortFunction);
      ut.assertDeepEqual(result_array, full_array, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash25 = function (errorCallback) {
    var test_case = 'HGETALL - big hash';
    var full = new Array();
    var result = new Array();
    for (key in bighash) {
      full.push(key);
      full.push(bighash[key]);
    }
    client.hgetall('bighash', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      for (k in res) {
        result.push(k);
        result.push(res[k]);
      }
      var result_array = result.sort(ut.sortFunction);
      var full_array = full.sort(ut.sortFunction);
      ut.assertDeepEqual(result_array, full_array, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Hash26 = function (errorCallback) {
    var test_case = 'HDEL and return value';
    var rv = new Array();
    var k = '';
    client.hdel('smallhash', 'nokey', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      rv.push(res);
      client.hdel('bighash', 'nokey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        rv.push(res);
        k = Object.keys(smallhash)[0];
        client.hdel('smallhash', k, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hdel('smallhash', k, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            client.hget('smallhash', k, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              rv.push(res);
              smallhash = ut.shift(smallhash, 1); // dirty trick to shift
              k = Object.keys(bighash)[0];
              client.hdel('bighash', k, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                rv.push(res);
                client.hdel('bighash', k, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  rv.push(res);
                  client.hget('bighash', k, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    rv.push(res);
                    bighash = ut.shift(bighash, 1); // dirty trick to shift
                    ut.assertDeepEqual(rv, [0, 0, 1, 0, null, 1, 0, null], test_case);
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

  tester.Hash27 = function (errorCallback) {
    var test_case = 'HDEL - more than a single value';
    var rv = new Array();
    client.del('myhash', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hmset('myhash', 'a', 1, 'b', 2, 'c', 3, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hdel('myhash', 'x', 'y', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hdel('myhash', 'a', 'c', 'f', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            client.hgetall('myhash', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              for (key in res) {
                rv.push(key);
                rv.push(res[key]);
              }
              ut.assertDeepEqual(rv, [0, 2, 'b', '2'], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.Hash28 = function (errorCallback) {
    var test_case = 'HDEL - hash becomes empty before deleting all specified fields';
    var rv = new Array();
    client.del('myhash', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hmset('myhash', 'a', 1, 'b', 2, 'c', 3, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hdel('myhash', 'a', 'b', 'c', 'd', 'e', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.exists('myhash', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            ut.assertDeepEqual(rv, [3, 0], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Hash29 = function (errorCallback) {
    var test_case = 'HEXISTS';
    var rv = new Array();
    var k = Object.keys(smallhash)[0];
    client.hexists('smallhash', k, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      rv.push(res);
      client.hexists('smallhash', 'nokey', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        rv.push(res);
        k = Object.keys(bighash)[0];
        client.hexists('bighash', k, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hexists('bighash', 'nokey', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            ut.assertDeepEqual(rv, [1, 0, 1, 0], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Hash30 = function (errorCallback) {
    var test_case = 'Is a ziplist encoded Hash promoted on big payload?';
    var str = g.fillString(1024, 'a');
    client.hset('smallhash', 'foo', str, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.debug('object', 'smallhash', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertOk('hashtable', res, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Hash31 = function (errorCallback) {
    var test_case = 'HINCRBY against non existing database key';
    client.del('htest', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hincrby('htest', 'foo', 2, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 2, test_case)
        testEmitter.emit('next');
      });
    });
  };
  tester.Hash32 = function (errorCallback) {
    var test_case = 'HINCRBY against non existing hash key';
    var rv = new Array();
    client.hdel('smallhash', 'tmp', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hdel('bighash', 'tmp', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hincrby('smallhash', 'tmp', 2, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hget('smallhash', 'tmp', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            client.hincrby('bighash', 'tmp', 2, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              rv.push(res);
              client.hget('bighash', 'tmp', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                rv.push(res);
                ut.assertDeepEqual(rv, [2, 2, 2, 2], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  tester.Hash33 = function (errorCallback) {
    var test_case = 'HINCRBY against hash key created by hincrby itself';
    var rv = new Array();
    client.hincrby('smallhash', 'tmp', 3, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      rv.push(res);
      client.hget('smallhash', 'tmp', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        rv.push(res);
        client.hincrby('bighash', 'tmp', 3, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hget('bighash', 'tmp', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            ut.assertDeepEqual(rv, [5, 5, 5, 5], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Hash34 = function (errorCallback) {
    var test_case = 'HINCRBY against hash key originally set with HSET';
    var rv = new Array();
    client.hset('smallhash', 'tmp', 100, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hset('bighash', 'tmp', 100, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hincrby('smallhash', 'tmp', 2, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hincrby('bighash', 'tmp', 2, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            ut.assertDeepEqual(rv, [102, 102], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Hash35 = function (errorCallback) {
    var test_case = 'HINCRBY over 32bit value';
    var rv = new Array();
    client.hset('smallhash', 'tmp', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hset('bighash', 'tmp', 17179869184, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hincrby('smallhash', 'tmp', 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hincrby('bighash', 'tmp', 1, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            ut.assertDeepEqual(rv, [17179869185, 17179869185], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Hash36 = function (errorCallback) {
    var test_case = 'HINCRBY over 32bit value with over 32bit increment';
    var rv = new Array();
    client.hset('smallhash', 'tmp', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hset('bighash', 'tmp', 17179869184, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hincrby('smallhash', 'tmp', 17179869184, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          rv.push(res);
          client.hincrby('bighash', 'tmp', 17179869184, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            rv.push(res);
            ut.assertDeepEqual(rv, [34359738368, 34359738368], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Hash37 = function (errorCallback) {
    var test_case = 'HINCRBY fails against hash value with spaces (left)';
    client.hset('smallhash', 'str', ' 11', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hset('bighash', 'str', ' 11', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hincrby('smallhash', 'str', 1, function (smallerr, res) {
          client.hincrby('bighash', 'str', 1, function (bigerr, res) {
            ut.assertMany(
              [
                ['ok', 'not an integer', smallerr],
                ['ok', 'not an integer', bigerr]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.Hash38 = function (errorCallback) {
    var test_case = 'HINCRBY can detect overflows';
    client.hset('hash', 'n', '-9223372036854775484', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hincrby('hash', 'n', -1, function (err, result) {
        if (err) {
          errorCallback(err);
        }
        client.hincrby('hash', 'n', -10000, function (hasherr, res) {
          ut.assertMany(
            [
              ['ok', 'overflow', hasherr],
              ['equal', result, '-9223372036854775485']
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Hash39 = function (errorCallback) {
    var test_case = 'Hash ziplist regression test for large keys';
    var str = g.fillString(336, 'k');
    client.hset('hash', str, 'a', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hset('hash', str, 'b', function (err, result) {
        if (err) {
          errorCallback(err);
        }
        client.hget('hash', str, function (err, res) {
          ut.assertEqual(res, 'b', test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Hash40 = function (errorCallback) {
    var test_case = 'HINCRBY fails against hash value with spaces (right)';
    client.hset('smallhash', 'str', '11 ', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.hset('bighash', 'str', '11 ', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.hincrby('smallhash', 'str', 1, function (smallerr, res) {
          client.hincrby('bighash', 'str', 1, function (bigerr, res) {
            ut.assertMany(
              [
                ['ok', 'not an integer', smallerr],
                ['ok', 'not an integer', bigerr]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Hash41 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT against non existing database key';
    client.del('htest');
    client.hincrbyfloat('htest', 'foo', 2.5, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 2.5, test_case);
      testEmitter.emit('next');
    });
  }

  tester.Hash42 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT against non existing hash key'
      var array = [];
    client.hdel('smallhash', 'tmp');
    client.hdel('bighash', 'tmp');
    client.hincrbyfloat('smallhash', 'tmp', 2.5, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      array.push(res);
      client.hget('smallhash', 'tmp', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        array.push(res);
        client.hincrbyfloat('bighash', 'tmp', 2.5, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          array.push(res);
          client.hget('smallhash', 'tmp', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            array.push(res);
            ut.assertDeepEqual(array, [2.5, 2.5, 2.5, 2.5], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Hash43 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT against hash key created by hincrby itself'
      var array = [];
    client.hincrbyfloat('smallhash', 'tmp', 3.5, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      array.push(res);
      client.hget('smallhash', 'tmp', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        array.push(res);
        client.hincrbyfloat('bighash', 'tmp', 3.5, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          array.push(res);
          client.hget('smallhash', 'tmp', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            array.push(res);
            ut.assertDeepEqual(array, [6, 6, 6, 6], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Hash44 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT against hash key originally set with HSET'
      var array = [];
    client.hset('smallhash', 'tmp', 100);
    client.hset('bighash', 'tmp', 100);
    client.hincrbyfloat('smallhash', 'tmp', 2.5, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      array.push(res);
      client.hincrbyfloat('bighash', 'tmp', 2.5, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        array.push(res);
        ut.assertDeepEqual(array, [102.5, 102.5], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Hash45 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT over 32bit value'
      var array = [];
    client.hset('smallhash', 'tmp', 17179869184);
    client.hset('bighash', 'tmp', 17179869184);
    client.hincrbyfloat('smallhash', 'tmp', 1, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      array.push(res);
      client.hincrbyfloat('bighash', 'tmp', 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        array.push(res);
        ut.assertDeepEqual(array, [17179869185, 17179869185], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Hash46 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT over 32bit value with over 32bit increment'
      var array = [];
    client.hset('smallhash', 'tmp', 17179869184);
    client.hset('bighash', 'tmp', 17179869184);
    client.hincrbyfloat('smallhash', 'tmp', 17179869184, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      array.push(res);
      client.hincrbyfloat('bighash', 'tmp', 17179869184, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        array.push(res);
        ut.assertDeepEqual(array, [34359738368, 34359738368], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Hash47 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT fails against hash value with spaces (left)'
      var array = [];
    client.hset('smallhash', 'str', ' 11');
    client.hset('bighash', 'str', ' 11');
    client.hincrbyfloat('smallhash', 'str', 1, function (smallErr, res) {
      client.hincrbyfloat('bighash', 'str', 1, function (bigErr, res) {
        ut.assertMany(
          [
            ['ok', 'not a valid float', smallErr],
            ['ok', 'not a valid float', bigErr]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Hash48 = function (errorCallback) {
    var test_case = 'HINCRBYFLOAT fails against hash value with spaces (right)'
      var array = [];
    client.hset('smallhash', 'str', '11 ');
    client.hset('bighash', 'str', ' 11 ');
    client.hincrbyfloat('smallhash', 'str', 1, function (smallErr, res) {
      client.hincrbyfloat('bighash', 'str', 1, function (bigErr, res) {
        ut.assertMany(
          [
            ['ok', 'not a valid float', smallErr],
            ['ok', 'not a valid float', bigErr]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Hash49 = function (errorCallback) {
    var size = [10, 512],
    index = 0,
    test_case = '',
    tcPassFlg = true;
    var hashField = [],
    hashVal = [],
    Randfield = '',
    RandVal = '',
    i = 0;
    g.asyncFor(0, size.length, function (loop) {
      index = loop.iteration();
      test_case = 'Hash fuzzing #1 - ' + size[index] + ' fields';
      g.asyncFor(0, 9, function (innerLoop) {
        client.del('hash', function (err, res) {
          if (err) {
            errorCallback(err)
          }
          hashField = [],
          hashVal = [];
          g.asyncFor(0, size[index], function (secLoop) {
            Randfield = Math.random() * 100;
            RandVal = Math.random() * 100;
            client.hset('hash', Randfield, RandVal, function (err, res) {
              hashField.push(Randfield);
              hashVal.push(RandVal);
              secLoop.next();
            });
          }, function () {
            var VerifyFlg = true;
            g.asyncFor(0, hashField.length, function (checkLoop) {
              i = checkLoop.iteration()
                client.hget('hash', hashField[i], function (err, res) {
                  if (hashVal[i] == res) {
                    checkLoop.next();
                  } else {
                    VerifyFlg = false;
                    checkLoop.break();
                  }
                });
            }, function () {
              if (VerifyFlg && tcPassFlg) {
                client.hlen('hash', function (err, len) {
                  if (err) {
                    errorCallback(err)
                  }
                  if (len != hashField.length)
                    tcPassFlg = false;
                });
              } else
                ut.fail('Hashtable Verification Failed', true);
              innerLoop.next();
            });
          });
        });
      }, function () {
        if (tcPassFlg) {
          ut.pass(test_case);
          loop.next();
        } else {
          ut.fail('Testcase Failed', true);
          loop.break();
        }

      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  tester.Hash50 = function (errorCallback) {
    var size = [10, 512],
    index = 0,
    test_case = '',
    tcPassFlg = true;
    var hashField = [],
    hashVal = [],
    Randfield = '',
    RandVal = '',
    i = 0;
    g.asyncFor(0, size.length, function (loop) {
      index = loop.iteration();
      test_case = 'Hash fuzzing #2 - ' + size[index] + ' fields';
      g.asyncFor(0, 9, function (innerLoop) {
        client.del('hash', function (err, res) {
          if (err) {
            errorCallback(err)
          }
          hashField = [],
          hashVal = [];
          g.asyncFor(0, size[index], function (secLoop) {
            var ch = ut.randpath(new Array(1, 2, 3));
            switch (ch) {
            case 1: {
                Randfield = Math.random() * 100;
                RandVal = Math.random() * 100;
                client.hset('hash', Randfield, RandVal, function (err, res) {
                  hashField.push(Randfield);
                  hashVal.push(RandVal);
                  secLoop.next();
                });
                break;
              }
            case 2: {
                Randfield = ut.randomSignedInt(512);
                RandVal = ut.randomSignedInt(512);
                client.hset('hash', Randfield, RandVal, function (err, res) {
                  hashField.push(Randfield);
                  hashVal.push(RandVal);
                  secLoop.next();
                });
                break;
              }
              case3 : {
                var ch_a = ut.randpath(new Array(1, 2));
                switch (ch_a) {
                case 1: {
                    Randfield = Math.random() * 100;
                    break;
                  }
                case 2: {
                    Randfield = ut.randomSignedInt(512);
                  }
                  client.hdel('hash', Randfield, function (err, res) {
                    if (err) {
                      errorCallback(err)
                    }
                    hashVal.pop(hashVal[hashField.indexOf(Randfield)]);
                    hashField.pop(Randfield);
                  });
                }
                break;
              }
            }
            secLoop.next();
          }, function () {
            var VerifyFlg = true;
            g.asyncFor(0, hashField.length, function (checkLoop) {
              i = checkLoop.iteration()
                client.hget('hash', hashField[i], function (err, res) {
                  if (hashVal[i] == res) {
                    checkLoop.next();
                  } else {
                    VerifyFlg = false;
                    checkLoop.break();
                  }
                });
            }, function () {
              if (VerifyFlg && tcPassFlg) {
                client.hlen('hash', function (err, len) {
                  if (err) {
                    errorCallback(err)
                  }
                  if (len != hashField.length)
                    tcPassFlg = false;
                });
              } else
                ut.fail('Hashtable Verification Failed', true);
              innerLoop.next();
            });
          });
        });
      }, function () {
        if (tcPassFlg) {
          ut.pass(test_case);
          loop.next();
        } else {
          ut.fail('Testcase Failed', true);
          loop.break();
        }
      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  tester.Hash51 = function (errorCallback) {
    var test_case = 'Stress test the hash ziplist -> hashtable encoding conversion'
      var tcPassFlg = true;
    error = '';
    client.config('set', 'hash-max-ziplist-entries', 32, function (err, res) {
      g.asyncFor(0, 100, function (loop) {
        client.del('myhash', function (err, res) {
          if (err) {
            errorCallback();
          }
          g.asyncFor(0, 64, function (Innerloop) {
            client.hset('myhash', Math.random() * 100, Math.random() * 100, function () {
              if (err) {
                errorCallback();
              }
              Innerloop.next();
            });
          }, function () {
            client.object('encoding', 'myhash', function (err, res) {
              if (tcPassFlg) {
                try {
                  if (!assert.ok(res, 'hashtable', test_case)) {
                    loop.next();
                  }
                } catch (e) {
                  tcPassFlg = false;
                  error = e;
                  loop.break();
                }
              }
            });
          });
        });
      }, function () {
        if (tcPassFlg) {
          ut.pass(test_case);
        } else {
          ut.fail(error, true)
        }
        testEmitter.emit('next');
      });
    });
  }
  return hash;
}
  ());