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

exports.Sort = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  sort = {},
  name = 'Sort',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {},
  result = [],
  local_result = [],
  global_result = [];

  //public property
  sort.debug_mode = false;

  //public method
  sort.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'sort';
      var overrides = {};
      overrides['list-max-ziplist-entries'] = 32;
      overrides['list-max-ziplist-value'] = 16;
      overrides['set-max-intset-entries'] = 32;
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
        var test_case_name = all_tests.shift()
          if (test_case_name) {
            tester[test_case_name](function (error) {
              ut.fail(error);
              testEmitter.emit('next');
            });
          } else {
            client.end();
            if (sort.debug_mode) {
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

    if (sort.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods

  function create_random_dataset(num, cmd, redisKey, callback) {
    var tosort = new Array();
    var i = 0;
    client.del(redisKey, function (err, result) {
      if (err) {
        callback(err, null);
      }
      g.asyncFor(0, num, function (loop) {
        var i = loop.iteration();
        var rn = Math.floor((Math.random() * 10000000000) + 1);
        if (cmd === 'lpush') {
          client.lpush(redisKey, i, function (err, res) {
            if (err) {
              callback(err, null);
            }
            client.set('weight_' + i, rn, function (err, res) {
              if (err) {
                callback(err, null);
              }
              client.hset('wobj_' + i, 'weight', rn, function (err, res) {
                if (err) {
                  callback(err, null);
                }
                tosort.push(rn);
                loop.next();
              });
            });

          });
        } else if (cmd === 'sadd') {
          client.sadd(redisKey, i, function (err, res) {
            if (err) {
              callback(err, null);
            }
            client.set('weight_' + i, rn, function (err, res) {
              if (err) {
                callback(err, null);
              }
              client.hset('wobj_' + i, 'weight', rn, function (err, res) {
                if (err) {
                  callback(err, null);
                }
                tosort.push(rn);
                loop.next();
              });
            });
          });
        }
      }, function () {
        var output = new Array();
        var new_tosort = tosort.slice(0);
        sorted_array = tosort.sort(ut.sortFunction);
        for (var i = 0; i < num; i++) {
          var index = new_tosort.indexOf(sorted_array[i]);
          output.push(index);
        }
        callback(null, output);
      })
    });
  };

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

  tester.Sort1 = function (errorCallback) {
    var test_case = 'Ziplist: SORT BY key';
    create_random_dataset(16, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res;
      assert_encoding('ziplist', 'tosort', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sort('tosort', 'by', 'weight_*', function (err, sorted) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(sorted, local_result, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort1_1 = function (errorCallback) {
    var test_case = 'Ziplist: SORT BY key with limit';
    create_random_dataset(16, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res.splice(5, 5);
      client.sort('tosort', 'by', 'weight_*', 'LIMIT', 5, 5, function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(res1, local_result, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort2 = function (errorCallback) {
    var test_case = 'Ziplist: SORT BY hash field';
    create_random_dataset(16, 'lpush', 'tosort', function (err, local_result) {
      if (err) {
        errorCallback(err);
      }
      client.sort('tosort', 'by', 'wobj_*->weight', function (err, sorted) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(sorted, local_result, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort3 = function (errorCallback) {
    var test_case = 'Linked list: SORT BY key';
    local_result = [];
    create_random_dataset(1000, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res;
      assert_encoding('linkedlist', 'tosort', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sort('tosort', 'by', 'weight_*', function (err, sorted) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(sorted, local_result, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort3_1 = function (errorCallback) {
    var test_case = 'Linked list: SORT BY key with limit';
    create_random_dataset(1000, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res.splice(5, 5);
      client.sort('tosort', 'by', 'weight_*', 'LIMIT', 5, 5, function (err, exp_res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(exp_res, local_result, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort4 = function (errorCallback) {
    var test_case = 'Linked list: SORT BY hash field';
    create_random_dataset(1000, 'lpush', 'tosort', function (err, local_result) {
      if (err) {
        errorCallback(err);
      }
      client.sort('tosort', 'by', 'wobj_*->weight', function (err, sorted) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(sorted, local_result, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.Sort5 = function (errorCallback) {
    var test_case = 'Big Linked list: SORT BY key';
    local_result = [];
    create_random_dataset(10000, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res;
      assert_encoding('linkedlist', 'tosort', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sort('tosort', 'by', 'weight_*', function (err, sorted) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(sorted, local_result, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort5_1 = function (errorCallback) {
    var test_case = 'Big Linked list: SORT BY key with limit';
    create_random_dataset(10000, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res.splice(5, 5);
      client.sort('tosort', 'by', 'weight_*', 'LIMIT', 5, 5, function (err, sorted) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(sorted, local_result, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort6 = function (errorCallback) {
    var test_case = 'Big Linked list: SORT BY hash field';
    create_random_dataset(10000, 'lpush', 'tosort', function (err, local_result) {
      if (err) {
        errorCallback(err);
      }
      client.sort('tosort', 'by', 'wobj_*->weight', function (err, sorted) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(sorted, local_result, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort7 = function (errorCallback) {
    var test_case = 'Intset: SORT BY key';
    local_result = [];
    create_random_dataset(16, 'sadd', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res;
      assert_encoding('intset', 'tosort', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sort('tosort', 'by', 'weight_*', function (err, sorted) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(sorted, local_result, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort8 = function (errorCallback) {
    var test_case = 'Intset: SORT BY hash field';
    client.sort('tosort', 'by', 'wobj_*->weight', function (err, sorted) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(sorted, local_result, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Sort9 = function (errorCallback) {
    var test_case = 'Hash table: SORT BY key';
    local_result = [];
    create_random_dataset(1000, 'sadd', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res;
      assert_encoding('hashtable', 'tosort', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sort('tosort', 'by', 'weight_*', function (err, sorted) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(sorted, local_result, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort10 = function (errorCallback) {
    var test_case = 'Hash table: SORT BY hash field';
    client.sort('tosort', 'by', 'wobj_*->weight', function (err, sorted) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(sorted, local_result, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Sort11 = function (errorCallback) {
    var test_case = 'Big Hash table: SORT BY key';
    local_result = [];
    create_random_dataset(10000, 'sadd', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      local_result = res;
      assert_encoding('hashtable', 'tosort', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sort('tosort', 'by', 'weight_*', function (err, sorted) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(sorted, local_result, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort12 = function (errorCallback) {
    var test_case = 'Big Hash table: SORT BY hash field';
    client.sort('tosort', 'by', 'wobj_*->weight', function (err, sorted) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(sorted, local_result, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Sort13 = function (errorCallback) {
    var test_case = 'SORT GET #';
    create_random_dataset(16, 'lpush', 'tosort', function (err, result) {
      if (err) {
        errorCallback(err);
      }
      global_result = result;
      local_result = result.slice(0).sort(ut.sortFunction);
      client.sort('tosort', 'get', '#', function (err, sorted) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(g.buffers_to_strings(sorted), local_result, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort14 = function (errorCallback) {
    var test_case = 'SORT GET <const>';
    client.sort('tosort', 'get', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertMany(
        [
          ['equal', res.length, 16],
          ['ok', check(res), null]
        ], test_case);
      testEmitter.emit('next');

      function check(result) {
        var flag = false;
        result.forEach(function (val, index, array) {
          if (val === null) {
            flag = true;
          }
        });
        return flag;
      };
    });
  };

  tester.Sort15 = function (errorCallback) {
    var test_case = 'SORT GET (key and hash) with sanity check';
    var result_array1 = new Array();
    var result_array2 = new Array();
    var flag1 = false;
    var flag2 = false;
    client.sort('tosort', 'get', '#', 'get', 'weight_*', function (err, result1) {
      if (err) {
        errorCallback(err);
      }
      client.sort('tosort', 'get', '#', 'get', 'wobj_*->weight', function (err, result2) {
        if (err) {
          errorCallback(err);
        }
        result1.forEach(function (val, index, array) {
          if (index % 2 == 0) {
            client.get('weight_' + val, function (err, res1) {
              if (err) {
                errorCallback(err);
              }
              if (array[index + 1] === res1) {
                result_array1.push(res1);
              }
            });
          }
          result_array1.push(result1[index]);
        });
        result2.forEach(function (val, index, array) {
          if (index % 2 == 0) {
            client.get('weight_' + val, function (err, res1) {
              if (err) {
                errorCallback(err);
              }
              if (array[index + 1] == res1) {
                result_array2.push(res1);
              }
            });
          }
          result_array2.push(result2[index]);
        });
        ut.assertMany(
          [
            ['equal', result1.length, result2.length],
            ['deepequal', result2, result_array2],
            ['deepequal', result1, result_array1]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort16 = function (errorCallback) {
    var test_case = 'SORT BY key STORE';
    local_result = [];
    client.sort('tosort', 'by', 'weight_*', 'store', 'sort-res', function (err, res1) {
      if (err) {
        errorCallback(err);
      }
      client.llen('sort-res', function (err, res3) {
        if (err) {
          errorCallback(err);
        }
        client.lrange('sort-res', 0, -1, function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          ut.assertMany(
            [
              ['equal', res3, 16],
              ['deepequal', g.buffers_to_strings(res2), g.buffers_to_strings(global_result)]
            ], test_case);
          assert_encoding('ziplist', 'sort-res', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Sort17 = function (errorCallback) {
    var test_case = 'SORT BY hash field STORE';
    client.sort('tosort', 'by', 'wobj_*->weight', 'store', 'sort-res', function (err, res1) {
      if (err) {
        errorCallback(err);
      }
      client.llen('sort-res', function (err, res3) {
        if (err) {
          errorCallback(err);
        }
        client.lrange('sort-res', 0, -1, function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          ut.assertMany(
            [
              ['equal', res3, 16],
              ['deepequal', g.buffers_to_strings(res2), g.buffers_to_strings(global_result)]
            ], test_case);
          assert_encoding('ziplist', 'sort-res', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Sort18 = function (errorCallback) {
    var test_case = 'SORT DESC';
    local_result = global_result.slice(0).sort(function (a, b) {
        return b - a
      });
    client.sort('tosort', 'desc', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(g.buffers_to_strings(res), local_result, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Sort19 = function (errorCallback) {
    var test_case = 'SORT ALPHA against integer encoded strings';
    var result_array = new Array();
    client.del('mylist', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.lpush('mylist', 2, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.lpush('mylist', 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.lpush('mylist', 3, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.lpush('mylist', 10, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.sort('mylist', 'alpha', function (err, res) {
                ut.assertDeepEqual(res, [1, 10, 2, 3], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  tester.Sort20 = function (errorCallback) {
    var test_case = 'SORT sorted set';
    client.del('zset', function (err) {
      if (err) {
        errorCallback(error);
      }
      client.zadd('zset', 1, 'a', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 5, 'b', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 2, 'c', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 10, 'd', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 3, 'e', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.sort('zset', 'alpha', 'desc', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(g.buffers_to_strings(res), ['e', 'd', 'c', 'b', 'a'], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort21 = function (errorCallback) {
    var test_case = 'SORT sorted set: +inf and -inf handling';
    client.del('zset', function (err) {
      if (err) {
        errorCallback(error);
      }
      client.zadd('zset', -100, 'a', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 200, 'b', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', -300, 'c', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 1000000, 'd', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', '+inf', 'max', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', '-inf', 'min', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zrange('zset', 0, -1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(g.buffers_to_strings(res), ['min', 'c', 'a', 'b', 'd', 'max'], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort22 = function (errorCallback) {
    var test_case = 'SORT regression for issue #19, sorting floats';
    client.flushdb();
    var floats = new Array();
    floats[0] = parseFloat('1.1');
    floats[1] = parseFloat('5.10');
    floats[2] = parseFloat('3.10');
    floats[3] = parseFloat('7.44');
    floats[4] = parseFloat('2.1');
    floats[5] = parseFloat('5.75');
    floats[6] = parseFloat('6.12');
    floats[7] = parseFloat('0.25');
    floats[8] = parseFloat('1.15');
    floats.forEach(function (val, index, array) {
      client.lpush('mylist', val);
    });
    var sf = floats.sort(ut.sortFunction);
    client.sort('mylist', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(res, sf, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Sort23 = function (errorCallback) {
    var test_case = 'SORT with STORE returns zero if result is empty (github isse 224)';
    client.flushdb();
    client.sort('foo', 'store', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 0, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Sort24 = function (errorCallback) {
    var test_case = 'SORT with STORE does not create empty lists (github issue 224)';
    client.flushdb();
    client.lpush('foo', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sort('foo', 'alpha', 'limit', 10, 10, 'store', 'zap', function (err) {
        if (err) {
          errorCallback(err);
        }
        client.exists('zap', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 0, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort25 = function (errorCallback) {
    var test_case = 'SORT speed, 100 element list BY key, 1000 times';
    var num = 100;
    var flag = 0;
    var error = null;
    create_random_dataset(num, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var start = new Date();
      g.asyncFor(0, 1000, function (loop) {
        client.sort('tosort', 'by', 'weight_*', 'LIMIT', 0, 10, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.ok(res, test_case)) {
              flag++;
              loop.next();
            }
          } catch (e) {
            error = e;
            loop.break();
          }
        });
      }, function () {
        if (error) {
          ut.fail(error);
          errorCallback(error)
        } else {
          var elapsed = new Date() - start;
          if (flag == 1000) {
            ut.pass(test_case + ' with Time to sort: ' + elapsed);
            testEmitter.emit('next');
          }
        }
      });
    });
  };

  tester.Sort26 = function (errorCallback) {
    var test_case = 'SORT speed, 100 element list BY hash field, 1000 times';
    var num = 100;
    var flag = 0;
    var error = null;
    create_random_dataset(num, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var start = new Date();
      g.asyncFor(0, 1000, function (loop) {
        client.sort('tosort', 'by', 'wobj_*->weight', 'LIMIT', 0, 10, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.ok(res, test_case)) {
              flag++;
              loop.next();
            }
          } catch (e) {
            error = e;
            loop.break();
          }
        });
      }, function () {
        if (error) {
          ut.fail(error);
          errorCallback(error)
        } else {
          var elapsed = new Date() - start;
          if (flag == 1000) {
            ut.pass(test_case + ' with Time to sort: ' + elapsed);
            testEmitter.emit('next');
          }
        }
      });
    });
  };

  tester.Sort27 = function (errorCallback) {
    var test_case = 'SORT speed, 100 element list directly, 1000 times';
    var num = 100;
    var flag = 0;
    var error = null;
    create_random_dataset(num, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var start = new Date();
      g.asyncFor(0, 1000, function (loop) {
        client.sort('tosort', 'LIMIT', 0, 10, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.ok(res, test_case)) {
              flag++;
              loop.next();
            }
          } catch (e) {
            error = e;
            loop.break();
          }
        });
      }, function () {
        if (error) {
          ut.fail(error);
          errorCallback(error)
        } else {
          var elapsed = new Date() - start;
          if (flag == 1000) {
            ut.pass(test_case + ' with Time to sort: ' + elapsed);
            testEmitter.emit('next');
          }
        }
      });
    });
  };

  tester.Sort28 = function (errorCallback) {
    var test_case = 'SORT speed, 100 element list BY <const>, 1000 times';
    var num = 100;
    var flag = 0;
    var error = null;
    create_random_dataset(num, 'lpush', 'tosort', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var start = new Date();
      g.asyncFor(0, 1000, function (loop) {
        client.sort('tosort', 'by', 'nokey', 'LIMIT', 0, 10, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.ok(res, test_case)) {
              flag++;
              loop.next();
            }
          } catch (e) {
            error = e;
            loop.break();
          }
        });
      }, function () {
        if (error) {
          ut.fail(error);
          errorCallback(error)
        } else {
          var elapsed = new Date() - start;
          if (flag == 1000) {
            ut.pass(test_case + ' with Time to sort: ' + elapsed);
            testEmitter.emit('next');
          }
        }
      });
    });
  };

  // Redis-2.6 additions
  tester.Sort29 = function (errorCallback) {
    var test_case = 'SORT sorted set BY nosort should retain ordering';
    client.del('zset', function (err) {
      if (err) {
        errorCallback(error);
      }
      client.zadd('zset', 1, 'a', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 5, 'b', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 2, 'c', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 10, 'd', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 3, 'e', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.multi().sort('zset', 'by', 'nosort', 'asc').sort('zset', 'by', 'nosort', 'desc').exec(function (err, replies) {
        if (err) {
          errorCallback(err);
        }
        ut.assertDeepEqual(g.buffers_to_strings(replies), g.buffers_to_strings([['a', 'c', 'e', 'b', 'd'], ['d', 'b', 'e', 'c', 'a']]), test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Sort30 = function (errorCallback) {
    var test_case = 'SORT sorted set BY nosort + LIMIT';
    var result_array = new Array();
    client.del('zset', function (err) {
      if (err) {
        errorCallback(error);
      }
      client.zadd('zset', 1, 'a', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 5, 'b', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 2, 'c', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 10, 'd', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.zadd('zset', 3, 'e', function (err) {
        if (err) {
          errorCallback(err);
        }
      });
      client.sort('zset', 'by', 'nosort', 'asc', 'limit', 0, 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.sort('zset', 'by', 'nosort', 'desc', 'limit', 0, 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.sort('zset', 'by', 'nosort', 'asc', 'limit', 0, 2, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.sort('zset', 'by', 'nosort', 'desc', 'limit', 0, 2, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.sort('zset', 'by', 'nosort', 'limit', 5, 10, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.sort('zset', 'by', 'nosort', 'limit', -10, 100, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  ut.assertDeepEqual(result_array.toString(), ['a', 'd', ['a', 'c'], ['d', 'b'], '', ['a', 'c', 'e', 'b', 'd']].toString(), test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  };

  tester.Sort31 = function (errorCallback) {
    var test_case = 'SORT with STORE removes key if result is empty (github issue 227)';
    client.flushdb();
    client.lpush('foo', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sort('emptylist', 'store', 'foo', function (err) {
        if (err) {
          errorCallback(err);
        }
        client.exists('foo', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 0, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort32 = function (errorCallback) {
    var test_case = 'SORT with BY <constant> and STORE should still order output';
    client.del('myset', 'mylist', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z', 'aa', 'aaa', 'azz', function (err, res) {
        if (err) {
          callback(err, null);
        }
        client.sort('myset', 'alpha', 'by', '_', 'store', 'mylist', function (err) {
          if (err) {
            errorCallback(err);
          }
          client.lrange('mylist', 0, -1, function (err, result) {
            if (err) {
              errorCallback(err);
            }
            ut.assertDeepEqual(result, ['a', 'aa', 'aaa', 'azz', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z'], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Sort32 = function (errorCallback) {
    var test_case = 'SORT will complain with numerical sorting and bad doubles (1)';
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 1, 2, 3, 4, 'not-a-double', function (err, res) {
        if (err) {
          callback(err, null);
        }
        client.sort('myset', function (err, res) {
          ut.assertOk('converted into double', err, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort33 = function (errorCallback) {
    var test_case = 'SORT will complain with numerical sorting and bad doubles (1)';
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 1, 2, 3, 4, 'not-a-double', function (err, res) {
        if (err) {
          callback(err, null);
        }
        client.sort('myset', function (err, res) {
          ut.assertOk('converted into double', err, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort34 = function (errorCallback) {
    var test_case = 'SORT will complain with numerical sorting and bad doubles (2)';
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 1, 2, 3, 4, function (err, res) {
        if (err) {
          callback(err, null);
        }
        client.mset('score:1', 10, 'score:2', 20, 'score:3', 30, 'score:4', 'not-a-double', function (err, res) {
          if (err) {
            callback(err, null);
          }
          client.sort('myset', 'by', 'score:*', function (err, res) {
            ut.assertOk('converted into double', err, test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Sort35 = function (errorCallback) {
    var test_case = 'SORT BY sub-sorts lexicographically if score is the same';
    var loop_array = new Array();
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z', 'aa', 'aaa', 'azz', function (err, res) {
        if (err) {
          callback(err, null);
        }
        loop_array = ['a', 'aa', 'aaa', 'azz', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z'];
        for (var i = 0; i < loop_array.length; i++)
          client.set('score:' + loop_array[i], 100);

        client.sort('myset', 'by', 'score:*', function (err, sortedres) {
          if (err) {
            callback(err, null);
          }
          ut.assertDeepEqual(sortedres, loop_array, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Sort36 = function (errorCallback) {
    var test_case = 'SORT GET with pattern ending with just -> does not get hash field'
      client.del('mylist', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.lpush('mylist', 'a', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.set('x:a->', 100, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.sort('mylist', 'by', 'num', 'get', 'x:*->', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              ut.assertEqual(res, 100, test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
  }

  tester.Sort37 = function (errorCallback) {
    var test_case = 'DECR Time';
    client.time(function (err, time) {
      if (err) {
        errorCallback(err);
      }
      client.set('somekey', time[1]);
      client.decr('somekey', function (err, val) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(val, time[1] - 1, test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Sort38 = function (errorCallback) {
    var test_case = "Sort on ZSET";
    client.del('myset');
    client.zadd('myset', 1, 'a');
    client.zadd('myset', 1, 'c');
    client.zadd('myset', 4, 'd');
    client.zadd('myset', 3, 'b');
    client.zadd('myset', 2, 'e');
    client.sort('myset', 'alpha', function (err, res1) {
      client.set('order:a', 1);
      client.set('order:c', 1);
      client.set('order:d', 4);
      client.set('order:b', 3);
      client.set('order:e', 2);
      client.sort('myset', 'by', 'order:*', function (err, res2) {
        client.del('myset');
        client.zadd('myset', 1, '1:a');
        client.zadd('myset', 1, '3:c');
        client.zadd('myset', 4, '4:d');
        client.zadd('myset', 3, '2:b');
        client.zadd('myset', 2, '5:e');
        client.sort('myset', 'by', 'order:*', 'get', 'order:*', 'get', '#', function (err, res3) {
          ut.assertMany(
            [
              ['deepequal', res1, ['a', 'b', 'c', 'd', 'e']],
              ['deepequal', res2, ['a', 'c', 'e', 'b', 'd']],
              ['equal', res3.length, 10]
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  return sort;

}
  ());
