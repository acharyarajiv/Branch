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

exports.scan = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  scan = {},
  name = 'Scan',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {};

  //public property
  scan.debug_mode = false;

  //public method
  scan.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'scan';
      var args = {};
      var overrides = {};
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
          if (scan.debug_mode) {
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

    if (scan.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //test methods
  tester.scan1 = function (errorCallback) {

    var test_case = 'Scan basic';
    client.flushdb(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.debug('populate', 1000, function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        var cur = 0,
        keys = [],
        k,
        leng = 0;
        g.asyncFor(0, -1, function (loop) {
          var count;
          client.scan(cur, function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            cur = res2[0];
            k = res2[1];
            keys = keys.concat(k);
            if (cur == 0)
              loop.break();
            else
              loop.next();

          });
        }, function () {
          keys = keys.sort();
          ut.assertEqual(keys.length, 1000, test_case)
          testEmitter.emit('next');
        });

      });
    });
  };

  tester.scan2 = function (errorCallback) {
    var test_case = 'Scan count';
    client.flushdb(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.debug('populate', 1000, function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        var cur = 0,
        keys = [],
        k;
        g.asyncFor(0, -1, function (loop) {
          client.scan(cur, 'count', 5, function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            cur = res2[0];
            k = res2[1];
            keys = keys.concat(k);
            if (cur == 0)
              loop.break();
            else
              loop.next();

          });
        }, function () {
          keys = keys.sort();
          ut.assertEqual(keys.length, 1000, test_case);
          testEmitter.emit('next');
        });

      });
    });
  };

  //Scan Match
  tester.scan3 = function (errorCallback) {
    var test_case = 'Scan match';
    client.flushdb(function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.debug('populate', 1000, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        var cur = 0,
        keys = [],
        k;
        g.asyncFor(0, -1, function (loop) {
          client.scan(cur, 'match', "key:1??", function (err, res1) {
            if (err) {
              errorCallback(err);
            }

            cur = res1[0];
            k = res1[1];
            keys = keys.concat(k);
            if (cur == 0) {
              loop.break();
            } else
              loop.next();
          });
        }, function () {
          keys = keys.sort();
          ut.assertEqual(keys.length, 100, test_case);
          testEmitter.emit('next');
        })
      });
    });
  };

  //SScan
  tester.scan4 = function (errorCallback) {
    var test_case = 'SScan';
    var prefix = '',
    cur = 0,
    keys = [];
    var list = ['intset', 'hashtable'];
    g.asyncFor(0, list.length, function (mainloop) {
      var encIndex = mainloop.iteration();
      var enc = list[encIndex];
      test_case = 'SSCAN with encoding ' + enc;
      client.del('set', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        prefix = (enc == 'intset') ? '' : 'ele:';
        var elements = [];
        for (var j = 0; j < 100; j++)
          elements.push(prefix + j);
        client.sadd('set', elements, function (err, res1) {
          if (err) {
            errorCallback(err, null);
          }
          client.object('encoding', 'set', function (err, res2) {
            if (err) {
              errorCallback(err, null);
            }
            cur = 0,
            keys = [];
            g.asyncFor(0, -1, function (loop) {
              client.sscan('set', cur, function (err, res3) {
                if (err) {
                  errorCallback(err);
                }
                cur = res3[0];
                k = res3[1];
                keys = keys.concat(k);
                if (cur == 0) {
                  loop.break();
                } else
                  loop.next();
              });
            }, function () {
              keys = keys.sort();
              ut.assertEqual(keys.length, 100, test_case);
              mainloop.next();
            });
          });
        });
      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  //Hscan with encoding
  tester.scan5 = function (errorCallback) {
    var test_case = 'HSCAN';
    var count = 0,
    cur = 0,
    keys = [];
    var list = ['ziplist', 'hashtable'];
    g.asyncFor(0, list.length, function (mainloop) {
      var encIndex = mainloop.iteration();
      var enc = list[encIndex];
      test_case = 'HSCAN with encoding ' + enc;
      client.del('hash', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        count = (enc == 'ziplist') ? 30 : 1000;
        var elements = [];
        for (var j = 0; j < count; j++)
          elements.push('key:' + j);
        client.hmset('hash', elements, function (err, res1) {
          if (err) {
            errorCallback(err, null);
          }
          client.object('encoding', 'hash', function (err, res2) {
            if (err) {
              errorCallback(err, null);
            }
            cur = 0,
            keys = [];
            g.asyncFor(0, -1, function (loop) {
              client.hscan('hash', cur, function (err, res3) {
                if (err) {
                  errorCallback(err);
                }
                cur = res3[0];
                k = res3[1];
                keys = keys.concat(k);
                if (cur == 0) {
                  loop.break();
                } else
                  loop.next();
              });
            }, function () {
              var keys2 = [];
              for (var obj = 0; obj < keys.length; obj += 2) {
                if (keys[obj + 1] == 'key:' + keys[obj])
                  keys2.push(obj);
              }

              keys2 = keys2.sort();
              ut.assertEqual(keys2.length, count, test_case);
              mainloop.next();
            });
          });
        });
      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  //ZSCAN with encoding
  tester.scan6 = function (errorCallback) {
    var test_case = 'ZSCAN';
    var count = 0,
    cur = 0,
    keys = [];
    var list = ['ziplist', 'skiplist'];
    g.asyncFor(0, list.length, function (mainloop) {
      var encIndex = mainloop.iteration();
      var enc = list[encIndex];
      test_case = 'ZSCAN with encoding ' + enc;
      client.del('zset', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        count = (enc == 'ziplist') ? 30 : 1000;
        var elements = [];
        g.asyncFor(0, count, function (zaddLoop) {
          j = zaddLoop.iteration();
          client.zadd('zset', j, 'key:' + j, function (err, res1) {
            if (err) {
              errorCallback(err, null);
            }
            zaddLoop.next();
          });
        }, function () {
          client.object('encoding', 'zset', function (err, res2) {
            if (err) {
              errorCallback(err, null);
            }
            cur = 0,
            keys = [];
            g.asyncFor(0, -1, function (loop) {
              client.zscan('zset', cur, function (err, res3) {
                if (err) {
                  errorCallback(err);
                }
                cur = res3[0];
                k = res3[1];
                keys = keys.concat(k);
                if (cur == 0) {
                  loop.break();
                } else
                  loop.next();
              });
            }, function () {
              var keys2 = [];
              for (var obj = 0; obj < keys.length; obj += 2) {
                if (keys[obj] == 'key:' + keys[obj + 1])
                  keys2.push(obj);
              }

              keys2 = keys2.sort();
              ut.assertEqual(keys2.length, count, test_case);
              mainloop.next();
            });
          });
        });

      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  tester.scan7 = function (errorCallback) {
    var test_case = 'SCAN guarantees check under write load';
    client.flushdb(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.debug('populate', 100, function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        var cur = 0,
        keys = [],
        k,
        leng = 0;
        g.asyncFor(0, -1, function (loop) {
          var count;
          client.scan(cur, function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            cur = res2[0];
            k = res2[1];
            keys = keys.concat(k);
            if (cur == 0)
              loop.break();
            else
              loop.next();

          });
        }, function () {
          //Write 10 random keys at every SCAN iteration.
          g.asyncFor(0, 10, function (setLoop) {
            client.set('addedkey:' + ut.randomInt(1000), 'foo', function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              setLoop.next();
            });
          }, function () {
            var keys2 = [];
            for (var i = 0; i < keys.length; i++) {
              if (keys[i].length <= 6)
                keys2.push(keys[i]);
            }
            keys2 = keys2.sort();
            ut.assertEqual(keys2.length, 100, test_case)
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.scan8 = function (errorCallback) {
    var test_case = 'SSCAN with integer encoded object (issue #1345)';
    var objects = [1, 'a'];
    client.del('set', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.sadd('set', objects, function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        client.sscan('set', 0, 'MATCH', '*a*', 'COUNT', 100, function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          client.sscan('set', 0, 'MATCH', '*1*', 'COUNT', 100, function (err, res1) {
            if (err) {
              errorCallback(err, null);
            }
            ut.assertMany([
                ['equal', res[1][0], 'a'],
                ['equal', res1[1][0], '1']
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.scan9 = function (errorCallback) {
    var test_case = 'SSCAN with PATTERN';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback();
      }
      client.sadd('mykey', 'foo', 'fab', 'fiz', 'foobar', 1, 2, 3, 4, function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        client.sscan('mykey', 0, 'MATCH', 'foo*', 'COUNT', 10000, function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          ut.assertDeepEqual(['foo', 'foobar'], res[1], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.scan9 = function (errorCallback) {
    var test_case = 'HSCAN with PATTERN';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback();
      }
      client.hmset('mykey', 'foo', 1, 'fab', 1, 'fiz', 3, 'foobar', 10, 1, 'a', 2, 'b', 3, 'c', 4, 'd', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        client.hscan('mykey', 0, 'MATCH', 'foo*', 'COUNT', 10000, function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          ut.assertDeepEqual(['foo', '1', 'foobar', '10'], res[1], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.scan10 = function (errorCallback) {
    var test_case = 'ZSCAN with PATTERN';
    client.del('mykey', function (err, res) {
      if (err) {
        errorCallback();
      }
      client.zadd('mykey', 1, 'foo', 2, 'fab', 3, 'fiz', 10, 'foobar', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        client.zscan('mykey', 0, 'MATCH', 'foo*', 'COUNT', 10000, function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          ut.assertDeepEqual(['foo', '1', 'foobar', '10'], res[1], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  return scan;

}
  ());
