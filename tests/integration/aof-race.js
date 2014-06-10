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

exports.AofRace = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  tp = new(require('../support/tmpfile.js'));
  aofrace = {},
  name = 'Aof-Race',
  tester = {},
  all_tests = {},
  master = '',
  server_path = '',
  aof_path = '',
  server_pid = '',
  server_pid2 = '',
  client_pid = '',
  server_host = '',
  server_port = '';

  //public property
  aofrace.debug_mode = false;

  //public method
  aofrace.start_test = function (cpid, callback) {
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

    if (aofrace.debug_mode) {
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
  function start_server_aof(client_pid, dir, callback) {
    var tags = 'aofrace';
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

  tester.AofRace = function (errorCallback) {
    var test_case = 'AOF Race Check';
    try {
      var st = create_aof();
      st.end();
    } catch (e) {
      errorCallback(e);
    }
    start_server_aof(client_pid, server_path, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      server_host = g.srv[client_pid][server_pid]['host'];
      server_port = g.srv[client_pid][server_pid]['port'];
      var client = redis.createClient(server_port, server_host);
      client.on('ready', function () {
        if (aofrace.debug_mode) {
          log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
        }
      });
      var cmd = '.' + sep + 'redis' + sep + 'src' + sep + REDIS_BENCHMARK + ' -q -p ' + server_port + ' -c 20 -n 20000 incr foo';
      var child_check = child.exec(cmd, function (error, stdout, stderr) {
          if (error) {
            kill_server_aof(client_pid, server_pid, function (err, res) {
              if (err) {
                errorCallback(err + error);
              } else {
                errorCallback(error);
              }
            });
          }
          setTimeout(function () {
            client.bgrewriteaof(function (error, res) {
              if (err) {
                kill_server_aof(client_pid, server_pid, function (err, res) {
                  if (err) {
                    errorCallback(err + error);
                  } else {
                    errorCallback(error);
                  }
                });
              }
            });
          });
        }, 100);
      child_check.on('close', function (data) {
        client.get('foo', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.equal(res, 20000, test_case)) {
              // start server again and check aof
              start_server_aof(client_pid, server_path, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                server_pid2 = res;
                var cli = redis.createClient(g.srv[client_pid][server_pid2]['port'], g.srv[client_pid][server_pid2]['host']);
                cli.on('ready', function () {
                  if (aofrace.debug_mode) {
                    log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
                  }
                });
                cli.get('foo', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  ut.assertEqual(res, 20000, test_case);
                  cli.end();
                  if (aofrace.debug_mode) {
                    log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid2]['host'] + ':' + g.srv[client_pid][server_pid2]['port']);
                  }
                  kill_server_aof(client_pid, server_pid2, function (err, res) {
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
              });
            }
          } catch (e) {
            ut.fail(e, true);
            client.end();
            if (aofrace.debug_mode) {
              log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            }
            kill_server_aof(client_pid, server_pid, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              testEmitter.emit('next');
            });
          }
        });
      });
    });
  };

  return aofrace;

}
  ());