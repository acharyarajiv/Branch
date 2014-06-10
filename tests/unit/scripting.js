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

exports.Scripting = (function () {
  // private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  server1 = new Server(),
  server2 = new Server(),
  server3 = new Server(),
  server4 = new Server(),
  scripting = {},
  name = 'Scripting',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = '',
  server_host = '',
  server_port = '',
  client_pid = '';

  //public property
  scripting.debug_mode = false;

  scripting.start_test = function (cpid, callback) {
    testEmitter.on('start', function () {
      var tags = 'scripting';
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
    testEmitter.on('end', function () {
      server.kill_server(client_pid, server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        }
        callback(null, true);
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
          if (scripting.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
          }
          testEmitter.emit('end');
        }
      }, ut.timeout);
    });
    if (scripting.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  // test methods
  tester.scripting1 = function (errorCallback) {
    var test_case = 'EVAL - Does Lua interpreter replies to our requests?';
    client.eval("return 'hello'", 0, function (err, res) {
      ut.assertEqual(res, 'hello', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting2 = function (errorCallback) {
    var test_case = "EVAL - Lua integer -> Redis protocol type conversion";
    client.eval('return 100.5', 0, function (err, res) {
      ut.assertEqual(res, '100', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting3 = function (errorCallback) {
    var test_case = 'EVAL - Lua string -> Redis protocol type conversion';
    client.eval("return 'hello world'", 0, function (err, res) {
      ut.assertEqual(res, 'hello world', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting4 = function (errorCallback) {
    var test_case = 'EVAL - Lua true boolean -> Redis protocol type conversion';
    client.eval('return true', 0, function (err, res) {
      ut.assertEqual(res, '1', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting5 = function (errorCallback) {
    var test_case = 'EVAL - Lua false boolean -> Redis protocol type conversion';
    client.eval('return false', 0, function (err, res) {
      ut.assertEqual(res, null, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting6 = function (errorCallback) {
    var test_case = 'EVAL - Lua status code reply -> Redis protocol type conversion';
    client.eval("return {ok='fine'}", 0, function (err, res) {
      ut.assertEqual(res, 'fine', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting7 = function (errorCallback) {
    var test_case = 'EVAL - Lua error reply -> Redis protocol type conversion';
    client.eval("return {err='this is an error'}", 0, function (err, res) {
      ut.assertOk('this is an error', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting8 = function (errorCallback) {
    var test_case = 'EVAL - Lua table -> Redis protocol type conversion';
    client.eval("return {1,2,3,'ciao',{1,2}}", 0, function (err, res) {
      ut.assertDeepEqual(res, [1, 2, 3, 'ciao', [1, 2]], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting9 = function (errorCallback) {
    var test_case = 'EVAL - Are the KEYS and ARGS arrays populated correctly?';
    client.eval("return {KEYS[1],KEYS[2],ARGV[1],ARGV[2]}", 2, 'a', 'b', 'c', 'd', function (err, res) {
      ut.assertDeepEqual(res, ['a', 'b', 'c', 'd'], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting10 = function (errorCallback) {
    var test_case = 'EVAL - is Lua able to call Redis API?';
    client.set('mykey', 'myval');
    client.eval("return redis.call('get','mykey')", 0, function (err, res) {
      ut.assertEqual(res, 'myval', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting11 = function (errorCallback) {
    var test_case = 'EVALSHA - Can we call a SHA1 if already defined?';
    client.evalsha('9bd632c7d33e571e9f24556ebed26c3479a87129', 0, function (err, res) {
      ut.assertEqual(res, 'myval', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting12 = function (errorCallback) {
    var test_case = 'EVALSHA - Can we call a SHA1 in uppercase?';
    client.evalsha('9BD632C7D33E571E9F24556EBED26C3479A87129', 0, function (err, res) {
      ut.assertEqual(res, 'myval', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting13 = function (errorCallback) {
    var test_case = 'EVALSHA - Do we get an error on invalid SHA1?';
    client.evalsha('NotValidShaSUM', 0, function (err, res) {
      ut.assertOk('NOSCRIPT', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting14 = function (errorCallback) {
    var test_case = 'EVALSHA - Do we get an error on non defined SHA1?';
    client.evalsha('ffd632c7d33e571e9f24556ebed26c3479a87130', 0, function (err, res) {
      ut.assertOk('NOSCRIPT', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting15 = function (errorCallback) {
    var test_case = 'EVAL - Redis integer -> Lua type conversion';
    client.eval("local foo = redis.pcall('incr','x') return {type(foo),foo}", 0, function (err, res) {
      ut.assertDeepEqual(res, ['number', 1], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting16 = function (errorCallback) {
    var test_case = 'EVAL - Redis bulk -> Lua type conversion';
    client.set('mykey', 'myval');
    client.eval("local foo = redis.pcall('get','mykey') return {type(foo),foo}", 0, function (err, res) {
      ut.assertDeepEqual(res, ['string', 'myval'], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting17 = function (errorCallback) {
    var test_case = 'EVAL - Redis multi bulk -> Lua type conversion';
    client.del('mylist');
    client.rpush('mylist', 'a');
    client.rpush('mylist', 'b');
    client.rpush('mylist', 'c');
    client.eval("local foo = redis.pcall('lrange','mylist',0,-1) return {type(foo),foo[1],foo[2],foo[3],# foo}", 0, function (err, res) {
      ut.assertDeepEqual(res, ['table', 'a', 'b', 'c', 3], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting18 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type conversion';

    client.eval("local foo = redis.pcall('set','mykey','myval') return {type(foo),foo['ok']}", 0, function (err, res) {
      ut.assertDeepEqual(res, ['table', 'OK'], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting19 = function (errorCallback) {
    var test_case = 'EVAL - Redis error reply -> Lua type conversion';
    client.set('mykey', 'myval');
    client.eval("local foo = redis.pcall('incr','mykey') return {type(foo),foo['err']}", 0, function (err, res) {
      ut.assertDeepEqual(res, ['table', 'ERR value is not an integer or out of range'], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting20 = function (errorCallback) {
    var test_case = 'EVAL - Redis nil bulk reply -> Lua type conversion';
    client.del('mykey');
    client.eval("local foo = redis.pcall('get','mykey') return {type(foo),foo == false}", 0, function (err, res) {
      ut.assertDeepEqual(res, ['boolean', 1], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting21 = function (errorCallback) {
    var test_case = 'EVAL - Is Lua affecting the currently selected DB?';
    client.set('mykey', 'this is DB 0');
    client.select(10);
    client.set('mykey', 'this is DB 10');
    client.eval("return redis.pcall('get','mykey')", 0, function (err, res) {
      ut.assertEqual(res, 'this is DB 10', test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting22 = function (errorCallback) {
    var test_case = 'EVAL - Is Lua seleced DB retained?';

    client.eval("return redis.pcall('select','0')", 0, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.get('mykey', function (err, res) {
        ut.assertEqual(res, 'this is DB 0', test_case);
        testEmitter.emit('next');
      });
    });
  }

  if (0) {
    tester.scripting23 = function (errorCallback) {
      var test_case = 'EVAL - Script can\'t run more than configured time limit';
      client.config('set', 'lua-time-limit', 1, function (err, res) {

        client.eval('local i = 0 while false do i=i+1 end', 0, function (err, res) {
          ut.assertOk('execution time', err, test_case);
          testEmitter.emit('next');

        });
      });
    }
  }

  tester.scripting24 = function (errorCallback) {
    var test_case = 'EVAL - Scripts can\'t run certain commands';

    client.eval("return redis.pcall('spop','x')", 0, function (err, res) {
      ut.assertOk('not allowed', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting25 = function (errorCallback) {
    var test_case = 'EVAL - Scripts can\'t run certain commands';

    client.eval("redis.pcall('randomkey'); return redis.pcall('set','x','ciao')", 0, function (err, res) {
      ut.assertOk('not allowed after', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting26 = function (errorCallback) {
    var test_case = 'EVAL - No arguments to redis.call/pcall is considered an error';

    client.eval('return redis.call()', 0, function (err, res) {
      ut.assertOk('one argument', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting27 = function (errorCallback) {
    var test_case = 'EVAL - redis.call variant raises a Lua error on Redis cmd error (1)';

    client.eval("redis.call('nosuchcommand')", 0, function (err, res) {
      ut.assertOk('Unknown Redis', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting28 = function (errorCallback) {
    var test_case = 'EVAL - redis.call variant raises a Lua error on Redis cmd error (1)';

    client.eval("redis.call('get','a','b','c')", 0, function (err, res) {
      ut.assertOk('number of args', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting29 = function (errorCallback) {
    var test_case = 'EVAL - redis.call variant raises a Lua error on Redis cmd error (1)';
    client.set('foo', 'bar');
    client.eval("redis.call('lpush','foo','val')", 0, function (err, res) {
      ut.assertOk('against a key', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting30 = function (errorCallback) {
    var test_case = 'SCRIPTING FLUSH - is able to clear the scripts cache?';
    client.set('mykey', 'myval');

    client.evalsha('9bd632c7d33e571e9f24556ebed26c3479a87129', 0, function (err, res_v) {
      if (res_v == 'myval') {
        client.multi([['script', 'flush']]).exec(function (err, res) {
          if (err) {
            errorCallback(err)
          }
          client.evalsha('9bd632c7d33e571e9f24556ebed26c3479a87129', 0, function (err, res_e) {
            ut.assertOk('NOSCRIPT', err, test_case);
            testEmitter.emit('next');
          });
        });
      } else {
        ut.fail('expected: ' + res_v + ' Actual: myval', true);
        testEmitter.emit('next');
      }

    });
  }

  tester.scripting31 = function (errorCallback) {
    var test_case = 'SCRIPT EXISTS - can detect already defined scripts?';
    client.eval('return 1+1', 0, function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.multi([['script', 'exists', 'a27e7e8a43702b7046d4f6a7ccf5b60cef6b9bd9', 'a27e7e8a43702b7046d4f6a7ccf5b60cef6b9bda']]).exec(function (err, res) {
        ut.assertDeepEqual(res, [[1, 0]], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting32 = function (errorCallback) {
    var test_case = 'SCRIPT LOAD - is able to register scripts in the scripting cache';
    var res_array = [];
    client.multi([['script', 'load', "return 'loaded'"]]).exec(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      res_array.push(res);
      client.evalsha('b534286061d4b9e4026607613b95c06c06015ae8', 0, function (err, res) {
        res_array.push(res);
        ut.assertDeepEqual(res_array, [['b534286061d4b9e4026607613b95c06c06015ae8'], 'loaded'], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting33 = function (errorCallback) {
    var test_case = 'In the context of Lua the output of random commands gets ordered';
    client.del('myset');
    client.sadd('myset', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z', 'aa', 'aaa', 'azz');
    client.eval("return redis.call('smembers','myset')", 0, function (err, res) {
      ut.assertDeepEqual(res, ['a', 'aa', 'aaa', 'azz', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z'], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting34 = function (errorCallback) {
    var test_case = 'SORT is normally not alpha re-ordered for the scripting engine';
    client.del('myset');
    client.sadd('myset', 1, 2, 3, 4, 10);
    client.eval("return redis.call('sort','myset','desc')", 0, function (err, res) {
      ut.assertDeepEqual(res, [10, 4, 3, 2, 1], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting35 = function (errorCallback) {
    var test_case = 'SORT BY <constant> output gets ordered for scripting';
    client.del('myset');
    client.sadd('myset', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z', 'aa', 'aaa', 'azz');
    client.eval("return redis.call('sort','myset','by','_')", 0, function (err, res) {
      ut.assertDeepEqual(res, ['a', 'aa', 'aaa', 'azz', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'z'], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting36 = function (errorCallback) {
    var test_case = 'SORT BY <constant> with GET gets ordered for scripting';
    client.del('myset');
    client.sadd('myset', 'a', 'b', 'c');
    client.eval("return redis.call('sort','myset','by','_','get','#','get','_:*')", 0, function (err, res) {
      ut.assertDeepEqual(res, ['a', null, 'b', null, 'c', null], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting37 = function (errorCallback) {
    var test_case = 'redis.sha1hex() implementation';
    var res_array = [];
    client.eval("return redis.sha1hex('')", 0, function (err, res) {
      if (err) {
        errorCallback(err)
      }
      res_array.push(res);
      client.eval("return redis.sha1hex('Pizza & Mandolino')", 0, function (err, res) {
        if (err) {
          errorCallback(err)
        }
        res_array.push(res);
        ut.assertDeepEqual(res_array, ['da39a3ee5e6b4b0d3255bfef95601890afd80709', '74822d82031af7493c20eefa13bd07ec4fada82f'], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting38 = function (errorCallback) {
    var test_case = 'Globals protection reading an undeclared global variable';

    client.eval('return a', 0, function (err, res) {
      ut.assertOk('attempted to access unexisting global', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting39 = function (errorCallback) {
    var test_case = 'Globals protection setting an undeclared global*';

    client.eval('a=10', 0, function (err, res) {
      ut.assertOk('attempted to create global', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting40 = function (errorCallback) {
    var test_case = 'Test an example script DECR_IF_GT';
    var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							local current \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							current = redis.call("get",KEYS[1]) \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							if not current then return nil end \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							if current > ARGV[1] then \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							return redis.call("decr",KEYS[1]) \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							else \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							return redis.call("get",KEYS[1]) \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          							end';
    client.set('foo', 5);
    var result = '';
    client.eval(script, 1, 'foo', 2, function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result += res;
      client.eval(script, 1, 'foo', 2, function (err, res) {
        if (err) {
          errorCallback(err)
        }
        result += res;
        client.eval(script, 1, 'foo', 2, function (err, res) {
          if (err) {
            errorCallback(err)
          }
          result += res;
          client.eval(script, 1, 'foo', 2, function (err, res) {
            if (err) {
              errorCallback(err)
            }
            result += res;
            client.eval(script, 1, 'foo', 2, function (err, res) {
              if (err) {
                errorCallback(err)
              }
              result += res;
              ut.assertEqual(result, 43222, test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  }

  tester.scripting41 = function (errorCallback) {
    var test_case = 'Scripting engine resets PRNG at every script execution';
    client.eval('return tostring(math.random())', 0, function (err, res1) {
      if (err) {
        errorCallback(err)
      }
      client.eval('return tostring(math.random())', 0, function (err, res2) {
        if (err) {
          errorCallback(err)
        }
        ut.assertEqual(res1, res2, test_case);
        testEmitter.emit('next');
      });
    });

  }

  tester.scripting42 = function (errorCallback) {
    var test_case = 'Scripting engine PRNG can be seeded correctly';
    client.eval('math.randomseed(ARGV[1]); return tostring(math.random())', 0, 10, function (err, res1) {
      if (err) {
        errorCallback(err)
      }
      client.eval('math.randomseed(ARGV[1]); return tostring(math.random())', 0, 10, function (err, res2) {
        if (err) {
          errorCallback(err)
        }
        client.eval('math.randomseed(ARGV[1]); return tostring(math.random())', 0, 20, function (err, res3) {
          if (err) {
            errorCallback(err)
          }
          ut.assertMany(
            [
              ['equal', res1, res2],
              ['notequal', res2, res3]
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });

  }

  tester.scripting43 = function (errorCallback) {
    var test_case = 'EVAL does not leak in the Lua stack';
    client.set('x', 0);
    //Use a non blocking client to speedup the loop
    var client1 = redis.createClient(server_port, server_host);
    client1.on('ready', function () {
      if (scripting.debug_mode) {
        log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
      }
    });
    g.asyncFor(0, 10000, function (loop) {
      client1.eval('return redis.call("incr",KEYS[1])', 1, 'x', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        loop.next();
      });
    }, function () {
      ut.serverInfo(client1, 'used_memory_lua', function (err, meminfo) {
        if (err) {
          errorCallback(err, null);
        }
        client.get('x', function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          ut.assertMany([
              ['ok', meminfo < (1024 * 100), null],
              ['equal', res, 10000]
            ], test_case);
          client1.end();
          testEmitter.emit('next');
        });
      });
    });
  }

  tester.scripting44 = function (errorCallback) {
    var test_case = 'EVAL processes writes from AOF in read-only slaves';
    var test_pass = false;
    client.flushall(function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.config('set', 'appendonly', 'yes', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        client.eval('redis.call("set","foo","100")', 0, function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          client.eval('redis.call("incr","foo")', 0, function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            client.eval('redis.call("incr","foo")', 0, function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              ut.wait_for_condition(50, 100, function (cb) {
                ut.serverInfo(client, 'aof_rewrite_in_progress', function (err, res) {
                  try {
                    if (!assert.equal(res, 0, test_case)) {
                      test_pass = true;
                      cb(true);
                    }
                  } catch (e) {
                    cb(false);
                  }
                });
              }, function () {
                if (!test_pass) {
                  ut.fail('AOF rewrite can\'t complete after CONFIG SET appendonly yes.', true);
                  testEmitter.emit('next');
                }
                client.config('set', 'slave-read-only', 'yes', function (err, res) {
                  if (err) {
                    errorCallback(err, null);
                  }
                  client.slaveof('127.0.0.1', 0, function (err, res) {
                    if (err) {
                      errorCallback(err, null);
                    }
                    client.debug('loadaof', function (err, res) {
                      if (err) {
                        errorCallback(err, null);
                      }
                      client.get('foo', function (err, res) {
                        if (err) {
                          errorCallback(err, null);
                        }
                        ut.assertEqual(res, 102, test_case);
                        testEmitter.emit('next');
                      });
                    });
                  });
                });
              }, function () {
                errorCallback(new Error('EVAL processes writes from AOF in read-only slaves failed'), null);
              });
            });
          });
        });
      });
    });
  }

  //Increase Code coverage
  tester.scripting46 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Syntax Error';

    client.eval("local foo = redis.pcall('set','mykey','myval') return {type(foo),foo['ok}", 0, function (err, res) {
      ut.assertOk('Error', err, test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting47 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Unknown command';

    client.eval("local foo = redis.pcall('int.parse(2)')  return {type(foo),foo}", 0, function (err, res) {
      ut.assertDeepEqual(res, ['table', '@user_script: 1: Unknown Redis command called from Lua script'], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting48 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type Number';
    var result_array = [];
    client.eval('return {tonumber(math.random()),tonumber("55"),tonumber(10101.1012e12),tonumber("100110",2),tonumber("LUA", 36),tonumber("55 "),tonumber("100112",2)}', 0, function (err, res) {
      result_array.push(res);
      client.eval('return tonumber("a",50)', 0, function (errB, res) {
        ut.assertMany(
          [
            ['deepequal', result_array, [[0, 55, 10101101200000000, 38, 28306, 55]]],
            ['ok', 'base out of range', errB]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting49 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type String format';

    client.eval('return string.format("%s %q", "Hello", "Lua user!")', 0, function (err, res1) {
      client.eval('return string.format("%c%c%c", 76,117,97)', 0, function (err, res2) {
        client.eval('return string.format("%e, %E", math.pi,math.pi)', 0, function (err, res3) {
          client.eval('return string.format("%f, %g", math.pi,math.pi)', 0, function (err, res4) {
            client.eval('return string.format("%d, %i, %u", -100,-100,-100)', 0, function (err, res5) {
              client.eval('return string.format("%o, %x, %X", -100,-100,-100)', 0, function (err, res6) {
                ut.assertMany(
                  [
                    ['deepequal', res1, 'Hello "Lua user!"'],
                    ['deepequal', res2, 'Lua'],
                    ['deepequal', res3, '3.141593e+000, 3.141593E+000'],
                    ['deepequal', res4, '3.141593, 3.14159'],
                    ['deepequal', res5, '-100, -100, 4294967196'],
                    ['deepequal', res6, '37777777634, ffffff9c, FFFFFF9C']
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  }

  tester.scripting50 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type String byte and char';
    var resArray = [];
    client.eval('return string.byte("ABCDE")', 0, function (err, res1) {
      resArray.push(res1);
      client.eval('return string.byte("ABCDE",0)', 0, function (err, res2) {
        resArray.push(res2);
        client.eval('return string.byte("ABCDE",0)', 0, function (err, res3) {
          resArray.push(res3);
          client.eval('return string.byte("ABCDE",3,4)', 0, function (err, res4) {
            resArray.push(res4);
            client.eval('local s = "ABCDE" return s:byte(3,4)', 0, function (err, res5) {
              resArray.push(res5);
              client.eval('return string.char(65,66,67)', 0, function (err, res6) {
                resArray.push(res6);
                client.eval('return string.char()', 0, function (err, res7) {
                  resArray.push(res7);
                  ut.assertDeepEqual(resArray, [65, null, null, 67, 67, 'ABC', ''], test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  }

  tester.scripting51 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type String Ops';
    var resArray = [];
    client.eval('return string.sub("Hello Lua user", 7, 9)', 0, function (err, res) {
      resArray.push(res);
      client.eval('return string.sub("Hello Lua user", -8, -6)', 0, function (err, res) {
        resArray.push(res);
        client.eval('return string.reverse("lua")', 0, function (err, res) {
          resArray.push(res);
          client.eval('return string.rep("Lua ",2)', 0, function (err, res) {
            resArray.push(res);
            client.eval('return string.match("I have 2 questions for you.", "%d+ %a+")', 0, function (err, res) {
              resArray.push(res);
              client.eval('return string.format("%d, %q", string.match("I have 2 questions for you.", "(%d+) (%a+)"))', 0, function (err, res) {
                resArray.push(res);
                client.eval('return string.len("Lua")', 0, function (err, res) {
                  resArray.push(res);
                  client.eval('return string.len("Lua\000user")', 0, function (err, res) {
                    resArray.push(res);
                    client.eval('return tostring(null)', 0, function (err, res) {
                      resArray.push(res);
                      client.eval('return {string.upper ("lua"),string.lower ("LUA"),string.len("Lua")}', 0, function (err, res) {
                        resArray.push(res);
                        ut.assertDeepEqual(resArray, ['Lua', 'Lua', 'aul', 'Lua Lua ', '2 questions', '2, "questions"', 3, 8, undefined, ['LUA', 'lua', 3]], test_case);
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
  }

  tester.scripting52 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type String find and pattern';
    var resArray = [];
    client.eval('return string.find("Hello Lua user", "Lua")', 0, function (err, res) {
      resArray.push(res);
      client.eval('return string.find("Hello Lua user", "banana")', 0, function (err, res) {
        resArray.push(res);
        client.eval('return string.find("Hello Lua user", "Lua", 1)', 0, function (err, res) {
          resArray.push(res);
          client.eval('return string.find("Hello Lua user", "Lua", 8)', 0, function (err, res) {
            resArray.push(res);
            client.eval('return string.find("Hello Lua user", "e", -5)', 0, function (err, res) {
              resArray.push(res);
              client.eval('return string.find("Hello Lua user", "%su")', 0, function (err, res) {
                resArray.push(res);
                client.eval('return string.find("Hello Lua user", "%su", 1, true)', 0, function (err, res) {
                  resArray.push(res);
                  ut.assertDeepEqual(resArray, [7, null, 7, null, 13, 10, null], test_case);
                  testEmitter.emit('next');
                });
              });

            });
          });
        });
      });
    });
  }

  tester.scripting53 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type String gsub and gmatch';
    var resArray = [];
    client.eval('local t = false for i,n in string.gmatch("from=world, to=Lua", "%a+") do t=true end return tostring(t)', 0, function (err, res) {
      resArray.push(res);
      client.eval('return string.gsub("Hello banana", "banana", "Lua user")', 0, function (err, res) {
        resArray.push(res);
        client.eval('return string.gsub("banana", "a", "A", 2)', 0, function (err, res) {
          resArray.push(res);
          client.eval('return string.gsub("banana", "(an)", "%1-")', 0, function (err, res) {
            resArray.push(res);
            client.eval('return string.gsub("banana", "(a)(n)", "%2%1")', 0, function (err, res) {
              resArray.push(res);
              client.eval('return string.gsub("Hello Lua user", "(%w+)", print)', 0, function (err, res) {
                resArray.push(res);
                client.eval('return string.gsub("Hello Lua user", "(%w+)", function(w) return string.len(w) end)', 0, function (err, res) {
                  resArray.push(res);
                  client.eval('return string.gsub("banana", "(a)", string.upper)', 0, function (err, res) {
                    resArray.push(res);
                    client.eval('return string.gsub("banana", "(a)(n)", function(a,b) return b..a end)', 0, function (err, res) {
                      resArray.push(res);
                      ut.assertDeepEqual(resArray, ['true', 'Hello Lua user', 'bAnAna', 'ban-an-a', 'bnanaa', 'Hello Lua user', '5 3 4', 'bAnAnA', 'bnanaa'], test_case);
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
  }

  tester.scripting54 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua type Table';
    var resArray = [];
    client.eval('return assert( 1 == 1, "true" )', 0, function (err, res) {
      resArray.push(res);
      client.eval('return assert( 1 == 2, "true" )', 0, function (errorMsg, res) {
        client.eval('local myTable  = { 1, 4, "LUA"} return type(myTable)', 0, function (err, res) {
          resArray.push(res);
          client.eval('local myTable  = { 1, 4, "LUA"} return table.concat(myTable)', 0, function (err, res) {
            resArray.push(res);
            client.eval('local myTable  = { 1, 4, "LUA"} return table.concat(myTable, " space ")', 0, function (err, res) {
              resArray.push(res);
              client.eval('local myTable  = { 1, 4, "LUA"} return table.concat(myTable, " space ", 2, 3)', 0, function (err, res) {
                resArray.push(res);
                client.eval('local myTable  = { 1, 4, "LUA"} table.insert(myTable, 5) return table.concat(myTable)', 0, function (err, res) {
                  resArray.push(res);
                  client.eval('local myTable  = { 1, 4, "LUA"} return table.getn (myTable)', 0, function (err, res) {
                    resArray.push(res);
                    client.eval('local myTable  = { 1, 4, "LUA"} table.remove(myTable, 1) return table.getn(myTable)', 0, function (err, res) {
                      resArray.push(res);
                      client.eval('local myTable  = { 4, 1, 3} table.sort(myTable) return table.concat(myTable)', 0, function (err, res) {
                        resArray.push(res);
                        client.eval('local myTable  = {"c","a","b"} table.sort(myTable) return table.concat(myTable)', 0, function (err, res) {
                          resArray.push(res);
                          ut.assertMany(
                            [
                              ['deepequal', resArray, [1, 'table', '14LUA', '1 space 4 space LUA', '4 space LUA', '14LUA5', 3, 2, '134', 'abc']],
                              ['ok', "Error", errorMsg]
                            ], test_case);
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
  }

  tester.scripting55 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Math';
    var resArray = [];
    client.eval('return {math.abs(1.1),math.acos(1),math.asin(1),math.atan(1),math.atan2(1,0)}', 0, function (err, res) {
      resArray.push(res);
      client.eval('return{math.cos(1),math.cosh(1)}', 0, function (err, res) {
        resArray.push(res);
        client.eval('return {math.ceil(math.pi),math.deg (0),math.exp (1),math.floor (1.9),math.fmod (3, 2),math.frexp (1),math.ldexp (2,2),math.log (10)}', 0, function (err, res) {
          resArray.push(res);
          client.eval('return {math.max (1,2,3),math.min (1,2,3),math.modf (2),math.pow (2, 2),math.rad (90)}', 0, function (err, res) {
            resArray.push(res);
            client.eval('return {math.sin (90),math.sinh (0),math.sqrt (4),math.tan (45),math.tanh (0)}', 0, function (err, res) {
              resArray.push(res);
              ut.assertDeepEqual(resArray, [[1, 0, 1, 0, 1], [0, 1], [4, 0, 2, 1, 1, 0, 8, 2], [3, 1, 2, 4, 1], [0, 0, 2, 1, 0]], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  }

  tester.scripting56 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua loadstring and unpack';
    var resultArray = [];
    client.eval('local f = loadstring("i = i + 1") return {tostring(f)}', 0, function (err, resload) {
      client.eval('return {unpack{10,20,30}}', 0, function (err, res) {
        resultArray.push(res);
        client.eval('local a,b = unpack{10,20,30} return {a,b}', 0, function (err, res) {
          resultArray.push(res);
          ut.assertMany(
            [
              ['ok', 'function', resload],
              ['deepequal', resultArray, [[10, 20, 30], [10, 20]]]
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  tester.scripting57 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua coroutine and select';
    var resultArray = [];
    var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local co = coroutine.create(function ()\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									return coroutine.wrap(function () return("hi") end)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								end)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								';
    client.eval(script + ' return coroutine.status(co)', 0, function (err, res) {
      resultArray.push(res);
      client.eval(script + ' return {coroutine.resume(co),coroutine.status(co)}', 0, function (err, res) {
        resultArray.push(res);
        var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      														local co = coroutine.create(function (a,b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      														coroutine.yield(a + b, a - b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      														coroutine.running ()\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      														end)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      														';
        client.eval(script + ' return {coroutine.resume(co, 20, 10)}', 0, function (err, res) {
          resultArray.push(res);
          client.eval('return {select(-1, 1, 2, 3),select(1, 1, 2, 3),select(4, 1, 2, 3)}', 0, function (err, res) {
            resultArray.push(res);
            client.eval('return {select("#", {1,2,3}, 4, 5, {6,7,8})}', 0, function (err, res) {
              resultArray.push(res);
              client.eval('return select(0, 1, 2, 3)', 0, function (errZ, res) {
                client.eval('return select(-2,1)', 0, function (errN, res) {
                  ut.assertMany(
                    [
                      ['deepequal', resultArray, ['suspended', [1, 'dead'], [1, 30, 10], [3, 1], [4]]],
                      ['ok', 'out of range', errZ],
                      ['ok', 'out of range', errN]
                    ], test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  }

  tester.scripting58 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua newproxy';
    var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local a = newproxy(true)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								getmetatable(a).__len = function() return 5 end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local b = newproxy(a)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local c = newproxy(false)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local is_collected = false\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local o = newproxy(true)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								getmetatable(o).__gc = function() is_collected = true end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								o = nil; collectgarbage()\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								return {type(a),#a,tostring(b ~= a),tostring(getmetatable(b) == getmetatable(a)),#b,tostring(not getmetatable(c)),tostring(is_collected)}';
    client.eval(script, 0, function (err, res) {
      client.eval('local a = newproxy(0) return {type(a)}', 0, function (errE, resE) {
        ut.assertMany(
          [
            ['deepequal', res, ['userdata', 5, 'true', 'true', 5, 'true', 'true']],
            ['ok', 'boolean or proxy expected', errE]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting59 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua setfenv';
    var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								a = 1 \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								setfenv(1, {})\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								return {a}';
    client.eval(script, 0, function (errG, res) {
      script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											local a = 1; \
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											local newgt = {}\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											setmetatable(newgt, {__index = _G})\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											setfenv(1, newgt)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											return a';
      client.eval(script, 0, function (err, res) {
        script = 'return {gcinfo(),getfenv(1)}';
        client.eval(script, 0, function (errL, resL) {
          ut.assertMany(
            [
              ['deepequal', resL[1], []],
              ['equal', res, 1],
              ['ok', 'global variable', errG]
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  tester.scripting60 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua pcall and xpcall';
    var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local add = function(a,b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									return tonumber(a)+tonumber(b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								return {pcall(add,"a"," ")}';
    client.eval(script, 0, function (errP, resP) {
      var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											local add = function(a,b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											return tonumber(a)+tonumber(b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											local err = function(a,b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											return "Error in Function"\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											return {xpcall(add,err,"a"," ")}';
      client.eval(script, 0, function (errXP, resXP) {
        ut.assertMany(
          [
            ['ok', 'nil value', resP[1]],
            ['ok', 'Error', resXP[1]]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting61 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Running code within code';
    var script = 'local code = [[ return ("Redis") ]]\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local test = loadstring(code) return test()';
    client.eval(script, 0, function (errL, resL) {
      script = 'local code = string.dump(function() return("Redis") end)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											local test = loadstring(code)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											return test()';
      client.eval(script, 0, function (errOL, resOL) {
        script = 'local filefunc = dofile("test.lua")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      														local returnedfunc = filefunc(2, 3)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      														return returnedfunc';
        client.eval(script, 0, function (errStr, resStr) {
          script = 'return {tostring(rawequal(1,1)),tostring(rawequal(1,2))}';
          client.eval(script, 0, function (errLF, resLF) {
            script = 'local code = string.dump(function() return(1) end)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  															local test = loadstring(code)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  															return test()';
            client.eval(script, 0, function (errLN, resLN) {
              script = 'local code = string.dump(function() return(true) end)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                																	local test = loadstring(code)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                																	return test()';
              client.eval(script, 0, function (errLB, resLB) {
                script = 'local code = string.dump(function() return("") end)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              																			local test = loadstring(code)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              																			return test()';
                client.eval(script, 0, function (errLNiL, resLNiL) {
                  script = 'local code = function(a)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            																						return a\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            																						end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            																						local test = load(code)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            																						return test()';
                  client.eval(script, 0, function (errLd, resLd) {
                    ut.assertMany(
                      [
                        ['ok', 'Redis', resL],
                        ['ok', 'Redis', resOL],
                        ['ok', 'Error', errStr],
                        ['deepequal', resLF, ['true', 'false']],
                        ['ok', 1, resLN],
                        ['ok', 1, resLB],
                        ['ok', '', resLNiL]
                      ], test_case);
                    testEmitter.emit('next');
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  tester.scripting62 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua pairs and ipairs';
    var script = 'local Name = {"Jones","Smith","Patel","Brown","Ng"}\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								local temp_table={}\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								for index,val in ipairs(Name) do\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								 table.insert(temp_table,index .. " - " .. val)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          								return table.concat(temp_table,",")';
    client.eval(script, 0, function (errOL, resOL) {
      script = 'local Name = {"Jones","Smith","Patel","Brown","Ng"}\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											local temp_table={}\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											for index,val in pairs(Name) do\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        												table.insert(temp_table,index .. " - " .. val)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        											return table.concat(temp_table,",")';
      client.eval(script, 0, function (errStr, resStr) {
        ut.assertMany(
          [
            ['equal', resOL, '1 - Jones,2 - Smith,3 - Patel,4 - Brown,5 - Ng'],
            ['equal', resStr, '1 - Jones,2 - Smith,3 - Patel,4 - Brown,5 - Ng']
          ], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting63 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Json decoding simple types';
    var res_Array = [];
    client.eval("return cjson.decode('\"test string\"')", 0, function (err, res) {
      res_Array.push(res);
      client.eval("cjson.refuse_invalid_numbers(true) return cjson.decode('[0.0, -5e3, -1, 0.3e-3]')", 0, function (err, res) {
        res_Array.push(res);
        client.eval("return cjson.decode('null')", 0, function (err, res) {
          res_Array.push(res);
          client.eval("return {tostring(cjson.decode('true')),tostring(cjson.decode('false'))}", 0, function (err, res) {
            res_Array.push(res);
            client.eval("return cjson.decode(cjson.encode('{\"1\": \"one\", \"3\": \"three\"}'))", 0, function (err, res) {
              res_Array.push(res);
              ut.assertDeepEqual(res_Array, ["test string", [0, -5000, -1, 0], null, ['true', 'false'], '{"1": "one", "3": "three"}'], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  }

  tester.scripting64 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Json decoding and encoding errors';
    client.eval("return cjson.decode('{ \"unexpected eof\": ')", 0, function (errTE, res) {
      client.eval("return cjson.decode('{ \"extra data\": true }, false')", 0, function (errTC, res) {
        client.eval("return cjson.decode([[ { bad escape \q code } ]])", 0, function (errI, res) {
          client.eval("return cjson.decode([[ { \"bad escape \q code\"  } ]])", 0, function (errTO, res) {
            client.eval("return cjson.decode('[ -+12 ]')", 0, function (errN, res) {
              client.eval("return cjson.encode({ [false] = \"wrong\" })", 0, function (errEn, res) {
                client.eval("return cjson.decode('\0\"0\"')", 0, function (errSy, res) {
                  client.eval("local foo=cjson.null return cjson.decode(foo)", 0, function (errLD, res) {
                    ut.assertMany(
                      [
                        ['ok', 'Expected value but found T_END', errTE],
                        ['ok', 'Expected the end but found T_COMMA', errTC],
                        ['ok', 'Expected object key string but found invalid token', errI],
                        ['ok', 'Expected colon but found T_OBJ_END', errTO],
                        ['ok', 'invalid number', errN],
                        ['ok', 'Cannot serialise', errEn],
                        ['ok', 'JSON parser does not support UTF-16 or UTF-32', errSy],
                        ['ok', 'got userdata', errLD]
                      ], test_case);
                    testEmitter.emit('next');
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  tester.scripting65 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Json decoding nested arrays / objects';
    var res_Array = [];
    client.eval("return cjson.encode_max_depth(5)", 0, function (err, res) {
      res_Array.push(res);
      client.eval("return cjson.decode('[ \"nested\" ]')", 0, function (err, res) {
        res_Array.push(res);
        client.eval("return cjson.decode(cjson.encode('{\"a\":{\"b\":{\"c\":{\"d\":{\"e\":\"nested\"}}}}}'))", 0, function (err, res) {
          res_Array.push(res);
          ut.assertDeepEqual(res_Array, [5, ['nested'], '{"a":{"b":{"c":{"d":{"e":"nested"}}}}}'], test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  tester.scripting66 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Json encoding simple types';
    var res_Array = [];
    client.eval("return {cjson.encode(true),cjson.encode(false)}", 0, function (err, res) {
      res_Array.push(res);
      client.eval("return {cjson.encode({ }),cjson.encode(10)}", 0, function (err, res) {
        res_Array.push(res);
        ut.assertDeepEqual(res_Array, [['true', 'false'], ['{}', 10]], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.scripting67 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Json encoding table tests';
    var res_Array = [];
    client.eval("cjson.encode_sparse_array(true, 2, 3) cjson.encode_max_depth(5) return {cjson.encode({ [3] = \"sparse test\" })}", 0, function (err, res) {
      res_Array.push(res);
      client.eval("cjson.encode_sparse_array(true, 2, 3) cjson.encode_max_depth(5) return cjson.encode({ [1] = \"one\", [4] = \"sparse test\" })", 0, function (err, res) {
        res_Array.push(res);
        client.eval("cjson.encode_sparse_array(true, 2, 3) cjson.encode_max_depth(5) return cjson.encode({ [\"2\"] = \"numeric string key test\" })", 0, function (err, res) {
          res_Array.push(res);
          client.eval("cjson.encode_sparse_array(true, 2, 3) cjson.encode_max_depth(5) return cjson.encode({ {{{{{ \"nested\" }}}}}})", 0, function (err, res) {
            ut.assertMany(
              [
                ['deepequal', res_Array, [['[null,null,"sparse test"]'], '["one",null,null,"sparse test"]', '{"2":"numeric string key test"}']],
                ['ok', 'excessive nesting', err]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  }

  tester.scripting68 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua msgpack';
    var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local payload = {1, 2, 3}\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local varpack = cmsgpack.pack(payload)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local varunpack = cmsgpack.unpack(varpack)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									return {varunpack,cmsgpack.unpack(cmsgpack.pack(17)),cmsgpack.unpack(cmsgpack.pack(-1))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									,cmsgpack.unpack(cmsgpack.pack(true)),cmsgpack.unpack(cmsgpack.pack(false)),cmsgpack.unpack(cmsgpack.pack(1.5))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									,cmsgpack.unpack(cmsgpack.pack(101)),cmsgpack.unpack(cmsgpack.pack(-101)),cmsgpack.unpack(cmsgpack.pack(20001))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									,cmsgpack.unpack(cmsgpack.pack(-20001)),cmsgpack.unpack(cmsgpack.pack(-20000001)),cmsgpack.unpack(cmsgpack.pack(20000001))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									,cmsgpack.unpack(cmsgpack.pack(200000000001)),cmsgpack.unpack(cmsgpack.pack(-200000000001))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									,cmsgpack.unpack(cmsgpack.pack(0xff)),cmsgpack.unpack(cmsgpack.pack(0xffff)),cmsgpack.unpack(cmsgpack.pack(0xffffffff))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									,cmsgpack.unpack(cmsgpack.pack(-128)),cmsgpack.unpack(cmsgpack.pack(-32768)),cmsgpack.unpack(cmsgpack.pack(-2147483648))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									,cmsgpack.unpack(cmsgpack.pack(nil)),cmsgpack.unpack(cmsgpack.pack("abc")),cmsgpack.unpack(cmsgpack.pack("xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab"))}';
    client.eval(script, 0, function (err, res) {
      ut.assertDeepEqual(res, [[1, 2, 3], 17, -1, 1, null, 1, 101, -101, 20001, -20001, -20000001, 20000001, 200000000001, -200000000001, 255, 65535, 4294967295, -128, -32768, -2147483648], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting69 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Json escaping unicode';
    var res_Array = [];
    client.eval("cjson.refuse_invalid_numbers(true) return {cjson.encode(tonumber(0/0))}", 0, function (errN, res) {
      client.eval("cjson.refuse_invalid_numbers(true) return cjson.decode('0xa')", 0, function (errI, res) {
        client.eval("cjson.encode_keep_buffer(true) cjson.encode_number_precision(2) return cjson.encode({1.23})", 0, function (err, resP) {
          client.eval("cjson.refuse_invalid_numbers(false) return cjson.encode(tonumber(0/0))", 0, function (errRF, resRF) {
            client.eval("cjson.encode_number_precision(15) return cjson.encode({1.23})", 0, function (errE, res) {
              ut.assertMany(
                [
                  ['ok', 'NaN or Inf', errN],
                  ['ok', 'invalid number', errI],
                  ['equal', resP, '[1.2]'],
                  ['equal', resRF, '-1.$'],
                  ['ok', 'expected integer between 1 and 14', errE]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  }

  tester.scripting70 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua Json unicode_escape';
    var res_Array = [];
    client.eval("return cjson.decode('\"\\\\u0000\"')", 0, function (err, res) {
      res_Array.push(res);
      client.eval("return cjson.decode('\"\\\\uda00\\\\uDC00\"')", 0, function (err, res) {
        client.eval("return cjson.decode('\"\\\\uda00\\\\u0000\"')", 0, function (errI, res) {
          client.eval("return cjson.decode('\"\\\\uda00\\\\u\"')", 0, function (errI1, res) {
            client.eval("return cjson.decode('\"\\\\uda00\"')", 0, function (errI2, res) {
              client.eval("return cjson.decode('\"\\\\u\"')", 0, function (errI3, res) {
                ut.assertMany(
                  [
                    ['deepequal', res_Array, ['\u0000']],
                    ['ok', 'invalid unicode escape', errI],
                    ['ok', 'invalid unicode escape', errI1],
                    ['ok', 'invalid unicode escape', errI2],
                    ['ok', 'invalid unicode escape', errI3]
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  }

  tester.scripting71 = function (errorCallback) {
    var test_case = 'EVAL - Redis status reply -> Lua msgpack regression';
    var script = '\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local failed = 0\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local passed = 0\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local hex = function(s)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										local i\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										local h = ""\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										for i = 1, #s do\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											h = h .. string.format("%02x",string.byte(s,i))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										return h\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local test_pack = function(name,obj,raw)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										if hex(cmsgpack.pack(obj)) ~= raw then\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											failed = failed+1\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										else\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											passed = passed+1\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local ascii_to_num = function(c)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										if (c >= string.byte("0") and c <= string.byte("9")) then\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											return c - string.byte("0")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										elseif (c >= string.byte("A") and c <= string.byte("F")) then\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											return (c - string.byte("A"))+10\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										elseif (c >= string.byte("a") and c <= string.byte("f")) then\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											return (c - string.byte("a"))+10\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local unhex = function(h)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										local i\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										local s = ""\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										for i = 1, #h, 2 do\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											local high = ascii_to_num(string.byte(h,i))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											local low = ascii_to_num(string.byte(h,i+1))\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											s = s .. string.char((high*16)+low)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										return s\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local compare_objects = function(a,b)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										if (type(a) == "table") then\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											local count = 0\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											for k,v in pairs(a) do\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          												count = count + 1\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											for k,v in pairs(b) do count = count - 1 end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											if count == 0 then return true else return false end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										else\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											return a == b\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local test_unpack = function(name,raw,obj)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										if not compare_objects(cmsgpack.unpack(unhex(raw)),obj) then\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											failed = failed+1\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										else\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          											passed = passed+1\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									local test_pack_and_unpack = function(name,obj,raw)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										test_pack(name,obj,raw)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          										test_unpack(name,raw,obj)\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									end\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("positive fixnum",0,"00")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("negative fixnum",-1,"ff")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("uint8",255,"ccff")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("fix raw","a","a161")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("fix array",{0},"9100")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("fix map",{a=64},"81a16140")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("nil",nil,"c0")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("true",true,"c3")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("false",false,"c2")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("double",0.1,"cb3fb999999999999a")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("uint16",32768,"cd8000")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("uint32",1048576,"ce00100000")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("int8",-64,"d0c0")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("int16",-1024,"d1fc00")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("int32",-1048576,"d2fff00000")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("int64",-1099511627776,"d3ffffff0000000000")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("raw16","                                        ","da002820202020202020202020202020202020202020202020202020202020202020202020202020202020")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									test_pack_and_unpack("array 16",{0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},"dc001000000000000000000000000000000000")\
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          									return {failed,passed}';
    client.eval(script, 0, function (err, res) {
      ut.assertDeepEqual(res, [0, 36], test_case);
      testEmitter.emit('next');
    });
  }

  tester.scripting72 = function (errorCallback) {
    var tags = 'scripting-repl';
    var overrides = {};
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    server2.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid1 = res;
      // nesting calls to start_server
      setTimeout(function () { // to give some time for the master to start.
        master_cli = g.srv[client_pid][server_pid1]['client'];
        master_host = g.srv[client_pid][server_pid1]['host'];
        master_port = g.srv[client_pid][server_pid1]['port'];

        var tags = '';
        var overrides = {};
        var args = {};
        args['tags'] = tags;
        args['name'] = name;
        args['overrides'] = overrides;
        server3.start_server(client_pid, args, function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          server_pid2 = res;
          slave_cli = g.srv[client_pid][server_pid2]['client'];
          start_actual_test(function (err, res) {
            if (err) {
              errorCallback(err);
            }
            slave_cli.end();
            master_cli.end();

            kill_server(function (err, res) {
              if (err) {
                errorCallback(err)
              }
              testEmitter.emit('next');
            });
          });
        });
      }, 100);
    });
    function kill_server(callback) {
      server2.kill_server(client_pid, server_pid1, function (err, res) {
        if (err) {
          callback(err, null);
        } else {
          server3.kill_server(client_pid, server_pid2, function (err, res) {
            if (err) {
              callback(err, null);
            } else if (res) {
              callback(null, true);
            }
          });
        }
      });
    };
    function start_actual_test(callback) {
      async.series({
        one : function (cb) {
          var test_case = 'Before the slave connects we issue two EVAL commands';
          slave_cli.eval("redis.call('incr','x'); redis.call('nonexisting')", 0, function (err, res) {
            slave_cli.eval("return redis.call('incr','x')", 0, function (err, res) {
              ut.assertEqual(res, 2, test_case);
              cb(null, true);
            });
          });
        },
        two : function (cb) {
          var test_case = 'Now use EVALSHA against the master, with both SHAs';
          slave_cli.evalsha('6e8bd6bdccbe78899e3cc06b31b6dbf4324c2e56', 0, function (err, res) {

            slave_cli.evalsha('ae3477e27be955de7e1bc9adfdca626b478d3cb2', 0, function (err, res) {
              if (err) {
                cb(err);
              }
              ut.assertEqual(res, 4, test_case);
              cb(null, true);
            });

          });
        },
        three : function (cb) {
          var test_case = "If EVALSHA was replicated as EVAL, 'x' should be '4'";
          ut.wait_for_condition(50, 100, function (cb) {
            slave_cli.get('x', function (err, res) {
              try {
                if (!assert.equal(res, 4, test_case)) {
                  ut.pass(test_case);
                  cb(true);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(false);
              }

            });
          }, function () {
            cb(null, null);
          }, function () {
            ut.fail("Expected 4 in x, but value is '[r -1 get x]'", true);
            cb(null, true);
          });
        },
        four : function (cb) {
          var test_case = 'Connect a slave to the main instance';
          slave_cli.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              cb(err)
            }
            ut.wait_for_condition(50, 100, function (cb) {
              ut.getserverInfo(slave_cli, function (err, res) {
                if (err) {
                  cb(err);
                }
                if (ut.match('role:slave', res) && ut.match('master_link_status:up', res)) {
                  ut.pass(test_case);
                  cb(true);
                } else {
                  cb(false);
                }
              });
            }, function () {
              cb(null, null);
            }, function () {
              cb(new Error('Can\'t turn the instance into a slave'), null);
            });
          });
        },
      }, function (err, rep) {
        if (err) {
          callback(err, null);
        }
        callback(null, true);
      });
    };
  };

  tester.scripting73 = function (errorCallback) {
    //Test that the server can be started using the truncated AOF.
    var args = {};
    args['name'] = name;
    args['tags'] = 'scripting';
    args['overrides'] = {};
    var server_host1 = '',
    server_port1 = '',
    server_pid1 = '';
    var KillServer = true;
    server1.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid1 = res;
      client1 = g.srv[client_pid][server_pid1]['client'];
      server_host1 = g.srv[client_pid][server_pid1]['host'];
      server_port1 = g.srv[client_pid][server_pid1]['port'];
      start_actual_test(function (err, res) {
        if (err) {
          errorCallback(err);
        }
        if (KillServer) {
          kill_server(function (err, res) {
            if (err) {
              errorCallback(err)
            }
          });
        }
      });
    });
    function kill_server(callback) {
      server1.kill_server(client_pid, server_pid1, function (err, res) {
        if (err) {
          callback(err, null);
        }
      });
    };
    function start_actual_test(callback) {
      async.series({
        one : function (async_cb) {
          var test_case = 'Timedout read-only scripts can be killed by SCRIPT KILL'
            var newClient = redis.createClient(server_port1, server_host1);

          client1.config('set', 'lua-time-limit', 10);
          newClient.eval('while true do end', 0, function (err, res) {
            if (res)
              callback(res);
          });
          setTimeout(function () {
            client1.ping(function (err, res) {
              try {
                if (!assert.ok(ut.match('BUSY', err)), test_case) {
                  client1.script('kill', function (err, res) {
                    if (err) {
                      callback(err);
                    }
                    client1.ping(function (err, res) {
                      ut.assertEqual(res, 'PONG', test_case);
                      newClient.end();
                      async_cb(null, false);
                    });
                  });
                }
              } catch (e) {
                ut.fail(e, true);
                newClient.end();
                async_cb(null, true);
              }
            });
          }, 200);
        },
        two : function (async_cb) {
          var test_case = 'Timedout script link is still usable after Lua returns';
          client1.config('set', 'lua-time-limit', 10);
          client1.eval("for i=1,100000 do redis.call('ping') end return 'ok'", 0, function (err, res) {
            client1.ping(function (err, res) {
              ut.assertEqual(res, 'PONG', test_case);
              async_cb(null, true);
            });
          });
        },
        three : function (async_cb) {
          var test_case = 'Timedout scripts that modified data can\'t be killed by SCRIPT KILL';
          var newClient = redis.createClient(server_port1, server_host1);
          newClient.on('error', function (err) {
            newClient.end();
          });
          newClient.eval("redis.call('set','x','y'); while true do end", 0, function (err, res) {
            if (res)
              callback(res);
          });
          setTimeout(function () {
            client1.ping(function (err, res) {
              try {
                if (!assert.ok(ut.match('BUSY', err)), test_case) {
                  client1.script('kill', function (err, res) {
                    try {
                      if (!assert.ok(ut.match('UNKILLABLE', err)), test_case) {
                        client1.ping(function (err, res) {
                          try {
                            if (!assert.ok(ut.match('BUSY', err)), test_case) {
                              ut.pass(test_case);

                              test_case = 'SHUTDOWN NOSAVE can kill a timedout script anyway';
                              client1.write(ut.formatCommand(['shutdown', 'nosave']), function (error, res) {
                                if (res) {
                                  errorCallback(res);
                                }
                                newClient1 = redis.createClient(server_port1, server_host1);
                                newClient1.on('error', function (msg) {
                                  ut.assertOk('connect ECONNREFUSED', msg, test_case);
                                  KillServer = false;
                                  client1.end();
                                  newClient.end();
                                  newClient1.end();
                                  testEmitter.emit('next');
                                });
                              });
                            }
                          } catch (e) {
                            newClient.end();
                            ut.fail(e, true);
                            async_cb(e);
                          }
                        });
                      }
                    } catch (e) {
                      newClient.end();
                      ut.fail(e, true);
                      async_cb(e);
                    }
                  });
                }
              } catch (e) {
                newClient.end();
                ut.fail(e, true);
                async_cb(e);
              }

            });

          }, 200);
        },
      }, function (err, rep) {
        if (err) {
          callback(err, null);
        }
        callback(null, true);
      });

    }
  }

  tester.scripting74 = function (errorCallback) {
    var test_case = 'Shutdown save works';
    var tags = 'scripting';
    var overrides = {};
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;

    server4.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }

      setTimeout(function () {
        server_pid1 = res;
        client1 = g.srv[client_pid][server_pid1]['client'];
        server_host = g.srv[client_pid][server_pid1]['host'];
        server_port = g.srv[client_pid][server_pid1]['port'];

        function killserver() {
          client1.end();
          server4.kill_server(client_pid, server_pid1, function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            testEmitter.emit('next');
          });
        }
        client1.shutdown('somecommand', function (err, res) {
          try {
            if (!assert.ok(ut.match('syntax error', err), test_case)) {
              setTimeout(function () {
                //i had to use write for shutdown cause client.shutdown throws error
                //this issue is present in mranney module and they recommend to use quit instead of shutdown for orderly shutdown.
                //https://github.com/mranney/node_redis/pull/16

                client1.write(ut.formatCommand(['shutdown', 'save']), function (err, res) {
                  client1.end();
                  setTimeout(function () {
                    var msg = fs.readFileSync(g.srv[client_pid][server_pid1]['stdout']).toString().split('\n');
                    var val = msg[msg.length - 4];
                    var res = ut.assertOk('Saving', val, test_case, true);
                    if (res) {
                      ut.pass(test_case);
                      testEmitter.emit('next');
                    } else {
                      killserver();
                    }
                  }, 500);
                });
              }, 3000);
            }
          } catch (e) {
            killserver();
            ut.fail(e, true);
          }
        });
      }, 1000);
    });

  };

  return scripting;
}
  ());
