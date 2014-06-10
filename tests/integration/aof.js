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

exports.Aof = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  tp = new(require('../support/tmpfile.js'));
  aof = {},
  name = 'Aof',
  tester = {},
  all_tests = {},
  master = '',
  server_path = '',
  aof_path = '',
  server_pid = '',
  client_pid = '',
  server_host = '',
  server_port = '';

  //public property
  aof.debug_mode = false;

  //public method
  aof.start_test = function (cpid, callback) {
    testEmitter.on('start', function () {
      client_pid = cpid;
      all_tests = Object.keys(tester);
      testEmitter.emit('next');
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
          testEmitter.emit('end');
        }
      }, ut.timeout);
    });
    testEmitter.on('end', function () {
      callback(null, true);
    });

    if (aof.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods
  function create_aof() {
    server_path = tp.tmpdir('server.aof');
    aof_path = server_path + '/appendonly.aof';
    var stream = fs.createWriteStream(aof_path, {
        flags : 'w+'
      });
    return stream;
  }
  function append_to_aof(st, str) {
    st.write(str);
  }
  function start_server_aof(client_pid, dir, callback) {
    var tags = 'aof';
    var overrides = {};
    overrides['dir'] = dir;
    overrides['appendonly'] = 'yes';
    overrides['appendfilename'] = 'appendonly.aof';
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    (new Server()).start_server(client_pid, args, function (err, res) {
      if (err) {
        callback(err, null);
      }
      callback(null, res); // returned is server.pid
    });
  }
  function kill_server_aof(client_pid, server_pid, callback) {
    server.kill_server(client_pid, server_pid, callback);
  }
  tester.Aof1 = function (errorCallback) {
    var test_case = 'Unfinished MULTI: Server should have logged an error';
    try {
      var st = create_aof();
      append_to_aof(st, ut.formatCommand(['set', 'foo', 'hello']));
      append_to_aof(st, ut.formatCommand(['multi']));
      append_to_aof(st, ut.formatCommand(['set', 'bar', 'world']));
      st.end();
    } catch (e) {
      errorCallback(e);
    }
    start_test_aof(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      if (res) {
        //there if no server to kill.
        testEmitter.emit('next');
      }
    });
    function start_test_aof(callback) {
      start_server_aof(client_pid, server_path, function (err, res) {
        if (err) {
          callback(err, null);
        }
        server_pid = res;
        var pattern = 'Unexpected end of file reading the append only file';
        var retry = 10;
        g.asyncFor(0, retry, function (loop) {
          retry = loop.iteration();
          var file = g.srv[client_pid][server_pid]['stdout'];
          fs.readFile(file, function (err, result) {
            if (err) {
              callback(err, null);
            }
            if (ut.match(pattern, result)) {
              loop.break();
            } else {
              loop.decrease(1);
              //retry-=1;
              setTimeout(function () {
                loop.next();
              }, 1000);
            }
          });
        }, function () {
          ut.assertEqual(retry, 0, test_case);
          // no server to kill. Just delete the entry from dictionary.
          delete g.srv[client_pid][server_pid];
          callback(null, true);
        });
      });
    }
  };
  tester.Aof2 = function (errorCallback) {
    var test_case = 'Short read: Server should have logged an error';
    try {
      var st = create_aof();
      append_to_aof(st, ut.formatCommand(['set', 'foo', 'hello']));
      var str = ut.formatCommand(['set', 'bar', 'world']);
      append_to_aof(st, str.substr(0, str.length - 1));
      st.end();
    } catch (e) {
      errorCallback(e);
    }
    start_test_aof(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      if (res) {
        //there if no server to kill.
        testEmitter.emit('next');
      }
    });
    function start_test_aof(callback) {
      start_server_aof(client_pid, server_path, function (err, res) {
        if (err) {
          callback(err, null);
        }
        server_pid = res;
        var pattern = 'Bad file format reading the append only file';
        var retry = 10;
        g.asyncFor(0, retry, function (loop) {
          retry = loop.iteration();
          var file = g.srv[client_pid][server_pid]['stdout'];
          fs.readFile(file, function (err, result) {
            if (err) {
              callback(err, null);
            }
            if (ut.match(pattern, result)) {
              loop.break();
            } else {
              loop.decrease(1);
              //retry-=1;
              setTimeout(function () {
                loop.next();
              }, 1000);
            }
          });
        }, function () {
          ut.assertEqual(retry, 0, test_case);
          // no server to kill. Just delete the entry from dictionary.
          delete g.srv[client_pid][server_pid];
          callback(null, true);
        });
      });
    }
  };
  tester.Aof3 = function (errorCallback) {
    //Test that redis-check-aof indeed sees this AOF is not valid
    var test_case = 'Short read: Utility should confirm the AOF is not valid';
    var cmd = '.' + sep + 'redis' + sep + 'src' + sep + REDIS_CHECK_AOF + ' ' + aof_path;
    var child_check = child.exec(cmd,
        function (error, stdout, stderr) {
        ut.assertOk('not valid', stdout, test_case);
        testEmitter.emit('next');
      });
  };
  tester.Aof4 = function (errorCallback) {
    //Test that redis-check-aof indeed sees this AOF is not valid
    var test_case = 'Short read: Utility should be able to fix the AOF';
    var cmd = '.' + sep + 'redis' + sep + 'src' + sep + REDIS_CHECK_AOF + ' --fix ' + aof_path;
    var child_check = child.exec(cmd);
    child_check.stdin.write('y');
    child_check.stdout.on('data', function (data) {
      ut.assertOk('Successfully truncated AOF', data, test_case);
      testEmitter.emit('next');
    });
  };
  tester.Aof5_6 = function (errorCallback) {
    //Test that the server can be started using the truncated AOF.
    start_server_aof(client_pid, server_path, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      server_host = g.srv[client_pid][server_pid]['host'];
      server_port = g.srv[client_pid][server_pid]['port'];
      async.series({
        one : function (async_cb) {
          var test_case = 'Fixed AOF: Server should have been started';
          server.is_alive(g.srv[client_pid][server_pid]['pid'], function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            var res_Bool = ut.assertEqual(res, 1, test_case, true);
            if (res_Bool) {
              ut.pass(test_case);
              async_cb(null, true);
            } else {
              async_cb(e, null);
            }
          });
        },
        two : function (async_cb) {
          var test_case = 'Fixed AOF: Keyspace should contain values that were parsable';
          var client = redis.createClient(server_port, server_host);
          client.on('ready', function () {
            if (aof.debug_mode) {
              log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
            }
          });
          var result_array = new Array();
          client.get('foo', function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            result_array.push(res);
            client.get('bar', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              result_array.push(res);
              var res_Bool = ut.assertDeepEqual(result_array, ['hello', null], test_case, true);
              client.end();
              if (aof.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              if (res_Bool) {
                ut.pass(test_case);
                async_cb(null, true);
              } else {
                async_cb(e, null);
              }
            });
          });
        },

      }, function (err, results) {
        if (err) {
          errorCallback(err);
        }
        kill_server_aof(client_pid, server_pid, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.Aof7_8 = function (errorCallback) {
    //Test that SPOP (that modifies the client's argc/argv) is correctly free'd
    try {
      var st = create_aof();
      append_to_aof(st, ut.formatCommand(['sadd', 'set', 'foo']));
      append_to_aof(st, ut.formatCommand(['sadd', 'set', 'bar']));
      append_to_aof(st, ut.formatCommand(['spop', 'set']));
      st.end();
    } catch (e) {
      errorCallback(e);
    }
    start_test_aof(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      // server.pid is returned in res
      kill_server_aof(client_pid, res, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        testEmitter.emit('next');
      });
    });
    function start_test_aof(callback) {
      start_server_aof(client_pid, server_path, function (err, res) {
        if (err) {
          callback(err, null);
        }
        server_pid = res;
        server_host = g.srv[client_pid][server_pid]['host'];
        server_port = g.srv[client_pid][server_pid]['port'];
        setTimeout(function () {
          async.series({
            one : function (async_cb) {
              var test_case = 'AOF+SPOP: Server should have been started';
              server.is_alive(g.srv[client_pid][server_pid]['pid'], function (err, res) {
                if (err) {
                  async_cb(err, null);
                }
                var res_Bool = ut.assertEqual(res, 1, test_case, true);
                if (res_Bool) {
                  ut.pass(test_case);
                  async_cb(null, true);
                } else {
                  async_cb(e, null);
                }
              });
            },
            two : function (async_cb) {
              var test_case = 'AOF+SPOP: Set should have 1 member';
              var client = redis.createClient(server_port, server_host);
              client.on('ready', function () {
                if (aof.debug_mode) {
                  log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
                }
              });
              client.scard('set', function (err, res) {
                if (err) {
                  async_cb(err, null);
                }
                var res_Bool = ut.assertEqual(res, 1, test_case);
                client.end();
                if (aof.debug_mode) {
                  log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                }
                if (res_Bool) {
                  ut.pass(test_case);
                  async_cb(null, true);
                } else {
                  async_cb(e, null);
                }
              });
            },

          }, function (err, results) {
            if (err) {
              callback(err, null);
            }
            callback(null, server_pid)
          });
        }, 500);
      });
    }
  };
  tester.Aof9_10 = function (errorCallback) {
    //Test that EXPIREAT is loaded correctly
    try {
      var st = create_aof();
      append_to_aof(st, ut.formatCommand(['rpush', 'list', 'foo']));
      append_to_aof(st, ut.formatCommand(['expireat', 'list', '1000']));
      append_to_aof(st, ut.formatCommand(['rpush', 'list', 'bar']));
      st.end();
    } catch (e) {
      errorCallback(e);
    }
    start_test_aof(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      // server.pid is returned in res
      kill_server_aof(client_pid, res, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        testEmitter.emit('next');
      });
    });
    function start_test_aof(callback) {
      start_server_aof(client_pid, server_path, function (err, res) {
        if (err) {
          callback(err, null);
        }
        server_pid = res;
        server_host = g.srv[client_pid][server_pid]['host'];
        server_port = g.srv[client_pid][server_pid]['port'];
        async.series({
          one : function (async_cb) {
            var test_case = 'AOF+EXPIRE: Server should have been started';
            server.is_alive(g.srv[client_pid][server_pid]['pid'], function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              try {
                if (!assert.equal(res, 1, test_case)) {
                  ut.pass(test_case);
                  async_cb(null, true);
                }
              } catch (e) {
                ut.fail(e);
                async_cb(e, null);
              }
            });
          },
          two : function (async_cb) {
            var test_case = 'AOF+EXPIRE: List should be empty';
            var client = redis.createClient(server_port, server_host);
            client.on('ready', function () {
              if (aof.debug_mode) {
                log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
              }
            });
            client.llen('list', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              var res_Bool = ut.assertEqual(res, 0, test_case, true);
              client.end();
              if (aof.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              if (res_Bool) {
                ut.pass(test_case);
                async_cb(null, true);
              } else {
                async_cb(e, null);
              }
            });
          },
        }, function (err, results) {
          if (err) {
            callback(err, null);
          }
          callback(null, server_pid);
        });
      });
    }
  };
  tester.Aof11 = function (errorCallback) {
    var test_case = 'Redis should not try to convert DEL into EXPIREAT for EXPIRE -1';
    start_server_aof(client_pid, server_path, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      server_host = g.srv[client_pid][server_pid]['host'];
      server_port = g.srv[client_pid][server_pid]['port'];
      var client = redis.createClient(server_port, server_host);
      client.on('ready', function () {
        if (aof.debug_mode) {
          log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
        }
      });
      client.set('x', 10, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.expire('x', -1, function (err, res) {
          ut.assertError(err, test_case);
          client.end();
          if (aof.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          }
          kill_server_aof(client_pid, server_pid, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.Aof12 = function (errorCallback) {
    var test_case = 'Switch to appendonly from YES to NO using CONFIG';
    var st = create_aof();
    start_server_aof(client_pid, server_path, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      server_host = g.srv[client_pid][server_pid]['host'];
      server_port = g.srv[client_pid][server_pid]['port'];
      var client = redis.createClient(server_port, server_host);
      client.on('ready', function () {
        if (aof.debug_mode) {
          log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
        }
      });
      client.set('john', 'doe', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.config('set', 'appendonly', 'no', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.serverInfo(client, 'aof_enabled', function (err, res1) {
            if (err) {
              errorCallback(err);
            }
            client.set('jane', 'roe', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              ut.assertEqual(res1, 0, test_case);
              client.end();
              if (aof.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              kill_server_aof(client_pid, server_pid, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  tester.Aof13 = function (errorCallback) {
    var test_case = 'Switch to appendonly from NO to YES using CONFIG';
    start_server_aof(client_pid, server_path, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      server_host = g.srv[client_pid][server_pid]['host'];
      server_port = g.srv[client_pid][server_pid]['port'];
      var client = redis.createClient(server_port, server_host);
      var result = [];
      client.on('ready', function () {
        if (aof.debug_mode) {
          log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
        }
      });
      client.config('set', 'appendonly', 'yes', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.serverInfo(client, 'aof_enabled', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          client.get('john', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result.push(res);
            client.get('jane', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result.push(res);
              // Key john should exist wheres as jane should not
              ut.assertDeepEqual(result, [1, 'doe', null], test_case);
              client.end();
              if (aof.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              kill_server_aof(client_pid, server_pid, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  return aof;

}
  ());