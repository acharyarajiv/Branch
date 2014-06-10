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

exports.Other = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  other = {},
  name = 'Other',
  client = '',
  tester = {},
  cpid = '',
  server_pid = '',
  server_port = '',
  server_host = '',
  all_tests = {},
  sha1 = '',
  dump = '';

  //public property
  other.debug_mode = false;

  //public method
  other.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'other';
      var overrides = {};
      var args = {};
      args['name'] = name;
      args['tags'] = tags;
      args['overrides'] = overrides;
      cpid = client_pid;
      server.start_server(client_pid, args, function (err, res) {
        if (err) {
          callback(err, null);
        }
        server_pid = res;
        server_port = g.srv[client_pid][server_pid]['port'];
        server_host = g.srv[client_pid][server_pid]['host'];
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
          if (other.debug_mode) {
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

    if (other.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods
  tester.other1 = function (errorCallback) {
    var test_case = 'SAVE - make sure there are all the types as values';
    ut.waitForBgsave(client, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.lpush('mysavelist', 'hello', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.lpush('mysavelist', 'world', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.set('myemptykey', ' ', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.set('mynormalkey', 'blablabla', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.zadd('mytestzset', 10, 'a', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.zadd('mytestzset', 20, 'b', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.zadd('mytestzset', 30, 'c', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    client.save(function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      ut.assertEqual(res, 'OK', test_case);
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
  };

  tester.other2 = function (errorCallback) {
    var iterations = 1000;
    var fuzztype = new Array('binary', 'alpha', 'compr');
    g.asyncFor(0, fuzztype.length, function (outerloop) {
      var i = outerloop.iteration();
      var test_case = 'FUZZ stresser with data model ' + fuzztype[i];
      var error_array = new Array();
      g.asyncFor(0, iterations, function (innerloop) {
        var fuzz = ut.randstring(0, 512, fuzztype[i]);
        client.set('foo', fuzz, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.get('foo', function (err, got) {
            if (got !== fuzz) {
              error_array.push(fuzz);
              error_array.push(got);
              innerloop.break();
            } else
              innerloop.next();
          });
        });
      }, function () {
        ut.assertDeepEqual(error_array, [], test_case);
        outerloop.next();
      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  tester.other3 = function (errorCallback) {
    var test_case = 'BGSAVE';
    ut.waitForBgsave(client, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.flushdb(function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.save(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.set('x', 10, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.bgsave(function (err, res) {
              if (err) {
                errorCallback(err);
              }
              ut.waitForBgsave(client, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.debug('reload', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.get('x', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.assertEqual(res, 10, test_case);
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

  tester.other4 = function (errorCallback) {
    var test_case = 'SELECT an out of range DB';
    client.select(1000000, function (err, res) {
      ut.assertOk('invalid', err, test_case);
      testEmitter.emit('next');
    })
  };

  tester.other5 = function (errorCallback) {
    var test_case = 'EXPIRES after AOF reload (without rewrite)';
    var test_pass = false;
    client.flushdb(function (err, res) {
      client.config('set', 'appendonly', 'yes', function (err, res) {
        client.set('x', 'somevalue', function (err, res) {
          client.expire('x', 1000, function (err, res) {
            client.setex('y', 2000, 'somevalue', function (err, res) {
              client.set('z', 'somevalue', function (err, res) {
                var epochz = (parseInt((new Date()).getTime() / 1000) + 3000);
                client.expireat('z', epochz, function (err, res) {
                  client.set('px', 'somevalue', function (err, res) {
                    client.pexpire('px', 1000000, function (err, res) {
                      client.psetex('py', 2000000, 'somevalue', function (err, res) {
                        client.set('pz', 'somevalue', function (err, res) {
                          var epochpz = ((parseInt((new Date()).getTime() / 1000) + 3000) * 1000);
                          client.pexpireat('pz', epochpz, function (err, res) {
                            ut.waitForBgrewriteaof(client, function (err, res) {
                              setTimeout(function () {
                                client.debug('loadaof', function (err, res) {
                                  client.ttl('x', function (err, ttl1) {
                                    client.ttl('y', function (err, ttl2) {
                                      client.ttl('z', function (err, ttl3) {
                                        client.ttl('px', function (err, ttl4) {
                                          client.ttl('py', function (err, ttl5) {
                                            client.ttl('pz', function (err, ttl6) {
                                              if ((ttl1 > 900 && ttl1 <= 1000) && (ttl2 > 1900 && ttl2 <= 2000) && (ttl3 > 2900 && ttl3 <= 3000)
                                                 && (ttl4 > 900 && ttl4 <= 1000) && (ttl5 > 1900 && ttl5 <= 2000) && (ttl6 > 2900 && ttl6 <= 3000)) {
                                                test_pass = true;
                                              }
                                              ut.assertEqual(test_pass, true, test_case);
                                              client.config('set', 'appendonly', 'no');
                                              testEmitter.emit('next');
                                            });
                                          });
                                        });
                                      });
                                    });
                                  });
                                });
                              }, 2000);
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
      });
    });
  };

  tester.other6 = function (errorCallback) {
    var test_case = 'EXPIRES after a reload (snapshot + append only file rewrite)';
    var res1 = 0,
    res2 = 0;
    client.flushdb(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.set('x', 100, function (err, res) {
        if (err) {
          errorCallback(err)
        }
        client.expire('x', 1000, function (err, res) {
          if (err) {
            errorCallback(err)
          }
          client.save(function (err, res) {
            if (err) {
              errorCallback(err)
            }
            client.debug('reload', function (err, res) {
              if (err) {
                errorCallback(err)
              }
              client.ttl('x', function (err, ttl) {
                if (err) {
                  errorCallback(err)
                }
                if (ttl > 900 && ttl <= 1000) {
                  res1 = 1;
                }
                client.bgrewriteaof(function (err, res) {
                  if (err) {
                    errorCallback(err)
                  }
                  ut.waitForBgrewriteaof(client, function (err, res) {
                    if (err) {
                      errorCallback(err)
                    }
                    client.debug('reload', function (err, res) {
                      if (err) {
                        errorCallback(err)
                      }
                      client.ttl('x', function (err, ttl) {
                        if (err) {
                          errorCallback(err)
                        }
                        if (ttl > 900 && ttl <= 1000) {
                          res2 = 1;
                        }
                        ut.assertEqual(ut.compareArray([res1, res2], [1, 1]), true, test_case);
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
  };

  tester.other7 = function (errorCallback) {
    var test_case = 'Perform a final SAVE to leave a clean DB on disk';
    ut.waitForBgsave(client, function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.save(function (err, res) {
        if (err) {
          errorCallback(err)
        }
        ut.assertEqual(res, 'OK', test_case);
        testEmitter.emit('next');
      });
    });
  };

  // consistency
  tester.other8 = function (errorCallback) {
    var test_case = 'Check consistency of different data types after a reload';
    var numops = 1000;
    client.flushdb(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.createComplexDataset(client, numops, null, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.csvdump(client, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          setTimeout(function () {
            dump = res;
            client.debug('digest', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              sha1 = res;
              client.debug('reload', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.debug('digest', function (err, sha1_after) {
                  if (err) {
                    errorCallback(err);
                  }
                  var bool_Res = ut.assertDeepEqual(sha1_after, sha1, test_case, true);
                  if (bool_Res) {
                    ut.pass(test_case);
                    testEmitter.emit('next');
                  } else {
                    ut.csvdump(client, function (err, newdump) {
                      if (err) {
                        errorCallback(err);
                      }
                      fs.writeFileSync('.//tests//tmp//repldump1.txt', dump);
                      fs.writeFileSync('.//tests//tmp//repldump2.txt', newdump);
                      console.log('Consistency test failed!');
                      console.log('You can inspect the two dumps in /tmp/repldump*.txt');
                      testEmitter.emit('next');
                    });
                  }
                });
              });
            });
          }, 500);
        });
      });
    });
  };

  //consistency
  tester.other9 = function (errorCallback) {
    var test_case = 'Same dataset digest if saving/reloading as AOF?';
    client.bgrewriteaof(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.waitForBgrewriteaof(client, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        setTimeout(function () {
          client.debug('loadaof', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.debug('digest', function (err, sha1_after) {
              if (err) {
                errorCallback(err);
              }
              var bool_Res = ut.assertDeepEqual(sha1_after, sha1, test_case, true);
              if (bool_Res) {
                ut.pass(test_case);
                fs.unlink(path.dirname(g.srv[cpid][server_pid]['stdout']) + path.sep + 'appendonly.aof', function (err) {
                  if (err) {
                    errorCallback(err);
                  }
                  testEmitter.emit('next');
                });
              } else {
                ut.csvdump(client, function (err, newdump) {
                  if (err) {
                    errorCallback(err);
                  }
                  fs.writeFileSync('.//tests//tmp//aofdump1.txt', dump);
                  fs.writeFileSync('.//tests//tmp//aofdump2.txt', newdump);
                  console.log('Consistency test failed!');
                  console.log('You can inspect the two dumps in /tmp/aofdump*.txt');
                  fs.unlink(path.dirname(g.srv[cpid][server_pid]['stdout']) + path.sep + 'appendonly.aof', function (err) {
                    if (err) {
                      errorCallback(err);
                    }
                    testEmitter.emit('next');
                  });
                });
              }
            });
          });
        }, 500);
      });
    });
  };

  tester.other10_1 = function (errorCallback) {
    var test_case = 'PIPELINING stresser (also a regression for the old epoll bug.) ';
    var error = '',
    flag = true;
    client.select('9', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, 100000, function (loop) {
        var i = loop.iteration();
        var val = '0000' + i + '0000';
        client.set('key:' + i, val, function (err, set_res) {
          if (err) {
            errorCallback(err);
          }
          client.get('key:' + i, function (err, get_res) {
            if (err) {
              errorCallback(err);
            }
            if (get_res !== val) {
              flag = false;
              error = 'Expected: ' + val + ' got: ' + get_res;
              loop.break();
            }
            loop.next();
          });
        });
      }, function () {
        ut.assertOk(flag, null, test_case + error);
        testEmitter.emit('next');
      });
    });
  };

  tester.other11 = function (errorCallback) {
    var test_case = 'APPEND basics';
    var result = new Array();
    client.append('foo', 'bar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      client.get('foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        client.append('foo', 100, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          client.get('foo', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result.push(res);
            ut.assertDeepEqual(result, [3, 'bar', 6, 'bar100'], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.other12 = function (errorCallback) {
    var test_case = 'APPEND basics, integer encoded values';
    var result = new Array();
    client.del('foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.append('foo', 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.append('foo', 2, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.get('foo', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result.push(res);
            client.set('foo', 1, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.append('foo', 2, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.get('foo', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result.push(res);
                  ut.assertDeepEqual(result, [12, 12], test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  };

  tester.other13 = function (errorCallback) {
    var test_case = 'APPEND fuzzing';
    var error_array = new Array();
    var type = new Array('alpha', 'binary', 'compr');
    g.asyncFor(0, type.length, function (outerloop) {
      var i = outerloop.iteration();
      var b = [];
      client.del('x', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        g.asyncFor(0, 1000, function (innerloop) {
          var j = innerloop.iteration();
          var bin = ut.randstring(0, 10, type[i]);
          b[j] = new Buffer(bin);
          client.append('x', bin, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            innerloop.next();
          });
        }, function () {
          var buf = Buffer.concat(b);
          client.get('x', function (err, got) {
            if (got !== buf.toString()) {
              error_array.push('Expected ' + buf + ' got ' + got);
              outerloop.break();
            } else
              outerloop.next();
          });
        });
      });
    }, function () {
      ut.assertDeepEqual(error_array, [], test_case);
      testEmitter.emit('next');
    });
  };

  //Leave the user with a clean DB before to exit
  tester.other14 = function (errorCallback) {
    var test_case = 'FLUSHDB';
    var aux = new Array();
    client.select(9, function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.flushdb(function (err, res) {
        if (err) {
          errorCallback(err)
        }
        client.dbsize(function (err, res) {
          if (err) {
            errorCallback(err)
          }
          aux[0] = res;
          client.select(10, function (err, res) {
            if (err) {
              errorCallback(err)
            }
            client.flushdb(function (err, res) {
              if (err) {
                errorCallback(err)
              }
              client.dbsize(function (err, res) {
                if (err) {
                  errorCallback(err)
                }
                aux[1] = res;
                ut.assertEqual(aux, '0,0', test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  tester.other15 = function (errorCallback) {
    var test_case = 'Config GET * returns all config parameters';
    client.config('get', '*', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      ut.assertEqual(res.length, 114, test_case);
      testEmitter.emit('next');
    });
  };

  tester.other16 = function (errorCallback) {
    var test_case = 'Config GET wrong number of parameters';
    client.config('get', 'param1', 'param2', function (err, res) {
      ut.assertOk('Wrong number of arguments for CONFIG get', err, test_case);
      testEmitter.emit('next');
    });
  };

  tester.other17 = function (errorCallback) {
    var test_case = 'Config GET parameter name.';
    client.config('get', 'dbfilename', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      ut.assertDeepEqual(res[1], 'dump.rdb', test_case);
      testEmitter.emit('next');
    });
  };

  tester.other18 = function (errorCallback) {
    var test_case = 'Config GET parameter with pattern';
    client.config('get', '*max-*-entries*', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      ut.assertEqual(res.length, 8, test_case);
      testEmitter.emit('next');
    });
  };

  tester.other19 = function (errorCallback) {
    var test_case = 'Config SET & GET combinations';
    var error = null,
    count = 0,
    size = 0;
    var result = {},
    input = {};
    input['dbfilename'] = 'temp-db.rdb';
    input['masterauth'] = '';
    input['maxmemory-policy'] = 'noeviction';
    input['maxmemory-samples'] = 4;
    input['appendonly'] = 'no';
    input['appendfsync'] = 'no';
    input['timeout'] = 200;
    input['list-max-ziplist-entries'] = 16;
    input['list-max-ziplist-value'] = 128;
    input['set-max-intset-entries'] = 32;
    input['zset-max-ziplist-entries'] = 256;
    input['zset-max-ziplist-value'] = 128;
    input['slowlog-log-slower-than'] = 100000;
    input['slowlog-max-len'] = 100;
    input['loglevel'] = 'warning';
    client.config('set', 'dbfilename', input['dbfilename']);
    client.config('set', 'masterauth', input['masterauth']);
    client.config('set', 'maxmemory-policy', input['maxmemory-policy']);
    client.config('set', 'maxmemory-samples', input['maxmemory-samples']);
    client.config('set', 'appendonly', input['appendonly']);
    client.config('set', 'appendfsync', input['appendfsync']);
    client.config('set', 'timeout', input['timeout']);
    client.config('set', 'list-max-ziplist-entries', input['list-max-ziplist-entries']);
    client.config('set', 'list-max-ziplist-value', input['list-max-ziplist-value']);
    client.config('set', 'set-max-intset-entries', input['set-max-intset-entries']);
    client.config('set', 'zset-max-ziplist-entries', input['zset-max-ziplist-entries']);
    client.config('set', 'zset-max-ziplist-value', input['zset-max-ziplist-value']);
    client.config('set', 'slowlog-log-slower-than', input['slowlog-log-slower-than']);
    client.config('set', 'slowlog-max-len', input['slowlog-max-len']);
    client.config('set', 'loglevel', input['loglevel']);
    client.config('get', 'dbfilename', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['dbfilename'] = res;
    });
    client.config('get', 'masterauth', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['masterauth'] = res;
    });
    client.config('get', 'maxmemory-policy', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['maxmemory-policy'] = res;
    });
    client.config('get', 'maxmemory-samples', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['maxmemory-samples'] = res;
    });
    client.config('get', 'timeout', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['timeout'] = res;
    });
    client.config('get', 'appendonly', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['appendonly'] = res;
    });
    client.config('get', 'appendfsync', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['appendfsync'] = res;
    });
    client.config('get', 'list-max-ziplist-entries', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['list-max-ziplist-entries'] = res;
    });
    client.config('get', 'list-max-ziplist-value', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['list-max-ziplist-value'] = res;
    });
    client.config('get', 'set-max-intset-entries', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['set-max-intset-entries'] = res;
    });
    client.config('get', 'zset-max-ziplist-entries', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['zset-max-ziplist-entries'] = res;
    });
    client.config('get', 'zset-max-ziplist-value', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['zset-max-ziplist-value'] = res;
    });
    client.config('get', 'slowlog-log-slower-than', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['slowlog-log-slower-than'] = res;
    });
    client.config('get', 'slowlog-max-len', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['slowlog-max-len'] = res;
    });
    client.config('get', 'loglevel', function (err, res) {
      if (err) {
        errorCallback(err)
      }
      result['loglevel'] = res;
    });
    setTimeout(function () {
      for (key in result) {
        size++;
      }
      for (key in result) {
        try {
          if (!assert.deepEqual(result[key][1], input[key], test_case)) {
            count++;
            continue;
          }
        } catch (e) {
          error = e;
          break;
        }
      }
      if (count === size && error == null) {
        ut.pass(test_case);
        testEmitter.emit('next');
      } else if (error) {
        ut.fail(error, true);
        testEmitter.emit('next');
      }
    }, 500);
  };

  tester.other20 = function (errorCallback) {
    var test_case = 'Config RESETSTAT';
    client.config('resetstat', function (err, result) {
      if (err) {
        errorCallback(err)
      }
      ut.serverInfo(client, 'total_commands_processed', function (err, res) {
        if (err) {
          errorCallback(err)
        }
        ut.assertMany(
          [
            ['equal', result, 'OK'],
            ['equal', res, 1],
          ], test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.other21 = function (errorCallback) {
    var test_case = 'Config command other than GET, SET, RESETSTAT';
    client.config('fake_command', function (err, res) {
      ut.assertOk('CONFIG subcommand must be one of GET, SET, RESETSTAT', err, test_case);
      testEmitter.emit('next');
    });
  };

  tester.other22 = function (errorCallback) {
    var test_case = 'Lastsave';
    client.lastsave(function (err, res) {
      ut.assertOk(util.isDate(new Date(res)), null, test_case);
      testEmitter.emit('next');
    });
  };

  tester.other23 = function (errorCallback) {
    var test_case = 'ECHO';
    var str = 'Hello World!!';
    client.echo(str, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(res, str, test_case);
      testEmitter.emit('next');
    });
  };

  tester.other24 = function (errorCallback) {
    var test_case = 'Redis Version Check';
    var cmd = '.' + sep + 'redis' + sep + 'src' + sep + REDIS_SERVER + ' --version ';
    var child_check = child.exec(cmd);
    child_check.stdout.on('data', function (data) {
      ut.assertOk('Redis server', data, test_case);
      testEmitter.emit('next');
    });
  };

  tester.other25 = function (errorCallback) {
    var test_case = 'Monitor',
    replies = [],
    m_client;
    m_client = redis.createClient(server_port, server, {
        no_ready_check : true
      });
    m_client.on('ready', function () {
      if (other.debug_mode) {
        log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
      }
    });
    m_client.on('monitor', function (time, args) {
      replies.push(args);
      if (replies.length === 2) {
        ut.assertMany(
          [
            ['equal', replies[0].length, 1],
            ['equal', replies[0][0], 'dbsize'],
            ['equal', replies[1][0], 'set'],
            ['equal', replies[1][1], 'json'],
            ['equal', replies[1][2], '{"name":"John","surname":"Doe"}'],
          ], test_case);
        m_client.quit();
        if (other.debug_mode) {
          log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
        }
        testEmitter.emit('next');
      }
    });
    m_client.monitor(function (err, res) {
      client.dbsize();
      client.set('json', JSON.stringify({
          name : 'John',
          surname : 'Doe'
        }));
    });

  };

  tester.other26 = function (errorCallback) {
    var test_case = "DEBUG Command Basics(OBJECT,POPULATE)";
    var res_array = [];
    client.set('foo', 'bar');
    client.debug('object', 'foo', function (err, res_obj) {
      client.exists('key:0', function (err, res_key1) {
        client.exists('key:1', function (err, res_key2) {
          if (res_key1 === 1)
            client.del('key:0');
          if (res_key2 === 1)
            client.del('key:1');
          client.debug('populate', 2, function (err, res) {
            res_array.push(res);
            client.exists('key:0', function (err, res) {
              res_array.push(res);
              client.exists('key:1', function (err, res) {
                res_array.push(res);
                ut.assertMany(
                  [
                    ['equal', res_obj.split(' ')[4].split(':')[1], 4],
                    ['deepequal', res_array, ['OK', 1, 1]]
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          })
        });
      });
    });
  }

  tester.other27 = function (errorCallback) {
    var test_case = "OBJECT Command basics(REFCOUNT,ENCODING,IDLETIME)";
    var res_array = [];
    client.set('foo', 'bar');
    client.object('refcount', 'foo', function (err, res) {
      res_array.push(res);
      client.object('encoding', 'foo', function (err, res) {
        res_array.push(res);
        client.object('idletime', 'foo', function (err, res) {
          ut.assertMany(
            [
              ['deepequal', res_array, [1, 'raw']],
              ['ok', !isNaN(res), null]
            ], test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  return other;

}
  ());
