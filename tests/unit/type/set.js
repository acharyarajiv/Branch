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

exports.Set = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  set = {},
  name = 'Set',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {};

  //public property
  set.debug_mode = true;

  //public method
  set.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'set';
      var overrides = {};
      overrides['set-max-intset-entries'] = 512;
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
          if (set.debug_mode) {
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

    if (set.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods
  function assert_encoding(enc, key, callback) {
    client.object('encoding', key, function (error, res) {
      if (error) {
        callback(error, null);
      }
      var pattern = /( swapped at: )/;
      while (pattern.test(res)) {
        client.debug('swapin', key, function (err, res) {
          if (err) {
            callback(err, null);
          }
          client.debug('object', key, function (err, res) {
            if (err) {
              callback(err, null);
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
        console.log(e);
        callback(e, null);
      }
    });
  };
  function create_set(key, entries, callback) {
    client.del(key, function (err, res) {
      if (err) {
        callback(err);
      }
      g.asyncFor(0, entries.length, function (loop) {
        client.sadd(key, entries[loop.iteration()], function (err, res) {
          if (err) {
            callback(err, null);
          }
          loop.next();
        });
      }, function () {
        callback(null, true)
      });
    });
  };
  function sadd_loop(type, callback) {
    async.series({
      a : function (cb) {
        g.asyncFor(1, 5 + 1, function (loop) {
          var v = 'set' + loop.iteration();
          client.del(v, function (err, res) {
            if (err) {
              callback(err, null);
            }
            loop.next();
          });
        }, function () {
          cb(null);
        });
      },
      b : function (cb) {
        g.asyncFor(0, 200, function (loop) {
          var i = loop.iteration();
          client.sadd('set1', i, function (err, res) {
            if (err) {
              callback(err, null);
            }
            client.sadd('set2', i + 195, function (err, res) {
              if (err) {
                callback(err, null);
              }
              loop.next();
            });
          });
        }, function () {
          cb(null);
        });
      },
      c : function (cb) {
        var n = [199, 195, 1000, 2000];
        g.asyncFor(0, n.length, function (loop) {
          var i = loop.iteration();
          client.sadd('set3', n[i], function (err, res) {
            if (err) {
              callback(err, null);
            }
            loop.next();
          });
        }, function () {
          cb(null);
        });
      },
      d : function (cb) {
        g.asyncFor(5, 200, function (loop) {
          client.sadd('set4', loop.iteration(), function (err, res) {
            if (err) {
              callback(err, null);
            }
            loop.next();
          });
        }, function () {
          cb(null);
        });
      },
      e : function (cb) {
        client.sadd('set5', 0, function (err, res) {
          if (err) {
            callback(err, null);
          }
          cb(null);
        });
      },
      f : function (cb) {
        //To make sure the sets are encoded as the type we are testing --
        //also when the VM is enabled and the values may be swapped in and
        //out while the tests are running -- an extra element is added to
        //every set that determines its encoding.
        if (type === 'hashtable')
          large = 'foo';
        else
          large = 200;
        g.asyncFor(1, 5 + 1, function (loop) {
          var v = 'set' + loop.iteration();
          client.sadd(v, large, function (err, res) {
            if (err) {
              callback(err, null);
            }
            loop.next();
          });
        }, function () {
          cb(null);
        });
      },
    }, function (err, rep) {
      callback(null, true);
    });
  };

  tester.set1 = function (errorCallback) {
    var test_case = 'SADD, SCARD, SISMEMBER, SMEMBERS basics - regular set';
    var result_array = new Array();
    create_set('myset', ['foo'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('hashtable', 'myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sadd('myset', 'bar', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.sadd('myset', 'bar', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.scard('myset', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.sismember('myset', 'foo', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.sismember('myset', 'bar', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  client.sismember('myset', 'bla', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    client.smembers('myset', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      result_array.push(res.sort());
                      ut.assertDeepEqual(result_array, [1, 0, 2, 1, 1, 0, ['bar', 'foo']], test_case);
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
  tester.set2 = function (errorCallback) {
    var test_case = 'SADD, SCARD, SISMEMBER, SMEMBERS basics - intset';
    var result_array = new Array();
    create_set('myset', [17], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('intset', 'myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sadd('myset', 16, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.sadd('myset', 16, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.scard('myset', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res);
              client.sismember('myset', 16, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res);
                client.sismember('myset', 17, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  result_array.push(res);
                  client.sismember('myset', 18, function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    result_array.push(res);
                    client.smembers('myset', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      result_array.push(res.sort());
                      ut.assertDeepEqual(result_array, [1, 0, 2, 1, 1, 0, ['16', '17']], test_case);
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
  tester.set3 = function (errorCallback) {
    var test_case = 'SADD against non set';
    client.lpush('mylist', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('mylist', 'bar', function (err, res) {
        ut.assertOk('WRONGTYPE', err, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.set4 = function (errorCallback) {
    var test_case = 'SADD a non-integer against an intset';
    var entry = new Array(1, 2, 3);
    create_set('myset', entry, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('intset', 'myset', function (err, res) {
        client.sadd('myset', 'a', function (err, result) {
          if (err) {
            errorCallback(err);
          }
          assert_encoding('hashtable', 'myset', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.assertMany(
              [
                ['equal', result, 1],
                ['ok', res, null]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.set5 = function (errorCallback) {
    var test_case = 'SADD an integer larger than 64 bits';
    var entry = new Array();
    entry[0] = 213244124402402314402033402;
    create_set('myset', entry, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('hashtable', 'myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sismember('myset', entry[0], function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 1, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.set6 = function (errorCallback) {
    var test_case = 'SADD overflows the maximum allowed integers in an intset';
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, 512, function (loop) {
        var i = loop.iteration();
        client.sadd('myset', i, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          loop.next();
        });
      }, function () {
        assert_encoding('intset', 'myset', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.sadd('myset', 512, function (err, result) {
            if (err) {
              errorCallback(err);
            }
            assert_encoding('hashtable', 'myset', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              ut.assertMany(
                [
                  ['equal', result, 1],
                  ['ok', res, null]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.set7 = function (errorCallback) {
    var test_case = 'Variadic SADD';
    var result_array = new Array();
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 'a', 'b', 'c', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res);
        client.sadd('myset', 'A', 'a', 'b', 'c', 'B', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.smembers('myset', function (err, res) {
            ut.assertMany(
              [
                ['deepequal', res.sort(), ['A', 'B', 'a', 'b', 'c'].sort()],
                ['deepequal', result_array, [3, 2]]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.set8 = function (errorCallback) {
    var test_case = 'Set encoding after DEBUG RELOAD';
    client.del('myintset', 'myhashset', 'mylargeintset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      async.series({
        one : function (cb) {
          g.asyncFor(0, 100, function (loop) {
            var i = loop.iteration();
            client.sadd('myintset', i, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              loop.next();
            });
          }, function () {
            cb(null);
          });
        },
        two : function (cb) {
          g.asyncFor(0, 1280, function (loop) {
            var i = loop.iteration();
            client.sadd('mylargeintset', i, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              loop.next();
            });
          }, function () {
            cb(null);
          });
        },
        three : function (cb) {
          g.asyncFor(0, 256, function (loop) {
            var i = loop.iteration();
            var v = '';
            if (i <= 9)
              v = 'i00' + i;
            else if (i <= 99)
              v = 'i0' + i;
            else
              v = 'i' + i;
            client.sadd('myhashset', v, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              loop.next();
            });
          }, function () {
            cb(null);
          });
        },
      }, function (err, rep) {
        assert_encoding('intset', 'myintset', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          assert_encoding('hashtable', 'mylargeintset', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            assert_encoding('hashtable', 'myhashset', function (err, res) {
              if (err) {
                errorCallback(err)
              }
              client.debug('reload', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                assert_encoding('intset', 'myintset', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  assert_encoding('hashtable', 'mylargeintset', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    assert_encoding('hashtable', 'myhashset', function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      ut.assertEqual(res, true, test_case);
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
  tester.set9 = function (errorCallback) {
    var test_case = 'SREM basics - regular set';
    var entry = new Array('foo', 'bar', 'ciao');
    var result_array = new Array();
    create_set('myset', entry, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('hashtable', 'myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.srem('myset', 'qux', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.srem('myset', 'foo', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.smembers('myset', function (err, res) {
              ut.assertMany(
                [
                  ['equal', res.sort().toString(), 'bar,ciao'],
                  ['deepequal', result_array, [0, 1]]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.set10 = function (errorCallback) {
    var test_case = 'SREM basics - intset';
    var entry = new Array(3, 4, 5);
    var result_array = new Array();
    create_set('myset', entry, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('intset', 'myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.srem('myset', 6, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.srem('myset', 4, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.smembers('myset', function (err, res) {
              ut.assertMany(
                [
                  ['equal', res.sort().toString(), '3,5'],
                  ['ok', result_array, [0, 1]]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.set11 = function (errorCallback) {
    var test_case = 'SREM with multiple arguments';
    var result_array = new Array();
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 'a', 'b', 'c', 'd', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.srem('myset', 'k', 'k', 'k', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res);
          client.srem('myset', 'b', 'd', 'x', 'y', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res);
            client.smembers('myset', function (err, res) {
              ut.assertMany(
                [
                  ['equal', res.sort(), 'a,c'],
                  ['deepequal', result_array, [0, 2]]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  tester.set12 = function (errorCallback) {
    var test_case = 'SREM variadic version with more args needed to destroy the key';
    client.del('myset', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('myset', 1, 2, 3, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.srem('myset', 1, 2, 3, 4, 5, 6, 7, 8, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 3, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.set13_1 = function (errorCallback) {
    var t = new Array('hashtable', 'intset');
    var errors = new Array();
    var large = {};
    large[t[0]] = 'foo';
    large[t[1]] = 200;
    g.asyncFor(0, t.length, function (mloop) {
      var type = t[mloop.iteration()];
      sadd_loop(type, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        async.series({
          one : function (cb) {
            var test_case = 'Generated sets must be encoded as ' + type;
            var error = '';
            g.asyncFor(1, 5 + 1, function (loop) {
              var i = loop.iteration();
              var v = 'set' + i;
              assert_encoding(type, v, function (err, res) {
                if (err) {
                  error = err;
                  loop.break();
                }
                loop.next();
              });
            }, function () {
              try {
                if (!assert.equal(error, '', test_case + error)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(e, null);
              }
            });
          },
          two : function (cb) {
            var test_case = 'SINTER with two sets - ' + type;
            client.sinter('set1', 'set2', function (err, res) {
              if (err) {
                cb(err, null);
              }
              try {
                if (!assert.deepEqual(res.sort(), ['195', '196', '197', '198', '199', large[type]], test_case)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(e, null);
              }
            });
          },
          three : function (cb) {
            var test_case = 'SINTERSTORE with two sets - ' + type;
            client.sinterstore('setres', 'set1', 'set2', function (err, res) {
              if (err) {
                cb(err, null);
              }
              assert_encoding(type, 'setres', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.smembers('setres', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  try {
                    if (!assert.deepEqual(res.sort(), ['195', '196', '197', '198', '199', large[type]], test_case)) {
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
          four : function (cb) {
            var test_case = 'SINTERSTORE with two sets, after a DEBUG RELOAD  - ' + type;
            client.debug('reload', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.sinterstore('setres', 'set1', 'set2', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                assert_encoding(type, 'setres', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.smembers('setres', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    try {
                      if (!assert.deepEqual(res.sort(), ['195', '196', '197', '198', '199', large[type]], test_case)) {
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
          five : function (cb) {
            var test_case = 'SUNION with two sets - ' + type;
            client.smembers('set1', function (err, s1) {
              if (err) {
                cb(err, null);
              }
              client.smembers('set2', function (err, s2) {
                if (err) {
                  cb(err, null);
                }
                var expected = ut.removeDuplicates(s1.concat(s2)).sort();
                client.sunion('set1', 'set2', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  try {
                    if (!assert.deepEqual(res.sort(), expected, test_case)) {
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
          six : function (cb) {
            var test_case = 'SUNIONSTORE with two sets  - ' + type;
            client.sunionstore('setres', 'set1', 'set2', function (err, res) {
              if (err) {
                cb(err, null);
              }
              assert_encoding(type, 'setres', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                client.smembers('set1', function (err, s1) {
                  if (err) {
                    cb(err, null);
                  }
                  client.smembers('set2', function (err, s2) {
                    if (err) {
                      cb(err, null);
                    }
                    var expected = ut.removeDuplicates(s1.concat(s2)).sort();
                    client.smembers('setres', function (err, res) {
                      if (err) {
                        cb(err, null);
                      }
                      try {
                        if (!assert.deepEqual(res.sort(), expected, test_case)) {
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
          seven : function (cb) {
            var test_case = 'SINTER against three sets - ' + type;
            client.sinter('set1', 'set2', 'set3', function (err, res) {
              if (err) {
                cb(err, null);
              }
              try {
                if (!assert.deepEqual(res.sort(), ['195', '199', large[type]], test_case)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(e, null);
              }
            });
          },
          eight : function (cb) {
            var test_case = 'SINTERSTORE with three sets - ' + type;
            client.sinterstore('setres', 'set1', 'set2', 'set3', function (err, res) {
              if (err) {
                cb(err, null);
              }
              client.smembers('setres', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if (!assert.deepEqual(res.sort(), ['195', '199', large[type]], test_case)) {
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
          nine : function (cb) {
            var test_case = 'SUNION with non existing keys - ' + type;
            client.smembers('set1', function (err, s1) {
              if (err) {
                cb(err, null);
              }
              client.smembers('set2', function (err, s2) {
                if (err) {
                  cb(err, null);
                }
                var expected = ut.removeDuplicates(s1.concat(s2)).sort();
                client.sunion('nokey1', 'set1', 'set2', 'nokey2', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  try {
                    if (!assert.deepEqual(res.sort(), expected, test_case)) {
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
          ten : function (cb) {
            var test_case = 'SDIFF with two sets - ' + type;
            client.sdiff('set1', 'set4', function (err, res) {
              if (err) {
                cb(err, null);
              }
              try {
                if (!assert.deepEqual(res.sort(), [0, 1, 2, 3, 4], test_case)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(e, null);
              }
            });
          },
          eleven : function (cb) {
            var test_case = 'SDIFF with three sets - ' + type;
            client.sdiff('set1', 'set4', 'set5', function (err, res) {
              if (err) {
                cb(err, null);
              }
              try {
                if (!assert.deepEqual(res.sort(), [1, 2, 3, 4], test_case)) {
                  ut.pass(test_case);
                  cb(null, null);
                }
              } catch (e) {
                ut.fail(e, true);
                cb(e, null);
              }
            });

          },
          twelve : function (cb) {
            var test_case = 'SDIFFSTORE with three sets - ' + type;
            client.sdiffstore('setres', 'set1', 'set4', 'set5', function (err, res) {
              if (err) {
                cb(err, null);
              }
              //When we start with intsets, we should always end with intsets.
              if (type == 'intset') {
                assert_encoding('intset', 'setres', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  client.smembers('setres', function (err, res) {
                    if (err) {
                      cb(err, null);
                    }
                    try {
                      if (!assert.deepEqual(res.sort(), [1, 2, 3, 4], test_case)) {
                        ut.pass(test_case);
                        cb(null, null);
                      }
                    } catch (e) {
                      ut.fail(e, true);
                      cb(e, null);
                    }
                  });
                });
              } else {
                client.smembers('setres', function (err, res) {
                  if (err) {
                    cb(err, null);
                  }
                  try {
                    if (!assert.deepEqual(res.sort(), [1, 2, 3, 4], test_case)) {
                      ut.pass(test_case);
                      cb(null, null);
                    }
                  } catch (e) {
                    ut.fail(e, true);
                    cb(e, null);
                  }
                });
              }
            });
          },
        }, function (err, rep) {
          if (err) {
            // can only push the error here, we need another iteration of loop.
            errors.push(err);
          }
          mloop.next();
        });
      });
    }, function () {
      if (errors.length != 0) {
        errorCallback(errors.toString());
      }
      testEmitter.emit('next');

    });
  };

  tester.set15 = function (errorCallback) {
    var test_case = 'SINTER against non-set should throw error';
    client.set('key1', 'x', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sinter('key1', 'noset', function (err, res) {
        ut.assertOk('WRONGTYPE', err, test_case);
        testEmitter.emit('next');
      });
    });
  }
  tester.set16 = function (errorCallback) {
    var test_case = 'SUNION against non-set should throw error';
    client.set('key1', 'x', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sunion('key1', 'noset', function (err, res) {
        ut.assertOk('WRONGTYPE', err, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.set17 = function (errorCallback) {
    var test_case = 'SINTERSTORE against non existing keys should delete dstkey';
    var result = new Array();
    client.set('setres', 'xxx', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sinterstore('setres', 'foo111', 'bar222', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        client.exists('setres', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          ut.assertDeepEqual(result, [0, 0], test_case);
          testEmitter.emit('next');
        });
      });
    });
  }
  tester.set18 = function (errorCallback) {
    var test_case = 'SUNIONSTORE against non existing keys should delete dstkey';
    var result = new Array();
    client.set('setres', 'xxx', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sunionstore('setres', 'foo111', 'bar222', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        client.exists('setres', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          ut.assertDeepEqual(result, [0, 0], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.set19 = function (errorCallback) {
    var test_case = 'SPOP basics - Hashtable';
    var Hcontent = ['a', 'b', 'c']
    var result = new Array();
    create_set('myset', Hcontent, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('hashtable', 'myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.spop('myset', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          client.spop('myset', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result.push(res);
            client.spop('myset', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result.push(res);
              var sortedres = result.sort();
              client.scard('myset', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany(
                  [
                    ['equal', res, 0],
                    ['deepequal', sortedres, Hcontent]
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });

  };
  tester.set19_1 = function (errorCallback) {
    var test_case = 'SRANDMEMBER - Hashtable';
    var Hcontent = ['a', 'b', 'c']
    var myset = {};
    create_set('myset', Hcontent, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, 100, function (loop) {
        client.srandmember('myset', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          myset[res] = 1;
          loop.next();
        });
      }, function () {
        var c = 0,
        myset_arr = [];
        for (k in myset) {
          myset_arr[c++] = k
        }
        ut.assertDeepEqual(myset_arr.sort(), Hcontent, test_case);
        testEmitter.emit('next');
      });
    });

  };
  tester.set20 = function (errorCallback) {
    var test_case = 'SPOP basics - Intset';
    var Icontent = [1, 2, 3]
    var result = new Array();
    create_set('myset', Icontent, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      assert_encoding('intset', 'myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.spop('myset', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          client.spop('myset', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result.push(res);
            client.spop('myset', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result.push(res);
              var sortedres = result.sort();
              client.scard('myset', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany(
                  [
                    ['equal', res, 0],
                    ['deepequal', sortedres, Icontent]
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });

  }
  tester.set20_1 = function (errorCallback) {
    var test_case = 'SRANDMEMBER - Intset';
    var Icontent = [1, 2, 3]
    var myset = {};
    create_set('myset', Icontent, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, 100, function (loop) {
        client.srandmember('myset', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          myset[res] = 1;
          loop.next();
        });
      }, function () {
        var c = 0,
        myset_arr = [];
        for (k in myset) {
          myset_arr[c++] = k
        }
        ut.assertDeepEqual(myset_arr.sort(), Icontent, test_case);
        testEmitter.emit('next');
      });
    });

  };
  function setup_move(callback) {
    client.del('myset3', 'myset4', function (err, res) {
      if (err) {
        callback(err, null);
      }
      create_set('myset1', [1, 'a', 'b'], function (err, res) {
        if (err) {
          callback(err, null);
        }
        create_set('myset2', [2, 3, 4], function (err, res) {
          if (err) {
            callback(err, null);
          }
          assert_encoding('hashtable', 'myset1', function (err, res) {
            if (err) {
              callback(err, null);
            }
            assert_encoding('intset', 'myset2', function (err, res) {
              if (err) {
                callback(err, null);
              }
              callback(null, true)
            });
          });
        });
      });
    });
  }
  tester.set21 = function (errorCallback) {
    //move a non-integer element to an intset should convert encoding
    var test_case = 'SMOVE basics - from regular set to intset';
    var result = new Array();
    setup_move(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.smove('myset1', 'myset2', 'a', function (err, res) {
        if (err) {
          errorCallback(err)
        }
        result.push(res);
        client.smembers('myset1', function (err, res) {
          if (err) {
            errorCallback(err)
          }
          result.push(res.sort());
          client.smembers('myset2', function (err, res) {
            if (err) {
              errorCallback(err)
            }
            result.push(res.sort());
            assert_encoding('hashtable', 'myset2', function (err, res) {
              if (err) {
                errorCallback(err)
              }
              //	move an integer element should not convert the encoding
              setup_move(function (err, res) {
                if (err) {
                  errorCallback(err)
                }
                client.smove('myset1', 'myset2', 1, function (err, res) {
                  if (err) {
                    errorCallback(err)
                  }
                  result.push(res);
                  client.smembers('myset1', function (err, res) {
                    if (err) {
                      errorCallback(err)
                    }
                    result.push(res.sort());
                    client.smembers('myset2', function (err, res) {
                      if (err) {
                        errorCallback(err)
                      }
                      result.push(res.sort());
                      assert_encoding('intset', 'myset2', function (err, res) {
                        if (err) {
                          errorCallback(err)
                        }
                        ut.assertDeepEqual(result, [1, [1, 'b'], [2, 3, 4, 'a'], 1, ['a', 'b'], [1, 2, 3, 4]], test_case);
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
  tester.set22 = function (errorCallback) {
    var test_case = 'SMOVE basics - from intset to regular set';
    var result = new Array();
    setup_move(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.smove('myset2', 'myset1', 2, function (err, res) {
        if (err || res != 1) {
          errorCallback(err)
        }
        result.push(res);
        client.smembers('myset1', function (err, res) {
          if (err) {
            errorCallback(err)
          }
          result.push(res.sort());
          client.smembers('myset2', function (err, res) {
            if (err) {
              errorCallback(err)
            }
            result.push(res.sort());
            ut.assertDeepEqual(result, [1, [1, 2, 'a', 'b'], [3, 4]], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.set23 = function (errorCallback) {
    var test_case = 'SMOVE non existing key';
    var result = new Array();
    setup_move(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.smove('myset1', 'myset2', 'foo', function (err, res) {
        if (err) {
          errorCallback(err)
        }
        result.push(res);
        client.smembers('myset1', function (err, res) {
          if (err) {
            errorCallback(err)
          }
          result.push(res.sort());
          client.smembers('myset2', function (err, res) {
            if (err) {
              errorCallback(err)
            }
            result.push(res.sort());
            ut.assertDeepEqual(result, [0, [1, 'a', 'b'], [2, 3, 4]], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.set24 = function (errorCallback) {
    var test_case = 'SMOVE non existing src set';
    var result = new Array();
    setup_move(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.smove('noset', 'myset2', 'foo', function (err, res) {
        if (err) {
          errorCallback(err)
        }
        result.push(res);
        client.smembers('myset2', function (err, res) {
          result.push(res.sort());
          ut.assertDeepEqual(result, [0, [2, 3, 4]], test_case);
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.set25 = function (errorCallback) {
    var test_case = 'SMOVE from regular set to non existing destination set';
    var result = new Array();
    setup_move(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.smove('myset1', 'myset3', 'a', function (err, res) {
        if (err) {
          errorCallback(err)
        }
        result.push(res);
        client.smembers('myset1', function (err, res) {
          if (err) {
            errorCallback(err)
          }
          result.push(res.sort());
          client.smembers('myset3', function (err, res) {
            if (err) {
              errorCallback(err)
            }
            result.push(res.sort());
            assert_encoding('hashtable', 'myset3', function (err, res) {
              if (err) {
                errorCallback(err)
              }
              ut.assertDeepEqual(result, [1, [1, 'b'], ['a']], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  }
  tester.set26 = function (errorCallback) {
    var test_case = 'SMOVE from intset to non existing destination set';
    var result = new Array();
    setup_move(function (err, res) {
      if (err) {
        errorCallback(err)
      }
      client.smove('myset2', 'myset3', 2, function (err, res) {
        if (err || res != 1) {
          errorCallback(err)
        }
        result.push(res);
        client.smembers('myset2', function (err, res) {
          if (err) {
            errorCallback(err)
          }
          result.push(res.sort());
          client.smembers('myset3', function (err, res) {
            if (err) {
              errorCallback(err)
            }
            result.push(res.sort());
            assert_encoding('intset', 'myset3', function (err, res) {
              if (err) {
                errorCallback(err)
              }
              ut.assertDeepEqual(result, [1, [3, 4], [2]], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };
  tester.set27 = function (errorCallback) {
    var test_case = 'SMOVE wrong src key type';
    client.set('x', 10, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.smove('x', 'myset2', 'foo', function (err, res) {
        ut.assertOk('WRONGTYPE', err, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.set27 = function (errorCallback) {
    var test_case = 'SMOVE wrong dst key type';
    client.set('x', 10, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.smove('myset2', 'x', 'foo', function (err, res) {
        ut.assertOk('WRONGTYPE', err, test_case);
        testEmitter.emit('next');
      });
    });
  };
  tester.set28 = function (errorCallback) {
    var test_case = 'intsets implementation stress testing';
    var error = '';
    g.asyncFor(0, 20, function (outerloop) {
      var s = {};
      client.del('s', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        var len = g.randomInt(1024);
        g.asyncFor(0, len, function (innerloop) {
          var data = '';
          var c = ut.randpath(new Array(1, 2, 3));
          if (c == 1) {
            data = g.randomInt(65536);
          } else if (c == 2) {
            data = g.randomInt(4294967296);
          } else {
            data = g.randomInt(18446744073709551616);
          }
          s[data] = {};
          client.sadd('s', data, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            innerloop.next();
          });
        }, function () {
          client.smembers('s', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            var sorted = res.sort();
            var c = 0,
            s_arr = [];
            for (k in s) {
              s_arr[c++] = k;
            }
            var s_sorted = s_arr.sort();
            try {
              if (!assert.deepEqual(sorted, s_sorted, test_case)) {
                g.asyncFor(0, c, function (loop) {
                  client.spop('s', function (err, e) {
                    if (err) {
                      errorCallback(err);
                    }
                    if (!s.hasOwnProperty(e)) {
                      console.log('Can\'t find ' + e + ' on local array');
                      console.log('Local array: ' + sorted);
                      console.log('Remote array: ' + s_sorted);
                      throw new Error('exception')
                    }
                    delete s[e];
                    loop.next();
                  });
                }, function () {
                  client.scard('s', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    if (res !== 0) {
                      errors.push('Scard: ' + res + ' not equal to 0');
                      outerloop.break();
                    }
                    var size = 0;
                    for (k in s) {
                      size++;
                    }
                    if (size !== 0) {
                      errors.push('Size: ' + size + ' not equal to 0');
                      outerloop.break();
                    }
                    outerloop.next();
                  });
                });
              }
            } catch (e) {
              error = e;
              outerloop.break();
            }

          });
        });
      });
    }, function () {
      if (error)
        ut.fail(error, test_case);
      else
        ut.pass(test_case);
      testEmitter.emit('next');
    });
  };
  tester.set29 = function (errorCallback) {
    var test_case = 'SDIFF with first set empty';
    client.del('set1', 'set2', 'set3', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('set2', '1', '2', '3', '4', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sadd('set3', 'a', 'b', 'c', 'd', function (err, res) {
          if (err) {
            errorCallback(err);
          }

          client.sdiff('set1', 'set2', 'set3', function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            ut.assertEqual(res, '', test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.set30 = function (errorCallback) {
    var test_case = 'SDIFF with same set two times';
    client.del('set1');
    client.sadd('set1', 'a', 'b', 'c', 1, 2, 3, 4, 5, 6);
    client.sdiff('set1', 'set1', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      ut.assertEqual(res, '', test_case);
      testEmitter.emit('next');
    });
  };

  tester.set31 = function (errorCallback) {
    var test_case = 'SDIFF fuzzing';
    var set = {},
    args = [],
    num_sets = '',
    num_elements = '',
    innercount = 0,
    ele = '';
    g.asyncFor(0, 100, function (outerloop) {
      set = {};
      num_sets = g.randomInt(10) + 1;
      g.asyncFor(0, num_sets, function (innerloop) {
        innercount = innerloop.iteration();
        num_elements = g.randomInt(100);
        client.del('set_' + innercount);
        args.push('set_' + innercount);
        g.asyncFor(0, -1, function (loop) {
          if (num_elements == 0)
            loop.break();
          else {
            ele = ut.randomValue;
            client.sadd('set_' + innercount, ele, function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              if (innercount == 0)
                set[ele] = 'x';
              else
                delete set[ele];
              num_elements--;
              loop.next();
            });
          }
        }, function () {
          innerloop.next();
        });
      }, function () {
        outerloop.next();
      });
    }, function () {
      client.sdiff(args, function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        var result = res.sort().toString();
        var c = 0,
        myset_arr = [];
        for (k in set) {
          myset_arr[c++] = k
        }
        ut.assertEqual(myset_arr.toString(), res.sort().toString(), test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.set32 = function (errorCallback) {
    var test_case = 'SINTER should handle non existing key as empty';
    client.del('set1', 'set2', 'set3', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('set1', 'a', 'b', 'c', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sadd('set2', 'b', 'c', 'd', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.sinter('set1', 'set2', 'set3', function (err, res) {
            ut.assertEqual(res, '', test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };

  tester.set33 = function (errorCallback) {
    var test_case = 'SINTER with same integer elements but different encoding';
    client.del('set1', 'set2', 'set3', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('set1', '1', '2', '3', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.sadd('set2', '1', '2', '3', 'a', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.srem('set2', 'a', function (err, result) {
            if (err) {
              errorCallback(err);
            }
            assert_encoding('intset', 'set1', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              assert_encoding('hashtable', 'set2', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.sinter('set1', 'set2', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  ut.assertEqual(res.sort(), '1,2,3', test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  };

  tester.set34 = function (errorCallback) {
    var test_case = 'SMOVE with identical source and destination';
    client.del('set', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.sadd('set', 'a', 'b', 'c', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.smove('set', 'set', 'b', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.smembers('set', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.assertEqual(res.sort(), 'a,b,c', test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  };
  tester.set35 = function (errorCallback) {
    var test_case = 'SRANDMEMBER with <count> against non existing key';
    client.srandmember('nonexisting_key', 100, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertDeepEqual(res, [], test_case);
      testEmitter.emit('next');
    });
  };

  tester.set36 = function (errorCallback) {
    var test_case = 'SRANDMEMBER with <count> - Hashtable';
    var Hcontent = [1, 5, 10, 50, 125, 50000, 33959417, 4775547, 65434162, 12098459, 427716, 483706, 2726473884, 72615637475,
      'MARY', 'PATRICIA', 'LINDA', 'BARBARA', 'ELIZABETH', 'JENNIFER', 'MARIA', 'SUSAN', 'MARGARET', 'DOROTHY', 'LISA', 'NANCY',
      'KAREN', 'BETTY', 'HELEN', 'SANDRA', 'DONNA', 'CAROL', 'RUTH', 'SHARON', 'MICHELLE', 'LAURA', 'SARAH', 'KIMBERLY',
      'DEBORAH', 'JESSICA', 'SHIRLEY', 'CYNTHIA', 'ANGELA', 'MELISSA', 'BRENDA', 'AMY', 'ANNA', 'REBECCA', 'VIRGINIA', 'KATHLEEN'];
    var myset = [],
    Result = false,
    ErrorMsg = '';
    var tempArray = [],
    res_array = [];
    create_set('myset', Hcontent, function (err, status) {
      if (err) {
        errorCallback(err);
      }
      client.smembers('myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        for (var i = 0; i < res.length; i++)
          myset.push(res[i]);
        try {
          if (!assert.deepEqual(myset.sort(), Hcontent.sort(), test_case)) {
            Result = true;
          }
        } catch (e) {
          ErrorMsg = e;
          Result = false;
        }
        async.series({
          one : function (arg) {
            //Make sure that a count of 0 is handled correctly.
            client.srandmember('myset', 0, function (err, res1) {
              if (err) {
                errorCallback(err);
              }
              try {
                if (!assert.equal(res1, '', test_case) && Result) {
                  Result = true;
                }
              } catch (e) {
                ErrorMsg = e;
                Result = false;
              }
              client.srandmember('myset', -100, function (err, res2) {
                if (err) {
                  errorCallback(err);
                }
                var mySetLen = res2.length
                  try {
                    if (!assert.equal(mySetLen, 100, test_case) && Result) {
                      Result = true;
                    }
                  } catch (e) {
                    ErrorMsg = e;
                    Result = false;
                  }
                  var Exists = true;
                for (var i = 0; i < mySetLen; i++) {
                  if (myset.indexOf(res2[i]) == -1) {
                    Exists = false;
                    break;
                  }
                }
                try {
                  if (!assert.equal(Exists, true, test_case) && Result) {
                    Result = true;
                  }
                } catch (e) {
                  ErrorMsg = e;
                  Result = false;
                }

                //this loop is ver slow. it may take some time to execute
                g.asyncFor(0, 1000, function (loop) {
                  function test_cond(length) {
                    if (tempArray.length == length) {
                      tempArray = [];
                      if (ut.compareArray(res_array.sort(), myset.sort())) {
                        Result = true;
                        loop.break();
                      } else {
                        Result = false;
                        Error = 'Array not equal';
                        loop.next();
                      }
                    } else
                      test_cond(length);
                  }
                  client.srandmember('myset', -10, function (err, res4) {
                    tempArray = res4;
                    var i = 0;
                    while (i < res4.length) {
                      if (res_array.indexOf(res4[i]) == -1)
                        res_array.push(res4[i]);
                      i++
                    }
                  });
                  if (tempArray.length != 10) {
                    setTimeout(function () {
                      test_cond(10);
                    }, 1000);
                  }
                }, function () {
                  arg(null, null);
                });
              });
            }, function () {
              arg(null, null)
            });
          },
          two : function (arg) {
            res_array = [50, 100];
            g.asyncFor(0, res_array.length, function (loop) {
              loopIndex = loop.iteration();
              client.srandmember('myset', res_array[loopIndex], function (err, res) {
                if (res.length == 50 && ut.compareArray(res.sort(), myset.sort()) && Result) {
                  loop.next();
                } else {
                  Result = false;
                }
              });
            }, function () {
              arg(null, null);
            });
          },
          three : function (arg) {
            res_array = [45, 5];
            g.asyncFor(0, res_array.length, function (loop) {
              loopIndex = loop.iteration();
              client.srandmember('myset', res_array[loopIndex], function (err, res) {
                var mySetLen = res.length;
                try {
                  if (!assert.equal(mySetLen, res_array[loopIndex], test_case) && Result) {
                    Result = true;
                  }
                } catch (e) {
                  ErrorMsg = e;
                  Result = false;
                }
                var Exists = true;
                for (var i = 0; i < mySetLen; i++) {
                  if (myset.indexOf(res[i]) == -1) {
                    Exists = false;
                    break;
                  }
                }
                try {
                  if (!assert.equal(Exists, true, test_case) && Result) {
                    Result = true;
                  }
                } catch (e) {
                  ErrorMsg = e;
                  Result = false;
                }
                loop.next();
              });
            }, function () {
              arg(null, null);
            });
          },
        }, function (err, results) {
          if (err) {
            errorCallback(err);
          }
          if (Result) {
            ut.pass(test_case);
          } else {
            ut.fail(Error, true);
          }
          testEmitter.emit('next');
        });
      });
    });
  };
  tester.set37 = function (errorCallback) {
    var test_case = 'SRANDMEMBER with <count> - Intset';
    var Icontent = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49];
    var myset = [],
    Result = false,
    ErrorMsg = '';
    var tempArray = [],
    res_array = [];
    create_set('myset', Icontent, function (err, status) {
      if (err) {
        errorCallback(err);
      }
      client.smembers('myset', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        for (var i = 0; i < res.length; i++)
          myset.push(res[i]);
        try {
          if (!assert.deepEqual(myset.sort(), Icontent.sort(), test_case)) {
            Result = true;
          }
        } catch (e) {
          ErrorMsg = e;
          Result = false;
        }
        async.series({
          one : function (arg) {
            //Make sure that a count of 0 is handled correctly.
            client.srandmember('myset', 0, function (err, res1) {
              if (err) {
                errorCallback(err);
              }
              try {
                if (!assert.equal(res1, '', test_case) && Result) {
                  Result = true;
                }
              } catch (e) {
                ErrorMsg = e;
                Result = false;
              }
              client.srandmember('myset', -100, function (err, res2) {
                if (err) {
                  errorCallback(err);
                }
                var mySetLen = res2.length
                  try {
                    if (!assert.equal(mySetLen, 100, test_case) && Result) {
                      Result = true;
                    }
                  } catch (e) {
                    ErrorMsg = e;
                    Result = false;
                  }
                  var Exists = true;
                for (var i = 0; i < mySetLen; i++) {
                  if (myset.indexOf(res2[i]) == -1) {
                    Exists = false;
                    break;
                  }
                }
                try {
                  if (!assert.equal(Exists, true, test_case) && Result) {
                    Result = true;
                  }
                } catch (e) {
                  ErrorMsg = e;
                  Result = false;
                }

                //this loop is ver slow. it may take some time to execute
                g.asyncFor(0, 1000, function (loop) {
                  function test_cond(length) {
                    if (tempArray.length == length) {
                      tempArray = [];
                      if (ut.compareArray(res_array.sort(), myset.sort())) {
                        Result = true;
                        loop.break();
                      } else {
                        Result = false;
                        Error = 'Array not equal';
                        loop.next();
                      }
                    } else
                      test_cond(length);
                  }
                  client.srandmember('myset', -10, function (err, res4) {
                    tempArray = res4;
                    var i = 0;
                    while (i < res4.length) {
                      if (res_array.indexOf(res4[i]) == -1)
                        res_array.push(res4[i]);
                      i++
                    }
                  });
                  if (tempArray.length != 10) {
                    setTimeout(function () {
                      test_cond(10);
                    }, 1000);
                  }
                }, function () {
                  arg(null, null);
                });
              });
            }, function () {
              arg(null, null)
            });
          },
          two : function (arg) {
            res_array = [50, 100];
            g.asyncFor(0, res_array.length, function (loop) {
              loopIndex = loop.iteration();
              client.srandmember('myset', res_array[loopIndex], function (err, res) {
                if (res.length == 50 && ut.compareArray(res.sort(), myset.sort()) && Result) {
                  loop.next();
                } else {
                  Result = false;
                }
              });
            }, function () {
              arg(null, null);
            });
          },
          three : function (arg) {
            res_array = [45, 5];
            g.asyncFor(0, res_array.length, function (loop) {
              loopIndex = loop.iteration();
              client.srandmember('myset', res_array[loopIndex], function (err, res) {
                var mySetLen = res.length;
                try {
                  if (!assert.equal(mySetLen, res_array[loopIndex], test_case) && Result) {
                    Result = true;
                  }
                } catch (e) {
                  ErrorMsg = e;
                  Result = false;
                }
                var Exists = true;
                for (var i = 0; i < mySetLen; i++) {
                  if (myset.indexOf(res[i]) == -1) {
                    Exists = false;
                    break;
                  }
                }
                try {
                  if (!assert.equal(Exists, true, test_case) && Result) {
                    Result = true;
                  }
                } catch (e) {
                  ErrorMsg = e;
                  Result = false;
                }
                loop.next();
              });
            }, function () {
              arg(null, null);
            });
          },
        }, function (err, results) {
          if (err) {
            errorCallback(err);
          }
          if (Result) {
            ut.pass(test_case);
          } else {
            ut.fail(Error, true);
          }
          testEmitter.emit('next');
        });
      });
    });
  };

  return set;

}
  ());