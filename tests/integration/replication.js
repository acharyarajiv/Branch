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

exports.Replication = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  server1 = new Server(),
  server2 = new Server(),
  server3 = new Server(),
  server4 = new Server(),
  server5 = new Server(),
  server6 = new Server(),
  server7 = new Server(),
  replication = {},
  name = 'Replication',
  tester = {},
  all_tests = {},
  master_host = '',
  master_port = '',
  client_pid = '',
  monitor_cli = '',
  master = '',
  client1 = '',
  client2 = '',
  client3 = '',
  master_cli = '',
  slave_cli = '',
  load_handle0 = '',
  load_handle1 = '',
  load_handle2 = '',
  load_handle3 = '',
  load_handle4 = '',
  server_pid = '',
  server_pid2 = '',
  server_pid3 = '',
  server_pid4 = '';

  //public property
  replication.debug_mode = false;

  //public method
  replication.start_test = function (pid, callback) {
    testEmitter.on('start', function () {
      client_pid = pid;
      all_tests = Object.keys(tester);
      testEmitter.emit('next');
    });
    testEmitter.on('next', function () {
      var test_case_name = all_tests.shift()
        if (test_case_name) {
          tester[test_case_name](function (error) {
            ut.fail(error);
            testEmitter.emit('next');
          });
        } else {
          testEmitter.emit('end');
        }
    });
    testEmitter.on('end', function () {
      callback(null, true);
    });

    if (replication.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods

  function start_write_load(host, port, seconds) {
    var forked = child.fork('./tests/helpers/gen_write_load.js', [host, port, seconds]);
    return forked;
  }
  function stop_write_load(handle) {
    try {
      handle.kill('SIGKILL');
    } catch (e) {}
  }
  tester.Repl1 = function (errorCallback) {
    var tags = 'repl-mr11';
    var overrides = {};
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
        monitor_cli = redis.createClient(master_port, master_port);
        monitor_cli.on('ready', function () {
          if (replication.debug_mode) {
            log.notice('Monitor client connected  and listening on socket: ' + master_port + ':' + master_host);
          }
        });
        var tags = 'repl-mr12';
        var overrides = {};
		overrides['maxheap'] = '1gb';
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
            monitor_cli.end();
            slave_cli.end();
            master_cli.end();
            if (replication.debug_mode) {
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
          // issuing monitor here to enable monitor on master.
          monitor_cli.monitor(function (err, res) {
            if (err) {
              cb(err)
            }
          });
          slave_cli.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              cb(err)
            }
            ut.wait_for_condition(5, 1000, function (callback) {
              ut.getserverInfo(slave_cli, function (err, res) {
                if (err) {
                  cb(err);
                }
                if (ut.match('role:slave', res) && ut.match('master_link_status:up', res)) {
                  ut.pass(test_case);
                  callback(true);
                } else {
                  callback(false);
                }
              });
            }, function () {
              cb(null, null);
            }, function () {
              cb(new Error('Can\'t turn the instance into a slave'), null);
            });
          });
        },
        two : function (cb) {
          var test_case = 'BRPOPLPUSH replication, when blocking against empty list';
          var client = redis.createClient(master_port, master_host);
          client.on('ready', function () {
            if (replication.debug_mode) {
              log.notice(name + ':Client connected  and listening on socket: ' + master_port + ':' + master_host);
            }
          });
          client.brpoplpush('a', 'b', 5, function (err, res) {
            if (err) {
              cb(err)
            }
            master_cli.lpush('a', 'foo', function (err, res) {
              if (err) {
                cb(err)
              }
              ut.wait_for_condition(50, 100, function (callback) {
                master_cli.debug('digest', function (err, digest0) {
                  if (err) {
                    cb(err);
                  }
                  slave_cli.debug('digest', function (err, digest1) {
                    if (err) {
                      cb(err);
                    }
                    if (digest0 === digest1) {
                      ut.pass(test_case);
                      callback(true);
                    } else {
                      callback(false);
                    }
                  });
                });
              }, function () {
                client.quit();
                client.on('end', function () {
                  if (replication.debug_mode) {
                    log.notice(name + ':Client disconnected listeting to socket : ' + master_host + ':' + master_port);
                  }
                });
                cb(null, null);
              },
                function () {
                master_cli.debug('digest', function (err, digest0) {
                  if (err) {
                    cb(err);
                  }
                  slave_cli.debug('digest', function (err, digest1) {
                    if (err) {
                      cb(err);
                    }
                    cb(new Error('Master and slave have different digest: ' + digest0 + ' VS ' + digest1), null);
                  });
                });
              });

            });
          });
        },
        three : function (cb) {
          var test_case = 'BRPOPLPUSH replication, list exists';
          var client = redis.createClient(master_port, master_host);
          client.on('ready', function () {
            if (replication.debug_mode) {
              log.notice(name + ':Client connected  and listening on socket: ' + master_port + ':' + master_host);
            }
          });
          master_cli.lpush('c', 1, function (err, res) {
            if (err) {
              cb(err)
            }
            master_cli.lpush('c', 2, function (err, res) {
              if (err) {
                cb(err)
              }
              master_cli.lpush('c', 3, function (err, res) {
                if (err) {
                  cb(err)
                }
                client.brpoplpush('a', 'b', 5, function (err, res) {
                  if (err) {
                    cb(err)
                  }
                  setTimeout(function () {
                    master_cli.debug('digest', function (err, digest) {
                      if (err) {
                        cb(err);
                      }
                      slave_cli.debug('digest', function (err, digest0) {
                        if (err) {
                          cb(err);
                        }
                        ut.assertDeepEqual(digest, digest0, test_case);
                        client.quit();
                        client.on('end', function () {
                          if (replication.debug_mode) {
                            log.notice(name + ':Client disconnected listeting to socket : ' + master_host + ':' + master_port);

                          }
                        });
                        cb(null, null);
                      });
                    });
                  }, 1000);
                });
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

  tester.Repl2 = function (errorCallback) {
    var tags = 'repl-mr21';
    var overrides = {};
	overrides['maxheap'] = '1gb';
    var args = {};
    args['name'] = name + '(Master)';
    args['tags'] = tags;
    server6.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid = res;
      // nesting calls to start_server
      setTimeout(function () { // to give some time for the master to start.
        master_cli = g.srv[client_pid][server_pid]['client'];
        master_host = g.srv[client_pid][server_pid]['host'];
        master_port = g.srv[client_pid][server_pid]['port'];
        master_cli.set('mykey', 'foo', function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          var overrides = {};
          overrides['slave-read-only'] = 'no';
		  overrides['maxheap'] = '512mb';
          var tags = 'repl-mr22';
          var args = {};
          args['name'] = name + '(Slave0)';
          args['overrides'] = overrides;
          args['tags'] = tags;
          server7.start_server(client_pid, args, function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            server_pid2 = res;
            slave_cli = g.srv[client_pid][server_pid2]['client'];
            slave_host = g.srv[client_pid][server_pid2]['host'];
            slave_port = g.srv[client_pid][server_pid2]['port'];
            start_actual_test(function (err, res) {
              if (err) {
                errorCallback(err);
              }
              slave_cli.end();
              master_cli.end();
              if (replication.debug_mode) {
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
        });
      }, 100);
    });
    function kill_server(callback) {
      server6.kill_server(client_pid, server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        } else {
          server7.kill_server(client_pid, server_pid2, function (err, res) {
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
          var test_case = 'Second server should have role master at first';
          ut.serverInfo(slave_cli, 'role', function (err, res) {
            if (err) {
              cb(err)
            }
            ut.assertEqual(res, 'master', test_case);
            cb(null, true);
          });
        },
        two : function (cb) {
          var test_case = 'SET on the master should immediately propagate';
          slave_cli.set('mykey', 'bar', function (err, res) {
            if (err) {
              cb(err)
            }
            ut.wait_for_condition(500, 100, function (callback) {
              slave_cli.get('mykey', function (err, res) {
                if (err) {
                  cb(err)
                }
                if (res === 'bar') {
                  ut.pass(test_case);
                  callback(true);
                } else {
                  callback(false);
                }
              });
            }, function () {
              cb(null, true);
            }, function () {
              cb(new Error('SET on master did not propagated on slave'), null);
            });
          });
        },
        three : function (cb) {
          var test_case = 'SLAVEOF should start with link status \'down\'';
          slave_cli.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              cb(err)
            }
            ut.serverInfo(slave_cli, 'master_link_status', function (err, res) {
              if (err) {
                cb(err)
              }
              ut.assertEqual(res, 'down', test_case);
              cb(null, true);
            });
          });
        },
        four : function (cb) {
          var test_case = 'The role should immediately be changed to \'slave\'';
          ut.serverInfo(slave_cli, 'role', function (err, res) {
            if (err) {
              cb(err)
            }
            ut.assertEqual(res, 'slave', test_case);
            // calling wait_for_sync here so that the next test executes only after this competes.
            ut.wait_for_sync(slave_cli, function (err, res) {
              if (err) {
                cb(err)
              }
              if (res) {
                setTimeout(function () {
                  cb(null, true);
                }, 1000);
              }
            });
          });
        },
        five : function (cb) {
          var test_case = 'Sync should have transferred keys from master';
          slave_cli.get('mykey', function (err, res) {
            if (err) {
              cb(err)
            }
            ut.assertEqual(res, 'foo', test_case);
            cb(null, true);
          });
        },
        six : function (cb) {
          var test_case = 'The link status should be up';
          ut.serverInfo(slave_cli, 'master_link_status', function (err, res) {
            if (err) {
              cb(err)
            }
            ut.assertEqual(res, 'up', test_case);
            cb(null, true);
          });
        },
        seven : function (cb) {
          var test_case = 'FLUSHALL should replicate';
          var result = [];
          master_cli.flushall(function (err, res) {
            if (err) {
              cb(err)
            }
            var delay = 100;
            setTimeout(function () {
              master_cli.dbsize(function (err, res) {
                if (err) {
                  cb(err)
                }
                result.push(res);
                slave_cli.dbsize(function (err, res) {
                  if (err) {
                    cb(err)
                  }
                  result.push(res);
                  ut.assertDeepEqual(result, [0, 0], test_case);
                  cb(null, true);
                });
              });
            }, delay);
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

  tester.Repl3 = function (errorCallback) {
    var test_case = 'Connect multiple slaves at the same time (issue #141)';
    var tags = 'repl-mr31';
    var overrides = {};
	overrides['maxheap'] = '1gb';
    var args = {};
    args['name'] = name + '(Master)';
    args['tags'] = tags;
    args['overrides'] = overrides;
    server.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid = res;
      setTimeout(function () {
        master = g.srv[client_pid][server_pid]['client'];
        master_host = g.srv[client_pid][server_pid]['host'];
        master_port = g.srv[client_pid][server_pid]['port'];
        load_handle0 = start_write_load(master_host, master_port, 3);
        load_handle1 = start_write_load(master_host, master_port, 5);
        load_handle2 = start_write_load(master_host, master_port, 20);
        load_handle3 = start_write_load(master_host, master_port, 8);
        load_handle4 = start_write_load(master_host, master_port, 4);
        setTimeout(function () {
          var overrides = {};
		  overrides['maxheap'] = '1gb';
          var tags = 'repl-mr32';
          var args = {};
          args['name'] = name + '(Slave0)';
          args['tags'] = tags;
          args['overrides'] = overrides;
          server1.start_server(client_pid, args, function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            server_pid2 = res;
            client1 = g.srv[client_pid][server_pid2]['client'];
            setTimeout(function () {
              var overrides = {};
			  overrides['maxheap'] = '1gb';
              var tags = 'repl-mr33';
              var args = {};
              args['name'] = name + '(Slave1)';
              args['tags'] = tags;
              args['overrides'] = overrides;
              server2.start_server(client_pid, args, function (err, res) {
                if (err) {
                  errorCallback(err, null);
                }
                server_pid3 = res;
                client2 = g.srv[client_pid][server_pid3]['client'];
                setTimeout(function () {
                  var overrides = {};
				  overrides['maxheap'] = '512mb';
                  var tags = 'repl-mr34';
                  var args = {};
                  args['name'] = name + '(Slave2)';
                  args['tags'] = tags;
                  args['overrides'] = overrides;
                  server3.start_server(client_pid, args, function (err, res) {
                    if (err) {
                      errorCallback(err, null);
                    }
                    server_pid4 = res;
                    client3 = g.srv[client_pid][server_pid4]['client'];
                    start_actual_test(function (err, res) {
                      if (err) {
                        errorCallback(err)
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
            }, 100);
          });
        }, 2000);
      }, 100);
    });
    function kill_server(callback) {
      server.kill_server(client_pid, server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        }
        server1.kill_server(client_pid, server_pid2, function (err, res) {
          if (err) {
            callback(err, null);
          }
          server2.kill_server(client_pid, server_pid3, function (err, res) {
            if (err) {
              callback(err, null);
            }
            server3.kill_server(client_pid, server_pid4, function (err, res) {
              if (err) {
                callback(err, null);
              }
              callback(null, true);
            });
          });
        });
      });
    };
    function start_actual_test(callback) {
      client1.slaveof(master_host, master_port, function (err, res) {
        if (err) {
          callback(err)
        }
        client2.slaveof(master_host, master_port, function (err, res) {
          if (err) {
            callback(err)
          }
          client3.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              callback(err)
            }
            // Wait for all the three slaves to reach the 'online' state
            var retry = 500;
            var count = 0;
            g.asyncFor(0, retry, function (loop) {
              ut.getserverInfo(master, function (err, res) {
                if (err) {
                  callback(err)
                }
                // Don't know why this regex is not getting caught.
                var patt = 'connected_slaves:3'
                  if (ut.match(patt, res)) {
                    loop.break();
                  } else {
                    setTimeout(function () {
                      count++;
                      loop.next();
                    }, 100);
                  }
              });
            }, function () {
              if (count === retry) {
                callback(new Error('Error:Slaves not up.'));
              } else {
                // no error observed should continue.
              }
              stop_write_load(load_handle0);
              stop_write_load(load_handle1);
              stop_write_load(load_handle2);
              stop_write_load(load_handle3);
              stop_write_load(load_handle4);
              var retry = 10;
              //Wait that slaves exit the 'loading' state
              ut.wait_for_condition(500, 100, function (cb) {
                client1.info(function (err, info0) {
                  if (err) {
                    callback(err);
                  }
                  client2.info(function (err, info1) {
                    if (err) {
                      callback(err);
                    }
                    client3.info(function (err, info2) {
                      if (err) {
                        callback(err);
                      }
                      var patt = 'loading:1';
                      if (!ut.match(patt, info0) && !ut.match(patt, info1) && !ut.match(patt, info2)) {
                        cb(true);
                      } else {
                        cb(false);
                      }
                    });
                  });
                });
              }, function () {
                //Make sure that slaves and master have same number of keys
                ut.wait_for_condition(500, 100, function (cb) {
                  master.dbsize(function (err, db) {
                    if (err) {
                      callback(err);
                    }
                    client1.dbsize(function (err, db0) {
                      if (err) {
                        callback(err);
                      }
                      client2.dbsize(function (err, db1) {
                        if (err) {
                          callback(err);
                        }
                        client3.dbsize(function (err, db2) {
                          if (err) {
                            callback(err);
                          }
                          if ((db === db0) && (db === db1) && (db === db2)) {
                            cb(true);
                          } else {
                            cb(false);
                          }
                        });
                      });
                    });
                  });
                }, function () {
                  //Check digests
                  setTimeout(function () {
                    master.debug('digest', function (err, digest) {
                      if (err) {
                        callback(err);
                      }
					  setTimeout(function () {
                      client1.debug('digest', function (err, digest0) {
                        if (err) {
                          callback(err);
                        }
						setTimeout(function () {
                        client2.debug('digest', function (err, digest1) {
                          if (err) {
                            callback(err);
                          }
						  setTimeout(function () {
                          client3.debug('digest', function (err, digest2) {
                            if (err) {
                              callback(err);
                            }
                            try {
                              if ((!assert.notEqual(digest, '0000000000000000000000000000000000000000', test_case)) && (!assert.deepEqual(digest, digest0, test_case)) && (!assert.deepEqual(digest, digest1, test_case)) && (!assert.deepEqual(digest, digest2, test_case))) {
                                ut.pass(test_case);
                                client3.end();
                                client2.end();
                                client1.end();
                                master.end();
                                if (replication.debug_mode) {
                                  log.notice(g.srv[client_pid][server_pid4]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid4]['host'] + ':' + g.srv[client_pid][server_pid4]['port']);
                                  log.notice(g.srv[client_pid][server_pid3]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid3]['host'] + ':' + g.srv[client_pid][server_pid3]['port']);
                                  log.notice(g.srv[client_pid][server_pid2]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
                                  log.notice(g.srv[client_pid][server_pid]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
                                }
                                callback(null, true);
                              }
                            } catch (e) {
                              callback(e);
                            }
                          });
						  }, 1000);
                        });
						}, 1000);
                      });
					  }, 1000);
                    });
                  }, 100);
                }, function () {
                  cb(new Error('Different number of keys between masted and slave after too long time.'), null);
                });
              }, function () {
                callback(new Error('Slaves still loading data after too much time'), null);
              });
            });
          });
        });
      });
    };
  };

  return replication;

}
  ());
