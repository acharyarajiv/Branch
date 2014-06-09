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

exports.Dump = (function () {
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	server1 = new Server(),
	server2 = new Server(),
	server3 = new Server(),
	server4 = new Server(),
	server5 = new Server();
	var dump = {},
	name = 'Dump',
	client = '',
	server_host = '',
	server_port = '',
	tester = {},
	server_pid = '',
	all_tests = '',
	client_pid = '';

	//public property
	dump.debug_mode = false;

	dump.start_test = function (cpid, callback) {
		testEmitter.on('start', function () {
			var tags = 'dump';
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
			setTimeout(function(){
				var test_case_name = all_tests.shift()
				if (test_case_name) {
					tester[test_case_name](function (error) {
						ut.fail(error);
						testEmitter.emit('next');
					});
				} else {
					client.end();
					if (dump.debug_mode) {
						log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
					}
					testEmitter.emit('end');
				}
			},ut.timeout);
		});
		if (dump.debug_mode) {
			server.set_debug_mode(true);
		}
		testEmitter.emit('start');
	}

	// test methods
	tester.dump1 = function (errorCallback) {
		var test_case = 'DUMP / RESTORE are able to serialize / unserialize a simple key';
		var encoded = '';
		var newClient = redis.createClient(server_port, server_host, {
				return_buffers : true
			});
		newClient.on('error', function (err) {
			newClient.end();
		});
		newClient.set('foo', 'bar');
		newClient.dump('foo', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			encoded = res;
			newClient.del('foo');
			newClient.exists('foo', function (err, exist) {
				if (err) {
					errorCallback(err);
				}
				newClient.restore('foo', 0, encoded, function (err, resRes) {
					if (err) {
						errorCallback(err);
					}
					newClient.ttl('foo', function (err, ttlres) {
						if (err) {
							errorCallback(err);
						}
						newClient.get('foo', function (err, res) {
							ut.assertMany(
								[
									['equal',exist, 0],
									['equal',resRes, 'OK'],
									['equal',ttlres, -1],
									['equal',res, 'bar']
								],test_case);
							newClient.end();
							testEmitter.emit('next');
						});
					})
				});
			});
		});
	};

	tester.dump2 = function (errorCallback) {
		var test_case = 'RESTORE can set an arbitrary expire to the materialized key';
		var newClient = redis.createClient(server_port, server_host, {
				return_buffers : true
			});
		newClient.on('error', function (err) {
			newClient.end();
		});
		newClient.set('foo', 'bar');
		newClient.dump('foo', function (err, encoded) {
			if (err) {
				errorCallback(err);
			}
			newClient.del('foo');
			newClient.restore('foo', 5000, encoded, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				newClient.pttl('foo', function (err, ttl) {
					if (err) {
						errorCallback(err);
					}
					try {
						if (!assert(ttl >= 3000 && ttl <= 5000, test_case)) {
							newClient.get('foo', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								ut.assertEqual(res, 'bar', test_case);
								newClient.end();
								testEmitter.emit('next');
							});
						}
					} catch (e) {
						ut.fail(e, true);
						newClient.end();
						testEmitter.emit('next');
					}
				});
			});
		});
	};
	
	tester.dump3 = function (errorCallback){
		var test_case = 'RESTORE can set an expire that overflows a 32 bit integer';
		var newClient = redis.createClient(server_port, server_host, {
				return_buffers : true
			});
		newClient.on('error', function (err) {
			newClient.end();
		});
		newClient.set('foo', 'bar');
		newClient.dump('foo', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			encoded = res;
			newClient.del('foo');
			newClient.restore('foo', 2569591501, encoded, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				newClient.pttl('foo', function (err, ttl) {
					if (err) {
						errorCallback(err);
					}
					try{
						if (!assert(ttl >= (2569591501-3000) && ttl <= 2569591501, test_case)) {
							newClient.get('foo', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								ut.assertEqual(res, 'bar', test_case);
								newClient.end();
								testEmitter.emit('next');
							});
						}
					} catch (e) {
						ut.fail(e, true);
						newClient.end();
						testEmitter.emit('next');
					}
				});
			});
		});
	};

	tester.dump4 = function (errorCallback) {
		var test_case = 'RESTORE returns an error of the key already exists';
		client.set('foo', 'bar');
		client.restore('foo', 0, '...', function (err, res) {
			ut.assertOk('is busy', err, test_case);
			testEmitter.emit('next');
		});
	};

	tester.dump5 = function (errorCallback) {
		var test_case = 'DUMP of non existing key returns nil'
			client.dump('nonexisting_key', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertEqual(res, null, test_case);
				testEmitter.emit('next');
			});
	};

	tester.dump6 = function (errorCallback) {
		var test_case = 'MIGRATE is able to migrate a key between two instances';
		var first = g.srv[client_pid][server_pid]['client'];
		client.set('key', 'Some Value');

		var args = {};
		args['name'] = name;
		args['tags'] = 'repl';
		args['overrides'] = {};
		server1.start_server(client_pid, args, function (err, res) {
			if (err) {
				errorCallback(err, null);
			}
			var server_pid1 = res;
			var second = g.srv[client_pid][server_pid1]['client'];
			second_server_host = g.srv[client_pid][server_pid1]['host'];
			second_server_port = g.srv[client_pid][server_pid1]['port'];
			first.exists('key', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				try {
					if (!assert.equal(res, 1, test_case)) {
						second.exists('key', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							if (res == 0) {
								client.migrate(second_server_host, second_server_port, 'key', 0, 5000, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									if (res == 'OK') {
										first.exists('key', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											if (res == 0) {
												second.exists('key', function (err, res) {
													if (err) {
														errorCallback(err);
													}
													if (res == 1) {
														second.get('key', function (err, res) {
															if (err) {
																errorCallback(err);
															}
															if (res == 'Some Value') {
																second.ttl('key', function (err, res) {
																	if (err) {
																		errorCallback(err);
																	}
																	ut.assertEqual(res, -1, test_case);
																	second.end();
																	server1.kill_server(client_pid, server_pid1, function (err, res) {
																		testEmitter.emit('next');
																	});
																});
															} else {
																ut.fail('Key value: ' + res + ' do not match with expected value: Some Value', true);
																second.end();
																server1.kill_server(client_pid, server_pid1, function (err, res) {

																	testEmitter.emit('next');
																});
															}
														});
													} else {
														ut.fail('Key dosen\'t exists in second Client', true);
														second.end();
														server1.kill_server(client_pid, server_pid1, function (err, res) {

															testEmitter.emit('next');
														});
													}
												});
											} else {
												ut.fail('Key Exists in first Client', true);
												second.end();
												server1.kill_server(client_pid, server_pid1, function (err, res) {

													testEmitter.emit('next');
												});
											}
										});
									} else {
										ut.fail('Error occured while performing migrate. check the logs', true);
										second.end();
										server1.kill_server(client_pid, server_pid1, function (err, res) {

											testEmitter.emit('next');
										});
									}
								});
							} else {
								ut.fail('Key Exists in Second Client', true);
								second.end();
								server1.kill_server(client_pid, server_pid1, function (err, res) {

									testEmitter.emit('next');
								});
							}
						});
					}
				} catch (e) {
					ut.fail(e, true);
					second.end();
					server1.kill_server(client_pid, server_pid1, function (err, res) {

						testEmitter.emit('next');
					});
				}
			});
		});
	};

	tester.dump7 = function (errorCallback) {
		var test_case = 'MIGRATE propagates TTL correctly';
		var first = g.srv[client_pid][server_pid]['client'];
		client.set('key', 'Some Value');

		var args = {};
		args['name'] = name;
		args['tags'] = 'repl';
		args['overrides'] = {};
		server2.start_server(client_pid, args, function (err, res) {
			if (err) {
				errorCallback(err, null);
			}
			var server_pid1 = res;
			var second = g.srv[client_pid][server_pid1]['client'];
			second_server_host = g.srv[client_pid][server_pid1]['host'];
			second_server_port = g.srv[client_pid][server_pid1]['port'];
			first.exists('key', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				try {
					if (res == 1) {
						second.exists('key', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							if (res == 0) {
								first.expire('key', 10);
								client.migrate(second_server_host, second_server_port, 'key', 0, 5000, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									if (res == 'OK') {
										first.exists('key', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											if (res == 0) {
												second.exists('key', function (err, res) {
													if (err) {
														errorCallback(err);
													}
													if (res == 1) {
														second.get('key', function (err, res) {
															if (err) {
																errorCallback(err);
															}
															if (res == 'Some Value') {
																second.ttl('key', function (err, res) {
																	if (err) {
																		errorCallback(err);
																	}
																	if (res >= 7 && res <= 10)
																		ut.pass(test_case);
																	else
																		ut.fail('Value of ttl donot match ' + res, true);
																	second.end();
																	server2.kill_server(client_pid, server_pid1, function (err, res) {
																		testEmitter.emit('next');
																	});
																});
															} else {
																ut.fail('Key value: ' + res + ' do not match with expected value: Some Value', true);
																second.end();
																server2.kill_server(client_pid, server_pid1, function (err, res) {
																	testEmitter.emit('next');
																});
															}
														});
													} else {
														ut.fail('Key dosen\'t exists in second Client', true);
														second.end();
														server2.kill_server(client_pid, server_pid1, function (err, res) {
															testEmitter.emit('next');
														});
													}
												});
											} else {
												ut.fail('Key Exists in first Client', true);
												second.end();
												server2.kill_server(client_pid, server_pid1, function (err, res) {
													testEmitter.emit('next');
												});
											}
										});
									} else {
										ut.fail('Error occured while performing migrate. check the logs', true);
										second.end();
										server2.kill_server(client_pid, server_pid1, function (err, res) {
											testEmitter.emit('next');
										});
									}
								});
							} else {
								ut.fail('Key Exists in second client', true);
								second.end();
								server2.kill_server(client_pid, server_pid1, function (err, res) {
									testEmitter.emit('next');
								});
							}
						});
					} else {
						ut.fail('Key donot exist in first client', true);
						second.end();
						server2.kill_server(client_pid, server_pid1, function (err, res) {
							testEmitter.emit('next');
						});
					}
				} catch (e) {
					ut.fail(e, true);
					second.end();
					server2.kill_server(client_pid, server_pid1, function (err, res) {
						testEmitter.emit('next');
					});
				}
			});
		});
	};

	tester.dump8 = function (errorCallback) {
		var test_case = 'MIGRATE can correctly transfer hashes';
		var first = g.srv[client_pid][server_pid]['client'];
		client.del('key');
		client.hmset('key', 'field1', 'item 1', 'field2', 'item 2', 'field3', 'item 3',
			'field4', 'item 4', 'field5', 'item 5', 'field6', 'item 6', function (err, res) {
			var args = {};
			args['name'] = name;
			args['tags'] = 'repl';
			args['overrides'] = {};
			server4.start_server(client_pid, args, function (err, res) {
				if (err) {
					errorCallback(err, null);
				}
				var server_pid1 = res;
				var second = g.srv[client_pid][server_pid1]['client'];
				second_server_host = g.srv[client_pid][server_pid1]['host'];
				second_server_port = g.srv[client_pid][server_pid1]['port'];
				first.exists('key', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					try {
						if (!assert.equal(res, 1, test_case)) {
							second.exists('key', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								if (!assert.equal(res, 0, test_case)) {
									client.migrate(second_server_host, second_server_port, 'key', 0, 10000, function (err, res) {
										if (err) {
											errorCallback(err);
										}
										if (!assert.equal(res, 'OK', test_case)) {
											first.exists('key', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												if (!assert.equal(res, 0, test_case)) {
													second.exists('key', function (err, res) {
														if (err) {
															errorCallback(err);
														}
														if (!assert.equal(res, 1, test_case)) {
															second.ttl('key', function (err, res) {
																if (err) {
																	errorCallback(err);
																}
																ut.assertEqual(res, -1, test_case);
																second.end();
																server4.kill_server(client_pid, server_pid1, function (err, res) {
																	if (err) {
																		errorCallback(err);
																	};
																	testEmitter.emit('next');

																});
															});
														}
													});
												}
											});
										}
									});
								}
							});
						}
					} catch (e) {
						ut.fail(e);
						second.end();
						server4.kill_server(client_pid, server_pid1, function (err, res) {
							if (err) {
								errorCallback(err);
							};
							testEmitter.emit('next');
						});
					}
				});

			});
		});
	};

	tester.dump9 = function (errorCallback) {
		var test_case = 'MIGRATE timeout actually works';
		var first = g.srv[client_pid][server_pid]['client'];
		client.set('key', 'Some Value');
		var args = {};
		args['name'] = name;
		args['tags'] = 'repl';
		args['overrides'] = {};
		server5.start_server(client_pid, args, function (err, res) {
			if (err) {
				errorCallback(err, null);
			}

			var server_pid1 = res;
			var second = g.srv[client_pid][server_pid1]['client'];
			second_server_host = g.srv[client_pid][server_pid1]['host'];
			second_server_port = g.srv[client_pid][server_pid1]['port'];
			first.exists('key', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				try {
					if (!assert.equal(res, 1, test_case)) {
						second.exists('key', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							if (!assert.equal(res, 0, test_case)) {
								var newClient = redis.createClient(second_server_port, second_server_host);
								newClient.debug('sleep', 5.0);
								setTimeout(function () {
									client.migrate(second_server_host, second_server_port, 'key', 0, 1000, function (err, res) {
										ut.assertOk('IOERR', err, test_case)
										newClient.end();
										second.end();
										server5.kill_server(client_pid, server_pid1, function (err, res) {
											testEmitter.emit('next');
										});
									});
								}, 50);
							}
						});
					}
				} catch (e) {
					ut.fail(e, true);
					second.end();
					server5.kill_server(client_pid, server_pid1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						testEmitter.emit('next');
					});
				}
			});

		});
	};

	tester.dump10 = function (errorCallback) {
		var test_case = 'MIGRATE can correctly transfer large values';
		var first = g.srv[client_pid][server_pid]['client'];
		client.del('key');
		g.asyncFor(0, 5000, function (loop) {
			client.rpush('key', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpush('key', ['item 1', 'item 2', 'item 3', 'item 4', 'item 5', 'item 6', 'item 7', 'item 8', 'item 9', 'item 10'], function (err, res) {
					if (err) {
						errorCallback(err);
					}
					loop.next();
				});
			});
		}, function () {
			client.dump('key', function (err, res) {
				if (res.toString().length > 1024 * 64) {
					var args = {};
					args['name'] = name;
					args['tags'] = 'repl';
					args['overrides'] = {};
						server3.start_server(client_pid, args, function (err, res) {
							if (err) {
								errorCallback(err, null);
							}
							var server_pid1 = res;
							var second = g.srv[client_pid][server_pid1]['client'];
							second_server_host = g.srv[client_pid][server_pid1]['host'];
							second_server_port = g.srv[client_pid][server_pid1]['port'];
							first.exists('key', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								try {
									if (res == 1) {
										second.exists('key', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											if (res == 0) {
												client.migrate(second_server_host, second_server_port, 'key', 0, 10000, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													if (res == 'OK') {
														first.exists('key', function (err, res) {
															if (err) {
																errorCallback(err);
															}
															if (res == 0) {
																second.exists('key', function (err, res) {
																	if (err) {
																		errorCallback(err);
																	}
																	if (res == 1) {
																		second.ttl('key', function (err, res) {
																			if (err) {
																				errorCallback(err);
																			}
																			if (res == -1) {
																				second.llen('key', function (err, res) {
																					if (err) {
																						errorCallback(err);
																					}
																					ut.assertEqual(res, 5000 * 2, test_case);
																					second.end();
																					server3.kill_server(client_pid, server_pid1, function (err, res) {
																						if (err) {
																							errorCallback(err);
																						}
																						testEmitter.emit('next');
																					});
																				});
																			} else {
																				ut.fail('ttl value donot match');
																				second.end();
																				server3.kill_server(client_pid, server_pid1, function (err, res) {
																					if (err) {
																						errorCallback(err);
																					}
																					testEmitter.emit('next');
																				});
																			}
																		});
																	} else {
																		ut.fail('Key dosen\'t exists in second Client', true);
																		second.end();
																		server3.kill_server(client_pid, server_pid1, function (err, res) {
																			if (err) {
																				errorCallback(err);
																			}
																			testEmitter.emit('next');
																		});
																	}
																});
															} else {
																ut.fail('Key Exists in first Client', true);
																second.end();
																server3.kill_server(client_pid, server_pid1, function (err, res) {
																	if (err) {
																		errorCallback(err);
																	}
																	testEmitter.emit('next');
																});
															}
														});
													} else {
														ut.fail('Error occured while performing migrate. check the logs', true);
														second.end();
														server3.kill_server(client_pid, server_pid1, function (err, res) {
															if (err) {
																errorCallback(err);
															}
															testEmitter.emit('next');
														});
													}
												});
											} else {
												ut.fail('Key Exists in second client', true);
												second.end();
												server3.kill_server(client_pid, server_pid1, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													testEmitter.emit('next');
												});
											}
										});
									} else {
										ut.fail('Key donot exist in first client', true);
										second.end();
										server3.kill_server(client_pid, server_pid1, function (err, res) {
											if (err) {
												errorCallback(err);
											}
											testEmitter.emit('next');
										});
									}
								} catch (e) {
									ut.fail(e, true);
									second.end();
									server3.kill_server(client_pid, server_pid1, function (err, res) {
										if (err) {
											errorCallback(err);
										};
										testEmitter.emit('next');
									});
								}
							});
						});
				} else {
					ut.fail('key length doesn\'t match', true);
					testEmitter.emit('next');
				}
			});
		});
	};

	return dump;
}
	());
