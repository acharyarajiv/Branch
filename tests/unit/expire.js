exports.Expire = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  expire = {},
  name = "Expire",
  client = "", tester = {}, server_pid = "", all_tests = {};

  //public property
  expire.debug_mode = false;

  //public method
  expire.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = "expire";
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
      var test_case_name = all_tests.shift()
      if (test_case_name) {
        tester[test_case_name](function (error) {
          ut.fail(error);
          testEmitter.emit('next');
        });
      } else {
        client.end();
        if (expire.debug_mode) {
          log.notice(name + ":Client disconnected listeting to socket : " + g.srv[client_pid][server_pid]['host'] + ":" + g.srv[client_pid][server_pid]['port']);
        }
        testEmitter.emit('end');
      }
    });
    testEmitter.on('end', function () {
      server.kill_server(client_pid, server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        }
        callback(null, true);
      });
    });

    if (expire.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  // private methods

  function checkrange(value, start, end) {
    return (value >= start && value <= end) ? true : false;
  };

 /* tester.expire1 = function (errorCallback) {
    var test_case = "EXPIRE - set timeouts multiple times";
    var result_array = new Array();
    client.set('x', 'foobar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.expire('x', 5, function (err, v1) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(v1);
        client.ttl('x', function (err, v2) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(v2);
          client.expire('x', 10, function (err, v3) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(v3);
            client.ttl('x', function (err, v4) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(v4);
              client.expire('x', 4, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                // has the same output in Tcl
                try {
                  if (!assert.deepEqual(result_array, [1, 5, 1, 10], test_case)) {
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
  };

  tester.expire2 = function (errorCallback) {
    var test_case = "EXPIRE - It should be still possible to read 'x'";
    client.get('x', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      try {
        if (!assert.equal(res, 'foobar', test_case)) {
          ut.pass(test_case);
          testEmitter.emit('next');
        }
      } catch (e) {
        ut.fail(e, true);
        testEmitter.emit('next');
      }
    })
  };
  tester.expire3 = function (errorCallback) {
    var result_array = new Array();
    var test_case = "EXPIRE - After 6 seconds the key should no longer be here";
    setTimeout(function () {
      client.get('x', function (err, l1) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(l1);
        client.exists('x', function (err, l2) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(l2);
          try {
            if (!assert.deepEqual(result_array, [null, 0], test_case)) {
              ut.pass(test_case);
              testEmitter.emit('next');
            }
          } catch (e) {
            ut.fail(e, true);
            testEmitter.emit('next');
          }
        });
      });
    }, 6000)
  };

  tester.expire4 = function (errorCallback) {
    var test_case = "EXPIRE - write on expire should work";
    client.del('x', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.lpush('x', 'foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.expire('x', 1000, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.lpush('x', 'bar', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.lrange('x', 0, -1, function (err, res) {
              if (err) {
                errorCallback(err);
              }
              try {
                if (!assert.equal(res, 'bar,foo', test_case)) {
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
  };

  tester.expire5 = function (errorCallback) {
    var test_case = "EXPIREAT - Check for EXPIRE alike behavior";
    client.del('x', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('x', 'foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.expireat('x', (Math.round(new Date().getTime() / 1000) + 15), function (err, res1) {
          if (err) {
            errorCallback(err);
          }
          client.ttl('x', function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            // has the same output in Tcl, providing leniency of +-1 
            try {
              if ((!assert.deepEqual(res1, 1, test_case)) && (!assert.ok(checkrange(res2, 14, 16), test_case))) {
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
  };

  tester.expire6 = function (errorCallback) {
    var result_array = new Array();
    var test_case = "SETEX - Set + Expire combo operation. Check for TTL";
    client.setex('x', 12, 'test', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      result_array.push(res)
      client.ttl('x', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res)
        // has the same output in Tcl
        try {
          if (!assert.deepEqual(result_array, ['OK', 12], test_case)) {
            ut.pass(test_case);
            testEmitter.emit('next');
          }
        } catch (e) {
          ut.fail(e, true);
          testEmitter.emit('next');
        }
      });
    });
  };

  tester.expire7 = function (errorCallback) {
    var test_case = "SETEX - Check value";
    client.get('x', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      try {
        if (!assert.equal(res, 'test', test_case)) {
          ut.pass(test_case);
          testEmitter.emit('next');
        }
      } catch (e) {
        ut.fail(e, true);
        testEmitter.emit('next');
      }
    });
  };

  tester.expire8 = function (errorCallback) {
    var test_case = "SETEX - Overwrite old key";
    client.setex('y', 1, 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.get('y', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        try {
          if (!assert.equal(res, 'foo', test_case)) {
            ut.pass(test_case);
            testEmitter.emit('next');
          }
        } catch (e) {
          ut.fail(e, true);
          testEmitter.emit('next');
        }
      });
    });
  };

  tester.expire9 = function (errorCallback) {
    var test_case = "SETEX - Wait for the key to expire";
    setTimeout(function () {
      client.get('y', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        try {
          if (!assert.equal(res, null, test_case)) {
            ut.pass(test_case);
            testEmitter.emit('next');
          }
        } catch (e) {
          ut.fail(e, true);
          testEmitter.emit('next');
        }
      });
    }, 3000);
  };

  tester.expire9_1 = function (errorCallback) {
    var test_case = "SETEX - Wrong time parameter";
    try {
      client.setex('z', -10, 'foo', function (err, res) {
        try {
          if (!assert.ok(ut.match('invalid expire', err), test_case)) {
            ut.pass(test_case);
            testEmitter.emit('next');
          }
        } catch (e) {
          ut.fail(e, true);
          testEmitter.emit('next');
        }
      });
    } catch (e) {
      console.log("e-" + err);
    }
  };

  tester.expire10 = function (errorCallback) {
    var result_array = new Array();
    var test_case = "PERSIST can undo an EXPIRE";
    client.set('x', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.expire('x', 50, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.ttl('x', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res)
          client.persist('x', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            result_array.push(res)
            client.ttl('x', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              result_array.push(res)
              client.get('x', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                result_array.push(res)
                try {
                  if (!assert.deepEqual(result_array, [50, 1, -1, 'foo'], test_case)) {
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
  };

  tester.expire11 = function (errorCallback) {
    var result_array = new Array();
    var test_case = "PERSIST returns 0 against non existing or non volatile keys";
    client.set('x', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.persist('foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        result_array.push(res)
        client.persist('nokeyatall', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result_array.push(res)
          try {
            if (!assert.equal(result_array, '0,0', test_case)) {
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
  };

  tester.expire12 = function (errorCallback) {
    var test_case = "AOF with EXPIRE and SETEX";
    client.config('set', 'appendfsync', 'always', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setex('z', 5, 'xyz', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.set('y', 'bar', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.expireat('y', (Math.round(new Date().getTime() / 1000) + 5), function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.set('x', 'foo', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              client.expire('x', 5, function (err, res) {
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
                    try {
                      if (!assert.ok(res, test_case)) {
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
  };

  */ 
 tester.expire13 = function (errorCallback) {
    var test_case = "5 keys in, 5 keys out";
    var result_array = new Array();
    client.flushdb(function (err, res) {
        if (err) {
            errorCallback(err);
        }
        client.set('a', 'c', function (err, res) {
            if (err) {
                errorCallback(err);
            }
            client.expire('a', 5, function (err, v3) {
                if (err) {
                    errorCallback(err);
                }
				result_array.push('a')
                client.set('t', 'c', function (err, res) {
                    if (err) {
                        errorCallback(err);
                    }
                    result_array.push('t')
                    client.set('e', 'c', function (err, res) {
                        if (err) {
                            errorCallback(err);
                        }
                        result_array.push('e')
                        client.set('s', 'c', function (err, res) {
                            if (err) {
                                errorCallback(err);
                            }
                            result_array.push('s')
                            client.set('foo', 'b', function (err, res) {
                                if (err) {
                                    errorCallback(err);
                                }
                                result_array.push('foo')
                                //client.lsort(result_array, function (err, sortres) {
                                    //if (err) {
                                        //errorCallback(err);
                                    //}
                                    try {
                                        if (!assert.deepEqual(result_array.sort(), ['a', 'e', 'foo', 's', 't'], test_case)) {
                                            ut.pass(test_case);
                                            testEmitter.emit('next');
                                        }
                                    } catch (e) {
                                        ut.fail(e, true);
                                        testEmitter.emit('next');
                                    }
                                //});
                            });
                        });
                    });
                });
            });
        });
    });
  };

  tester.expire14 = function (errorCallback) {  
    var test_case = "PTTL returns millisecond time to live";
    client.del('x', function (err, res) {
        if (err) {
            errorCallback(err);
        }
        client.setex('x', 1, 'somevalue', function (err, res) {
            if (err) {
                errorCallback(err);
            }
            client.pttl('x', function (err, res1) {
                if (err) {
                    errorCallback(err);
                }
                client.set('ttl', res1, function (err, res2) {
                    if (err) {
                        errorCallback(err);
                    }
                    try {
                        if ((!assert(res1 > 900, test_case)) && (!assert(res1 <= 1000, test_case))) {
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
  };
 
 tester.expire15 = function (errorCallback) {
    var test_case = "EXPIRE precision is now the millisecond";
    /*  This test is very likely to do a false positive if the
    server is under pressure, so if it does not work give it a few more
    chances. */
    for (var j = 0; j < 10; j++) {
        client.del('x', function (err, res) {
            if (err) {
                errorCallback(err);
            }
            client.setex('x', 1, 'somevalue', function (err, res) {
                if (err) {
                    errorCallback(err);
                }
                setTimeout(function () {
                    client.get(x, function (err, res1) {
                        if (err) {
                            errorCallback(err);
                        }
                        client.set('a', res1, function (err, res) {
                            if (err) {
                                errorCallback(err);
                            }
                        });
                    });
                }, 900)
                setTimeout(function () {
                    client.get('x', function (err, res2) {
                        if (err) {
                            errorCallback(err);
                        }
                        client.set('b', res2, function (err, res) {
                            if (err) {
                                errorCallback(err);
                            }
                        });
                    });
                }, 1100)
            });
        });
        if ((!assert.equal('a', 'somevalue', test_case)) && (!assert.equal('b', {}, test_case))) {
            break;
        }
    };
    client.list('a', 'b', function (err, res) {
        if (err) {
            errorCallback(err);
        }
        try {
            if (!assert.equal(res, ['somevalue', {}], test_case)) {
                ut.pass(test_case);
                testEmitter.emit('next');
            }
        } catch (e) {
            ut.fail(e, true);
            testEmitter.emit('next');
        }
    });
  };
  
 tester.expire16 = function (errorCallback) {
 	var test_case = "Redis should actively expire keys incrementally";
	var res1 = "1",res2 = "";
	 client.get('size1',function(err,res){
		 res1 = res;
	 });
 	client.flushdb();
 	client.psetex('key1', 500, 'a', function (err, res) {
 		if (err) {
 			errorCallback(err);
 		}
 		client.psetex('key2', 500, 'a', function (err, res) {
 			if (err) {
 				errorCallback(err);
 			}
 			client.psetex('key3', 500, 'a', function (err, res) {console.log(1)
 				if (err) {
 					errorCallback(err);
 				}
 				client.dbsize(function (err, res) {
 					if (err) {
 						errorCallback(err);
 					}					
 					 client.set('size1', res, function (err, res) {
 						if (err) {
 							errorCallback(err);
 						}
						
 					}); 
 				});
 			});
 		});
 	});
 	/* Redis expires random keys ten times every second so we are
 	fairly sure that all the three keys should be evicted after
 	one second.*/

 	setTimeout(function () {
 		client.dbsize(function (err, size2) {
 			if (err) {
 				errorCallback(err);
 			}
			res2 = size2
 		});
 		/* client.set('size2', res, function (err, res) {
 			if (err) {
 				errorCallback(err);
 			}
 		}); */
 	}, 1000);
 	try {
 		if ((!assert.equal(res1, 3, test_case)) && (!assert.equal(res2, 0, test_case))) {
 				ut.pass(test_case);
 				testEmitter.emit('next');
 			}
 		} catch (e) {
 			ut.fail(e, true);
 			testEmitter.emit('next');
 		}
 	};
  /* tester.expire15 = function (errorCallback) {
	var test_case = "PEXPIRE/PSETEX/PEXPIREAT can set sub-second expires";
	/* This test is very likely to do a false positive if the
		server is under pressure, so if it does not work give it a few more
	chances*//*
	for (var j = 0; j < 10; j++) {
		client.del('x', 'y', 'z', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.psetex('x', 100, 'somevalue', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				setTimeout(function () {
					client.get('x', function (err, res1) {
						if (err) {
							errorCallback(err);
						}
						client.set('a', res1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
						});
					});
				}, 80)
				setTimeout(function () {
					client.get('x', function (err, res2) {
						if (err) {
							errorCallback(err);
						}
						client.set('b', res2, function (err, res) {
							if (err) {
								errorCallback(err);
							}
						});
					});
				}, 120)
				
				client.set('x', 'somevalue', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					client.pexpire('x', 100, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						setTimeout(function () {
							client.get('x', function (err, res1) {
								if (err) {
									errorCallback(err);
								}
								client.set('c', res1, function (err, res) {
									if (err) {
										errorCallback(err);
									}
								});
							});
						}, 80)
						setTimeout(function () {
							client.get('x', function (err, res2) {
								if (err) {
									errorCallback(err);
								}
								client.set('d', res2, function (err, res) {
									if (err) {
										errorCallback(err);
									}
								});
							});
						}, 120)
						client.set('x', 'somevalue', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							client.pexpireat('x', [], function (err, res) {
								if (err) {
									errorCallback(err);
								}
								setTimeout(function () {
									client.get('x', function (err, res1) {
										if (err) {
											errorCallback(err);
										}
										client.set('e', res1, function (err, res) {
											if (err) {
												errorCallback(err);
											}
										});
									});
								}, 80)
								setTimeout(function () {
									client.get('x', function (err, res2) {
										if (err) {
											errorCallback(err);
										}
										client.set('f', res2, function (err, res) {
											if (err) {
												errorCallback(err);
											}
										});
									});
								}, 120)
							});
						});
					});
				});
			});
		});
		 if ((!assert.equal('a', 'somevalue', test_case)) && (!assert.equal('b', {}, test_case)) &&
		(!assert.equal('c', 'somevalue', test_case)) && (!assert.equal('d', {}, test_case)) &&
		(!assert.equal('e', 'somevalue', test_case)) && (!assert.equal('f', {}, test_case))) {
			break;
		} 
	};
	client.list('a', 'b', function (err, res) {
		if (err) {
			errorCallback(err);
		}
		try {
			if (!assert.equal(res, ['somevalue', {}
			
			], test_case)) {
				ut.pass(test_case);
				testEmitter.emit('next');
			}
			} catch (e) {
			ut.fail(e, true);
			testEmitter.emit('next');
		}
	});
};
   */
  return expire;

}());