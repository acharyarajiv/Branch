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

exports.Pubsub = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  pubsub = {},
  name = 'PubSub',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {},
  server_host = '',
  server_host = '',
  sub_msg = [],
  unsub_msg = [];

  //public property
  pubsub.debug_mode = false;

  //public method
  pubsub.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'pubsub';
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
        server_host = g.srv[client_pid][server_pid]['host'];
        server_port = g.srv[client_pid][server_pid]['port'];
        g.srv[client_pid][server_pid]['client'].end();
        if (pubsub.debug_mode) {
          log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
        }
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

    if (pubsub.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods
  function subscribe(client, channels, callback) {
    var sub_counts = [];
    client.on('subscribe', function (channel, count) {
      sub_counts.push(count);
    });
    client.on('message', function (channel, message) {
      sub_msg.push(message);
    });

    client.subscribe(ut.expand(channels), function (err, res) {
      if (err) {
        callback(err, null);
      }
      setImmediate(function () {
        callback(null, sub_counts)
      });

    });
  }

  function unsubscribe(client, channels, callback) {
    var unsub_counts = [];
    client.on('unsubscribe', function (channel, count) {
      unsub_counts.push(count);
    });
    client.on('message', function (channel, message) {
      unsub_msg.push(message);
    });

    if (channels != '') {
      client.unsubscribe(ut.expand(channels), function (err, res) {
        if (err) {
          callback(err, null);
        }
        setImmediate(function () {
          callback(null, unsub_counts)
        });
      });
    } else {
      client.unsubscribe(function (err, res) {
        if (err) {
          callback(err, null);
        }
        setTimeout(function () {
          callback(null, unsub_counts)
        }, 1000);
      });
    }
  }

  function psubscribe(client, channels, callback) {
    var psub_counts = [];
    client.on('psubscribe', function (channel, count) {
      psub_counts.push(count);
    });
    client.on('pmessage', function (channel, message) {
      sub_msg.push(message);
    });

    client.psubscribe(ut.expand(channels), function (err, res) {
      if (err) {
        callback(err, null);
      }
      setImmediate(function () {
        callback(null, psub_counts);
      });

    });
  }

  function punsubscribe(client, channels, callback) {
    var punsub_counts = [];
    client.on('punsubscribe', function (channel, count) {
      punsub_counts.push(count);
    });
    client.on('pmessage', function (channel, message) {
      unsub_msg.push(message);
    });

    if (channels != '') {
      client.punsubscribe(ut.expand(channels), function (err, res) {
        if (err) {
          callback(err, null);
        }
        setImmediate(function () {
          callback(null, punsub_counts)
        });
      });
    } else {
      client.punsubscribe(function (err, res) {
        if (err) {
          callback(err, null);
        }
        callback(null, punsub_counts)
      });
    }
  }

  function createClient() {
    var newClient = redis.createClient(server_port, server_host);
    newClient.on('ready', function () {
      if (pubsub.debug_mode) {
        log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
      }
    });
    return newClient;
  }
  
  //test methods
  tester.psub1 = function (errorCallback) {
    var test_case = 'PUBLISH/SUBSCRIBE basics';
    var result1 = [],
    result2 = [],
    result3 = [],
    client = createClient();
    client1 = createClient();
    async.series({
      one : function (async_cb) {
        // subscribe to two channels
        subscribe(client1, ['chan1', 'chan2'], function (err, res) {
          if (err) {
            async_cb(err, null);
          }
          result1.push(res);
          client.publish('chan1', 'hello', function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            result1.push(res);
            client.publish('chan2', 'world', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              result1.push(res);
              result1.push(sub_msg); // hello and world should be emitted.
              sub_msg = [];
              async_cb(null, result1);
            });
          });
        });
      },
      two : function (async_cb) {
        // unsubscribe from one of the channels
        unsubscribe(client1, ['chan1'], function (err, res) {
          if (err) {
            async_cb(err, null);
          }
          client.publish('chan1', 'hello', function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            result2.push(res);
            client.publish('chan2', 'world', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              result2.push(res);
              result2.push(unsub_msg); //world should be emitted.
              unsub_msg = [];
              sub_msg = [];
              async_cb(null, result2);
            });
          });
        });
      },
      three : function (async_cb) {
        // unsubscribe from the remaining channel
        unsubscribe(client1, ['chan2'], function (err, res) {
          if (err) {
            async_cb(err, null);
          }
          client.publish('chan1', 'hello', function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            result3.push(res);
            client.publish('chan2', 'world', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              result3.push(res);
              async_cb(null, result3);
            });
          });
        });
      },
    }, function (err, results) {
      if (err) {
        errorCallback(err);
      }
      ut.assertMany(
        [
          ['deepequal', results.one, [[1, 2], 1, 1, ['hello', 'world']]],
          ['deepequal', results.two, [0, 1, ['world']]],
          ['deepequal', results.three, [0, 0]]
        ], test_case);
      client.end();
      client1.end();
      if (pubsub.debug_mode) {
        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
      }
      testEmitter.emit('next');
    });
  };

  tester.psub2 = function (errorCallback) {
    var test_case = 'PUBLISH/SUBSCRIBE with two clients';
    var result = [],
    client = createClient(),
    client1 = createClient(),
    client2 = createClient();
    subscribe(client1, ['chan1'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      subscribe(client2, ['chan1'], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        client.publish('chan1', 'hello', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          result.push(sub_msg);
          sub_msg = [];
          unsub_msg = [];

          ut.assertDeepEqual(result, [[1], [1], 2, ['hello', 'hello']], test_case);
          client.end();
          client1.end();
          client2.end();
          if (pubsub.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          }
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.psub3 = function (errorCallback) {
    var test_case = 'PUBLISH/SUBSCRIBE after UNSUBSCRIBE without arguments';
    var result = [],
    client = createClient();
    client1 = createClient();
    subscribe(client1, ['chan1', 'chan2', 'chan3'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      unsubscribe(client1, '', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.publish('chan1', 'hello', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          client.publish('chan2', 'hello', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result.push(res);
            client.publish('chan3', 'hello', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result.push(res);
              ut.assertDeepEqual(result, [[1, 2, 3], 0, 0, 0], test_case);
              client.end();
              client1.end();
              if (pubsub.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  tester.psub4 = function (errorCallback) {
    var test_case = 'SUBSCRIBE to one channel more than once';
    var result = [],
    client = createClient();
    client1 = createClient();
    subscribe(client1, ['chan1', 'chan1', 'chan1'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      client.publish('chan1', 'hello', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        result.push(sub_msg);
        sub_msg = [];
        unsub_msg = [];
        ut.assertDeepEqual(result, [[1, 1, 1], 1, ['hello']], test_case);
        client.end();
        client1.end();
        if (pubsub.debug_mode) {
          log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
        }
        testEmitter.emit('next');
      });
    });
  };

  tester.psub5 = function (errorCallback) {
    var test_case = 'UNSUBSCRIBE from non-subscribed channels';
    var result = [],
    client = createClient();
    client1 = createClient();
    // client.unsubscribe([],callback) - returns just one of the unsubscribed channed. This is seen in redis-cli.exe as well.
    // Moreoever, client.unsubscribe(['foo','bar','quux'],callback) - breaks node_redis. Hence calling one by one.
    // Since we have an array, the return is cumulated, hence the deviation.
    unsubscribe(client1, ['foo'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      unsubscribe(client1, ['bar'], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        unsubscribe(client1, ['quux'], function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          ut.assertDeepEqual(result, [[0, 0, 0], [0, 0], [0]], test_case);
          client.end();
          client1.end();
          if (pubsub.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          }
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.psub6 = function (errorCallback) {
    var test_case = 'PUBLISH/PSUBSCRIBE basics';
    var result1 = [],
    result2 = [],
    result3 = [],
    client = createClient();
    client1 = createClient();
    async.series({
      one : function (async_cb) {
        // subscribe to two patterns
        psubscribe(client1, ['foo.*', 'bar.*'], function (err, res) {
          if (err) {
            async_cb(err, null);
          }
          result1.push(res);
          client.publish('foo.1', 'hello', function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            result1.push(res);
            client.publish('bar.1', 'world', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              result1.push(res);
              client.publish('foo1', 'hello', function (err, res) {
                if (err) {
                  async_cb(err, null);
                }
                result1.push(res);
                client.publish('barfoo.1', 'hello', function (err, res) {
                  if (err) {
                    async_cb(err, null);
                  }
                  result1.push(res);
                  client.publish('qux.1', 'hello', function (err, res) {
                    if (err) {
                      async_cb(err, null);
                    }
                    result1.push(res);
                    result1.push(sub_msg); // hello and world should be emitted.
                    sub_msg = [];
                    async_cb(null, result1);
                  });
                });
              });
            });
          });
        });
      },
      two : function (async_cb) {
        // unsubscribe from one of the patterns
        punsubscribe(client1, ['foo.*'], function (err, res) {
          if (err) {
            async_cb(err, null);
          }
          // here punsubscribe event is emitted suggesting foo.* is unsubscribed but bar.* is still subscribed. Since node_redis returns new count of subscriptions for the client.
          // hence result should be [1 0] not just [1]
          result2.push(res);
          client.publish('foo.1', 'hello', function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            result2.push(res);
            client.publish('bar.1', 'hello', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              result2.push(res);
              result2.push(unsub_msg);
              unsub_msg = [];
              sub_msg = [];
              async_cb(null, result2);
            });
          });
        });
      },
      three : function (async_cb) {
        // unsubscribe from the remaining pattern
        punsubscribe(client1, ['bar.*'], function (err, res) {
          if (err) {
            async_cb(err, null);
          }
          result3.push(res);
          client.publish('foo.1', 'hello', function (err, res) {
            if (err) {
              async_cb(err, null);
            }
            result3.push(res);
            client.publish('bar.1', 'hello', function (err, res) {
              if (err) {
                async_cb(err, null);
              }
              result3.push(res);
              async_cb(null, result3);
            });
          });
        });
      },

    }, function (err, results) {
      if (err) {
        errorCallback(err);
      }
      ut.assertMany(
        [
          ['deepequal', results.one, [[1, 2], 1, 1, 0, 0, 0, ['foo.1', 'bar.1']]],
          ['deepequal', results.two, [[1, 0], 0, 1, ['bar.1']]],
          ['deepequal', results.three, [[0], 0, 0]]
        ], test_case);
      client.end();
      client1.end();
      if (pubsub.debug_mode) {
        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
        log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
      }
      testEmitter.emit('next');
    });
  };

  tester.psub7 = function (errorCallback) {
    var test_case = 'PUBLISH/PSUBSCRIBE with two clients';
    var result = [],
    client = createClient(),
    client1 = createClient(),
    client2 = createClient();
    psubscribe(client1, ['chan.*'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      psubscribe(client2, ['chan.*'], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        client.publish('chan.foo', 'hello', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          result.push(sub_msg);
          sub_msg = [];
          unsub_msg = [];
          ut.assertDeepEqual(result, [[1], [1], 2, ['chan.foo', 'chan.foo']], test_case);
          client.end();
          client1.end();
          client2.end();
          if (pubsub.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          }
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.psub8 = function (errorCallback) {
    var test_case = 'PUBLISH/PSUBSCRIBE after PUNSUBSCRIBE without arguments';
    var result = [],
    client = createClient(),
    client1 = createClient();
    psubscribe(client1, ['chan1.*', 'chan2.*', 'chan3.*'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      punsubscribe(client1, '', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.publish('chan1.hi', 'hello', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          client.publish('chan2.hi', 'hello', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result.push(res);
            client.publish('chan3.hi', 'hello', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result.push(res);
              ut.assertDeepEqual(result, [[1, 2, 3], 0, 0, 0], test_case);
              client.end();
              client1.end();
              if (pubsub.debug_mode) {
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
                log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
              }
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  tester.psub9 = function (errorCallback) {
    var test_case = 'PUNSUBSCRIBE from non-subscribed channels';
    var result = [],
    client = createClient(),
    client1 = createClient();
    // client.punsubscribe([],callback) - returns just one of the unsubscribed channed. This is seen in redis-cli.exe as well.
    // Moreoever, client.punsubscribe(['foo.*','bar.*','quux.*'],callback) - breaks node_redis. Hence calling one by one.
    // Since we have an array, the return is cumulated, hence the deviation.
    punsubscribe(client1, ['foo.*'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      punsubscribe(client1, ['bar.*'], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        punsubscribe(client1, ['quux.*'], function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          ut.assertDeepEqual(result, [[0, 0, 0], [0, 0], [0]], test_case);
          client.end();
          client1.end();
          if (pubsub.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          }
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.psub10 = function (errorCallback) {
    var test_case = 'Mix SUBSCRIBE and PSUBSCRIBE';
    var result = [],
    client = createClient(),
    client1 = createClient();
    subscribe(client1, ['foo.bar'], function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result.push(res);
      psubscribe(client1, ['foo.*'], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result.push(res);
        client.publish('foo.bar', 'hello', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result.push(res);
          result.push(sub_msg);
          sub_msg = [];
          ut.assertDeepEqual(result, [[1], [2], 2, ['hello', 'foo.bar']], test_case);
          //client.end();
          client1.end();
          if (pubsub.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
            log.notice(name + ':Client disconnected listeting to socket : ' + server_host + ':' + server_port);
          }
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.psub11 = function (errorCallback) {
    var test_case = 'PUNSUBSCRIBE and UNSUBSCRIBE should always reply.';
    client = createClient();
    //when there are no objects in pubsub channel callback donot happen
    //have tp investigate and fix
    punsubscribe(client, ['foo.*', 'bar.*', 'quux.*'], function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      punsubscribe(client, ['foo.*', 'bar.*', 'quux.*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }

        unsubscribe(client, ['foo.*', 'bar.*', 'quux.*'], function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          punsubscribe(client, ['foo.*', 'bar.*', 'quux.*'], function (err, res1) {
            if (err) {
              errorCallback(err, null);
            }
            unsubscribe(client, ['foo.*', 'bar.*', 'quux.*'], function (err, res2) {
              if (err) {
                errorCallback(err, null);
              }
              ut.assertEqual(00, res1 + res2, test_case);
              client.end()
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  //keySpace Events
  tester.pubsub12 = function (errorCallback) {
    var test_case = 'Keyspace notifications: we receive keyspace notifications';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'KA', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.set('foo', 'bar', function (err, res) {
            if (err) {
              errorCallback(err, nul);
            }
            ut.assertDeepEqual(['__keyspace@0__:foo'], sub_msg, test_case);
            sub_msg = [];
            client.end();
            client1.end();
            testEmitter.emit('next');
          });
        }
      });
    });
  };

  tester.pubsub13 = function (errorCallback) {
    var test_case = 'Keyspace notifications: we receive keyspace notifications';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'EA', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.set('foo', 'bar', function (err, res) {
            if (err) {
              errorCallback(err, nul);
            }
            ut.assertDeepEqual(['__keyevent@0__:set'], sub_msg, test_case);
            sub_msg = [];
            client.end();
            client1.end();
            testEmitter.emit('next');
          });
        }
      });
    });
  };

  tester.pubsub14 = function (errorCallback) {
    var test_case = 'Keyspace notifications: we can receive both kind of events';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'KEA', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.set('foo', 'bar', function (err, res) {
            if (err) {
              errorCallback(err, nul);
            }
            ut.assertDeepEqual(['__keyspace@0__:foo', '__keyevent@0__:set'], sub_msg, test_case);
            sub_msg = [];
            client.end();
            client1.end();
            testEmitter.emit('next');
          });
        }
      });
    });
  };

  tester.pubsub15 = function (errorCallback) {
    var test_case = 'Keyspace notifications: we are able to mask events';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'KEl', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.del('mylist');
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.set('foo', 'bar', function (err, res) {
            if (err) {
              errorCallback(err, nul);
            }
            client.lpush('mylist', 'a', function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              //No notification for set, because only list commands are enabled.
              setTimeout(function () {
                ut.assertDeepEqual(sub_msg, ['__keyspace@0__:mylist', '__keyevent@0__:lpush'], test_case);
                sub_msg = [];
                client.end();
                client1.end();
                testEmitter.emit('next');
              });
            });
          });
        }
      });
    });
  };

  tester.publish16 = function (errorCallback) {
    var test_case = 'Keyspace notifications: general events test';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'KEg', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.set('foo', 'bar', function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            client.expire('foo', 1, function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              client.del('foo');
              setTimeout(function () {
                ut.assertDeepEqual(sub_msg, ['__keyspace@0__:foo', '__keyevent@0__:expire', '__keyspace@0__:foo',
                    '__keyevent@0__:del'], test_case);
                sub_msg = [];
                client.end();
                client1.end();
                testEmitter.emit('next');
              });
            });
          });
        }
      });
    });
  };

  tester.publish17 = function (errorCallback) {
    var test_case = 'Keyspace notifications: list events test';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'KEl', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.del('mylist');
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.lpush('mylist', 'a', function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            client.rpush('mylist', 'a', function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              client.rpop('mylist', function (err, res) {
                if (err) {
                  errorCallback(err, null);
                }
                setTimeout(function () {
                  ut.assertDeepEqual(sub_msg, ['__keyspace@0__:mylist', '__keyevent@0__:lpush', '__keyspace@0__:mylist', '__keyevent@0__:rpush', '__keyspace@0__:mylist', '__keyevent@0__:rpop'], test_case);
                  sub_msg = [];
                  client.end();
                  client1.end();
                  testEmitter.emit('next');
                });
              });
            });
          });
        }
      });
    });
  };

  tester.publish18 = function (errorCallback) {
    var test_case = 'Keyspace notifications: set events test';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'Ks', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.del('myset');
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.sadd('myset', 'a', 'b', 'c', 'd', function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            client.srem('myset', 'x', function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              client.sadd('myset', 'x', 'y', 'z', function (err, res) {
                if (err) {
                  errorCallback(err, null);
                }
                client.srem('myset', 'x', function (err, res) {
                  if (err) {
                    errorCallback(err, null);
                  }
                  setTimeout(function () {
                    ut.assertDeepEqual(sub_msg, ['__keyspace@0__:myset', '__keyspace@0__:myset', '__keyspace@0__:myset'], test_case);
                    sub_msg = [];
                    client.end();
                    client1.end();
                    testEmitter.emit('next');
                  });
                });
              });
            });
          });
        }
      });
    });
  };

  tester.publish19 = function (errorCallback) {
    var test_case = 'Keyspace notifications: zset events test';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'Kz', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.del('myzset');
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.zadd('myzset', 1, 'a', 2, 'b', function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            client.zrem('myzset', 'x', function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              client.zadd('myzset', 3, 'x', 4, 'y', 5, 'z', function (err, res) {
                if (err) {
                  errorCallback(err, null);
                }
                client.zrem('myzset', 'x', function (err, res) {
                  if (err) {
                    errorCallback(err, null);
                  }
                  setTimeout(function () {
                    ut.assertDeepEqual(sub_msg, ['__keyspace@0__:myzset', '__keyspace@0__:myzset', '__keyspace@0__:myzset'], test_case);
                    sub_msg = [];
                    client.end();
                    client1.end();
                    testEmitter.emit('next');
                  });
                });
              });
            });
          });
        }
      });
    });
  };

  tester.publish20 = function (errorCallback) {
    var test_case = 'Keyspace notifications: hash events test';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'Kh', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.del('myhash');
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.hmset('myhash', 'yes', 1, 'no', 0, function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            client.hincrby('myhash', 'yes', 10, function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              setTimeout(function () {
                ut.assertDeepEqual(sub_msg, ['__keyspace@0__:myhash', '__keyspace@0__:myhash'], test_case);
                sub_msg = [];
                client.end();
                client1.end();
                testEmitter.emit('next');
              });
            });
          });
        }
      });
    });
  };

  tester.publish21 = function (errorCallback) {
    var test_case = 'Keyspace notifications: expired events (triggered expire)';
    var test_pass = false;
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'Ex', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.del('foo');
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.psetex('foo', 100, 1, function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            ut.wait_for_condition(50, 100, function (cb) {
              client.exists('foo', function (err, res) {
                if (err) {
                  cb(err, null);
                }
                try {
                  if (!assert.equal(0, res, test_case)) {
                    setTimeout(function () {
                      ut.assertDeepEqual(sub_msg, ['__keyevent@0__:expired'], test_case);
                      test_pass = true;
                      cb(true);
                    });
                  }
                } catch (e) {
                  cb(false);
                }
              });
            }, function () {
              if (!test_pass)
                ut.fail('Key does not expire?!', true);
              sub_msg = [];
              client.end();
              client1.end();
              testEmitter.emit('next');
            }, function () {
              errorCallback(new Error('Keyspace notifications: expired events (triggered expire) failed'), null);
            });
          });
        }
      });
    });
  };

  tester.publish22 = function (errorCallback) {
    var test_case = 'Keyspace notifications: expired events (background expire)';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'Ex', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.del('foo');
      var client1 = createClient();
      psubscribe(client1, ['*'], function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal(1, res, test_case)) {
          client.psetex('foo', 100, 1, function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            setTimeout(function () {
              ut.assertDeepEqual(sub_msg, ['__keyevent@0__:expired'], test_case);
              sub_msg = [];
              client.end();
              client1.end();
              testEmitter.emit('next');
            }, 300);
          });
        }
      });
    });
  };

  tester.publish23 = function (errorCallback) {
    var test_case = 'Keyspace notifications: evicted events';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'Ee', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.config('set', 'maxmemory-policy', 'allkeys-lru', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        client.flushdb(function (err, res) {
          if (err) {
            errorCallback(err, null);
          }
          var client1 = createClient();
          psubscribe(client1, ['*'], function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            if (!assert.equal(1, res, test_case)) {
              client.set('foo', 'bar');
              client.config('set', 'maxmemory', 1, function (err, res) {
                if (err) {
                  errorCallback(err, null);
                }
                setTimeout(function () {
                  ut.assertDeepEqual(sub_msg, ['__keyevent@0__:evicted'], test_case);
                  client.config('set', 'maxmemory', 0, function (err, res) {
                    if (err) {
                      errorCallback(err, null);
                    }
                    sub_msg = [];
                    client.end();
                    client1.end();
                    testEmitter.emit('next');
                  });
                });
              });
            }
          });
        });
      });
    });
  };

  tester.publish24 = function (errorCallback) {
    var test_case = 'Keyspace notifications: test CONFIG GET/SET of event flags';
    client = createClient();
    client.config('set', 'notify-keyspace-events', 'gKE', function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      client.config('get', 'notify-keyspace-events', function (err, res) {
        if (err) {
          errorCallback(err, null);
        }
        if (!assert.equal('gKE', res[1], test_case)) {
          client.config('set', 'notify-keyspace-events', '$lshzxeKE', function (err, res) {
            if (err) {
              errorCallback(err, null);
            }
            client.config('get', 'notify-keyspace-events', function (err, res) {
              if (err) {
                errorCallback(err, null);
              }
              if (!assert.equal('$lshzxeKE', res[1], test_case)) {
                client.config('set', 'notify-keyspace-events', 'KA', function (err, res) {
                  if (err) {
                    errorCallback(err, null);
                  }
                  client.config('get', 'notify-keyspace-events', function (err, res) {
                    if (err) {
                      errorCallback(err, null);
                    }
                    if (!assert.equal('AK', res[1], test_case)) {
                      client.config('set', 'notify-keyspace-events', 'EA', function (err, res) {
                        if (err) {
                          errorCallback(err, null);
                        }
                        client.config('get', 'notify-keyspace-events', function (err, res) {
                          if (err) {
                            errorCallback(err, null);
                          }
                          ut.assertEqual('AE', res[1], test_case);
                          testEmitter.emit('next');
                        });
                      });
                    }
                  });
                });
              }
            });
          });
        }
      });
    });
  };

  return pubsub;

}
  ());
