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

exports.Replication4 = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  server1 = new Server(),
  server2 = new Server(),
  server3 = new Server(),
  server4 = new Server(),
  server5 = new Server(),
  replication4 = {},
  name = 'Replication4',
  tester = {},
  all_tests = {},
  master_host = '',
  master_port = '',
  client_pid = '',
  monitor_cli = '',
  master_cli = '',
  slave_cli = '',
  load_handle0 = '',
  load_handle1 = '',
  load_handle2 = '',
  server_pid = '',
  server_pid2 = '';

  //public property
  replication4.debug_mode = false;

  //public method
  replication4.start_test = function (pid, callback) {
    testEmitter.on('start', function () {
      client_pid = pid;
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

    if (replication4.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods

  function start_bg_complex_data(host, port, db, ops) {
    var forked = child.fork('./tests/helpers/bg_complex_data.js', [host, port, db, ops]);
    return forked;
  }

  function stop_bg_complex_data(handle) {
    try {
      handle.kill('SIGKILL');
    } catch (e) {}
  }

  tester.Repl41 = function (errorCallback) {
    var tags = 'repl-41';
    var overrides = {};
    overrides['maxheap'] = '1gb';
    var args = {};
    args['name'] = name + '(Master)';
    args['tags'] = tags;
    server.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid = res;
      // nesting calls to start_server
      setTimeout(function () { // to give some time for the master to start.
        master_cli = g.srv[client_pid][server_pid]['client'];
        master_host = g.srv[client_pid][server_pid]['host'];
        master_port = g.srv[client_pid][server_pid]['port'];
        monitor_cli = redis.createClient(master_port, master_port);
        monitor_cli.on('ready', function () {
          if (replication4.debug_mode) {
            log.notice('Monitor client connected  and listening on socket: ' + master_port + ':' + master_host);
          }
        });
        var tags = 'repl-mr12';
        var overrides = {};
        overrides['maxheap'] = '512mb';
        var args = {};
        args['tags'] = tags;
        args['name'] = name + '(Slave0)';
        args['overrides'] = overrides;
        server1.start_server(client_pid, args, function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          server_pid2 = res;
          slave_cli = g.srv[client_pid][server_pid2]['client'];
          setTimeout(function () {
            load_handle0 = start_bg_complex_data(master_host, master_port, 0, 100000);
          }, 100);
          setTimeout(function () {
            load_handle1 = start_bg_complex_data(master_host, master_port, 11, 100000);
          }, 100);
          setTimeout(function () {
            load_handle2 = start_bg_complex_data(master_host, master_port, 12, 100000);
          }, 100);

          start_actual_test(function (err, res) {
            if (err) {
              errorCallback(err);
            }
            monitor_cli.end();
            slave_cli.end();
            master_cli.end();
            if (replication4.debug_mode) {
              log.notice('Monitor client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
              log.notice(g.srv[client_pid][server_pid2]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
              log.notice(g.srv[client_pid][server_pid]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
            }
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
      server.kill_server(client_pid, server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        } else {
          server1.kill_server(client_pid, server_pid2, function (err, res) {
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
          var test_case = 'First server should have role slave after SLAVEOF';
          slave_cli.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              cb(err, null);
            }
            setTimeout(function () {
              ut.serverInfo(slave_cli, 'role', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if (!assert.equal(res, 'slave', test_case)) {
                    ut.pass(test_case);
                    cb(null, true);
                  }
                } catch (e) {
                  cb(e, null);
                }
              });
            }, 1000);
          });
        },
        two : function (cb) {
          var test_case = 'Test replication with parallel clients writing in differnet DBs';
          setTimeout(function () {
            stop_bg_complex_data(load_handle0);
            stop_bg_complex_data(load_handle1);
            stop_bg_complex_data(load_handle2);

            var retry = 10;
            g.asyncFor(0, retry, function (loop) {
              setTimeout(function () {
                master_cli.debug('digest', function (err, digest0) {
                  if (err) {
                    cb(err, null);
                  }
                  setTimeout(function () {
                    slave_cli.debug('digest', function (err, digest1) {
                      if (err) {
                        cb(err, null);
                      }
                      if (digest0 != digest1) {
                        setTimeout(function () {
                          loop.next();
                        }, 1000);
                      } else {
                        loop.
                        break();
                      }
                    });
                  }, 1000);
                });
              }, 1000);
            }, function () {
              master_cli.dbsize(function (err, res) {
                if (err) {
                  cb(err, null);
                }
                if (res <= 0) {
                  cb(new Error('Master is inconsistent.'), null);
                }
                setTimeout(function () {
                  master_cli.debug('digest', function (err, digest) {
                    if (err) {
                      cb(err, null);
                    }
                    setTimeout(function () {
                      slave_cli.debug('digest', function (err, digest0) {
                        if (err) {
                          cb(err, null);
                        }
                        var res_Bool = ut.assertDeepEqual(digest, digest0, test_case, true);
                        if (res_Bool) {
                          ut.pass(test_case);
                          cb(null, null);
                        } else {
                          ut.csvdump(master_cli, function (err, csv1) {
                            if (err) {
                              cb(err, null);
                            }
                            ut.csvdump(slave_cli, function (err, csv2) {
                              if (err) {
                                cb(err, null);
                              }
                              fs.writeFileSync('./tests/tmp/repldump1.txt', csv1);
                              fs.writeFileSync('./tests/tmp/repldump2.txt', csv2);
                              console.log('Master - Slave inconsistency');
                              console.log('Run diff -u against /tmp/repldump*.txt for more info');
                              cb(err, null);
                            });
                          });
                        }
                      });
                    }, 1000);
                  });
                }, 1000);
              });
            });
          }, 5000);
        },
      }, function (err, rep) {
        if (err) {
          callback(err, null);
        }
        callback(null, true);
      });
    };
  };

  tester.Repl42 = function (errorCallback) {
    var tags = 'repl-42';
    var overrides = {};
    overrides['maxheap'] = '1gb';
    var args = {};
    args['name'] = name + '(Master)';
    args['tags'] = tags;
    server2.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid = res;
      // nesting calls to start_server
      setTimeout(function () { // to give some time for the master to start.
        master_cli = g.srv[client_pid][server_pid]['client'];
        master_host = g.srv[client_pid][server_pid]['host'];
        master_port = g.srv[client_pid][server_pid]['port'];
        var tags = 'repl-mr12';
        var overrides = {};
        overrides['maxheap'] = '512mb';
        var args = {};
        args['tags'] = tags;
        args['name'] = name + '(Slave0)';
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
            if (replication4.debug_mode) {
              log.notice('Monitor client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
              log.notice(g.srv[client_pid][server_pid2]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
              log.notice(g.srv[client_pid][server_pid]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
            }
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
      server2.kill_server(client_pid, server_pid, function (err, res) {
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
          var test_case = 'First server should have role slave after SLAVEOF';
          slave_cli.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              cb(err, null);
            }
            var test_pass = false;
            ut.wait_for_condition(50, 100, function (callback) {
              ut.serverInfo(slave_cli, 'master_link_status', function (err, res) {
                if (err) {
                  callback(err);
                }
                if (res == 'up') {
                  test_pass = true;
                  callback(true);
                } else
                  callback(false);
              });
            },
              function () {
              ut.assertOk(test_pass, null, test_case);
              cb(null, true);
            },
              function () {
              errorCallback(new Error('Replication not started.'), null);
            });
          });
        },
        two : function (cb) {
          var test_case = 'With min-slaves-to-write (1,3): master should be writable';
          master_cli.config('set', 'min-slaves-max-lag', 3, function (err, res) {
            if (err) {
              cb(err, null);
            }
            master_cli.config('set', 'min-slaves-to-write', 1, function (err, res) {
              if (err) {
                cb(err, null);
              }
              master_cli.set('foo', 'bar', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                ut.assertEqual(res, 'OK', test_case);
                cb(null, true);
              })
            });
          });
        },
        three : function (cb) {
          var test_case = 'With min-slaves-to-write (2,3): master should not be writable';
          master_cli.config('set', 'min-slaves-max-lag', 3, function (err, res) {
            if (err) {
              cb(err, null);
            }
            master_cli.config('set', 'min-slaves-to-write', 2, function (err, res) {
              if (err) {
                cb(err, null);
              }
              master_cli.set('foo', 'bar', function (err, res) {
                ut.assertOk('NOREPLICAS', err, test_case);
                cb(null, true);
              })
            });
          });
        },
        four : function (cb) {
          var result = [];
          var test_case = 'With min-slaves-to-write: master not writable with lagged slave';
          master_cli.config('set', 'min-slaves-max-lag', 2, function (err, res) {
            if (err) {
              cb(err, null);
            }
            master_cli.config('set', 'min-slaves-to-write', 1, function (err, res) {
              if (err) {
                cb(err, null);
              }
              master_cli.set('foo', 'bar', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                result.push(res);
                //tweak made for redis::defer (right way has to be implemented)
                master_cli.config('set', 'min-slaves-to-write', 2, function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  slave_cli.debug('sleep', 6, function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    setTimeout(function () {
                      master_cli.set('foo', 'bar', function (err, res) {
                        result.push(err);
                        ut.assertMany([
                            ['equal', result[0], 'OK'],
                            ['ok', 'NOREPLICAS', result[1]]
                          ], test_case);
                        cb(null, true);
                      });
                    }, 4000);
                  });
                });
              })
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

  tester.Repl43 = function (errorCallback) {
    var tags = 'repl-43';
    var overrides = {};
    overrides['maxheap'] = '1gb';
    var args = {};
    args['name'] = name + '(Master)';
    args['tags'] = tags;
    server4.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid = res;
      // nesting calls to start_server
      setTimeout(function () { // to give some time for the master to start.
        master_cli = g.srv[client_pid][server_pid]['client'];
        master_host = g.srv[client_pid][server_pid]['host'];
        master_port = g.srv[client_pid][server_pid]['port'];
        var tags = 'repl-mr23';
        var overrides = {};
        overrides['maxheap'] = '512mb';
        var args = {};
        args['tags'] = tags;
        args['name'] = name + '(Slave0)';
        args['overrides'] = overrides;
        server5.start_server(client_pid, args, function (err, res) {
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
            if (replication4.debug_mode) {
              log.notice('Monitor client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
              log.notice(g.srv[client_pid][server_pid2]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
              log.notice(g.srv[client_pid][server_pid]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
            }
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
      server4.kill_server(client_pid, server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        } else {
          server5.kill_server(client_pid, server_pid2, function (err, res) {
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
          var test_case = 'First server should have role slave after SLAVEOF';
          slave_cli.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              cb(err, null);
            }
            var test_pass = false;
            ut.wait_for_condition(50, 100, function (callback) {
              ut.serverInfo(slave_cli, 'master_link_status', function (err, res) {
                if (err) {
                  callback(err);
                }
                if (res == 'up') {
                  test_pass = true;
                  callback(true);
                } else
                  callback(false);
              });
            },
              function () {
              ut.assertOk(test_pass, null, test_case);
              cb(null, true);
            },
              function () {
              errorCallback(new Error('Replication not started.'), null);
            });
          });
        },
        two : function (cb) {
          var test_case = 'Replication: commands with many arguments (issue #1221)';
          // We now issue large MSET commands, that may trigger a specific
          // class of bugs, see issue #1221.
          var cmd = [];
          g.asyncFor(0, 100, function (loop) {
            for (var x = 0; x < 1000; x++) {
              cmd.push(ut.randomKey, ut.randomValue);
            }
            master_cli.mset(cmd, function (err, res) {
              if (err) {
                cb(err, null);
              }
              loop.next();
            });
          }, function () {
            var retry = 10;
            g.asyncFor(0, retry, function (loop) {
              setTimeout(function () {
                master_cli.debug('digest', function (err, master_digest) {
                  if (err) {
                    cb(err, null);
                  }
                  setTimeout(function () {
                    slave_cli.debug('digest', function (err, slave_digest) {
                      if (err) {
                        cb(err, null);
                      }
                      if (master_digest != slave_digest) {
                        setTimeout(function () {
                          loop.next();
                        }, 1000);
                      } else
                        loop.break();
                    });
                  }, 1000);
                });
              }, 1000);
            }, function () {
              master_cli.dbsize(function (err, res) {
                ut.assertOk((res > 0), null, test_case);
                cb(null, true);
              });
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
  return replication4;

}
  ());