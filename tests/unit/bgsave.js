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

exports.Bgsave = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  BgUtility = require('../support/bgutil.js'),
  bg = new BgUtility(),
  bgsave = {},
  name = 'Bgsave',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {};

  //public property
  bgsave.debug_mode = false;

  //public method
  bgsave.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      // write logic to start the server here.
      var tags = 'bgsave';
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
          if (bgsave.debug_mode) {
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

    if (bgsave.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //private methods

  tester.bg1 = function (errorCallback) {
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
                    try {
                      if (!assert.equal(res, 10, test_case)) {
                        ut.pass(test_case);
                      }
                    } catch (e) {
                      ut.fail(e, true);
                    }
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
  tester.bg2 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot update values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          // semantics loop(client,start,end,step,[key,value],cb)
          bg.multi_op(client, 'set', 0, iter1, step1, [null, null], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {

                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'set', 0, iterhalf, step1, [null, 5000], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.multi_op(client, 'set', 0, iterhalf, step1, [null, 6000], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, null], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg3 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot add new values';
    var iter1 = 1000;
    var iterhalf = 500;
    var iter2 = 1100;
    var iter3 = 1200;
    var step1 = 1;
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

          bg.multi_op(client, 'set', 0, iter1, step1, [null, null], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {

                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'set', iter1, iter2, step1, [null, 5000], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.multi_op(client, 'set', iter2, iter3, step1, [null, 6000], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {

                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, null], function (err1, res) {
                            bg.exists_op(client, 'exists', iter1, iter3, step1, [null, 0], function (err2, res) {
                              try {
                                if ((!assert.ifError(err1, test_case)) && (!assert.ifError(err2, test_case))) {
                                  ut.pass(test_case);
                                }
                              } catch (e) {
                                ut.fail(e, true);
                              }
                              client.flushdb(function (err, res) {
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
          });
        });
      });
    });
  };
  tester.bg4 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot delete values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          bg.multi_op(client, 'set', 0, iter1, step1, [null, null], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {

                if (err) {
                  errorCallback(err);
                }
                bg.single_op(client, 'del', 0, iterhalf, step1, [null], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.single_op(client, 'del', iterhalf, iter1, step1, [null], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, null], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg5 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot append values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          bg.multi_op(client, 'set', 0, iter1, step1, [null, 'abcd'], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'append', 0, iterhalf, step1, [null, 'xyz'], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.multi_op(client, 'append', iterhalf, iter1, step1, [null, 'xyz'], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, 'abcd'], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg6 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot setbit values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          bg.multi_op(client, 'set', 0, iter1, step1, [null, 'abcd'], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'setbit', 0, iterhalf, step1, [null, 7, 1], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.multi_op(client, 'setbit', iterhalf, iter1, step1, [null, 7, 0], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, 'abcd'], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg7 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot setrange values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          bg.multi_op(client, 'set', 0, iter1, step1, [null, 'abcd'], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'setrange', 0, iterhalf, step1, [null, 7, 1], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.multi_op(client, 'setrange', iterhalf, iter1, step1, [null, 7, 0], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, 'abcd'], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg8 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot incr & decr values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          bg.multi_op(client, 'set', 0, iter1, step1, [null, null], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {

                if (err) {
                  errorCallback(err);
                }
                bg.single_op(client, 'incr', 0, iterhalf, step1, [null], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.single_op(client, 'decr', iterhalf, iter1, step1, [null], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, null], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg9 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot incrby & decrby values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          bg.multi_op(client, 'set', 0, iter1, step1, [null, null], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'incrby', 0, iterhalf, step1, [null, 3], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.multi_op(client, 'decrby', iterhalf, iter1, step1, [null, 3], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, null], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg10 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot rename values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          bg.multi_op(client, 'set', 0, iter1, step1, [null, null], function (err, res) {
            if (err) {
              errorCallback(err);
            }
            ut.serverInfo(client, 'used_memory', function (err, mem1) {
              if (err) {
                errorCallback(err);
              }
              client.bgsave(function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'rename', 0, iterhalf, step1, [null, 6000], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  bg.multi_op(client, 'renamenx', iterhalf, iter1, step1, [null, 6000], function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    ut.waitForBgsave(client, function (err, res) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.debug('flushload', function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }
                        ut.serverInfo(client, 'used_memory', function (err, mem2) {
                          if (err) {
                            errorCallback(err);
                          }
                          if ((mem2 - mem1) > 500) {
                            console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                          }
                          bg.get_op(client, 'get', 0, iter1, step1, [null, null], function (err, res) {
                            try {
                              if (!assert.ifError(err, test_case)) {
                                ut.pass(test_case);
                              }
                            } catch (e) {
                              ut.fail(e, true);
                            }
                            client.flushdb(function (err, res) {
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
        });
      });
    });
  };
  tester.bg11 = function (errorCallback) {
    var test_case = 'BGSAVE snapshot move values';
    var iter1 = 1000;
    var iterhalf = 500;
    var step1 = 1;
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
          client.select(0, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            bg.multi_op(client, 'set', 0, iter1, step1, [null, null], function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.select(1, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                bg.multi_op(client, 'set', 0, iter1, step1, [1000, 1000], function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  ut.serverInfo(client, 'used_memory', function (err, mem1) {
                    if (err) {
                      errorCallback(err);
                    }
                    client.bgsave(function (err, res) {

                      if (err) {
                        errorCallback(err);
                      }
                      client.select(0, function (err, res) {
                        if (err) {
                          errorCallback(err);
                        }

                        bg.multi_op(client, 'move', 0, iterhalf, step1, [null, 1], function (err, res) {
                          if (err) {
                            errorCallback(err);
                          }
                          client.select(1, function (err, res) {
                            if (err) {
                              errorCallback(err);
                            }

                            bg.multi_op(client, 'move', iterhalf, iter1, step1, [1000, 0], function (err, res) {
                              if (err) {
                                errorCallback(err);
                              }
                              ut.waitForBgsave(client, function (err, res) {
                                if (err) {
                                  errorCallback(err);
                                }
                                client.select(0, function (err, res) {
                                  if (err) {
                                    errorCallback(err);
                                  }
                                  client.debug('flushload', function (err, res) {

                                    if (err) {
                                      errorCallback(err);
                                    }
                                    ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                      if (err) {
                                        errorCallback(err);
                                      }
                                      if ((mem2 - mem1) > 500) {
                                        console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                      }
                                      bg.get_op(client, 'get', 0, iter1, step1, [null, null], function (err1, res) {
                                        client.select(1, function (err, res) {
                                          if (err) {
                                            errorCallback(err);
                                          }
                                          bg.get_op(client, 'get', 0, iter1, step1, [1000, 1000], function (err2, res) {
                                            client.flushdb(function (err, res) {
                                              if (err) {
                                                errorCallback(err);
                                              }
                                              client.select(0, function (err, res) {
                                                if (err) {
                                                  errorCallback(err);
                                                }
                                                try {
                                                  if ((!assert.ifError(err1, test_case)) && (!assert.ifError(err2, test_case))) {
                                                    ut.pass(test_case);
                                                  }
                                                } catch (e) {
                                                  ut.fail(e, true);
                                                }
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

  tester.bg12 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        timeout : 15000,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        timeout : 0,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var timeout = li.timeout;
      var test_case = 'BGSAVE snapshot pop ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  setTimeout(function () {
                    client.bgsave(function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.single_op(client, 'rpop', 0, iterhalf, step1, ['mylist'], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        bg.single_op(client, 'lpop', 0, iterhalf, step1, ['mylist'], function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          ut.waitForBgsave(client, function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            client.debug('flushload', function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                if (err) {
                                  cb(err);
                                }
                                if ((mem2 - mem1) > 500) {
                                  console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                }
                                client.llen('mylist', function (err, length) {
                                  if (err) {
                                    cb(err);
                                  }
                                  bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                    if (err) {
                                      cb(err);
                                    }
                                    try {
                                      if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                        ut.pass(test_case);
                                      }
                                    } catch (e) {
                                      ut.fail(e, true);
                                    }
                                    client.flushdb(function (err, res) {
                                      cb(null, null);
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  }, timeout);
                });
              });
            });
          });
        });
      });

    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg13 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot push ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'lpush', 0, iterhalf, step1, ['mylist', 'abc'], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'rpush', 0, iterhalf, step1, ['mylist', 'xyz'], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.llen('mylist', function (err, length) {
                                if (err) {
                                  cb(err);
                                }
                                bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg14 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot pushx ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              //semantics loop(cli,start,end,step,[result,key,args])
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'lpushx', 0, iterhalf, step1, ['mylist', 'abc'], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'rpushx', 0, iterhalf, step1, ['mylist', 'xyz'], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.llen('mylist', function (err, length) {
                                if (err) {
                                  cb(err);
                                }
                                bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg15 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot blocking pop ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              //semantics loop(cli,start,end,step,[result,key,args])
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'brpop', 0, iterhalf, step1, ['mylist', 10], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'blpop', 0, iterhalf, step1, ['mylist', 10], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.llen('mylist', function (err, length) {
                                if (err) {
                                  cb(err);
                                }
                                bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg16 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot insert ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'linsert', 0, iterhalf, step1, ['mylist', 'after', 5, 'abc'], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'linsert', 0, iterhalf, step1, ['mylist', 'before', 7, 'xyz'], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.llen('mylist', function (err, length) {
                                if (err) {
                                  cb(err);
                                }
                                bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg17 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot rpoplpush ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist2', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                  if (err) {
                    cb(err);
                  }
                  bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist2', null], function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ut.serverInfo(client, 'used_memory', function (err, mem1) {
                      if (err) {
                        cb(err);
                      }
                      client.bgsave(function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        bg.multi_op(client, 'rpoplpush', 0, iterhalf, step1, ['mylist', 'mylist2'], function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          bg.multi_op(client, 'brpoplpush', 0, iterhalf, step1, ['mylist', 'mylist2', 10], function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.waitForBgsave(client, function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  client.llen('mylist', function (err, length) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err1, res) {
                                      if (err) {
                                        cb(err1);
                                      }
                                      bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist2', null], function (err2, res) {
                                        if (err) {
                                          cb(err2);
                                        }
                                        try {
                                          if ((!assert.ifError(err1, test_case)) && (!assert.ifError(err2, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                            ut.pass(test_case);
                                          }
                                        } catch (e) {
                                          ut.fail(e, true);
                                        }
                                        client.flushdb(function (err, res) {
                                          cb(null, null);
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
      });
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg18 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot lset ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'lset', 0, iterhalf, step1, ['mylist', null, 4000], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'lset', iterhalf, iter1, step1, ['mylist', null, 4000], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.llen('mylist', function (err, length) {
                            if (err) {
                              cb(err);
                            }
                            bg.check_op(client, 'lindex', 0, iter1, step1, [4000, 'mylist', null], function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  client.llen('mylist', function (err, length1) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                      if (err) {
                                        cb(err);
                                      }
                                      try {
                                        if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case)) && (!assert.equal(length1, iter1, test_case))) {
                                          ut.pass(test_case);
                                        }
                                      } catch (e) {
                                        ut.fail(e, true);
                                      }
                                      client.flushdb(function (err, res) {
                                        cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg19 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot lrem ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'lrem', 0, iterhalf, step1, ['mylist', 0, null], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'lrem', iterhalf, iter1, step1, ['mylist', 0, null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.llen('mylist', function (err, length) {
                                if (err) {
                                  cb(err);
                                }
                                bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg20 = function (errorCallback) {
    var list = [{
        type : 'zip',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'linked',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot ltrim ' + li.type + ' list';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'rpush', 0, iter1, step1, ['mylist', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ////in tcl it is &i here , we are doing $i here
                    bg.multi_op(client, 'ltrim', 0, iterhalf, step1, ['mylist', null, iter1], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'ltrim', iterhalf, iter1, step1, ['mylist', 0, null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.llen('mylist', function (err, length) {
                                if (err) {
                                  cb(err);
                                }
                                bg.check_op(client, 'lindex', 0, iter1, step1, [null, 'mylist', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if ((!assert.ifError(err, test_case)) && (!assert.equal(length, iter1, test_case))) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg21 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot sadd ' + li.type + ' set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'sadd', iterhalf, iter1, step1, ['myset', 5000], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'sadd', 0, iterhalf, step1, ['myset', 6000], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                try {
                                  if (!assert.ifError(err, test_case)) {
                                    ut.pass(test_case);
                                  }
                                } catch (e) {
                                  ut.fail(e, true);
                                }
                                client.flushdb(function (err, res) {
                                  cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg22 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot srem ' + li.type + ' set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'srem', 0, iterhalf, step1, ['myset', null], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'srem', iterhalf, iter1, step1, ['myset', null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                try {
                                  if (!assert.ifError(err, test_case)) {
                                    ut.pass(test_case);
                                  }
                                } catch (e) {
                                  ut.fail(e, true);
                                }
                                client.flushdb(function (err, res) {
                                  cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg23 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot smove ' + li.type + ' set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset2', iter1], function (err, res) {
                if (err) {
                  cb(err);
                }
                bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                  if (err) {
                    cb(err);
                  }
                  bg.sismember_op2(client, 'sismember', 0, iter1, step1, [[0, 1], ['myset2', 'myset2'], [null, iter1]], function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ut.serverInfo(client, 'used_memory', function (err, mem1) {
                      if (err) {
                        cb(err);
                      }
                      client.bgsave(function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        bg.multi_op(client, 'smove', 0, iterhalf, step1, ['myset', 'myset2', null], function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          bg.multi_op(client, 'smove', iterhalf, iter1, step1, ['myset', 'myset2', null], function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.waitForBgsave(client, function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.sismember_op2(client, 'sismember', 0, iter1, step1, [[0, 1], ['myset2', 'myset2'], [null, iter1]], function (err, res) {
                                      if (err) {
                                        cb(err);
                                      }
                                      try {
                                        if (!assert.ifError(err, test_case)) {
                                          ut.pass(test_case);
                                        }
                                      } catch (e) {
                                        ut.fail(e, true);
                                      }
                                      client.flushdb(function (err, res) {
                                        cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg24 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot sinterstore ' + li.type + ' set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset2', '*twice*'], function (err, res) {
                if (err) {
                  cb(err);
                }
                bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                  if (err) {
                    cb(err);
                  }
                  bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset2', '*twice*'], function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ut.serverInfo(client, 'used_memory', function (err, mem1) {
                      if (err) {
                        cb(err);
                      }
                      client.bgsave(function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        client.sinterstore('myset', 'myset2', 'myset', function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.sinterstore('myset2', 'myset2', 'myset', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.waitForBgsave(client, function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset2', '*twice*'], function (err, res) {
                                      if (err) {
                                        cb(err);
                                      }
                                      try {
                                        if (!assert.ifError(err, test_case)) {
                                          ut.pass(test_case);
                                        }
                                      } catch (e) {
                                        ut.fail(e, true);
                                      }
                                      client.flushdb(function (err, res) {
                                        cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg25 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot sunionstore ' + li.type + ' set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset2', '*twice*'], function (err, res) {
                if (err) {
                  cb(err);
                }
                bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                  if (err) {
                    cb(err);
                  }
                  bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset2', '*twice*'], function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ut.serverInfo(client, 'used_memory', function (err, mem1) {
                      if (err) {
                        cb(err);
                      }
                      client.bgsave(function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        client.sunionstore('myset', 'myset2', 'myset', function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.sunionstore('myset2', 'myset2', 'myset', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.waitForBgsave(client, function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset2', '*twice*'], function (err, res) {
                                      if (err) {
                                        cb(err);
                                      }
                                      try {
                                        if (!assert.ifError(err, test_case)) {
                                          ut.pass(test_case);
                                        }
                                      } catch (e) {
                                        ut.fail(e, true);
                                      }
                                      client.flushdb(function (err, res) {
                                        cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg26 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot sdiffstore ' + li.type + ' set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset', null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.multi_op(client, 'sadd', 0, iter1, step1, ['myset2', '*twice*'], function (err, res) {
                if (err) {
                  cb(err);
                }
                bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                  if (err) {
                    cb(err);
                  }
                  bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset2', '*twice*'], function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ut.serverInfo(client, 'used_memory', function (err, mem1) {
                      if (err) {
                        cb(err);
                      }
                      client.bgsave(function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        client.sdiffstore('myset', 'myset2', 'myset', function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.sdiffstore('myset2', 'myset2', 'myset', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.waitForBgsave(client, function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset', null], function (err, res) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.sismember_op(client, 'sismember', 0, iter1, step1, [1, 'myset2', '*twice*'], function (err, res) {
                                      if (err) {
                                        cb(err);
                                      }
                                      try {
                                        if (!assert.ifError(err, test_case)) {
                                          ut.pass(test_case);
                                        }
                                      } catch (e) {
                                        ut.fail(e, true);
                                      }
                                      client.flushdb(function (err, res) {
                                        cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg27 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot zadd ' + li.type + ' ordered set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'zadd', iterhalf, iter1, step1, ['myset', 5000, 5000], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', 6000, 6000], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                try {
                                  if (!assert.ifError(err, test_case)) {
                                    ut.pass(test_case);
                                  }
                                } catch (e) {
                                  ut.fail(e, true);
                                }
                                client.flushdb(function (err, res) {
                                  cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg28 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot zrem ' + li.type + ' ordered set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'zrem', 0, iterhalf, step1, ['myset', null], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'zrem', iterhalf, iter1, step1, ['myset', null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                try {
                                  if (!assert.ifError(err, test_case)) {
                                    ut.pass(test_case);
                                  }
                                } catch (e) {
                                  ut.fail(e, true);
                                }
                                client.flushdb(function (err, res) {
                                  cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg29 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot zincrby ' + li.type + ' ordered set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'zincrby', 0, iterhalf, step1, ['myset', iter1, null], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'zincrby', iterhalf, iter1, step1, ['myset', iter1, null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                try {
                                  if (!assert.ifError(err, test_case)) {
                                    ut.pass(test_case);
                                  }
                                } catch (e) {
                                  ut.fail(e, true);
                                }
                                client.flushdb(function (err, res) {
                                  cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg30 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot zremrangebyscore ' + li.type + ' ordered set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'zremrangebyscore', 0, iterhalf, step1, ['myset', 0, null], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'zremrangebyscore', iterhalf, iter1, step1, ['myset', 0, null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                try {
                                  if (!assert.ifError(err, test_case)) {
                                    ut.pass(test_case);
                                  }
                                } catch (e) {
                                  ut.fail(e, true);
                                }
                                client.flushdb(function (err, res) {
                                  cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg31 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot zremrangebyrank ' + li.type + ' ordered set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    client.zremrangebyrank('myset', 0, iterhalf, function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      client.zremrangebyrank('myset', 0, iter1, function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                try {
                                  if (!assert.ifError(err, test_case)) {
                                    ut.pass(test_case);
                                  }
                                } catch (e) {
                                  ut.fail(e, true);
                                }
                                client.flushdb(function (err, res) {
                                  cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };
  tester.bg32 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot zunionstore ' + li.type + ' ordered set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset2', '*twice*', '*twice*'], function (err, res) {
                if (err) {
                  cb(err);
                }
                bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                  if (err) {
                    cb(err);
                  }
                  bg.check_op(client, 'zscore', 0, iter1, step1, ['*twice*', 'myset2', '*twice*'], function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ut.serverInfo(client, 'used_memory', function (err, mem1) {
                      if (err) {
                        cb(err);
                      }
                      client.bgsave(function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        client.zunionstore('myset', 2, 'myset2', 'myset', function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.zunionstore('myset2', 2, 'myset2', 'myset', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.waitForBgsave(client, function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.check_op(client, 'zscore', 0, iter1, step1, ['*twice*', 'myset2', '*twice*'], function (err, res) {
                                      if (err) {
                                        cb(err);
                                      }
                                      try {
                                        if (!assert.ifError(err, test_case)) {
                                          ut.pass(test_case);
                                        }
                                      } catch (e) {
                                        ut.fail(e, true);
                                      }
                                      client.flushdb(function (err, res) {
                                        cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg33 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot zinterstore ' + li.type + ' ordered set';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.multi_op(client, 'zadd', 0, iter1, step1, ['myset2', '*twice*', '*twice*'], function (err, res) {
                if (err) {
                  cb(err);
                }
                bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                  if (err) {
                    cb(err);
                  }
                  bg.check_op(client, 'zscore', 0, iter1, step1, ['*twice*', 'myset2', '*twice*'], function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    ut.serverInfo(client, 'used_memory', function (err, mem1) {
                      if (err) {
                        cb(err);
                      }
                      client.bgsave(function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        client.zinterstore('myset', 2, 'myset2', 'myset', function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.zinterstore('myset2', 2, 'myset2', 'myset', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.waitForBgsave(client, function (err, res) {
                              if (err) {
                                cb(err);
                              }
                              client.debug('flushload', function (err, res) {
                                if (err) {
                                  cb(err);
                                }
                                ut.serverInfo(client, 'used_memory', function (err, mem2) {
                                  if (err) {
                                    cb(err);
                                  }
                                  if ((mem2 - mem1) > 500) {
                                    console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                                  }
                                  bg.check_op(client, 'zscore', 0, iter1, step1, [null, 'myset', null], function (err, res) {
                                    if (err) {
                                      cb(err);
                                    }
                                    bg.check_op(client, 'zscore', 0, iter1, step1, ['*twice*', 'myset2', '*twice*'], function (err, res) {
                                      if (err) {
                                        cb(err);
                                      }
                                      try {
                                        if (!assert.ifError(err, test_case)) {
                                          ut.pass(test_case);
                                        }
                                      } catch (e) {
                                        ut.fail(e, true);
                                      }
                                      client.flushdb(function (err, res) {
                                        cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg34 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot hdel ' + li.type + ' hash';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'hset', 0, iter1, step1, ['myhash', null, null], function (err, res) {
              if (err) {
                cb(err);
              }

              bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'hdel', 0, iterhalf, step1, ['myhash', null], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'hdel', iterhalf, iter1, step1, ['myhash', null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.hlen('myhash', function (err, res) {
                                if (res != iter1) {
                                  assert.fail(res)
                                }
                                bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if (!assert.ifError(err, test_case)) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg35 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot hset ' + li.type + ' hash';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'hset', 0, iter1, step1, ['myhash', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'hset', 0, iterhalf, step1, ['myhash', null, 5000], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'hset', iterhalf, iter1, step1, ['myhash', null, 6000], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.hlen('myhash', function (err, res) {
                                if (res != iter1) {
                                  assert.fail(res)
                                }
                                bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if (!assert.ifError(err, test_case)) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg36 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot hsetnx ' + li.type + ' hash';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'hset', 0, iter1, step1, ['myhash', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'hsetnx', 0, iterhalf, step1, ['myhash', 5000, null], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'hsetnx', iterhalf, iter1, step1, ['myhash', 6000, null], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.hlen('myhash', function (err, res) {
                                if (res != iter1) {
                                  assert.fail(res)
                                }
                                bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if (!assert.ifError(err, test_case)) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg37 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot hmset ' + li.type + ' hash';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'hset', 0, iter1, step1, ['myhash', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'hmset', 0, iterhalf, step1, ['myhash', null, 5000, 5000, 5000], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'hmset', iterhalf, iter1, step1, ['myhash', 6000, 6000, 6000], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.hlen('myhash', function (err, res) {
                                if (res != iter1) {
                                  assert.fail(res)
                                }
                                bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if (!assert.ifError(err, test_case)) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg38 = function (errorCallback) {
    var list = [{
        type : 'small',
        iter1 : 10,
        iterhalf : 5,
        step1 : 1
      }, {
        type : 'large',
        iter1 : 1000,
        iterhalf : 500,
        step1 : 1
      }
    ];
    async.mapSeries(list, function (li, cb) {
      var iter1 = li.iter1;
      var iterhalf = li.iterhalf;
      var step1 = li.step1;
      var test_case = 'BGSAVE snapshot hincrby ' + li.type + ' hash';
      ut.waitForBgsave(client, function (err, res) {
        if (err) {
          cb(err);
        }
        client.flushdb(function (err, res) {
          if (err) {
            cb(err);
          }
          client.save(function (err, res) {
            if (err) {
              cb(err);
            }
            bg.multi_op(client, 'hset', 0, iter1, step1, ['myhash', null, null], function (err, res) {
              if (err) {
                cb(err);
              }
              bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                if (err) {
                  cb(err);
                }
                ut.serverInfo(client, 'used_memory', function (err, mem1) {
                  if (err) {
                    cb(err);
                  }
                  client.bgsave(function (err, res) {
                    if (err) {
                      cb(err);
                    }
                    bg.multi_op(client, 'hincrby', 0, iterhalf, step1, ['myhash', null, 1000], function (err, res) {
                      if (err) {
                        cb(err);
                      }
                      bg.multi_op(client, 'hincrby', iterhalf, iter1, step1, ['myhash', null, 2000], function (err, res) {
                        if (err) {
                          cb(err);
                        }
                        ut.waitForBgsave(client, function (err, res) {
                          if (err) {
                            cb(err);
                          }
                          client.debug('flushload', function (err, res) {
                            if (err) {
                              cb(err);
                            }
                            ut.serverInfo(client, 'used_memory', function (err, mem2) {
                              if (err) {
                                cb(err);
                              }
                              if ((mem2 - mem1) > 500) {
                                console.log('Warning: used memory before save ' + mem1 + ' after flushload ' + mem2);
                              }
                              client.hlen('myhash', function (err, res) {
                                if (res != iter1) {
                                  assert.fail(res)
                                }
                                bg.check_op(client, 'hget', 0, iter1, step1, [null, 'myhash', null], function (err, res) {
                                  if (err) {
                                    cb(err);
                                  }
                                  try {
                                    if (!assert.ifError(err, test_case)) {
                                      ut.pass(test_case);
                                    }
                                  } catch (e) {
                                    ut.fail(e, true);
                                  }
                                  client.flushdb(function (err, res) {
                                    cb(null, null);
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
    }, function (err, rep) {
      if (err) {
        errorCallback(err)
      }
      testEmitter.emit('next');
    });
  };

  tester.bg39 = function (errorCallback) {
    var test_case = 'BGSAVE expires';
    ut.waitForBgsave(client, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.flushdb(function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.set('x', 10, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.expire('x', 1000, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.bgsave(function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.expire('x', 2, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                ut.waitForBgsave(client, function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.debug('flushload', function (err, res) {
                    if (err) {
                      errorCallback(err);
                    }
                    client.ttl('x', function (err, ttl) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.flushdb(function (err, res) {
                        try {
                          if ((!assert.equal(res, 'OK', test_case)) && (!assert.ok((ttl > 900) ? true : false, test_case)) && (!assert.ok((ttl <= 1000) ? true : false, test_case))) {
                            ut.pass(test_case);
                            testEmitter.emit('next');
                          }
                        } catch (e) {
                          ut.fail(e, true);
                          testEmitter.emit('next');
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
  };

  return bgsave;

}
  ());