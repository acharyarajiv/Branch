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

exports.Zset = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  Zutil = require('../../support/zsetutil.js'),
  zt = new Zutil();
  zset = {},
  name = 'Zset',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {},
  p_inf = '+inf',
  n_inf = '-inf';

  //public property
  zset.debug_mode = false;

  //public method
  zset.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'zset';
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
          if (zset.debug_mode) {
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

    if (zset.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods

  function assert_encoding(enc, key, callback) {
    client.object('encoding', key, function (error, res) {
      if (error) {
        errorCallback(error);
      }
      var pattern = /( swapped at: )/;
      while (pattern.test(res)) {
        client.debug('swapin', key, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.debug('object', key, function (err, res) {
            if (err) {
              errorCallback(err);
            }
          });
        });
      }
      var message = 'Encoding: Expected:' + enc + ', Actual:' + res + ' for key:' + key;
      try {
        if (!assert.equal(res, enc, 'Error: ' + message) && (!assert.ifError(error))) {
          callback(null, true);
        }
      } catch (e) {
        callback(e, null);
      }
    });
  }

  function create_zset(key, items, callback) {
    client.del(key, function (err, res) {
      if (err) {
        callback(err, null);
      } else {
        g.asyncFor(0, items.length, function (loop) {
          var i = loop.iteration();
          client.zadd(key, items[i], items[i + 1], function (err, res) {
            if (err) {
              callback(err, null);
            }
            loop.updateindex(i + 2);
            loop.updatecounter(i + 2);
            loop.next();
          });
        }, function () {
          callback(null, true);
        });
      }
    })
  };

  function create_default_zset(callback) {
    create_zset('zset', [n_inf, 'a', 1, 'b', 2, 'c', 3, 'd', 4, 'e', 5, 'f', p_inf, 'g'], function (err, res) {
      if (err) {
        callback(err, null);
      }
      callback(null, true);
    });
  };

  function remrangebyscore(args, expected, message, callback) {
    create_zset('zset', [1, 'a', 2, 'b', 3, 'c', 4, 'd', 5, 'e'], function (err, res) {
      if (err) {
        callback(err, null);
      }
      client.exists('zset', function (err, res) {
        if (err) {
          callback(err, null);
        }
        if (res != 1) {
          callback(new Error('key:zset does not exist'), null);
        }
        client.zremrangebyscore('zset', args[0], args[1], function (err, res) {
          if (err) {
            callback(err, null);
          }
          try {
            if (!assert.deepEqual(res, expected, message)) {
              callback(null, true);
            }
          } catch (e) {
            callback(e, null);
          }
        });
      });
    });
  }

  function create_default_lex_zset(callback) {
    create_zset('zset', [0, 'alpha', 0, 'bar', 0, 'cool', 0, 'down', 0, 'elephant', 0, 'foo', 0, 'great', 0, 'hill', 0, 'omega'], function (err, res) {
      if (err) {
        callback(err, null);
      }
      callback(null, true);
    });
  }

  tester.zset1 = function (errorCallback) {
    var enc = new Array('ziplist', 'skiplist');
    var m_error = '';
    g.asyncFor(0, enc.length, function (mloop) {
      var itr = mloop.iteration();
      zt.basics(client, enc[itr], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        async.series({
          a : function (cb) {
            var test_case = 'Check encoding - ' + enc[itr];
            client.del('ztmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('ztmp', 10, 'x', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                assert_encoding(enc[itr], 'ztmp', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  try {
                    if (!assert.ok(res, test_case)) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                });
              })
            })
          },
          b : function (cb) {
            var test_case = 'ZSET basic ZADD and score update - ' + enc[itr];
            var result = [];
            if (err) {
              cb(err, null);
            }
            client.del('ztmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('ztmp', 10, 'x', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zadd('ztmp', 20, 'y', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.zadd('ztmp', 30, 'z', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zrange('ztmp', 0, -1, function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      result.push(res);
                      client.zadd('ztmp', 1, 'y', function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        client.zrange('ztmp', 0, -1, function (err, res) {
                          if (err) {
                            cb(err, null);
                          }
                          result.push(res);
                          try {
                            if (!assert.deepEqual(result, [['x', 'y', 'z'], ['y', 'x', 'z']], test_case)) {
                              ut.pass(test_case);
                              cb(null, null);
                            }
                          } catch (e) {
                            ut.fail(e, true);
                            cb(e, null);
                          }
                        });
                      });
                    });
                  });
                });
              });
            });
          },
          c : function (cb) {
            var test_case = 'ZSET element can\'t be set to NaN with ZADD -' + enc[itr];
            client.zadd('myzset', 'nan', 'abc', function (err, res) {
              try {
                if (!assert.ok(ut.match('not a valid float', err), test_case)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(e, null);
              }
            });
          },
          d : function (cb) {
            var test_case = 'ZSET element can\'t be set to NaN with ZINCRBY';
            client.zadd('myzset', 'nan', 'abc', function (err, res) {
              try {
                if (!assert.ok(ut.match('not a valid float', err), test_case)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(e, null);
              }
            })
          },
          e : function (cb) {
            var test_case = 'ZINCRBY calls leading to NaN result in error';
            client.zincrby('myzset', '+inf', 'abc', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zincrby('myzset', '-inf', 'abc', function (err, res) {
                try {
                  if (!assert.ok(ut.match('NaN', err), test_case)) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              })
            })
          },
          f : function (cb) {
            var test_case = 'ZADD - Variadic version base case';
            var list = new Array();
            client.del('myzset', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('myzset', 10, 'a', 20, 'b', 30, 'c', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                list[0] = res;
                client.zrange('myzset', 0, -1, 'withscores', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  list[1] = res;
                  try {
                    if (!assert.deepEqual(list, [3, ['a', 10, 'b', 20, 'c', 30]], test_case)) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                })
              })
            })
          },
          g : function (cb) {
            var test_case = 'ZADD - Return value is the number of actually added items';
            var list = new Array();
            client.zadd('myzset', 5, 'x', 20, 'b', 30, 'c', function (err, res) {
              if (err) {
                cb(err, null);
              }
              list[0] = res;
              client.zrange('myzset', 0, -1, 'withscores', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                list[1] = res;
                try {
                  if (!assert.deepEqual(list, [1, ['x', 5, 'a', 10, 'b', 20, 'c', 30]], test_case)) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              })
            })
          },
          h : function (cb) {
            var test_case = 'ZADD - Variadic version does not add nothing on single parsing err';
            client.del('myzset', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('myzset', 10, 'a', 20, 'b', '30.badscore', 'c', function (error, res) {
                client.exists('myzset', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  try {
                    if ((!assert.ok(ut.match('not a valid float', error), test_case)) && (!assert.equal(res, 0, test_case))) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                });
              });
            });
          },
          i : function (cb) {
            var test_case = 'ZADD - Variadic version will raise error on missing arg';
            client.del('myzset', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('myzset', 10, 'a', 20, 'b', 30, 'c', 40, function (error, res) {
                try {
                  if (!assert.ok(ut.match('ERR syntax', error), test_case)) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          j : function (cb) {
            var test_case = 'ZINCRBY does not work variadic even if shares ZADD implementation';
            client.del('myzset', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zincrby('myzset', 10, 'a', 20, 'b', 30, 'c', function (error, res) {
                try {
                  if (!assert.ok(ut.match('wrong number of arguments', error), test_case)) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          k : function (cb) {
            var test_case = 'ZCARD basics - ' + enc[itr];
            client.zcard('ztmp', function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zcard('zdoesntexist', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.equal(res1, 3, test_case)) && (!assert.equal(res2, 0, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              })
            })
          },
          l : function (cb) {
            var test_case = 'ZREM removes key after last element is removed';
            var result = new Array();
            client.del('ztmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('ztmp', 10, 'x', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zadd('ztmp', 20, 'y', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.exists('ztmp', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    result.push(res);
                    client.zrem('ztmp', 'z', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      result.push(res);
                      client.zrem('ztmp', 'y', function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        result.push(res);
                        client.zrem('ztmp', 'x', function (err, res) {
                          if (err) {
                            cb(err, null);
                          }
                          result.push(res);
                          client.exists('ztmp', function (err, res) {
                            if (err) {
                              cb(err, null);
                            }
                            result.push(res);
                            try {
                              if (!assert.deepEqual(result, [1, 0, 1, 1, 0], test_case)) {
                                ut.pass(test_case);
                                cb(null, null);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                              cb(e, null);
                            }
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          },
          m : function (cb) {
            var test_case = 'ZREM variadic version';
            var result = new Array();
            client.del('ztmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('ztmp', 10, 'a', 20, 'b', 30, 'c', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zrem('ztmp', 'x', 'y', 'a', 'b', 'k', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  result.push(res);
                  client.zrem('ztmp', 'foo', 'bar', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    result.push(res);
                    client.zrem('ztmp', 'c', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      result.push(res);
                      client.exists('ztmp', function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        result.push(res);
                        try {
                          if (!assert.deepEqual(result, [2, 0, 1, 0], test_case)) {
                            ut.pass(test_case);
                            cb(null, null);
                          }
                        } catch (e) {
                          ut.fail(e, true);
                          cb(e, null);
                        }
                      })
                    })
                  })
                })
              })
            })
          },
          n : function (cb) {
            var test_case = 'ZREM variadic version -- remove elements after key deletion';
            client.del('ztmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('ztmp', 10, 'a', 20, 'b', 30, 'c', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zrem('ztmp', 'a', 'b', 'c', 'd', 'e', 'f', 'g', function (err, res) {
                  if (err) {
                    cb(err, null);
                  };
                  try {
                    if (!assert.equal(res, 3, test_case)) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                })
              })
            })
          },
          o : function (cb) {
            var test_case = 'ZRANGE basics - ' + enc[itr];
            client.del('ztmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('ztmp', 1, 'a', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zadd('ztmp', 2, 'b', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.zadd('ztmp', 3, 'c', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zadd('ztmp', 4, 'd', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      async.series({
                        o1 : function (ocb) {
                          zt.zrange(client, ['ztmp', 0, -1], ['a', 'b', 'c', 'd'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o2 : function (ocb) {
                          zt.zrange(client, ['ztmp', 0, -2], ['a', 'b', 'c'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o3 : function (ocb) {
                          zt.zrange(client, ['ztmp', 1, -1], ['b', 'c', 'd'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o4 : function (ocb) {
                          zt.zrange(client, ['ztmp', 1, -2], ['b', 'c'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o5 : function (ocb) {
                          zt.zrange(client, ['ztmp', -2, -1], ['c', 'd'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o6 : function (ocb) {
                          zt.zrange(client, ['ztmp', -2, -2], ['c'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        // out of range start index
                        o7 : function (ocb) {
                          zt.zrange(client, ['ztmp', -5, 2], ['a', 'b', 'c'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o8 : function (ocb) {
                          zt.zrange(client, ['ztmp', -5, 1], ['a', 'b'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o9 : function (ocb) {
                          zt.zrange(client, ['ztmp', 5, -1], [], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o10 : function (ocb) {
                          zt.zrange(client, ['ztmp', 5, -2], [], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        // out of range end index
                        o11 : function (ocb) {
                          zt.zrange(client, ['ztmp', 0, 5], ['a', 'b', 'c', 'd'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o12 : function (ocb) {
                          zt.zrange(client, ['ztmp', 1, 5], ['b', 'c', 'd'], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o13 : function (ocb) {
                          zt.zrange(client, ['ztmp', 0, -5], [], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        o14 : function (ocb) {
                          zt.zrange(client, ['ztmp', 1, -5], [], test_case, function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            ocb(null, null);
                          });
                        },
                        // withscores
                        o15 : function (ocb) {
                          client.zrange('ztmp', 0, -1, 'withscores', function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            try {
                              if (!assert.deepEqual(res, ['a', 1, 'b', 2, 'c', 3, 'd', 4], test_case)) {
                                ocb(null, null);
                              }
                            } catch (e) {
                              ocb(e, null);
                            }
                          });
                        },
                      }, function (err, rep) {
                        if (err) {
                          ut.fail(err, true);
                        } else {
                          ut.pass(test_case);
                        }
                        cb(null, null);
                      });
                    });
                  });
                });
              });
            });
          },
          p : function (cb) {
            var test_case = 'ZREVRANGE basics - ' + enc[itr];
            client.del('ztmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('ztmp', 1, 'a', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zadd('ztmp', 2, 'b', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.zadd('ztmp', 3, 'c', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zadd('ztmp', 4, 'd', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      async.series({
                        p1 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 0, -1], ['d', 'c', 'b', 'a'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p2 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 0, -2], ['d', 'c', 'b'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p3 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 1, -1], ['c', 'b', 'a'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p4 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 1, -2], ['c', 'b'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p5 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', -2, -1], ['b', 'a'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p6 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', -2, -2], ['b'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        // out of range start index
                        p7 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', -5, 2], ['d', 'c', 'b'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p8 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', -5, 1], ['d', 'c'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p9 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 5, -1], [], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p10 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 5, -2], [], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        // out of range end index
                        p11 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 0, 5], ['d', 'c', 'b', 'a'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p12 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 1, 5], ['c', 'b', 'a'], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p13 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 0, -5], [], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        p14 : function (pcb) {
                          zt.zrevrange(client, ['ztmp', 1, -5], [], test_case, function (err, res) {
                            if (err) {
                              pcb(err, null);
                            }
                            pcb(null, null);
                          });
                        },
                        // withscores
                        p15 : function (pcb) {
                          client.zrevrange('ztmp', 0, -1, 'withscores', function (err, res) {
                            if (err) {
                              ocb(err, null);
                            }
                            try {
                              if (!assert.deepEqual(res, ['d', 4, 'c', 3, 'b', 2, 'a', 1], test_case)) {
                                pcb(null, null);
                              }
                            } catch (e) {
                              pcb(e, null);
                            }
                          });
                        },
                      }, function (err, res) {
                        if (err) {
                          ut.fail(err, true);
                        } else {
                          ut.pass(test_case);
                        }
                        cb(null, null);
                      });
                    });
                  });
                });
              });
            });
          },
          q : function (cb) {
            var test_case = 'ZRANK/ZREVRANK basics - ' + enc[itr];
            client.del('zranktmp', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('zranktmp', 10, 'x', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zadd('zranktmp', 20, 'y', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.zadd('zranktmp', 30, 'z', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    async.series({
                      q1 : function (qcb) {
                        zt.zrank(client, 'zranktmp', 'x', 0, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                      q2 : function (qcb) {
                        zt.zrank(client, 'zranktmp', 'y', 1, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                      q3 : function (qcb) {
                        zt.zrank(client, 'zranktmp', 'z', 2, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                      q4 : function (qcb) {
                        zt.zrank(client, 'zranktmp', 'foo', null, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                      q5 : function (qcb) {
                        zt.zrevrank(client, 'zranktmp', 'x', 2, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                      q6 : function (qcb) {
                        zt.zrevrank(client, 'zranktmp', 'y', 1, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                      q7 : function (qcb) {
                        zt.zrevrank(client, 'zranktmp', 'z', 0, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                      q8 : function (qcb) {
                        zt.zrevrank(client, 'zranktmp', 'foo', null, test_case, function (err, res) {
                          if (err) {
                            qcb(err, null);
                          }
                          qcb(null, null);
                        });
                      },
                    }, function (err, rep) {
                      if (err) {
                        ut.fail(err, true);
                      } else {
                        ut.pass(test_case);
                      }
                      cb(null, null);
                    });
                  });
                });
              });
            });
          },
          r : function (cb) {
            var test_case = 'ZRANK - after deletion - ' + enc[itr];
            var result = new Array();
            client.zrem('zranktmp', 'y', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zrank('zranktmp', 'x', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                result.push(res);
                client.zrank('zranktmp', 'z', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  result.push(res);
                  try {
                    if (!assert.deepEqual(result, [0, 1], test_case)) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                });
              });
            });
          },
          s : function (cb) {
            var test_case = 'ZINCRBY - can create a new sorted set - ' + enc[itr];
            var result = new Array();
            client.del('zset', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zincrby('zset', 1, 'foo', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zrange('zset', 0, -1, function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  result.push(res);
                  client.zscore('zset', 'foo', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    result.push(res);
                    try {
                      if (!assert.deepEqual(result, [['foo'], 1], test_case)) {
                        ut.pass(test_case);
                        cb(null, null);
                      }
                    } catch (e) {
                      ut.fail(e, true);
                      cb(e, null);
                    }
                  });
                });
              });
            });
          },
          t : function (cb) {
            var test_case = 'ZINCRBY - increment and decrement - ' + enc[itr];
            var result = new Array();
            client.zincrby('zset', 2, 'foo', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zincrby('zset', 1, 'bar', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zrange('zset', 0, -1, function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  result.push(res);
                  client.zincrby('zset', 10, 'bar', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zincrby('zset', -5, 'foo', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      client.zincrby('zset', -5, 'bar', function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        client.zrange('zset', 0, -1, function (err, res) {
                          if (err) {
                            cb(err, null);
                          }
                          result.push(res);
                          client.zscore('zset', 'foo', function (err, res) {
                            if (err) {
                              cb(err, null);
                            }
                            result.push(res);
                            client.zscore('zset', 'bar', function (err, res) {
                              if (err) {
                                cb(err, null);
                              }
                              result.push(res);
                              try {
                                if (!assert.deepEqual(result, [['bar', 'foo'], ['foo', 'bar'], -2, 6], test_case)) {
                                  ut.pass(test_case);
                                  cb(null, null);
                                }
                              } catch (e) {
                                ut.fail(e, true);
                                cb(e, null);
                              }
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });

          },
          u : function (cb) {
            var test_case = 'ZRANGEBYSCORE/ZREVRANGEBYSCORE/ZCOUNT basics';
            create_default_zset(function (err, res) {
              if (err) {
                cb(err, null);
              }
              //inclusive range
              async.series({
                u1 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', n_inf, 2], ['a', 'b', 'c'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u2 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 0, 3], ['b', 'c', 'd'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u3 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 3, 6], ['d', 'e', 'f'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u4 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 4, p_inf], ['e', 'f', 'g'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u5 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', 2, n_inf], ['c', 'b', 'a'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u6 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', 3, 0], ['d', 'c', 'b'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u7 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', 6, 3], ['f', 'e', 'd'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u8 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', p_inf, 4], ['g', 'f', 'e'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u9 : function (ucb) {
                  client.zcount('zset', 0, 3, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    try {
                      if (!assert.equal(res, 3, test_case)) {
                        ucb(null, null);
                      }
                    } catch (e) {
                      ucb(e, null);
                    }
                  });
                },
                //exclusive range
                u10 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + n_inf, '(' + 2], ['b'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u11 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 0, '(' + 3], ['b', 'c'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u12 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 3, '(' + 6], ['e', 'f'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u13 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 4, '(' + p_inf], ['f'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u14 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', '(' + 2, '(' + n_inf], ['b'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u15 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', '(' + 3, '(' + 0], ['c', 'b'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u16 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', '(' + 6, '(' + 3], ['f', 'e'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u17 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', '(' + p_inf, '(' + 4], ['f'], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u18 : function (ucb) {
                  client.zcount('zset', '(' + 0, '(' + 3, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    try {
                      if (!assert.equal(res, 2, test_case)) {
                        ucb(null, null);
                      }
                    } catch (e) {
                      ucb(e, null);
                    }
                  });
                },
                //test empty ranges
                u19 : function (ucb) {
                  client.zrem('zset', 'a', function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u20 : function (ucb) {
                  client.zrem('zset', 'g', function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                //inclusive
                u21 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 4, 2], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u22 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 6, p_inf], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u24 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', n_inf, -6], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u25 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', p_inf, 6], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u26 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', -6, n_inf], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                //exclusive
                u27 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 4, '(' + 2], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u28 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 2, '(' + 2], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u29 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 2, 2], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u30 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 6, '(' + p_inf], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u31 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + n_inf, '(-6'], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u32 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', '(' + p_inf, '(' + 6], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u33 : function (ucb) {
                  zt.zrevrangebyscore(client, ['zset', '(-6', '(' + n_inf], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                //empty inner range
                u34 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 2.4, 2.6], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u35 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 2.4, 2.6], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u36 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', 2.4, '(' + 2.6], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
                u37 : function (ucb) {
                  zt.zrangebyscore(client, ['zset', '(' + 2.4, '(' + 2.6], [], test_case, function (err, res) {
                    if (err) {
                      ucb(err, null);
                    }
                    ucb(null, null);
                  });
                },
              }, function (err, rep) {
                if (err) {
                  ut.fail(err, true);
                } else {
                  ut.pass(test_case);
                }
                cb(null, null);
              });
            });
          },
          v : function (cb) {
            var test_case = 'ZRANGEBYSCORE with WITHSCORES';
            create_default_zset(function (err, res) {
              if (err) {
                cb(err, null);
              }
              zt.zrangebyscore(client, ['zset', 0, 3, 'withscores'], ['b', 1, 'c', 2, 'd', 3], test_case, function (err, res) {
                if (err) {
                  cb(err, null);
                }
                zt.zrevrangebyscore(client, ['zset', 3, 0, 'withscores'], ['d', 3, 'c', 2, 'b', 1], test_case, function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  ut.pass(test_case);
                  cb(null, null);
                });
              });
            });
          },
          w : function (cb) {
            var test_case = 'ZRANGEBYSCORE with LIMIT';
            create_default_zset(function (err, res) {
              if (err) {
                ut.fail(err, true);
                cb(err, null);
              }
              zt.zrangebyscore(client, ['zset', 0, 10, 'LIMIT', 0, 2], ['b', 'c'], test_case, function (err, res) {
                if (err) {
                  cb(err, null);
                }
                zt.zrangebyscore(client, ['zset', 0, 10, 'LIMIT', 2, 3], ['d', 'e', 'f'], test_case, function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  zt.zrangebyscore(client, ['zset', 0, 10, 'LIMIT', 2, 10], ['d', 'e', 'f'], test_case, function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    zt.zrangebyscore(client, ['zset', 0, 10, 'LIMIT', 20, 10], [], test_case, function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      zt.zrevrangebyscore(client, ['zset', 10, 0, 'LIMIT', 0, 2], ['f', 'e'], test_case, function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        zt.zrevrangebyscore(client, ['zset', 10, 0, 'LIMIT', 2, 3], ['d', 'c', 'b'], test_case, function (err, res) {
                          if (err) {
                            cb(err, null);
                          }
                          zt.zrevrangebyscore(client, ['zset', 10, 0, 'LIMIT', 2, 10], ['d', 'c', 'b'], test_case, function (err, res) {
                            if (err) {
                              cb(err, null);
                            }
                            zt.zrevrangebyscore(client, ['zset', 10, 0, 'LIMIT', 20, 10], [], test_case, function (err, res) {
                              if (err) {
                                cb(err, null);
                              } else {
                                ut.pass(test_case);
                                cb(null, null);
                              }
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          },
          x : function (cb) {
            var test_case = 'ZRANGEBYSCORE with LIMIT and WITHSCORES';
            create_default_zset(function (err, res) {
              if (err) {
                cb(err, null);
              }
              zt.zrangebyscore(client, ['zset', 2, 5, 'LIMIT', 2, 3, 'WITHSCORES'], ['e', 4, 'f', 5], test_case, function (err, res) {
                if (err) {
                  cb(err, null);
                }
                zt.zrevrangebyscore(client, ['zset', 5, 2, 'LIMIT', 2, 3, 'WITHSCORES'], ['d', 3, 'c', 2], test_case, function (err, res) {
                  if (err) {
                    cb(err, null);
                  } else {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                });
              });
            });
          },
          y : function (cb) {
            var test_case = 'ZRANGEBYSCORE with non-value min or max';
            client.zrangebyscore('fooz', 'str', 1, function (err1, res) {
              client.zrangebyscore('fooz', 1, 'str', function (err2, res) {
                client.zrangebyscore('fooz', 1, 'NaN', function (err3, res) {
                  try {
                    if ((!assert.ok(ut.match('not a float', err1), test_case)) && (!assert.ok(ut.match('not a float', err2), test_case)) && (!assert.ok(ut.match('not a float', err3), test_case))) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                });
              });
            });
          },
          z : function (cb) {
            var test_case = 'ZREMRANGEBYRANK basics';
            async.series({
              z1 : function (zcb) {
                //inner range
                remrangebyscore([2, 4], 3, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['a', 'e'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z2 : function (zcb) {
                //start underflow
                remrangebyscore([-10, 1], 1, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['b', 'c', 'd', 'e'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z3 : function (zcb) {
                // end overflow
                remrangebyscore([5, 10], 1, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['a', 'b', 'c', 'd'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z4 : function (zcb) {
                // switch min and max
                remrangebyscore([4, 2], 0, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['a', 'b', 'c', 'd', 'e'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z5 : function (zcb) {
                // -inf to mid
                remrangebyscore([n_inf, 3], 3, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['d', 'e'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z6 : function (zcb) {
                //mid to +inf
                remrangebyscore([3, p_inf], 3, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['a', 'b'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z7 : function (zcb) {
                //-inf to +inf
                remrangebyscore([n_inf, p_inf], 5, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], [], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z8 : function (zcb) {
                //exclusive min
                remrangebyscore(['(' + 1, 5], 4, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['a'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    remrangebyscore(['(' + 2, 5], 3, test_case, function (err, res) {
                      if (err) {
                        zcb(err, null);
                      }
                      zt.zrange(client, ['zset', 0, -1], ['a', 'b'], test_case, function (err, res) {
                        if (err) {
                          zcb(err, null);
                        }
                        zcb(null, null);
                      });
                    });
                  });
                });
              },
              z9 : function (zcb) {
                //exclusive max
                remrangebyscore([1, '(' + 5], 4, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['e'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    remrangebyscore([1, '(' + 4], 3, test_case, function (err, res) {
                      if (err) {
                        zcb(err, null);
                      }
                      zt.zrange(client, ['zset', 0, -1], ['d', 'e'], test_case, function (err, res) {
                        if (err) {
                          zcb(err, null);
                        }
                        zcb(null, null);
                      });
                    });
                  });
                });
              },
              z10 : function (zcb) {
                // exclusive min and max
                remrangebyscore(['(' + 1, '(' + 5], 3, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  zt.zrange(client, ['zset', 0, -1], ['a', 'e'], test_case, function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    zcb(null, null);
                  });
                });
              },
              z11 : function (zcb) {
                // destroy when empty
                remrangebyscore([1, 5], 5, test_case, function (err, res) {
                  if (err) {
                    zcb(err, null);
                  }
                  client.exists('zset', function (err, res) {
                    if (err) {
                      zcb(err, null);
                    }
                    try {
                      if (!assert.equal(res, 0, test_case)) {
                        zcb(null, null);
                      }
                    } catch (e) {
                      zcb(e, null);
                    }

                  });
                });
              },

            }, function (err, rep) {
              if (err) {
                ut.fail(err, true);
                cb(err, null);
              } else {
                ut.pass(test_case);
                cb(null, null);
              }
            });
          },
          aa : function (cb) {
            var test_case = 'ZUNIONSTORE against non-existing key doesn\'t set destination - ' + enc[itr];
            client.del('zseta', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zunionstore('dst_key', 1, 'zseta', function (err, res1) {
                if (err) {
                  cb(err, null);
                }
                client.exists('dst_key', function (err, res2) {
                  if (err) {
                    cb(err, null);
                  }
                  try {
                    if ((!assert.equal(res1, 0, test_case)) && (!assert.equal(res2, 0, test_case))) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                });
              });
            });
          },
          ab : function (cb) {
            var test_case = 'ZUNIONSTORE with empty set - ' + enc[itr];
            client.del('zseta', 'zsetb', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('zseta', 1, 'a', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zadd('zseta', 2, 'b', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.zunionstore('zsetc', 2, 'zseta', 'zsetb', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zrange('zsetc', 0, -1, 'withscores', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      try {
                        if (!assert.deepEqual(res, ['a', 1, 'b', 2], test_case)) {
                          ut.pass(test_case);
                          cb(null, null);
                        }
                      } catch (e) {
                        ut.fail(e, true);
                        cb(e, null);
                      }
                    });
                  });
                });
              });
            });
          },
          ac : function (cb) {
            var test_case = 'ZUNIONSTORE basics - ' + enc[itr];
            client.del('zseta', 'zsetb', 'zsetc', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.zadd('zseta', 1, 'a', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zadd('zseta', 2, 'b', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.zadd('zseta', 3, 'c', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zadd('zsetb', 1, 'b', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      client.zadd('zsetb', 2, 'c', function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        client.zadd('zsetb', 3, 'd', function (err, res) {
                          if (err) {
                            cb(err, null);
                          }
                          client.zunionstore('zsetc', 2, 'zseta', 'zsetb', function (err, res1) {
                            if (err) {
                              cb(err, null);
                            }
                            client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                              if (err) {
                                cb(err, null);
                              }
                              try {
                                if ((!assert.deepEqual(res2, ['a', 1, 'b', 3, 'd', 3, 'c', 5], test_case)) && (!assert.equal(res1, 4, test_case))) {
                                  ut.pass(test_case);
                                  cb(null, null);
                                }
                              } catch (e) {
                                ut.fail(e, true);
                                cb(e, null);
                              }
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          },
          ad : function (cb) {
            var test_case = 'ZUNIONSTORE with weights - ' + enc[itr];
            client.zunionstore('zsetc', 2, 'zseta', 'zsetb', 'weights', 2, 3, function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.deepEqual(res2, ['a', 2, 'b', 7, 'd', 9, 'c', 12], test_case)) && (!assert.equal(res1, 4, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          ae : function (cb) {
            var test_case = 'ZUNIONSTORE with a regular set and weights - ' + enc[itr];
            client.del('seta', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.sadd('seta', 'a', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.sadd('seta', 'b', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.sadd('seta', 'c', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zunionstore('zsetc', 2, 'seta', 'zsetb', 'weights', 2, 3, function (err, res1) {
                      if (err) {
                        cb(err, null);
                      }
                      client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                        if (err) {
                          cb(err, null);
                        }
                        try {
                          if ((!assert.deepEqual(res2, ['a', 2, 'b', 5, 'c', 8, 'd', 9], test_case)) && (!assert.equal(res1, 4, test_case))) {
                            ut.pass(test_case);
                            cb(null, null);
                          }
                        } catch (e) {
                          ut.fail(e, true);
                          cb(e, null);
                        }
                      });
                    });
                  });
                });
              });
            });
          },
          af : function (cb) {
            var test_case = 'ZUNIONSTORE with AGGREGATE MIN - ' + enc[itr];
            client.zunionstore('zsetc', 2, 'zseta', 'zsetb', 'aggregate', 'min', function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.deepEqual(res2, ['a', 1, 'b', 1, 'c', 2, 'd', 3], test_case)) && (!assert.equal(res1, 4, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          ag : function (cb) {
            var test_case = 'ZUNIONSTORE with AGGREGATE MAX - ' + enc[itr];
            client.zunionstore('zsetc', 2, 'zseta', 'zsetb', 'aggregate', 'max', function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.deepEqual(res2, ['a', 1, 'b', 2, 'c', 3, 'd', 3], test_case)) && (!assert.equal(res1, 4, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          ah : function (cb) {
            var test_case = 'ZINTERSTORE basics - ' + enc[itr];
            client.zinterstore('zsetc', 2, 'zseta', 'zsetb', function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.deepEqual(res2, ['b', 3, 'c', 5], test_case)) && (!assert.equal(res1, 2, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          ai : function (cb) {
            var test_case = 'ZINTERSTORE with weights - ' + enc[itr];
            client.zinterstore('zsetc', 2, 'zseta', 'zsetb', 'weights', 2, 3, function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.deepEqual(res2, ['b', 7, 'c', 12], test_case)) && (!assert.equal(res1, 2, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          aj : function (cb) {
            var test_case = 'ZINTERSTORE with a regular set and weights - ' + enc[itr];
            client.del('seta', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.sadd('seta', 'a', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.sadd('seta', 'b', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.sadd('seta', 'c', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zinterstore('zsetc', 2, 'seta', 'zsetb', 'weights', 2, 3, function (err, res1) {
                      if (err) {
                        cb(err, null);
                      }
                      client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                        if (err) {
                          cb(err, null);
                        }
                        try {
                          if ((!assert.deepEqual(res2, ['b', 5, 'c', 8], test_case)) && (!assert.equal(res1, 2, test_case))) {
                            ut.pass(test_case);
                            cb(null, null);
                          }
                        } catch (e) {
                          ut.fail(e, true);
                          cb(e, null);
                        }
                      });
                    });
                  });
                });
              });
            });
          },
          ak : function (cb) {
            var test_case = 'ZINTERSTORE with AGGREGATE MIN - ' + enc[itr];
            client.zinterstore('zsetc', 2, 'zseta', 'zsetb', 'aggregate', 'min', function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.deepEqual(res2, ['b', 1, 'c', 2], test_case)) && (!assert.equal(res1, 2, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          al : function (cb) {
            var test_case = 'ZINTERSTORE with AGGREGATE MAX - ' + enc[itr];
            client.zinterstore('zsetc', 2, 'zseta', 'zsetb', 'aggregate', 'max', function (err, res1) {
              if (err) {
                cb(err, null);
              }
              client.zrange('zsetc', 0, -1, 'withscores', function (err, res2) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if ((!assert.deepEqual(res2, ['b', 2, 'c', 3], test_case)) && (!assert.equal(res1, 2, test_case))) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  ut.fail(e, true);
                  cb(e, null);
                }
              });
            });
          },
          am : function (cb) {
            var cmd = ['ZUNIONSTORE', 'ZINTERSTORE'];
            var error = '';
            g.asyncFor(0, cmd.length, function (loop) {
              var i = loop.iteration();
              async.series({
                am1 : function (amcb) {
                  var test_case = cmd[i] + ' with +inf/-inf scores - ' + enc[itr];
                  client.del('zsetinf1', 'zsetinf2', function (err, res) {
                    if (err) {
                      amcb(err, null);
                    }
                    client.zadd('zsetinf1', p_inf, 'key', function (err, res) {
                      if (err) {
                        amcb(err, null);
                      }
                      client.zadd('zsetinf2', p_inf, 'key', function (err, res) {
                        if (err) {
                          amcb(err, null);
                        }
                        client[cmd[i]]('zsetinf3', 2, 'zsetinf1', 'zsetinf2', function (err, res) {
                          if (err) {
                            amcb(err, null);
                          }
                          client.zscore('zsetinf3', 'key', function (err, res1) {
                            if (err) {
                              amcb(err, null);
                            }
                            client.zadd('zsetinf1', n_inf, 'key', function (err, res) {
                              if (err) {
                                amcb(err, null);
                              }
                              client.zadd('zsetinf2', p_inf, 'key', function (err, res) {
                                if (err) {
                                  amcb(err, null);
                                }
                                client[cmd[i]]('zsetinf3', 2, 'zsetinf1', 'zsetinf2', function (err, res) {
                                  if (err) {
                                    amcb(err, null);
                                  }
                                  client.zscore('zsetinf3', 'key', function (err, res2) {
                                    if (err) {
                                      amcb(err, null);
                                    }
                                    client.zadd('zsetinf1', p_inf, 'key', function (err, res) {
                                      if (err) {
                                        amcb(err, null);
                                      }
                                      client.zadd('zsetinf2', n_inf, 'key', function (err, res) {
                                        if (err) {
                                          amcb(err, null);
                                        }
                                        client[cmd[i]]('zsetinf3', 2, 'zsetinf1', 'zsetinf2', function (err, res) {
                                          if (err) {
                                            amcb(err, null);
                                          }
                                          client.zscore('zsetinf3', 'key', function (err, res3) {
                                            if (err) {
                                              amcb(err, null);
                                            }
                                            client.zadd('zsetinf1', n_inf, 'key', function (err, res) {
                                              if (err) {
                                                amcb(err, null);
                                              }
                                              client.zadd('zsetinf2', n_inf, 'key', function (err, res) {
                                                if (err) {
                                                  amcb(err, null);
                                                }
                                                client[cmd[i]]('zsetinf3', 2, 'zsetinf1', 'zsetinf2', function (err, res) {
                                                  if (err) {
                                                    amcb(err, null);
                                                  }
                                                  client.zscore('zsetinf3', 'key', function (err, res4) {
                                                    if (err) {
                                                      amcb(err, null);
                                                    }
                                                    try {
                                                      if ((!assert.deepEqual(res1, 'inf', test_case)) &&
                                                        (!assert.deepEqual(res2, 0, test_case)) &&
                                                        (!assert.deepEqual(res3, 0, test_case)) &&
                                                        (!assert.deepEqual(res4, '-inf', test_case))) {
                                                        ut.pass(test_case);
                                                        amcb(null, null);
                                                      }
                                                    } catch (e) {
                                                      ut.fail(e, true);
                                                      amcb(e, null);
                                                    }

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
                        });
                      });
                    });
                  });
                },
                am2 : function (amcb) {
                  var test_case = cmd[i] + ' with NaN weights - ' + enc[itr];
                  client.del('zsetinf1', 'zsetinf1', function (err, res) {
                    if (err) {
                      amcb(err, null);
                    }
                    client.zadd('zsetinf1', 1.0, 'key', function (err, res) {
                      if (err) {
                        amcb(err, null);
                      }
                      client.zadd('zsetinf2', 1.0, 'key', function (err, res) {
                        if (err) {
                          amcb(err, null);
                        }
                        client[cmd[i]]('zsetinf3', 2, 'zsetinf1', 'zsetinf2', 'weights', 'nan', 'nan', function (err, res) {
                          try {
                            if (!assert.ok(ut.match('not a float', err), test_case)) {
                              ut.pass(test_case);
                              amcb(null, null);
                            }
                          } catch (e) {
                            ut.fail(e, true);
                            amcb(e, null);
                          }
                        });
                      });
                    });
                  });
                },
              }, function (err, rep) {
                if (err) {
                  error = err;
                  loop.break();
                }
                loop.next();
              });
            }, function () {
              if (error != '')
                cb(error, null);
              else
                cb(null, null);
            });
          },

        }, function (err, rep) {
          if (err) {
            m_error = err;
            mloop.break();
          } else {
            mloop.next();
          }
        });
      });
    }, function () {
      if (m_error != '') {
        errorCallback(m_error);
      } else {
        testEmitter.emit('next');
      }
    });
  };

  tester.zset2 = function (errorCallback) {
    var res_array = []
    create_default_lex_zset(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      async.series({
        a : function (cb) {
          //# inclusive range
          var test_case = 'ZRANGEBYLEX/ZREVRANGEBYLEX/ZCOUNT basics - inclusive range';
          client.zrangebylex('zset', '-', '\[cool', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            res_array.push(res);
            client.zrangebylex('zset', '\[bar', '\[down', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              res_array.push(res);
              client.zrangebylex('zset', '\[g', '+', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                res_array.push(res);
                client.zrevrangebylex('zset', '\[cool', '-', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  res_array.push(res);
                  client.zrevrangebylex('zset', '\[down', '\[bar', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    res_array.push(res);
                    client.zrevrangebylex('zset', '+', '\[d', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      res_array.push(res);
                      client.zlexcount('zset', '\[ele', '\[h', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        res_array.push(res);
                        ut.assertDeepEqual([['alpha', 'bar', 'cool'], ['bar', 'cool', 'down'],
                            ['great', 'hill', 'omega'], ['cool', 'bar', 'alpha'], ['down', 'cool', 'bar'],
                            ['omega', 'hill', 'great', 'foo', 'elephant', 'down'], 3], res_array, test_case);
                        cb(null, true);
                      });
                    });
                  });
                });
              });
            });
          });
        },
        b : function (cb) {
          var test_case = 'ZRANGEBYLEX/ZREVRANGEBYLEX/ZCOUNT basics - exclusive range';
          res_array = [];
          client.zrangebylex('zset', '-', '(cool', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            res_array.push(res);
            client.zrangebylex('zset', '(bar', '(down', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              res_array.push(res);
              client.zrangebylex('zset', '(great', '+', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                res_array.push(res);
                client.zrevrangebylex('zset', '(cool', '-', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  res_array.push(res);
                  client.zrevrangebylex('zset', '(down', '(bar', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    res_array.push(res);
                  });
                  client.zrevrangebylex('zset', '+', '(great', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    res_array.push(res);
                    client.zlexcount('zset', '(ele', '(great', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      res_array.push(res);
                      ut.assertDeepEqual([['alpha', 'bar'], ['cool'],
                          ['hill', 'omega'], ['bar', 'alpha'], ['cool'],
                          ['omega', 'hill'], 2], res_array, test_case);
                      cb(null, true);
                    });
                  });
                });
              });
            });
          });
        },
        c : function (cb) {
          res_array = [];
          var test_case = 'ZRANGEBYLEX/ZREVRANGEBYLEX/ZCOUNT basics - inclusive and exclusive';
          client.zrangebylex('zset', '(az', '(b', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            res_array.push(res);
            client.zrangebylex('zset', '(z', '+', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              res_array.push(res);
              client.zrangebylex('zset', '-', '\[aaaa', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                res_array.push(res);
                client.zrevrangebylex('zset', '\[elez', '\[elex', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  res_array.push(res);
                  client.zrevrangebylex('zset', '(hill', '(omega', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    res_array.push(res);
                    ut.assertDeepEqual([[], [], [],
                        [], []], res_array, test_case);
                    cb(null, true);
                  });
                });
              });
            });
          });
        }
      }, function (err, rep) {
        testEmitter.emit('next');
      });
    });
  }

  tester.zset3 = function (errorCallback) {
    var test_case = 'ZRANGEBYSLEX with LIMIT';
    var res_array = [];
    create_default_lex_zset(function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.zrangebylex('zset', '-', '\[cool', 'LIMIT', 0, 2, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        res_array.push(res);
        client.zrangebylex('zset', '-', '\[cool', 'LIMIT', 1, 2, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          res_array.push(res);
          client.zrangebylex('zset', '\[bar', '\[down', 'LIMIT', 0, 0, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            res_array.push(res);
            client.zrangebylex('zset', '\[bar', '\[down', 'LIMIT', 2, 0, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              res_array.push(res);
              client.zrangebylex('zset', '\[bar', '\[down', 'LIMIT', 0, 1, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                res_array.push(res);
                client.zrangebylex('zset', '\[bar', '\[down', 'LIMIT', 1, 1, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  res_array.push(res);
                  client.zrangebylex('zset', '\[bar', '\[down', 'LIMIT', 0, 100, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    res_array.push(res);
                    client.zrevrangebylex('zset', '+', '\[d', 'LIMIT', 0, 5, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      res_array.push(res);
                      client.zrevrangebylex('zset', '+', '\[d', 'LIMIT', 0, 4, function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        res_array.push(res);
                        ut.assertDeepEqual([['alpha', 'bar'], ['bar', 'cool'],
                            [], [], ['bar'], ['cool'], ['bar', 'cool', 'down'], ['omega', 'hill', 'great', 'foo', 'elephant'],
                            ['omega', 'hill', 'great', 'foo']], res_array, test_case);
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

  tester.zset4 = function (errorCallback) {
    var test_case = 'ZRANGEBYLEX with invalid lex range specifiers';
    client.zrangebylex('fooz', 'foo', 'bar', function (err1, res) {
      client.zrangebylex('fooz', '\[foo', 'bar', function (err2, res) {
        client.zrangebylex('fooz', 'foo', '\[bar', function (err3, res) {
          client.zrangebylex('fooz', '+x', '\[bar', function (err4, res) {
            client.zrangebylex('fooz', '-x', '\[bar', function (err5, res) {
              ut.assertMany([
                  ['ok', (ut.match('not valid string', err1)), true],
                  ['ok', (ut.match('not valid string', err2)), true],
                  ['ok', (ut.match('not valid string', err3)), true],
                  ['ok', (ut.match('not valid string', err4)), true],
                  ['ok', (ut.match('not valid string', err5)), true],

                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  }

  tester.zset5 = function (errorCallback) {
    var test_case = 'ZINTERSTORE regression with two sets, intset+hashtable';
    client.del('seta', 'setb', 'setc', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('set1', 'a', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sadd('set2', 10, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.zinterstore('set3', 2, 'set1', 'set2', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.assertEqual(res, 0, test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.zset6 = function (errorCallback) {
    var test_case = 'ZUNIONSTORE regression, should not create NaN in scores';
    client.zadd('z', n_inf, 'neginf', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.zunionstore('out', 1, 'z', 'weights', 0, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.zrange('out', 0, -1, 'withscores', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertDeepEqual(res, ['neginf', 0], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.zset7 = function (errorCallback) {
    var stresser = new Array('ziplist', 'skiplist');
    var n_error = '',
    elements = '';
    g.asyncFor(0, stresser.length, function (nloop) {
      var itr = nloop.iteration();
      if (stresser[itr] == 'ziplist') {
        elements = 128;
      } else {
        elements = 100;
      }
      zt.stressers(client, stresser[itr], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        async.series({
          one : function (cb) {
            var test_case = 'ZSCORE - ' + stresser[itr];
            var error = '';
            client.del('zscoretest', function (err, res) {
              if (err) {
                cb(err, null);
              }
              var aux = [];
              g.asyncFor(0, elements, function (loop) {
                var score = Math.random();
                aux.push(score);
                client.zadd('zscoretest', score, loop.iteration(), function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  loop.next();
                });
              }, function () {
                assert_encoding(stresser[itr], 'zscoretest', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  g.asyncFor(0, elements, function (loop) {
                    var i = loop.iteration();
                    client.zscore('zscoretest', i, function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      try {
                        if (!assert.deepEqual(parseInt(res), parseInt(aux[i]), test_case)) {
                          loop.next();
                        }
                      } catch (e) {
                        cb(e, null);
                      }
                    });
                  }, function () {
                    ut.pass(test_case);
                    cb(null, null);
                  });
                });
              });

            });
          },
          two : function (cb) {
            var test_case = 'ZSCORE after a DEBUG RELOAD - ' + stresser[itr];
            client.del('zscoretest', function (err, res) {
              if (err) {
                cb(err, null);
              }
              var aux = [];
              g.asyncFor(0, elements, function (loop) {
                var score = Math.random();
                aux.push(score);
                client.zadd('zscoretest', score, loop.iteration(), function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  loop.next();
                });
              }, function () {
                client.debug('reload', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  assert_encoding(stresser[itr], 'zscoretest', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    g.asyncFor(0, elements, function (loop) {
                      var i = loop.iteration();
                      client.zscore('zscoretest', i, function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        try {
                          if (!assert.deepEqual(parseInt(res), parseInt(aux[i]), test_case)) {
                            loop.next();
                          }
                        } catch (e) {
                          cb(e, null);
                        }
                      });
                    }, function () {
                      ut.pass(test_case);
                      cb(null, null);
                    });
                  });
                });
              });

            });
          },
          three : function (cb) {
            var test_case = 'ZSET sorting stresser - ' + stresser[itr];
            var delta = 0,
            score = 0;
            g.asyncFor(0, 2, function (outerloop) {
              var test = outerloop.iteration();
              var auxarray = {};
              var auxlist = [];
              client.del('myzset', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                g.asyncFor(0, elements, function (innerloop1) {
                  var i = innerloop1.iteration();
                  if (test == 0) {
                    score = Math.random();
                  } else {
                    score = g.randomInt(10);
                  }
                  auxarray[i] = score;
                  client.zadd('myzset', score, i, function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    //Random Update
                    var rand = Math.random();
                    if (rand < 0.2) {
                      var j = g.randomInt(1000);
                      if (test == 0) {
                        score = Math.random();
                      } else {
                        score = g.randomInt(10);
                      }
                      auxarray[j] = score;
                      client.zadd('myzset', score, j, function (err, res) {
                        if (err) {
                          cb(err, null);
                        }
                        innerloop1.next();
                      });
                    } else {
                      innerloop1.next();
                    }
                  });
                }, function () {
                  for (key in auxarray) {
                    if (auxarray.hasOwnProperty(key)) {
                      auxlist.push([auxarray[key], key]);
                    }
                  }
                  var sorted = auxlist.sort(ut.zlistAlikeSort);
                  auxlist = [];
                  for (var i = 0; i < sorted.length; i++) {
                    auxlist[i] = sorted[i][1];
                  };
                  assert_encoding(stresser[itr], 'myzset', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    client.zrange('myzset', 0, -1, function (err, fromredis) {
                      if (err) {
                        cb(err, null);
                      }
                      delta = 0;
                      for (var i = 0; i < fromredis.length; i++) {
                        if (fromredis[i] !== auxlist[i])
                          delta++;
                      }
                      outerloop.next();
                    });
                  });

                });
              });
            }, function () {
              try {
                if (!assert.equal(delta, 0, test_case)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                cb(e, null);
              }
            });
          },
          four : function (cb) {
            var test_case = 'ZRANGEBYSCORE fuzzy test, 100 ranges in 128 element sorted set - ' + stresser[itr];
            var error = [],
            low = '',
            lowx = '',
            ok = '',
            okx = '',
            high = '',
            highx = '';
            client.del('zset', function (err, res) {
              if (err) {
                cb(err, null);
              }
              g.asyncFor(0, elements, function (loop) {
                client.zadd('zset', Math.random(), loop.iteration(), function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  loop.next();
                });
              }, function () {
                assert_encoding(stresser[itr], 'zset', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  g.asyncFor(0, 100, function (loop) {
                    var aur = '';
                    var min = Math.random();
                    var max = Math.random();
                    if (min > max) {
                      aux = min;
                      min = max;
                      max = aux;
                    }
                    async.series({
                      f1 : function (fcb) {
                        client.zrangebyscore('zset', n_inf, min, function (err, res) {
                          if (err) {
                            fcb(err, null);
                          }
                          low = res;
                          client.zrangebyscore('zset', min, max, function (err, res) {
                            if (err) {
                              fcb(err, null);
                            }
                            ok = res;
                            client.zrangebyscore('zset', max, p_inf, function (err, res) {
                              if (err) {
                                fcb(err, null);
                              }
                              high = res;
                              client.zrangebyscore('zset', n_inf, '(' + min, function (err, res) {
                                if (err) {
                                  fcb(err, null);
                                }
                                lowx = res;
                                client.zrangebyscore('zset', '(' + min, '(' + max, function (err, res) {
                                  if (err) {
                                    fcb(err, null);
                                  }
                                  okx = res;
                                  client.zrangebyscore('zset', '(' + max, p_inf, function (err, res) {
                                    if (err) {
                                      fcb(err, null);
                                    }
                                    highx = res;
                                    fcb(null, null);
                                  });
                                });
                              });
                            });
                          });
                        });
                      },
                      f2 : function (fcb) {
                        client.zcount('zset', n_inf, min, function (err, res) {
                          if (err) {
                            fcb(err, null);
                          }
                          if (res !== low.length)
                            error.push('Error, len does not match zcount\n');
                          fcb(null, null);
                        });
                      },
                      f3 : function (fcb) {
                        client.zcount('zset', min, max, function (err, res) {
                          if (err) {
                            fcb(err, null);
                          }
                          if (res !== ok.length)
                            error.push('Error, len does not match zcount\n');
                          fcb(null, null);
                        });
                      },
                      f4 : function (fcb) {
                        client.zcount('zset', max, p_inf, function (err, res) {
                          if (err) {
                            fcb(err, null);
                          }
                          if (res !== high.length)
                            error.push('Error, len does not match zcount\n');
                          fcb(null, null);
                        });
                      },
                      f5 : function (fcb) {
                        client.zcount('zset', n_inf, '(' + min, function (err, res) {
                          if (err) {
                            fcb(err, null);
                          }
                          if (res !== lowx.length)
                            error.push('Error, len does not match zcount\n');
                          fcb(null, null);
                        });
                      },
                      f6 : function (fcb) {
                        client.zcount('zset', '(' + min, '(' + max, function (err, res) {
                          if (err) {
                            fcb(err, null);
                          }
                          if (res !== okx.length)
                            error.push('Error, len does not match zcount\n');
                          fcb(null, null);
                        });
                      },
                      f7 : function (fcb) {
                        client.zcount('zset', '(' + max, p_inf, function (err, res) {
                          if (err) {
                            fcb(err, null);
                          }
                          if (res !== highx.length)
                            error.push('Error, len does not match zcount\n');
                          fcb(null, null);
                        });
                      },
                      f8 : function (fcb) {
                        g.asyncFor(0, low.length, function (loop) {
                          var x = low[loop.iteration()];
                          client.zscore('zset', x, function (err, res) {
                            if (err) {
                              fcb(err, null);
                            }
                            if (res > min)
                              error.push('Error, score for ' + x + ' is ' + res + ' > ' + min + '\n');
                            loop.next();
                          });
                        }, function () {
                          fcb(null, null);
                        })
                      },
                      f9 : function (fcb) {
                        g.asyncFor(0, lowx.length, function (loop) {
                          var x = lowx[loop.iteration()];
                          client.zscore('zset', x, function (err, res) {
                            if (err) {
                              fcb(err, null);
                            }
                            if (res >= min)
                              error.push('Error, score for ' + x + ' is ' + res + ' >= ' + min + '\n');
                            loop.next();
                          });
                        }, function () {
                          fcb(null, null);
                        })
                      },
                      f10 : function (fcb) {
                        g.asyncFor(0, ok.length, function (loop) {
                          var x = ok[loop.iteration()];
                          client.zscore('zset', x, function (err, res) {
                            if (err) {
                              fcb(err, null);
                            }
                            if (res < min || res > max)
                              error.push('Error, score for ' + x + ' is ' + res + ' outside ' + min + '-' + max + ' range\n');
                            loop.next();
                          });
                        }, function () {
                          fcb(null, null);
                        })
                      },
                      f11 : function (fcb) {
                        g.asyncFor(0, okx.length, function (loop) {
                          var x = okx[loop.iteration()];
                          client.zscore('zset', x, function (err, res) {
                            if (err) {
                              fcb(err, null);
                            }
                            if (res <= min || res >= max)
                              error.push('Error, score for ' + x + ' is ' + res + ' outside ' + min + '-' + max + ' open range\n');
                            loop.next();
                          });
                        }, function () {
                          fcb(null, null);
                        })
                      },
                      f12 : function (fcb) {
                        g.asyncFor(0, high.length, function (loop) {
                          var x = high[loop.iteration()];
                          client.zscore('zset', x, function (err, res) {
                            if (err) {
                              fcb(err, null);
                            }
                            if (res < max)
                              error.push('Error, score for ' + x + ' is ' + res + ' < ' + max + '\n');
                            loop.next();
                          });
                        }, function () {
                          fcb(null, null);
                        })
                      },
                      f13 : function (fcb) {
                        g.asyncFor(0, highx.length, function (loop) {
                          var x = highx[loop.iteration()];
                          client.zscore('zset', x, function (err, res) {
                            if (err) {
                              fcb(err, null);
                            }
                            if (res <= max)
                              error.push('Error, score for ' + x + ' is ' + res + ' <= ' + max + '\n');
                            loop.next();
                          });
                        }, function () {
                          fcb(null, null);
                        })
                      },

                    }, function (err, rep) {
                      if (err) {
                        cb(err, null);
                      }
                      loop.next();
                    });

                  }, function () {
                    if (error.length != 0) {
                      cb(new Error(error.toString()), null);
                    } else {
                      ut.pass(test_case);
                      cb(null, null);
                    }

                  });
                });
              });
            });
          },
          five : function (cb) {
            var test_case = 'ZSETs skiplist implementation backlink consistency test - ' + stresser[itr];
            var diff = 0;
            g.asyncFor(0, elements, function (loop) {
              client.zadd('myzset', Math.random(), 'Element-' + loop.iteration(), function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zrem('myzset', 'Element-' + g.randomInt(elements), function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  loop.next();
                });
              });
            }, function () {
              assert_encoding(stresser[itr], 'myzset', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.zrange('myzset', 0, -1, function (err, l1) {
                  if (err) {
                    cb(err, null);
                  }
                  client.zrevrange('myzset', 0, -1, function (err, l2) {
                    if (err) {
                      cb(err, null);
                    }
                    for (var j = 0; j < l1.length; j++) {
                      if (l1[j] !== l2[l2.length - j - 1]) {
                        diff++;
                      }
                    }
                    try {
                      if (!assert.equal(diff, 0, test_case)) {
                        ut.pass(test_case);
                        cb(null, null);
                      }
                    } catch (e) {
                      cb(e, null);
                    }
                  });
                });
              });
            });

          },
          six : function (cb) {
            var test_case = 'ZSETs ZRANK augmented skip list stress testing - ' + stresser[itr];
            var error = [],
            i = 0;
            client.del('myzset', function (err, res) {
              if (err) {
                cb(err, null);
              }
              g.asyncFor(0, 2000, function (loop) {
                async.series({
                  s1 : function (scb) {
                    i = loop.iteration() % elements;
                    var rand = Math.random();
                    if (rand < 0.2) {
                      client.zrem('myzset', i, function (err, res) {
                        if (err) {
                          scb(err, null);
                        }
                        scb(null, null);
                      });
                    } else {
                      var score = Math.random();
                      client.zadd('myzset', score, i, function (err, res) {
                        if (err) {
                          scb(err, null);
                        }
                        assert_encoding(stresser[itr], 'myzset', function (err, res) {
                          if (err) {
                            scb(err, null);
                          }
                          scb(null, null);
                        })
                      });
                    }
                  },
                  s2 : function (scb) {
                    client.zcard('myzset', function (err, card) {
                      if (err) {
                        scb(err, null);
                      }
                      if (card > 0) {
                        var index = g.randomInt(card) - 1;
                        client.zrange('myzset', index, index, function (err, res) {
                          if (err) {
                            scb(err, null);
                          }
                          var ele = res[0];
                          client.zrank('myzset', ele, function (err, rank) {
                            if (rank !== index) {
                              error.push(ele + ' RANK is wrong! (' + rank + ' != ' + index + ' )');
                              scb(error, null);
                            }
                            scb(null, null);
                          });
                        });
                      } else {
                        scb(null, null);
                      }
                    });
                  },
                }, function (err, rep) {
                  if (err) {
                    cb(err, null);
                  }
                  loop.next();
                });
              }, function () {
                try {
                  if (!assert.equal(error, '', test_case)) {
                    ut.pass(test_case);
                    cb(null, null);
                  }
                } catch (e) {
                  cb(e, null);
                }
              });
            });
          },

        }, function (err, rep) {
          if (err) {
            n_error = err;
            nloop.break();
          }
          nloop.next();
        });
      });

    }, function () {
      if (n_error !== '') {
        errorCallback(n_error);
      } else {
        testEmitter.emit('next');
      }
    });
  };

  tester.zset8 = function (errorCallback) {
    var enc = new Array('ziplist', 'skiplist');
    var itype = 0,
    lexset = [],
    elements = 128,
    e = '',
    error = false; ;
    g.asyncFor(0, enc.length, function (type) {
      itype = type.iteration();
      var test_case = 'ZRANGEBYLEX fuzzy test, 100 ranges in 128 element sorted set - ' + enc[itype];
      client.del('zset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        g.asyncFor(0, elements, function (loop) {
          e = ut.randstring(0, 30, 'alpha');
          lexset.push(e);
          client.zadd('zset', 0, e, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            loop.next();
          });
        }, function () {
          lexset = lexset.sort();
          var min = '',
          max = '',
          mininc = 0,
          maxinc = 0,
          cmin,
          cmax,
          rev,
          cmd,
          o,
          copy;
          g.asyncFor(0, 100, function (loop) {
            min = ut.randstring(0, 30, 'alpha');
            max = ut.randstring(0, 30, 'alpha');
            mininc = parseInt(ut.randomInt(2));
            maxinc = parseInt(ut.randomInt(2));
            cmin = (mininc) ? '\[$min' : '($min';
            cmax = (maxinc) ? '\[$max' : '($max';
            rev = ut.randomInt(2);
            cmd = (rev) ? 'zrevrangebylex' : 'zrangebylex';
            //#  Make sure data is the same in both sides
            client.zrange('zset', 0, -1, function (err, lexset) {
              if (err) {
                errorCallback(err);
              }
              //# Get the Redis output
              client.write(ut.formatCommand([cmd, 'zset', cmin, cmax]), function (err, output_res) {
                if (err) {
                  errorCallback(err);
                }
                if (rev)
                  cmd = ['zlexcount', 'zset', cmax, cmin];
                else
                  cmd = ['zlexcount', 'zset', cmin, cmax];
                client.write(ut.formatCommand(cmd), function (err, outlen) {
                  if (err) {
                    errorCallback(err);
                  }
                  try {
                    if (!assert.equal(output_res.length, outlen, test_case))
                      loop.next();
                  } catch (e) {
                    error = true;
                    ut.fail(e);
                    loop.break();
                  }
                });
              });
            });
          }, function () {
			if(!error)
				ut.pass(test_case);
            type.next();
          });
        });
      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  
  tester.zset9 = function (errorCallback) {
    var enc = new Array('ziplist', 'skiplist');
    var itype = 0,
    lexset = [],
	elements = 128
    e = '',
    error = false;
    g.asyncFor(0, enc.length, function (type) {
      itype = type.iteration();
      var test_case = 'ZREMRANGEBYLEX fuzzy test, 100 ranges in ' + elements + ' element sorted set - ' + enc[itype];
	  lexset = [];
	  client.del('zset', 'zsetcopy', function(err, res){
		if(err){
			errorCallback(err);
		}
		g.asyncFor(0, elements, function (loop) {
			e = ut.randstring(0, 30, 'alpha');
			lexset.push(e);
			client.zadd('zset', 0, e, function(err, res){
				if(err){
					errorCallback(err);
				}
				loop.next();
			});			
		}, function(){
			var min, max, mininc, maxinc, cmin, cmax, output, first, last, lexsetcopy
			lexset = lexset.sort();
			g.asyncFor(0, 100, function (loop) {
				//# Copy...
				client.zunionstore('zsetcopy', 1, 'zset', function(err, res){
					if(err){
						errorCallback(err);
					}
					lexsetcopy = lexset.slice(0);
					min = ut.randstring(0, 30, 'alpha');
					max = ut.randstring(0, 30, 'alpha');
					mininc = parseInt(ut.randomInt(2));
					maxinc = parseInt(ut.randomInt(2));
					cmin  = (mininc) ? '\[$min' : '($min';
					cmax  = (maxinc) ? '\[$max' : '($max';
					client.zrange('zset', 0, -1, function(err, res){
						if(err){
							errorCallback(err);
						}
						client.zrangebylex('zset', cmin, cmax, function(err, torem){
							if(err){
								errorCallback(err);
							}
							client.zlexcount('zset', cmin, cmax, function(err, toremlen){
								if(err){
									errorCallback(err);
								}
								client.zremrangebylex('zsetcopy', cmin, cmax, function(err, res){
									if(err){
										errorCallback(err);
									}
									client.zrange('zsetcopy', 0, -1, function(err, output){
										if(err){
											errorCallback(err);
										}
										//# Remove the range with Js from the original list
										if(toremlen){
											first = lexsetcopy.indexOf(torem[0]);
											last = first + toremlen - 1;
											console.log(lexsetcopy);
										}
										try{
											if(!assert.equal(lexsetcopy.toString(), output.toString(), test_case))
												loop.next();
										} catch(e){
											error = true;
											ut.fail(e);
											loop.break();
										}										
									});
								});
							});
						});
					});
				});
			}, function(){
				if(!error)
					ut.pass(test_case);
				type.next();
			});
		});
	  });
    }, function () {
      testEmitter.emit('next');
    });
  }

  // 2.6 addition
  tester.zset10 = function (errorCallback) {
    var test_case = 'ZINTERSTORE #516 regression, mixed sets and ziplist zsets';
    client.sadd('one', 100, 101, 102, 103, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('two', 100, 200, 201, 202, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.zadd('three', 1, 500, 1, 501, 1, 502, 1, 503, 1, 100, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.zinterstore('to_here', 3, 'one', 'two', 'three', 'WEIGHTS', 0, 0, 1, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.zrange('to_here', 0, -1, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              ut.assertDeepEqual(res, [100], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  }

  tester.zset11 = function (errorCallback) {
    var test_case = 'ZREMRANGEBYRANK with WITHSCORES';
    client.del('myzset');
    client.zadd('myzset', 1, 'one', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.zadd('myzset', 2, 'two', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.zadd('myzset', 3, 'three', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.zremrangebyrank('myzset', 0, 1, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.zrange('myzset', 0, -1, 'WITHSCORES', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              ut.assertDeepEqual(res, ['three', '3'], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });

  }

  tester.zset12 = function (errorCallback) {
    var test_case = 'ZREMRANGEBYRANK - Error invalid Floats';
    var res_Array = [];
    client.del('myzset');
    client.zadd('myzset', 1, 'one');
    client.zadd('myzset', 2, 'two');
    client.zadd('myzset', 3, 'three');
    client.zscore('myzset', 'a', function (err, res) {
      client.zremrangebyrank('myzset', 0, 1, function (err, res) {
        res_Array.push(res);
        client.zremrangebyrank('myzset', -1e-1, 1, function (err1, res) {
          client.zremrangebyrank('myzset', -1, 0, function (err, res) {
            res_Array.push(res);
            for (var i = 0; i < 1111; i++)
              client.zadd('myzset', i, i);
            client.zremrangebyrank('myzset', 0, 1, function (err, res) {
              res_Array.push(res);
              client.zremrangebyscore('myzset', 'a', 1.4, function (err2, res) {
                client.zcount('myzset', 'a', '', function (err3, res) {
                  client.zscore('myzset', 1, function (err, res) {
                    ut.assertMany(
                      [
                        ['ok', "ERR", err1],
                        ['ok', "ERR min or max is not a float", err2],
                        ['ok', "ERR min or max is not a float", err3],
                        ['deepequal', res_Array, [2, 1, 2]]
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

  return zset;

}
  ());
