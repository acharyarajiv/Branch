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

exports.Introspection = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  server2 = new Server(),
  server3 = new Server(),
  server4 = new Server(),
  server5 = new Server(),
  server6 = new Server(),
  server7_1 = new Server(),
  server7_2 = new Server(),
  server8 = new Server(),
  server9 = new Server(),
  server10 = new Server(),
  intro = {},
  name = 'Introspection',
  client = '',
  tester = {},
  server_pid = '',
  client_pid = '',
  all_tests = {},
  server_host = '',
  server_port = '';

  //public property
  intro.debug_mode = false;

  //public method
  intro.start_test = function (cpid, callback) {
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

    if (intro.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  //test methods
  tester.introspection1 = function (errorCallback) {
    var test_case = 'CLIENT LIST & KILL';
    var tags = 'introspection1';
    var overrides = {};
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      server_pid = res;
      // we need to have a no-ready-check client, so killing here.
      g.srv[client_pid][server_pid]['client'].end();
      server_port = g.srv[client_pid][server_pid]['port'];
      server_host = g.srv[client_pid][server_pid]['host'];
      if (intro.debug_mode) {
        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
      }
      client = redis.createClient(server_port, server_host, {
          no_ready_check : true
        });
      if (intro.debug_mode) {
        log.notice(name + ':Client connected listeting to socket : ' + server_host + ':' + server_port);
      }
      client.on('ready', function () {
        var patt = '[addr=:.: fd=. age=. idle=. flags=N db=9 sub=0 psub=0 multi=0 qbuf=0  qbuf-free=. obl=0 oll=0 omem=0 events=r cmd=client.]';
        client.client('list', function (err, result1) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.ok(ut.match(patt, result1), test_case)) {
              var socket = result1.slice(result1.indexOf('=') + 1, result1.indexOf(' '));
              //client.quit() sends the Redis QUIT command, which flags the connection for orderly shutdown and not to retry connecting.
              client.quit(function (err, result) {
                if (err) {
                  errorCallback(err);
                }
                client.ping(function (err, res) {
                  if (res) {
                    errorCallback(res);
                  }
                  ut.assertMany(
                    [
                      ['equal', result, 'OK'],
                      ['ok', 'Error', err]
                    ], test_case);
                  if (intro.debug_mode) {
                    log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                  }
                  client.end();
                  server.kill_server(client_pid, server_pid, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    testEmitter.emit('next');
                  });
                });
              });
            }
          } catch (e) {
            ut.fail(e, true);
            client.end();
            // writing in catch since we do not want this to be executed with pass
            if (intro.debug_mode) {
              log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            }
            server.kill_server(client_pid, server_pid, function (err, res) {
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

  tester.introspection2 = function (errorCallback) {
    var test_case = 'CONFIG - Reading full set of config values';
    var tags = 'introspection2';
    var file_loc = '.' + sep + 'tests' + sep + 'tmp' + sep + 'temp-conf.conf';
    var conf_stream = fs.createWriteStream(file_loc);
    var str = '#bogus This will be skipped by the server \n\nzset-max-ziplist-value 64 \n';
    fs.writeFile(file_loc, str, function (err) {
      if (err) {
        errorCallback(err);
      }
      var overrides = {};
      if (process.platform !== 'win32') {
        overrides['unixsocket'] = '/tmp/redis.sock';
      }
      // console.log('..' + sep + 'temp-conf.conf');
      //overrides['include'] = '..' + sep + 'temp-conf.conf';
      overrides['maxclients'] = 32;
      overrides['maxmemory'] = '64MB';
      overrides['syslog-enabled'] = 'no';
      overrides['syslog-ident'] = 'redis';
      overrides['syslog-facility'] = 'local4';
      overrides['rename-command'] = 'CONFIG some_obscure_command';
      overrides['maxmemory-policy'] = 'volatile-ttl';
      overrides['maxmemory-samples'] = 8;
      overrides['zset-max-ziplist-entries'] = 256;
      overrides['slowlog-max-len'] = 1024;
      overrides['slowlog-log-slower-than'] = 1000000;
      overrides['rdbchecksum'] = 'yes';
      overrides['rdbcompression'] = 'yes';
      var args = {};
      args['name'] = name;
      args['tags'] = tags;
      args['overrides'] = overrides;
      server2.start_server(client_pid, args, function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        server_pid = res;
        client = g.srv[client_pid][server_pid]['client'];
        server_port = g.srv[client_pid][server_pid]['port'];
        server_host = g.srv[client_pid][server_pid]['host'];
        client.write(ut.formatCommand(['some_obscure_command', 'set', 'hash-max-ziplist-entries', '32']), function (err, res1) {
          if (err) {
            errorCallback(err);
          }
          client.write(ut.formatCommand(['some_obscure_command', 'get', 'hash-max-ziplist-entries']), function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            client.write(ut.formatCommand(['some_obscure_command', 'get', 'zset-max-ziplist-value']), function (err, res3) {
              if (err) {
                errorCallback(err);
              }
              ut.assertMany(
                [
                  ['equal', res1, 'OK'],
                  ['equal', res2[1], 32],
                  ['equal', res3[1], 64],
                ], test_case);
              client.end();
              if (intro.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              server2.kill_server(client_pid, server_pid, function (err, res) {
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

  tester.introspection3 = function (errorCallback) {
    var test_case = 'Can\'t BGSAVE when AOF is in progress';
    var tags = 'introspection4';
    var overrides = {};
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server3.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      client = g.srv[client_pid][server_pid]['client'];
      server_port = g.srv[client_pid][server_pid]['port'];
      server_host = g.srv[client_pid][server_pid]['host'];
      setTimeout(function () {
        client.config('set', 'appendonly', 'yes', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.set('foo', 'bar', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.bgsave(function (err, res) {
              if (res) {
                errorCallback(res);
              }
              ut.assertOk('Can\'t BGSAVE while AOF log rewriting', err, test_case);
			  client.end();
              if (intro.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              server3.kill_server(client_pid, server_pid, function (err, res) {
                if (err) {
                  errorCallback(err, null);
                }
                testEmitter.emit('next');
              });
            });
          });
        });
      }, 1000);
    });
  };

  tester.introspection4 = function (errorCallback) {
    var test_case = 'Shutdown with BGSAVE';
    var tags = 'introspection4';
    var overrides = {};
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server4.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      client = g.srv[client_pid][server_pid]['client'];
      server_port = g.srv[client_pid][server_pid]['port'];
      server_host = g.srv[client_pid][server_pid]['host'];
      client.set('foo', 'bar', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bgsave(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.write(ut.formatCommand(['shutdown', 'save']), function (error, res) {
            client.end();
            var file = g.srv[client_pid][server_pid]['stdout'];
            setTimeout(function () {
              fs.readFile(file, function (err, result) {
                if (err) {
                  errorCallback(err);
                }

                ut.assertMany(
                  [
                    ['ok', 'Redis is now ready to exit, bye', result],
                    ['ok', error, null]
                  ], test_case);

                if (intro.debug_mode) {
                  log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                }
                testEmitter.emit('next');
                // no server to kill. Server is gone due to shutdown
              });
            }, 1000);
          });
        });
      });
    });
  };

  tester.introspection5 = function (errorCallback) {
    var test_case = 'Shutdown with AOF';
    var tags = 'introspection4';
    var overrides = {};
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server5.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      client = g.srv[client_pid][server_pid]['client'];
      server_port = g.srv[client_pid][server_pid]['port'];
      server_host = g.srv[client_pid][server_pid]['host'];
      client.config('set', 'appendonly', 'yes', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.set('foo', 'bar', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.bgrewriteaof(function (error1, res) {
            if (res) {
              errorCallback(res);
            }
            client.write(ut.formatCommand(['shutdown']), function (error2, res) {
              if (res) {
                errorCallback(res);
              }
              var file = g.srv[client_pid][server_pid]['stdout'];
              setTimeout(function () {
                fs.readFile(file, function (err, result) {
                  if (err) {
                    errorCallback(err);
                  }
                  ut.assertMany(
                    [
                      ['ok', 'Redis is now ready to exit, bye', result],
                      ['ok', error1, null],
                      ['ok', error2, null]
                    ], test_case);
                  client.end();
                  if (intro.debug_mode) {
                    log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                  }
                  testEmitter.emit('next');
                  // no server to kill. Server is gone due to shutdown
                });
              }, 100);
            });
          });
        });
      });
    });
  };

  tester.introspection6 = function (errorCallback) {
    var test_case = 'Scheduled AOF when BGSAVE is in progress';
    var tags = 'introspection6';
    var overrides = {};
    overrides['appendonly'] = 'yes';
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server6.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      client = g.srv[client_pid][server_pid]['client'];
      server_port = g.srv[client_pid][server_pid]['port'];
      server_host = g.srv[client_pid][server_pid]['host'];
      ut.createComplexDataset(client, 100, null, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bgsave(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.bgrewriteaof(function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.waitForBgrewriteaof(client, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              setTimeout(function () {
                ut.assertOk(res, null, test_case);
                client.end();
                if (intro.debug_mode) {
                  log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                }
                server6.kill_server(client_pid, server_pid, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  testEmitter.emit('next');
                });
              }, 200);
            });
          });
        });
      });
    });
  };

  tester.introspection7 = function (errorCallback) {
    var test_case = 'BGSAVE on MASTER when SLAVE is attached.';
    var tags = 'introspection6';
    var overrides = {};
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server7_1.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var server_pid1 = res;
      var master_cli = g.srv[client_pid][server_pid1]['client'];
      var master_port = g.srv[client_pid][server_pid1]['port'];
      var master_host = g.srv[client_pid][server_pid1]['host'];
      server7_2.start_server(client_pid, args, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        var server_pid2 = res;
        setTimeout(function () {
          var slave_cli = g.srv[client_pid][server_pid2]['client'];
          var slave_port = g.srv[client_pid][server_pid2]['port'];
          var slave_host = g.srv[client_pid][server_pid2]['host'];

          slave_cli.slaveof(master_host, master_port, function (err, res) {
            if (err) {
              errorCallback(err)
            }
            ut.createComplexDataset(master_cli, 1000, null, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              master_cli.bgsave(function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                ut.waitForBgsave(master_cli, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  ut.assertOk(res, null, test_case);
                  master_cli.end();
                  slave_cli.end();
                  if (intro.debug_mode) {
                    log.notice(name + ':Master Client disconnected listeting to socket : ' + master_host + ':' + master_port);
                    log.notice(name + ':Slave Client disconnected listeting to socket : ' + slave_host + ':' + slave_port);
                  }
                  server7_1.kill_server(client_pid, server_pid1, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    server7_2.kill_server(client_pid, server_pid2, function (err, res) {
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
        }, 1000);
      });
    });
  };

  tester.introspection8 = function (errorCallback) {
    var test_case = 'AOF Foreground rewrite';
    var tags = 'introspection8';
    var overrides = {};
    overrides['appendonly'] = 'yes';
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server8.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      client = g.srv[client_pid][server_pid]['client'];
      server_port = g.srv[client_pid][server_pid]['port'];
      server_host = g.srv[client_pid][server_pid]['host'];
      client.set('key1', 'barfoo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bgrewriteaof(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.waitForBgrewriteaof(client, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            setTimeout(function () {
              ut.createComplexDataset(client, 10, null, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.bgrewriteaof(function (err, res) {
                  ut.waitForBgrewriteaof(client, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    setTimeout(function () {
                      ut.assertOk(res, null, test_case);
                      client.end();
                      if (intro.debug_mode) {
                        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                      }
                      server8.kill_server(client_pid, server_pid, function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        testEmitter.emit('next');
                      });
                    }, 100);
                  });
                });
              });
            }, 300);
          });
        });
      });
    });
  };

  tester.introspection9 = function (errorCallback) {
    var test_case = 'MONITOR can log executed commands'
      var tags = 'introspection9';
    var overrides = {};
    var responses = [];
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    setTimeout(function () {
      server9.start_server(client_pid, args, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        server_pid = res;
        server_port = g.srv[client_pid][server_pid]['port'];
        server_host = g.srv[client_pid][server_pid]['host'];
        client = g.srv[client_pid][server_pid]['client'];
        monitor_client = redis.createClient(server_port, server_host);
        monitor_client.on('monitor', function (time, args) {
          responses.push(args);
        });
        monitor_client.on('end', function (err, res) {
          ut.assertOk('set,foo,bar', responses.toString(), test_case);
          if (intro.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          }
          testEmitter.emit('next');
          monitor_client.end();
          client.end();
          server9.kill_server(client_pid, server_pid, function (err, res) {
            if (err) {
              errorCallback(err);
            }
          });
        });
        monitor_client.monitor(function (err, res) {
          client.set('foo', 'bar', function (err, res) {
            monitor_client.emit('monitor');
            client.get('foo', function (err, res1) {
              monitor_client.emit('monitor');
              monitor_client.emit('end');
            });
          });
        });
      });
    }, 1000);
  };

  tester.introspection10 = function (errorCallback) {
    var test_case = 'MONITOR can log commands issued by the scripting engine'
      var tags = 'introspection10';
    var overrides = {};
    overrides['maxheap'] = '512mb';
    var responses = [];
    var args = {};
    args['name'] = name;
    args['tags'] = tags;
    args['overrides'] = overrides;
    server10.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      server_pid = res;
      server_port = g.srv[client_pid][server_pid]['port'];
      server_host = g.srv[client_pid][server_pid]['host'];
      client = g.srv[client_pid][server_pid]['client'];
      monitor_client = redis.createClient(server_port, server_host);
      monitor_client.on('monitor', function (time, args) {
        responses.push(args);
      });
      monitor_client.on('end', function (err, res) {
        ut.assertMany(
          [
            ['ok', 'foo,bar', responses.toString()],
            ['equal', responses[0][0], 'evalsha']
          ], test_case);
        monitor_client.end();
        client.end();
        server10.kill_server(client_pid, server_pid, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          testEmitter.emit('next');
        });
      });
      monitor_client.monitor(function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.eval("redis.call('set',KEYS[1],ARGV[1])", 1, 'foo', 'bar', function (err, res) {
          monitor_client.emit('monitor');
          monitor_client.emit('end');
        });
      });

    });
  };

  return intro;

}
  ());
