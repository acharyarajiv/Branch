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

exports.ReplicationStress = (function () {
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
  replication_stress = {},
  name = 'Replication-Stress',
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
  server_pid4 = '',
  error = '';

  //public property
  replication_stress.debug_mode = false;

  //public method
  replication_stress.start_test = function (pid, callback) {
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
      }, ut.timeout)
    });
    testEmitter.on('end', function () {
      callback(null, true);
    });

    if (replication_stress.debug_mode) {
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
    var test_case = 'Replication Stress with two Slaves for n iterations';
    var tags = 'repl-mr31';
    var overrides = {};
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
        var overrides = {};
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
            callback(null, true);
          });
        });
      });
    };
    function start_actual_test(callback) {
      g.asyncFor(0, 3, function (mainloop) {
        for (var i = 0; i < 1000000; i++) {
          master.set(i, i, function () {});
        }
        client1.slaveof(master_host, master_port, function (err, res) {
          if (err) {
            callback(err)
          }
          client2.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              callback(err)
            }
            // Wait for all the three slaves to reach the 'online' state
            var retry = 100;
            var count = 0;
            g.asyncFor(0, retry, function (loop) {
              ut.getserverInfo(master, function (err, res) {
                if (err) {
                  callback(err)
                }
                var patt = 'slave0 online slave1 online';
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
                callback(new Error('Error:Slaves not up'));
              } else {
                // no error observed should continue.
              }
              var retry = 1000;
              g.asyncFor(0, retry, function (loop1) {
                var i = loop1.iteration();
                master.debug('digest', function (err, res1) {
                  if (err) {
                    callback(err);
                  }
                  client1.debug('digest', function (err, res2) {
                    if ((res1 === res2) || (i === retry)) {
                      loop1.break();
                    }
                    setTimeout(function () {
                      loop1.next();
                    }, 1000);
                  });
                });
              }, function () {
                master.debug('digest', function (err, digest) {
                  if (err) {
                    callback(err);
                  }
                  client1.debug('digest', function (err, digest0) {
                    if (err) {
                      callback(err);
                    }
                    client2.debug('digest', function (err, digest1) {
                      if (err) {
                        callback(err);
                      }
                      try {
                        if ((!assert.notEqual(digest, '0000000000000000000000000000000000000000', test_case))
                           && (!assert.deepEqual(digest, digest0, test_case))
                           && (!assert.deepEqual(digest, digest1, test_case))) {
                          console.log('Master - Slave0 Slave1 digest equal for iteration #' + mainloop.iteration() + '\n');
                          master.flushall(function (err, res) {
                            mainloop.next();
                          });
                        }
                      } catch (e) {
                        error = e;
                        mainloop.break();
                      }
                    });
                  });
                });
              });
            });
          });
        });
      }, function () {
        if (error)
          callback(error);
        else {
          ut.pass(test_case);
          client2.end();
          client1.end();
          master.end();
          if (replication_stress.debug_mode) {
            log.notice(g.srv[client_pid][server_pid3]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid3]['host'] + ':' + g.srv[client_pid][server_pid3]['port']);
            log.notice(g.srv[client_pid][server_pid2]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
            log.notice(g.srv[client_pid][server_pid]['name'] + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
          }
          callback(null, true);
        }
      });
    };
  };

  return replication_stress;

}
  ());