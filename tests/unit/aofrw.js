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

exports.Aofrw = (function () {
  // private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  aofrw = {},
  name = 'Aofrw',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = '',
  client_pid = '';

  //public property
  aofrw.debug_mode = false;

  //public method
  aofrw.start_test = function (cpid, callback) {
    testEmitter.on('start', function () {
      var tags = 'aofrw';
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
          if (aofrw.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
          }
          testEmitter.emit('end');
        }
      }, ut.timeout);
    });
    if (aofrw.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  // test methods
  tester.Aofrw1 = function (errorCallback) {
    var test_case = 'Turning off AOF kills the background writing child if any';
    client.config('set', 'appendonly', 'yes', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.waitForBgrewriteaof(client, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        var MultiCom = client.multi();
        MultiCom.bgrewriteaof();
        MultiCom.config('set', 'appendonly', 'no');
        MultiCom.exec(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.wait_for_condition(50, 100, function (cb) {
            var file = g.srv[client_pid][server_pid]['stdout'];
            var strText = '';
            fs.readFile(file, function (err, result) {
              if (err) {
                errorCallback(err);
              }
              var resStrArray = result.toString().split('\n');
              var resFlag = false;
              for (var j = resStrArray.length; j > resStrArray.length - 5; j--) {
                if (ut.match('Killing running AOF rewrite child', resStrArray[j])) {
                  resFlag = true;
                  cb(true);
                  break;
                }
              }
              if (resFlag) {
                ut.pass(test_case);
              } else {
                ut.fail("Can't find 'Killing AOF child' into recent logs");
              }
              setTimeout(function () {
                testEmitter.emit('next');
              }, 1000);
            });
          }, function () {});
        });
      });
    });
  };

  tester.Aofrw2 = function (errorCallback) {
    var dataTypes = ['string', 'int'];
    var dataObjs = ['ziplist', 'linkedlist'];
    var test_case = '';
    var len = 0;
    var data = '';
    var iDtype = 0,
    iDataObj = 0;
    g.asyncFor(0, dataTypes.length, function (dTypeloop) {
      iDtype = dTypeloop.iteration();
      g.asyncFor(0, dataObjs.length, function (dObjloop) {
        iDataObj = dObjloop.iteration();
        test_case = 'AOF rewrite of list with ' + dataObjs[iDataObj] + ' encoding, ' + dataTypes[iDtype] + ' data';
        client.flushall(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          len = (dataObjs[iDataObj] == 'ziplist') ? 10 : 1000;
          g.asyncFor(0, len, function (loop) {
            data = (dataTypes[iDtype] == 'string') ? ut.randstring(0, 16, 'alpha') : g.randomInt(4000000000);
            client.lpush('key', data, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              loop.next();
            });
          }, function () {
            client.object('encoding', 'key', function (err, ObjType) {
              if (err) {
                errorCallback(err);
              }
              try {
                if (!assert.equal(ObjType, dataObjs[iDataObj], test_case)) {
                  client.debug('digest', function (err, d1) {
                    if (err) {
                      errorCallback(err);
                    }
                    client.bgrewriteaof(function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      ut.waitForBgrewriteaof(client, function (err, res) {
                        if (err) {
                          console.log(err)
                        }
                        client.debug('digest', function (err, d2) {
                          if (err) {
                            console.log(err)
                          }
                          if (d1 != d2) {
                            ut.fail('assertion:' + d1 + ' is not equal to ' + d2, true);
                            dObjloop.break();
                            dTypeloop.break();
                          } else {
                            ut.pass(test_case);
                            setTimeout(function () {
                              dObjloop.next();
                            }, 80);
                          }
                        });
                      });
                    });
                  });
                }
              } catch (e) {
                ut.fail(e, true);
                dObjloop.break();
                dTypeloop.break();
              }
            });
          });
        });
      }, function () {
        dTypeloop.next();
      });
    }, function () {
      setTimeout(function () {
        testEmitter.emit('next');
      }, 1000);
    });
  };

  tester.Aofrw3 = function (errorCallback) {
    var dataTypes = ['string', 'int'];
    var dataObjs = ['intset', 'hashtable'];
    var test_case = '';
    var len = 0;
    var data = '';
    var iDtype = 0,
    iDataObj = 0;
    g.asyncFor(0, dataTypes.length, function (dTypeloop) {
      iDtype = dTypeloop.iteration();
      g.asyncFor(0, dataObjs.length, function (dObjloop) {
        iDataObj = dObjloop.iteration();
        test_case = 'AOF rewrite of set with ' + dataObjs[iDataObj] + ' encoding, ' + dataTypes[iDtype] + ' data';
        client.flushall(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          len = (dataObjs[iDataObj] == 'intset') ? 10 : 1000;
          g.asyncFor(0, len, function (loop) {
            data = (dataTypes[iDtype] == 'string') ? ut.randstring(0, 16, 'alpha') : g.randomInt(4000000000);
            client.sadd('key', data, function (err, res) {
              loop.next();
            });
          }, function () {
            var testPass = false;
            client.object('encoding', 'key', function (err, ObjType) {
              if (err) {
                errorCallback(err);
              }
              try {
                if (dataTypes[iDtype] != 'string') {
                  if (!assert.equal(ObjType, dataObjs[iDataObj], test_case))
                    testPass = true;
                } else
                  testPass = true;

                if (testPass) {
                  client.debug('digest', function (err, d1) {
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
                        client.debug('digest', function (err, d2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if (d1 != d2) {
                            ut.fail('assertion:' + d1 + ' is not equal to ' + d2, true);
                            dObjloop.break();
                            dTypeloop.break();
                          } else {
                            ut.pass(test_case);
                            setTimeout(function () {
                              dObjloop.next();
                            }, 80);
                          }
                        });
                      });
                    });

                  });
                }
              } catch (e) {
                ut.fail(e, true);
                dObjloop.break();
                dTypeloop.break();
              }
            });
          });
        });
      }, function () {
        dTypeloop.next();
      });
    }, function () {
      setTimeout(function () {
        testEmitter.emit('next');
      }, 1000);
    });
  };

  tester.Aofrw4 = function (errorCallback) {
    var dataTypes = ['string', 'int'];
    var dataObjs = ['ziplist', 'skiplist'];
    var test_case = '';
    var len = 0;
    var data = '';
    var iDtype = 0,
    iDataObj = 0;
    g.asyncFor(0, dataTypes.length, function (dTypeloop) {
      iDtype = dTypeloop.iteration();
      g.asyncFor(0, dataObjs.length, function (dObjloop) {
        iDataObj = dObjloop.iteration();
        test_case = 'AOF rewrite of zset with ' + dataObjs[iDataObj] + ' encoding, ' + dataTypes[iDtype] + ' data';
        client.flushall(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          len = (dataObjs[iDataObj] == 'ziplist') ? 10 : 1000;
          g.asyncFor(0, len, function (loop) {
            data = (dataTypes[iDtype] == 'string') ? ut.randstring(0, 16, 'alpha') : g.randomInt(4000000000);
            client.zadd('key', Math.random(), data, function (err, res) {
              loop.next();
            });
          }, function () {
            client.object('encoding', 'key', function (err, ObjType) {
              if (err) {
                errorCallback(err);
              }
              try {
                if (!assert.equal(ObjType, dataObjs[iDataObj], test_case)) {
                  client.debug('digest', function (err, d1) {
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
                        client.debug('digest', function (err, d2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if (d1 != d2) {
                            ut.fail('assertion:' + d1 + ' is not equal to ' + d2, true);
                            dObjloop.break();
                            dTypeloop.break();
                          } else {
                            ut.pass(test_case);
                            setTimeout(function () {
                              dObjloop.next();
                            }, 80);
                          }
                        });
                      });
                    });
                  });
                }
              } catch (e) {
                ut.fail(e, true);
                dObjloop.break();
                dTypeloop.break();
              }
            });
          });
        });

      }, function () {
        dTypeloop.next();
      });
    }, function () {
      setTimeout(function () {
        testEmitter.emit('next');
      }, 1000);
    });
  };

  tester.Aofrw5 = function (errorCallback) {
    var dataTypes = ['string', 'int'];
    var dataObjs = ['ziplist', 'hashtable'];
    var test_case = '';
    var len = 0;
    var data = '';
    var iDtype = 0,
    iDataObj = 0;
    g.asyncFor(0, dataTypes.length, function (dTypeloop) {
      iDtype = dTypeloop.iteration();
      g.asyncFor(0, dataObjs.length, function (dObjloop) {
        iDataObj = dObjloop.iteration();
        test_case = 'AOF rewrite of hash with ' + dataObjs[iDataObj] + ' encoding, ' + dataTypes[iDtype] + ' data';
        client.flushall(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          len = (dataObjs[iDataObj] == 'ziplist') ? 10 : 1000;
          g.asyncFor(0, len, function (loop) {
            data = (dataTypes[iDtype] == 'string') ? ut.randstring(0, 16, 'alpha') : g.randomInt(4000000000);
            client.hset('key', data, data, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              loop.next();
            });
          }, function () {
            client.object('encoding', 'key', function (err, ObjType) {
              if (err) {
                errorCallback(err);
              }
              try {
                if (!assert.equal(ObjType, dataObjs[iDataObj], test_case)) {
                  client.debug('digest', function (err, d1) {
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
                        //client.debug('loadaof');
                        client.debug('digest', function (err, d2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if (d1 != d2) {
                            ut.fail('assertion:' + d1 + ' is not equal to ' + d2, true);
                            dObjloop.break();
                            dTypeloop.break();
                          } else {
                            ut.pass(test_case);
                            setTimeout(function () {
                              dObjloop.next();
                            }, 200);
                          }
                        });
                      });
                    });

                  });
                }
              } catch (e) {
                ut.fail(e, true);
                dObjloop.break();
                dTypeloop.break();
              }

            });
          });
        });
      }, function () {
        setTimeout(function () {
          dTypeloop.next();
        }, 200);

      });

    }, function () {
      setTimeout(function () {
        testEmitter.emit('next');
      }, 1000);
    });

  };

  tester.Aofrw6 = function (errorCallback) {
    var test_case = 'BGREWRITEAOF is delayed if BGSAVE is in progress';
    var MultiCli = client.multi();
    MultiCli.bgsave();
    MultiCli.bgrewriteaof();
    MultiCli.info('persistence');
    MultiCli.exec(function (err, res) {
      ut.assertMany(
        [
          ['ok', 'scheduled', res[1]],
          ['ok', 'aof_rewrite_scheduled:1', res[2]]
        ], test_case);
      setTimeout(function () {
        testEmitter.emit('next');
      }, 1000);
    });

  };

  tester.Aofrw7 = function (errorCallback) {
    var test_case = 'BGREWRITEAOF is refused if already in progress';
    client.multi().bgrewriteaof().exec(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      setTimeout(function () {
        client.multi().bgrewriteaof().bgrewriteaof().exec(function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.equal(ut.match('already in progress', res.toString()), true, test_case)) {
              g.asyncFor(0, -1, function (loop) {
                client.info('persistence', function (err, res) {
                  if (!ut.match('aof_rewrite_scheduled:1', res.split('\r')[10])) {
                    loop.break();
                  } else
                    setTimeout(function () {
                      loop.next();
                    }, 100);
                });
              }, function () {
                ut.pass(test_case);
                testEmitter.emit('next');
              });
            }
          } catch (e) {
            ut.fail(e, true);
            testEmitter.emit('next');
          }
        });
      }, 100);
    });
  };

  return aofrw;
}
  ());
