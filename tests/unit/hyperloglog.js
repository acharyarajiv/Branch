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

exports.Hyperlog = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  hyperlog = {},
  name = 'Hyperlog',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {},
  result = [],
  local_result = [],
  global_result = [];

  //public property
  hyperlog.debug_mode = false;

  //public method
  hyperlog.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'hyperlog';
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
          if (hyperlog.debug_mode) {
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

    if (hyperlog.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  tester.hyperlog1 = function (errorCallback) {
    var test_case = 'HyperLogLog self test passes';
    client.pfselftest(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 'OK', test_case);
      testEmitter.emit('next');
    })
  };

  tester.hyperlog2 = function (errorCallback) {
    var test_case = 'PFADD without arguments creates an HLL value';
    client.pfadd('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.exists('hll', function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res1, 1, test_case);
        testEmitter.emit('next');
      })
    })
  };

  tester.hyperlog3 = function (errorCallback) {
    var test_case = 'Approximated cardinality after creation is zero';
    client.pfadd('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 0, test_case);
      testEmitter.emit('next');
    })
  };

  tester.hyperlog4 = function (errorCallback) {
    var test_case = 'PFADD returns 1 when at least 1 reg was modified';
    client.pfadd('hll', 'a', 'b', 'c', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 1, test_case);
      testEmitter.emit('next');
    })
  };

  tester.hyperlog5 = function (errorCallback) {
    var test_case = 'PFADD returns 0 when no reg was modified';
    client.pfadd('hll', 'a', 'b', 'c', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 0, test_case);
      testEmitter.emit('next');
    })
  };

  tester.hyperlog6 = function (errorCallback) {
    var test_case = 'PFADD works with empty string (regression)';
    client.pfadd('hll', '', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 1, test_case);
      testEmitter.emit('next');
    })
  };

  tester.hyperlog7 = function (errorCallback) {
    var test_case = 'PFCOUNT returns approximated cardinality of set';
    client.del('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.pfadd('hll', 1, 2, 3, 4, 5, function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        client.pfcount('hll', function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          client.pfadd('hll', 6, 7, 8, 9, 10, function (err, res3) {
            if (err) {
              errorCallback(err);
            }
            client.pfcount('hll', function (err, res4) {
              if (err) {
                errorCallback(err);
              }
              ut.assertMany(
                [
                  ['ok', 10, res4],
                  ['ok', 5, res2]

                ], test_case);

              testEmitter.emit('next');
            })
          })
        })
      })
    })
  };

  tester.hyperlog8 = function (errorCallback) {
    var test_case = 'HyperLogLogs are promote from sparse to dense';
    client.del('hll', function (err, res) {
      client.config('set', 'hll-sparse-max-bytes', 3000, function (err, res1) {
        g.asyncFor(0, 100000, function (outerloop) {
          var n = 0;
          var elements = new Array();
          g.asyncFor(0, 100, function (innerloop) {
            var rn = Math.floor(Math.random());
            elements.push(rn);
            innerloop.next();
          }, function () {
            n += 100;
            client.pfadd('hll', elements, function (err, res2) {
              client.pfcount('hll', function (err, card) {
                err = card - n;
                try {
                  if (!assert.ok(err < (card / 100) * 5, test_case)) {
                    var result = '';
                    client.pfdebug('encoding', 'hll', function (err, res3) {
                      if (n < 1000)
                        result = 'sparse';
                      else if (n > 10000)
                        result = 'dense';
                      try {
                        if (!assert.equal(result, res3, test_case))
                          outerloop.next();
                      } catch (ex) {
                        ut.fail(ex);
                      }
                    });
                  }
                } catch (ex) {
                  ut.fail(ex);
                }
              });
            });
          });
        }, function () {
          ut.pass(test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.hyperlog9 = function (errorCallback) {
    var test_case = 'HyperLogLog sparse encoding stress test';
    g.asyncFor(0, 1000, function (outerloop) {
      client.del('hll1', 'hll2', function (err, res1) {
        var numele = g.randomInt(100);
        var elements = new Array();
        g.asyncFor(0, numele, function (innerloop) {
          var rn = Math.floor(Math.random());
          elements.push(rn);
          innerloop.next();
        }, function () {
          client.pfadd('hll2', function (err, res2) {
            client.pfdebug('todense', 'hll2', function (err, res3) {
              client.pfadd('hll1', elements, function (err, res4) {
                client.pfadd('hll2', elements, function (err, res5) {
                  try {
                    client.pfdebug('encoding', 'hll1', function (err, res6) {
                      client.pfdebug('encoding', 'hll2', function (err, res7) {
                        client.pfcount('hll1', function (err, res8) {
                          client.pfcount('hll2', function (err, res9) {

                            if (!assert.equal(res6, 'sparse', test_case) && !assert.equal(res7, 'dense', test_case) && !assert.equal(res8, res9, test_case))

                              outerloop.next();

                          });
                        });
                      });
                    });
                  } catch (ex) {
                    ut.fail(ex);
                  }
                });
              });
            });
          });
        });
      });
    }, function () {
      ut.pass(test_case);
      testEmitter.emit('next');
    });
  };

  tester.hyperlog10 = function (errorCallback) {
    var test_case = 'Corrupted sparse HyperLogLogs are detected: Additionl at tail';
    client.del('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.pfadd('hll', 'a', 'b', 'c', function (err, res1) {
        if (err) {
          errorCallback(err);
        }

        client.append('hll', 'hello', function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          client.pfcount('hll', function (err, res3) {
            ut.assertOk('INVALIDOBJ Corrupted HLL object detected', err, test_case);
            testEmitter.emit('next');
          })
        })
      })
    })
  };

  tester.hyperlog11 = function (errorCallback) {
    var test_case = 'Corrupted sparse HyperLogLogs are detected: Broken magic';
    client.del('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.pfadd('hll', 'a', 'b', 'c', function (err, res1) {
        if (err) {
          errorCallback(err);
        }

        client.setrange('hll', 0, '0123', function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          client.pfcount('hll', function (err, res3) {
            ut.assertOk('WRONGTYPE Key is not a valid HyperLogLog string value', err, test_case);
            testEmitter.emit('next');
          })
        })
      })
    })
  };

  tester.hyperlog12 = function (errorCallback) {
    var test_case = 'Corrupted sparse HyperLogLogs are detected: Invalid encoding';
    client.del('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.pfadd('hll', 'a', 'b', 'c', function (err, res1) {
        if (err) {
          errorCallback(err);
        }

        client.setrange('hll', 4, 'x', function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          client.pfcount('hll', function (err, res3) {
            ut.assertOk('WRONGTYPE Key is not a valid HyperLogLog string value', err, test_case);
            testEmitter.emit('next');
          })
        })
      })
    })
  };

  tester.hyperlog13 = function (errorCallback) {
    var test_case = 'Corrupted sparse HyperLogLogs are detected: Wrong length';
    client.del('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.pfadd('hll', 'a', 'b', 'c', function (err, res1) {
        if (err) {
          errorCallback(err);
        }

        client.setrange('hll', 4, '\x00', function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          client.pfcount('hll', function (err, res3) {
            ut.assertOk('WRONGTYPE Key is not a valid HyperLogLog string value', err, test_case);
            testEmitter.emit('next');
          })
        })
      })
    })
  };

  tester.hyperlog14 = function (errorCallback) {
    var test_case = 'PFADD, PFCOUNT, PFMERGE type checking works';
    client.set('foo', 'bar', function (err1, res1) {
      client.pfadd('foo', 1, function (err2, res2) {
        client.pfcount('foo', function (err3, res3) {
          client.pfmerge('bar', 'foo', function (err4, res4) {
            client.pfmerge('foo', 'bar', function (err4, res4) {
              ut.assertMany(
                [
                  ['ok', 'WRONGTYPE Key is not a valid HyperLogLog string value', err2],
                  ['ok', 'WRONGTYPE Key is not a valid HyperLogLog string value', err1],
                  ['ok', 'WRONGTYPE Key is not a valid HyperLogLog string value', err3],
                  ['ok', 'WRONGTYPE Key is not a valid HyperLogLog string value', err4],
                ], test_case);
              testEmitter.emit('next');
            })
          })
        })
      })
    })
  };

  tester.hyperlog15 = function (errorCallback) {
    var test_case = 'PFMERGE results on the cardinality of union of sets';
    client.del('hll', 'hll1', 'hll2', 'hll3', function (err, res1) {
      if (err) {
        errorCallback(err);
      }
      client.pfadd('hll1', 'a', 'b', 'c', function (err, res2) {
        if (err) {
          errorCallback(err);
        }
        client.pfadd('hll2', 'b', 'c', 'd', function (err, res3) {
          if (err) {
            errorCallback(err);
          }
          client.pfadd('hll3', 'c', 'd', 'e', function (err, res4) {
            if (err) {
              errorCallback(err);
            }
            client.pfmerge('hll', 'hll1', 'hll2', 'hll3', function (err, res5) {
              if (err) {
                errorCallback(err);
              }
              client.pfcount('hll', function (err, res6) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertEqual(res6, 5, test_case);
                testEmitter.emit('next');
              })
            })
          })
        })
      })
    })
  };

  tester.hyperlog16 = function (errorCallback) {
    var test_case = 'PFCOUNT multiple-keys merge returns cardinality of union';
    client.del('hll1', 'hll2', 'hll3', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(1, 10000, function (loop) {
        var i = loop.iteration();
        client.pfadd('hll1', 'foo-$x', function (err, res1) {
          if (err) {
            errorCallback(err);
          }
          client.pfadd('hll2', 'bar-$x', function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            client.pfadd('hll2', 'zap-$x', function (err, res3) {
              if (err) {
                errorCallback(err);
              }
              client.pfcount('hll1', 'hll2', 'hll3', function (err, card) {
                var realcard = i * 3;
                var err = card - realcard;

                try {
                  if (!assert.ok(err < (card / 100) * 5, test_case)) {
                    loop.next();
                  }
                } catch (ex) {
                  ut.fail(ex);
                }
              });
            });
          });
        });
      }, function () {
        ut.pass(test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.hyperlog17 = function (errorCallback) {
    var test_case = 'PFDEBUG GETREG returns the HyperLogLog raw registers';
    client.del('hll', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.pfadd('hll', 1, 2, 3, function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        client.pfdebug('getreg', 'hll', function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res2.length, 16384, test_case);
          testEmitter.emit('next');
        })
      })
    })
  };

  return hyperlog;

}
  ());
