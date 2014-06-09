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

exports.List = (function () {
	//private properties
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	list_common = require('./list-common.js'),
	list = {},
	name = 'List',
	client = '',
	tester = {},
	server_pid = '',
	all_tests = '',
	client_pid = '',
	server_port = '',
	server_host = '',
	client1 = '',
	client2 = '',
	cli = '',
	tosort = [],
	result = [];

	//public property
	list.debug_mode = false;

	//public method
	list.start_test = function (client_pid, callback) {
		testEmitter.on('start', function () {
			var tags = 'list';
			var overrides = {};
			overrides['list-max-ziplist-entries'] = 256
				overrides['list-max-ziplist-value'] = 16;
			var args = {};
			args['name'] = name;
			args['tags'] = tags;
			args['overrides'] = overrides;
			server.start_server(client_pid, args, function (err, res) {
				if (err) {
					callback(err, null);
				}
				server_pid = res;
				server_port = g.srv[client_pid][server_pid]['port'];
				server_host = g.srv[client_pid][server_pid]['host'];
				// we already have a client while checking for the server, we dont need it now.
				g.srv[client_pid][server_pid]['client'].end();
				if (list.debug_mode) {
					log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
				}
				client = redis.createClient(server_port, server_host);
				client.on('ready', function () {
					if (list.debug_mode) {
						log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
					}
				});
				client1 = redis.createClient(server_port, server_host);
				client1.on('ready', function () {
					if (list.debug_mode) {
						log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
					}
				});
				client2 = redis.createClient(server_port, server_host);
				client2.on('ready', function () {
					if (list.debug_mode) {
						log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
					}
				});
				cli = redis.createClient(server_port, server_host);
				cli.on('ready', function () {
					if (list.debug_mode) {
						log.notice(name + ':Client connected  and listening on socket: ' + server_host + ':' + server_port);
					}
				});

				all_tests = Object.keys(tester);
				testEmitter.emit('next');
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
					client1.end();
					client2.end();
					cli.end();
					if (list.debug_mode) {
						log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
					}
					testEmitter.emit('end');
				}
			},1000);
		});
		testEmitter.on('end', function () {
			server.kill_server(client_pid, server_pid, function (err, res) {
				if (err) {
					callback(err, null);
				}
				callback(null, true);
			});
		});

		if (list.debug_mode) {
			server.set_debug_mode(true);
		}

		testEmitter.emit('start');
	}

	//private methods
	function trim_list(value, type, min, max, callback) {
		client.del('mylist', function (err, res) {
			if (err) {
				callback(err, null);
			}
			if (type == 'ziplist') {
				create_ziplist('mylist', new Array(1, 2, 3, 4, value), function (err, res) {
					if (err) {
						callback(err, null);
					}
					client.ltrim('mylist', min, max, function (err, res) {
						if (err) {
							callback(err, null);
						}
						client.lrange('mylist', 0, -1, function (err, res) {
							if (err) {
								callback(err, null);
							}
							callback(null, res);
						});
					});
				});
			} else {
				create_linkedlist('mylist', new Array(1, 2, 3, 4, value), function (err, res) {
					if (err) {
						callback(err, null);
					}
					client.ltrim('mylist', min, max, function (err, res) {
						if (err) {
							callback(err, null);
						}
						client.lrange('mylist', 0, -1, function (err, res) {
							if (err) {
								callback(err, null);
							}
							callback(null, res);
						});
					});

				});
			}
		});
	}

	function create_ziplist(key, entries, callback) {
		client.del(key, function (err, res) {
			if (err) {
				callback(err, null);
			}
			g.asyncFor(0, entries.length, function (loop) {
				var i = loop.iteration();
				client.rpush(key, entries[i], function (err, res) {
					if (err) {
						callback(err, null);
					}
					loop.next();
				});
			}, function () {
				assert_encoding('ziplist', key, function (err, res) {
					if (err) {
						callback(err, null)
					}
					callback(null, true);
				});
			});
		});
	}

	function create_linkedlist(key, entries, callback) {
		client.del(key, function (err, res) {
			if (err) {
				callback(err, null);
			}
			g.asyncFor(0, entries.length, function (loop) {
				var i = loop.iteration();
				client.rpush(key, entries[i], function (err, res) {
					if (err) {
						callback(err, null);
					}
					loop.next();
				});
			}, function () {
				assert_encoding('linkedlist', key, function (err, res) {
					if (err) {
						callback(err, null)
					}
					callback(null, true);
				});
			});
		});
	}

	function check_numbered_list_consistency(key, callback) {
		client.llen(key, function (err, len) {
			if (err) {
				callback(err, null);
			}
			g.asyncFor(0, len, function (loop) {
				var i = loop.iteration();

				client.lindex(key, i, function (err, res1) {
					if (err) {
						callabck(err, null);
					}
					client.lindex(key, (-i - 1), function (err, res2) {
						if (err) {
							callabck(err, null);
						}
						if ((res1 == i)) {
							if ((res2 == (len - 1 - i))) {
								loop.next();
							} else {
								callback(new Error('Check Numbered List Consistancy not equal for ' + res2 + ' ne ' + (len - 1 - i) + ''), null);
							}
						} else {
							callback(new Error('Check Numbered List Consistancy not equal for ' + res1 + ' ne ' + i + ''), null);
						}
					});
				});
			}, function () {
				callback(null, true);
			});
		});
	};
	function check_random_access_consistency(key, callback) {
		client.llen(key, function (err, len) {
			if (err) {
				callback(err, null);
			}
			g.asyncFor(0, len, function (loop) {
				var rand = Math.floor(Math.random() * len);
				client.lindex(key, rand, function (err, res1) {
					if (err) {
						callabck(err, null);
					}
					client.lindex(key, (-rand - 1), function (err, res2) {
						if (err) {
							callabck(err, null);
						}
						if ((res1 == rand)) {
							if ((res2 == (len - 1 - rand))) {
								loop.next();
							} else {
								callback(new Error('Check Numbered List Consistancy not equal for ' + res2 + ' ne ' + (len - 1 - rand) + ''), null);
							}
						} else {
							callback(new Error('Check Numbered List Consistancy not equal for ' + res1 + ' ne ' + rand + ''), null);
						}
					});
				});
			}, function () {
				callback(null, true);
			});
		});
	};

	function assert_encoding(enc, key, callback) {
		client.object('encoding', key, function (error, res) {
			if (error) {
				callback(error);
			}
			var pattern = /( swapped at: )/;
			while (pattern.test(res)) {
				client.debug('swapin', key, function (err, res) {
					if (err) {
						callback(err);
					}
					client.debug('object', key, function (err, res) {
						if (err) {
							callback(err);
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
	}

	function assert_type(type, key) {
		client.type(key, function (err, res) {
			try {
				var message = 'Type: Expected: ' + type + ', Actual: ' + res + ' for key: ' + key;
				if (!assert.equal(res, type, 'Error: ' + message) && (assert.ifError(err))) {}
			} catch (e) {
				console.log('Error: ' + message);
			}
		});
	}

	tester.List1 = function (errorCallback) {
		var test_case = 'LPUSH, RPUSH, LLENGTH, LINDEX, LPOP - ziplist';
		var result_array = new Array();
		// first lpush then rpush
		client.lpush('myziplist1', 'a', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(res);
			client.rpush('myziplist1', 'b', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.rpush('myziplist1', 'c', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.llen('myziplist1', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lindex('myziplist1', 0, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lindex('myziplist1', 1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.lindex('myziplist1', 2, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									client.lindex('myziplist2', 3, function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										client.rpop('myziplist1', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(res);
											client.lpop('myziplist1', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(res);
												assert_encoding('ziplist', 'myziplist1', function (err, res) {
													if (err) {
														errorCallback(err);
													}
													client.rpush('myziplist2', 'a', function (err, res) {
														if (err) {
															errorCallback(err);
														}
														result_array.push(res);
														client.lpush('myziplist2', 'b', function (err, res) {
															if (err) {
																errorCallback(err);
															}
															result_array.push(res);
															client.lpush('myziplist2', 'c', function (err, res) {
																if (err) {
																	errorCallback(err);
																}
																result_array.push(res);
																client.llen('myziplist2', function (err, res) {
																	if (err) {
																		errorCallback(err);
																	}
																	result_array.push(res);
																	client.lindex('myziplist2', 0, function (err, res) {
																		if (err) {
																			errorCallback(err);
																		}
																		result_array.push(res);
																		client.lindex('myziplist2', 1, function (err, res) {
																			if (err) {
																				errorCallback(err);
																			}
																			result_array.push(res);
																			client.lindex('myziplist2', 2, function (err, res) {
																				if (err) {
																					errorCallback(err);
																				}
																				result_array.push(res);
																				client.lindex('myziplist2', 3, function (err, res) {
																					if (err) {
																						errorCallback(err);
																					}
																					result_array.push(res);
																					client.rpop('myziplist2', function (err, res) {
																						if (err) {
																							errorCallback(err);
																						}
																						result_array.push(res);
																						client.rpop('myziplist2', function (err, res) {
																							if (err) {
																								errorCallback(err);
																							}
																							result_array.push(res);
																							assert_encoding('ziplist', 'myziplist2', function (err, res) {
																								if (err) {
																									errorCallback(err);
																								}
																								ut.assertDeepEqual(result_array, [1, 2, 3, 3, 'a', 'b', 'c', null, 'c', 'a', 1, 2, 3, 3, 'c', 'b', 'a', null, 'a', 'b'], test_case);
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
	tester.List2 = function (errorCallback) {
		var test_case = 'LPUSH, RPUSH, LLENGTH, LINDEX, LPOP - regular list';
		var result_array = new Array();
		// first lpush then rpush
		client.lpush('mylist1', list_common.linkedlist, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(res);
			assert_encoding('linkedlist', 'mylist1', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpush('mylist1', 'b', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpush('mylist1', 'c', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('mylist1', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lindex('mylist1', 0, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.lindex('mylist1', 1, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									client.lindex('mylist1', 2, function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										client.lindex('mylist1', 3, function (err, res) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(res);
											client.rpop('mylist1', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(res);
												client.lpop('mylist1', function (err, res) {
													if (err) {
														errorCallback(err);
													}
													result_array.push(res);
													//first rpush then lpush
													client.rpush('mylist2', list_common.linkedlist, function (err, res) {
														if (err) {
															errorCallback(err);
														}
														result_array.push(res);
														assert_encoding('linkedlist', 'mylist2', function (err, rs) {
															if (err) {
																errorCallback(err);
															}
															client.lpush('mylist2', 'b', function (err, res) {
																if (err) {
																	errorCallback(err);
																}
																result_array.push(res);
																client.lpush('mylist2', 'c', function (err, res) {
																	if (err) {
																		errorCallback(err);
																	}
																	result_array.push(res);
																	client.llen('mylist2', function (err, res) {
																		if (err) {
																			errorCallback(err);
																		}
																		result_array.push(res);
																		client.lindex('mylist2', 0, function (err, res) {
																			if (err) {
																				errorCallback(err);
																			}
																			result_array.push(res);
																			client.lindex('mylist2', 1, function (err, res) {
																				if (err) {
																					errorCallback(err);
																				}
																				result_array.push(res);
																				client.lindex('mylist2', 2, function (err, res) {
																					if (err) {
																						errorCallback(err);
																					}
																					result_array.push(res);
																					client.lindex('mylsit2', 3, function (err, res) {
																						if (err) {
																							errorCallback(err);
																						}
																						result_array.push(res);
																						client.rpop('mylist2', function (err, res) {
																							if (err) {
																								errorCallback(err);
																							}
																							result_array.push(res);
																							client.lpop('mylist2', function (err, res) {
																								if (err) {
																									errorCallback(err);
																								}
																								result_array.push(res);
																								assert_encoding('ziplist', 'myziplist2', function (err, res) {
																									if (err) {
																										errorCallback(err);
																									}
																									ut.assertDeepEqual(result_array, [1, 2, 3, 3, list_common.linkedlist, 'b', 'c', null, 'c', list_common.linkedlist, 1, 2, 3, 3, 'c', 'b', list_common.linkedlist, null, list_common.linkedlist, 'c'], test_case);
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
		});
	};
	tester.List3 = function (errorCallback) {
		var test_case = 'Variadic RPUSH/LPUSH';
		var result_array = new Array();
		// first lpush then rpush
		client.del('mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lpush('mylist', 'a', 'b', 'c', 'd', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.rpush('mylist', 0, 1, 2, 3, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lrange('mylist', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [4, 8, ['d', 'c', 'b', 'a', 0, 1, 2, 3]], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};
	tester.List4 = function (errorCallback) {
		var test_case = 'DEL a list - ziplist';
		var result_array = new Array();
		client.del('myziplist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(res);
			client.exists('myziplist2', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.llen('myziplist2', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					ut.assertDeepEqual(result_array, [1, 0, 0], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List5 = function (errorCallback) {
		var test_case = 'DEL a list - regular list';
		var result_array = new Array();
		client.del('mylist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(res);
			client.exists('mylist2', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.llen('mylist2', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					ut.assertDeepEqual(result_array, [1, 0, 0], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List6 = function (errorCallback) {
		var test_case = 'BLPOP, BRPOP: single existing list - ziplist';
		var result_array = new Array();
		create_ziplist('blist', new Array('a', 'b', list_common.ziplist, 'c', 'd'), function (err, res) {
			if (err) {
				errorCallback(err);
			}

			client.blpop('blist', 1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.brpop('blist', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.blpop('blist', 1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.brpop('blist', 1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							ut.assertDeepEqual(result_array, [
											['blist', 'a'],
											['blist', 'd'],
											['blist', 'b'],
											['blist', 'c']
										], test_case);
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};
	tester.List7 = function (errorCallback) {
		var test_case = 'BLPOP, BRPOP: multiple existing lists - ziplist';
		var result_array = new Array();
		create_ziplist('blist1', new Array('a', list_common.ziplist, 'c'), function (err, res) {
			if (err) {
				errorCallback(err);
			}

			create_ziplist('blist2', new Array('d', list_common.ziplist, 'f'), function (err, res) {
				if (err) {
					errorCallback(err);
				}

				client.blpop('blist1', 'blist2', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.brpop('blist1', 'blist2', 1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('blist1', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.llen('blist2', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.blpop('blist2', 'blist1', 1, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									client.brpop('blist2', 'blist1', 1, function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										client.llen('blist1', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(res);
											client.llen('blist2', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(res);
												ut.assertDeepEqual(result_array, [
																['blist1', 'a'],
																['blist1', 'c'], 1, 3, ['blist2', 'd'],
																['blist2', 'f'], 1, 1], test_case);
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
	tester.List8 = function (errorCallback) {
		var test_case = 'BLPOP, BRPOP: second list has an entry - ziplist';
		var result_array = new Array();
		create_ziplist('blist2', new Array('d', list_common.ziplist, 'f'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.del('blist1', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.blpop('blist1', 'blist2', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.brpop('blist1', 'blist2', 1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('blist1', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.llen('blist2', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								ut.assertDeepEqual(result_array, [
												['blist2', 'd'],
												['blist2', 'f'], 0, 1], test_case);
								testEmitter.emit('next');
							});
						});
					});
				});
			});
		});
	};
	tester.List9 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH - ziplist';
		var result_array = new Array();
		create_ziplist('blist', new Array('a', 'b', list_common.ziplist, 'c', 'd'), function (err, res) {
			if (err) {
				errorCallback(err);
			}

			client.del('target', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.brpoplpush('blist', 'target', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpop('target', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('blist', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							ut.assertDeepEqual(result_array, ['d', 'd', ['a', 'b', list_common.ziplist, 'c']], test_case);
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};
	tester.List10 = function (errorCallback) {
		var test_case = 'BLPOP, BRPOP: single existing list - linkedlist';
		var result_array = new Array();
		create_linkedlist('blist', new Array('a', 'b', list_common.linkedlist, 'c', 'd'), function (err, res) {
			if (err) {
				errorCallback(err);
			}

			client.blpop('blist', 1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.brpop('blist', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.blpop('blist', 1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.brpop('blist', 1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							ut.assertDeepEqual(result_array, [
											['blist', 'a'],
											['blist', 'd'],
											['blist', 'b'],
											['blist', 'c']
										], test_case);
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};
	tester.List11 = function (errorCallback) {
		var test_case = 'BLPOP, BRPOP: multiple existing lists - linkedlist';
		var result_array = new Array();
		create_linkedlist('blist1', new Array('a', list_common.linkedlist, 'c'), function (err, res) {
			if (err) {
				errorCallback(err);
			}

			create_linkedlist('blist2', new Array('d', list_common.linkedlist, 'f'), function (err, res) {
				if (err) {
					errorCallback(err);
				}

				client.blpop('blist1', 'blist2', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.brpop('blist1', 'blist2', 1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('blist1', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.llen('blist2', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.blpop('blist2', 'blist1', 1, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									client.brpop('blist2', 'blist1', 1, function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										client.llen('blist1', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(res);
											client.llen('blist2', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(res);
												ut.assertDeepEqual(result_array, [
																['blist1', 'a'],
																['blist1', 'c'], 1, 3, ['blist2', 'd'],
																['blist2', 'f'], 1, 1], test_case);
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
	tester.List12 = function (errorCallback) {
		var test_case = 'BLPOP, BRPOP: second list has an entry - linkedlist';
		var result_array = new Array();
		create_linkedlist('blist2', new Array('d', list_common.linkedlist, 'f'), function (err, res) {
			if (err) {
				errorCallback(err);
			}

			client.del('blist1', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.blpop('blist1', 'blist2', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.brpop('blist1', 'blist2', 1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('blist1', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.llen('blist2', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								ut.assertDeepEqual(result_array, [
												['blist2', 'd'],
												['blist2', 'f'], 0, 1], test_case);
								testEmitter.emit('next');

							});
						});
					});
				});
			});
		});
	};
	tester.List13 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH - linkedlist';
		var result_array = new Array();
		create_linkedlist('blist', new Array('a', 'b', list_common.linkedlist, 'c', 'd'), function (err, res) {
			if (err) {
				errorCallback(err);
			}

			client.del('target', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.brpoplpush('blist', 'target', 1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpop('target', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('blist', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							ut.assertDeepEqual(result_array, ['d', 'd', ['a', 'b', list_common.linkedlist, 'c']], test_case);
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};
	tester.List14 = function (errorCallback) {
		var test_case = 'BLPOP with variadic LPUSH';
		var result_array = new Array();
		client.del('blist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.blpop('blist', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
			});
			cli.lpush('blist', 'foo', 'bar', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				cli.lrange('blist', 0, -1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res[0]);
					ut.assertDeepEqual(result_array.toString(), ([2, ['blist', 'bar'], 'foo']).toString(), test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List15 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH with zero timeout should block indefinitely';
		var result_array = new Array();
		client.del('blist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.brpoplpush('blist', 'target', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				setTimeout(function(){
					ut.assertDeepEqual(result_array.toString(), ([[ 'foo' ], 'foo' ]).toString(), test_case);
					testEmitter.emit('next');
				},100);
			});
			setTimeout(function () {
				cli.rpush('blist', 'foo', function (err, res) {
					if (err) {
						errorCallback(err);
					}
				});
				cli.lrange('target', 0, -1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
				});
			}, 1000);
		});
	};
	
	tester.List16 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH with a client BLPOPing the target list';
		var result_array = new Array();
		cli.del('blist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client2.blpop('target', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
			});
			client1.brpoplpush('blist', 'target', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
			});
			cli.rpush('blist', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.exists('target', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					ut.assertDeepEqual(result_array, ['foo', ['target', 'foo'], 0], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List17 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH with wrong source type';
		var result_array = new Array();
		cli.del('blist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.set('blist', 'nolist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.brpoplpush('blist', 'target', 1, function (err, res) {
					if (res) {
						errorCallback(res);
					}
					ut.assertOk('wrong kind', err, test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List18 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH with wrong destination type';
		var flag = false;
		cli.del('blist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.set('target', 'nolist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.lpush('blist', 'foo', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					client1.brpoplpush('blist', 'target', 1, function (err, res) {
						if (res) {
							errorCallback(res);
						}
						if (ut.match('wrong kind', err)) {
							flag = true;
						}
					});
				});
			});
		});
		cli.del('blist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.set('target', 'nolist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client2.brpoplpush('blist', 'target', 0, function (error, result) {
					setTimeout(function () {
						cli.rpush('blist', 'foo', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							cli.lrange('blist', 0, -1, function (err, res1) {
								if (err) {
									errorCallback(err);
								}
								ut.assertMany(
									[
										['deepequal',res1, ['foo', 'foo']],
										['ok','wrong kind', error],
										['ok',flag, null]
									],test_case);
								testEmitter.emit('next');
							});
						});
					}, 1000);
				});
			});
		});
	};

	tester.List19 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH with multiple blocked clients';
		var result_array = new Array();
		var error = '';
		cli.del('blist', 'target1', 'target2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.set('target1', 'nolist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client1.brpoplpush('blist', 'target1', 0, function (error1, result1) {
					error = error1;
				});
				client2.brpoplpush('blist', 'target2', 0, function (error2, result2) {
					result_array.push(result2);
				});
				cli.lpush('blist', 'foo', function (err, res) {
					cli.lrange('target2', 0, -1, function (err, res1) {
						result_array.push(res1[0]);
						setTimeout(function(){
							ut.assertMany(
							[	
								['ok', 'wrong kind', error],
								['deepequal', result_array, ['foo', 'foo']]
							],test_case);
							testEmitter.emit('next');
						},1000);
					});
				});
			});
		});
	};
	
	tester.List20 = function (errorCallback) {
		var test_case = 'Linked BRPOPLPUSH';
		var result_array = new Array();
		cli.del('list1', 'list2', 'list3', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.brpoplpush('list1', 'list2', 0, function (error1, result1) {});
			client2.brpoplpush('list2', 'list3', 0, function (error2, result2) {});
			cli.rpush('list1', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.lrange('list1', 0, -1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					cli.lrange('list2', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						cli.lrange('list3', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							ut.assertDeepEqual(result_array, [
											[],
											[],
											['foo']
										], test_case);
							testEmitter.emit('next');

						});
					});
				});
			});
		});
	};
	tester.List21 = function (errorCallback) {
		var test_case = 'Circular BRPOPLPUSH';
		var result_array = new Array();
		cli.del('list1', 'list2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.brpoplpush('list1', 'list2', 0, function (error1, result1) {});
			client2.brpoplpush('list2', 'list1', 0, function (error2, result2) {});
			cli.rpush('list1', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.lrange('list1', 0, -1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					cli.lrange('list2', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [['foo'],[]], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};
	tester.List22 = function (errorCallback) {
		var test_case = 'Self-referential BRPOPLPUSH';
		cli.del('blist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.brpoplpush('blist', 'blist', 0, function (error1, result1) {});
			cli.rpush('blist', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.lrange('blist', 0, -1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					ut.assertDeepEqual(res, ['foo'], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List23 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH inside a transaction';
		cli.del('xlist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.lpush('xlist', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.lpush('xlist', 'bar', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					cli.multi().brpoplpush('xlist', 'target', 0).brpoplpush('xlist', 'target', 0).brpoplpush('xlist', 'target', 0).lrange('xlist', 0, -1).lrange('target', 0, -1).exec(function (err, replies) {
						if (err) {
							errorCallback(err);
						}
						// reply from redis-server is
						// 1) 'foo'
						// 2) 'bar'
						// 3) (nil)
						// 4) (empty list or set)
						// 5) 1) 'bar'
						// 2) 'foo'
						ut.assertDeepEqual(replies, ['foo', 'bar', null, [],
									['bar', 'foo']
								], test_case);
						testEmitter.emit('next');
					});

				});
			});

		});
	};
	tester.List24 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH timeout';
		client1.brpoplpush('foo_list', 'bar_list', 1, function (error1, result1) {

			setTimeout(function () {
				ut.assertDeepEqual(result1, null, test_case);
				testEmitter.emit('next');
			}, 2000);
		});
	};
	tester.List25 = function (errorCallback) {
		var test_case = 'BLPOP: with single empty list argument';
		var result_array = new Array();
		cli.del('blist1', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.blpop('blist1', 1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
			});
			cli.rpush('blist1', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.exists('blist1', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					setTimeout(function(){
						ut.assertDeepEqual(result_array.sort().toString(), ([0, ['blist1', 'foo']]).toString(), test_case);
						testEmitter.emit('next');
					},200);
				});
			});
		});
	};
	tester.List26 = function (errorCallback) {
		var test_case = 'BLPOP: with negative timeout';
		client1.blpop('blist1', -1, function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk('is negative', err, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List27 = function (errorCallback) {
		var test_case = 'BLPOP: with non-integer timeout';
		client1.blpop('blist1', 1.1, function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk('not an integer', err, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List28 = function (errorCallback) {
		var test_case = 'BLPOP: with zero timeout should block indefinitely';
		// To test this, use a timeout of 0 and wait a second.
		// The blocking pop should still be waiting for a push.
		var result_array = new Array();
		client1.blpop('blist1', 0, function (err, result1) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result1);
		});
		setTimeout(function () {
			cli.rpush('blist1', 'foo', function (err, res) {
				ut.assertDeepEqual(result_array, [], test_case);
				testEmitter.emit('next');
			});
		}, 1000);
	};
	tester.List29 = function (errorCallback) {
		var test_case = 'BLPOP: second argument is not a list';
		cli.del('blist1', 'blist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.set('blist2', 'nolist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client1.blpop('blist1', 'blist2', 1, function (err, res) {
					if (res) {
						errorCallback(res);
					}
					ut.assertOk('wrong kind', err, test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List30 = function (errorCallback) {
		var test_case = 'BLPOP: timeout';
		cli.del('blist1', 'blist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.blpop('blist1', 'blist2', 1, function (err, res) {
				if (res) {
					errorCallback(res);
				}
				ut.assertEqual(res, null, test_case);
				testEmitter.emit('next');
			});
		});
	};
	tester.List31 = function (errorCallback) {
		var test_case = 'BLPOP: arguments are empty';
		var result_array = new Array();
		cli.del('blist1', 'blist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.blpop('blist1', 'blist2', 1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
			});
			cli.rpush('blist1', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.exists('blist1', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					cli.exists('blist2', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client1.blpop('blist1', 'blist2', 1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
						});
						cli.rpush('blist2', 'foo', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							cli.exists('blist1', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								cli.exists('blist2', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									setTimeout(function(){
										ut.assertDeepEqual(result_array.sort(), [0, 0, 0, 0,['blist1', 'foo'],  ['blist2', 'foo']], test_case);
										testEmitter.emit('next');
									},100);
								});
							});
						});
					});
				});
			});
		});
	};
	tester.List32 = function (errorCallback) {
		var test_case = 'BRPOP: with single empty list argument';
		var result_array = new Array();
		cli.del('blist1', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.brpop('blist1', 1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
			});
			cli.rpush('blist1', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.exists('blist1', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					setTimeout(function(){
						ut.assertDeepEqual(result_array.sort().toString(), ([0, ['blist1', 'foo']]).toString(), test_case);
						testEmitter.emit('next');
					},200);
				});
			});
		});
	};
	tester.List33 = function (errorCallback) {
		var test_case = 'BRPOP: with negative timeout';
		client1.brpop('blist1', -1, function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk('is negative', err, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List34 = function (errorCallback) {
		var test_case = 'BRPOP: with non-integer timeout';
		client1.blpop('blist1', 1.1, function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk('not an integer', err, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List35 = function (errorCallback) {
		var test_case = 'BRPOP: with zero timeout should block indefinitely';
		// To test this, use a timeout of 0 and wait a second.
		// The blocking pop should still be waiting for a push.
		var result_array = new Array();
		client1.brpop('blist1', 0, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(res);
		});
		setTimeout(function () {
			cli.rpush('blist1', 'foo', function (err, res) {
				ut.assertDeepEqual(result_array, [], test_case);
				testEmitter.emit('next');
			});
		}, 1000);
	};
	tester.List36 = function (errorCallback) {
		var test_case = 'BRPOP: second argument is not a list';
		cli.del('blist1', 'blist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.set('blist2', 'nolist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client1.brpop('blist1', 'blist2', 1, function (err, res) {
					if (res) {
						errorCallback(res);
					}
					ut.assertOk('wrong kind', err, test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List37 = function (errorCallback) {
		var test_case = 'BRPOP: timeout';
		cli.del('blist1', 'blist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.brpop('blist1', 'blist2', 1, function (err, res) {
				if (res) {
					errorCallback(res);
				}
				ut.assertEqual(res, null, test_case);
				testEmitter.emit('next');
			});
		});
	};
	tester.List38 = function (errorCallback) {
		var test_case = 'BRPOP: arguments are empty';
		var result_array = new Array();
		cli.del('blist1', 'blist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client1.brpop('blist1', 'blist2', 1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
			});
			cli.rpush('blist1', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.exists('blist1', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					cli.exists('blist2', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client1.brpop('blist1', 'blist2', 1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
						});
						cli.rpush('blist2', 'foo', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							cli.exists('blist1', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								cli.exists('blist2', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									ut.assertDeepEqual(result_array.sort(), [ 0, 0, 0, 0, [ 'blist1', 'foo' ], [ 'blist2', 'foo' ] ], test_case);
									testEmitter.emit('next');
								});
							});
						});
					});
				});
			});
		});
	};
	tester.List39 = function (errorCallback) {
		var test_case = 'BLPOP inside a transaction';
		cli.del('xlist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			cli.lpush('xlist', 'foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				cli.lpush('xlist', 'bar', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					cli.multi().blpop('xlist', 0).blpop('xlist', 0).blpop('xlist', 0).exec(function (err, replies) {
						if (err) {
							errorCallback(err);
						}
						ut.assertDeepEqual(replies, [['xlist', 'bar'],['xlist', 'foo'], null], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List40 = function (errorCallback) {
		var test_case = 'LPUSHX, RPUSHX - generic';
		var result_array = new Array();
		client.del('xlist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lpushx('xlist', 'a', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.llen('xlist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpushx('xlist', 'a', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('xlist', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							ut.assertDeepEqual(result_array, [0, 0, 0, 0], test_case);
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};

	tester.List41 = function (errorCallback) {
		var test_case = 'LPUSHX, RPUSHX - ziplist';
		var result_array = new Array();
		create_ziplist('xlist', new Array(list_common.ziplist, 'c'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.rpushx('xlist', 'd', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);

				client.lpushx('xlist', 'a', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lrange('xlist', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [3, 4, ['a', list_common.ziplist, 'c', 'd']], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List42 = function (errorCallback) {
		var test_case = 'LINSERT - ziplist';
		var result_array = new Array();
		create_ziplist('xlist', new Array('a', list_common.ziplist, 'c', 'd'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.linsert('xlist', 'before', 'c', 'zz', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.lrange('xlist', 0, 10, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.linsert('xlist', 'after', 'c', 'yy', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('xlist', 0, 10, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.linsert('xlist', 'after', 'd', 'dd', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.linsert('xlist', 'after', 'bad', 'ddd', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									client.lrange('xlist', 0, 10, function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										client.linsert('xlist', 'before', 'a', 'aa', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(res);
											client.linsert('xlist', 'before', 'bad', 'aaa', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(res);
												client.lrange('xlist', 0, 10, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													result_array.push(res);
													client.linsert('xlist', 'before', 'aa', 42, function (err, res) {
														if (err) {
															errorCallback(err);
														}
														result_array.push(res);
														client.lrange('xlist', 0, 0, function (err, res) {
															if (err) {
																errorCallback(err);
															}
															result_array.push(res);
															ut.assertDeepEqual(result_array, [5, ['a', list_common.ziplist, 'zz', 'c', 'd'], 6, ['a', list_common.ziplist, 'zz', 'c', 'yy', 'd'], 7, -1, ['a', list_common.ziplist, 'zz', 'c', 'yy', 'd', 'dd'], 8, -1, ['aa', 'a', list_common.ziplist, 'zz', 'c', 'yy', 'd', 'dd'], 9, ['42']], test_case);
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

	tester.List43 = function (errorCallback) {
		var test_case = 'LPUSHX, RPUSHX - linkedlist';
		var result_array = new Array();
		create_linkedlist('xlist', new Array(list_common.linkedlist, 'c'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.rpushx('xlist', 'd', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.lpushx('xlist', 'a', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lrange('xlist', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [3, 4, ['a', list_common.linkedlist, 'c', 'd']], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List44 = function (errorCallback) {
		var test_case = 'LINSERT - linkedlist';
		var result_array = new Array();
		create_linkedlist('xlist', new Array('a', list_common.linkedlist, 'c', 'd'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.linsert('xlist', 'before', 'c', 'zz', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.lrange('xlist', 0, 10, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.linsert('xlist', 'after', 'c', 'yy', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('xlist', 0, 10, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.linsert('xlist', 'after', 'd', 'dd', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.linsert('xlist', 'after', 'bad', 'ddd', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									client.lrange('xlist', 0, 10, function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										client.linsert('xlist', 'before', 'a', 'aa', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(res);
											client.linsert('xlist', 'before', 'bad', 'aaa', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(res);
												client.lrange('xlist', 0, 10, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													result_array.push(res);
													client.linsert('xlist', 'before', 'aa', 42, function (err, res) {
														if (err) {
															errorCallback(err);
														}
														result_array.push(res);
														client.lrange('xlist', 0, 0, function (err, res) {
															if (err) {
																errorCallback(err);
															}
															result_array.push(res);
															ut.assertDeepEqual(result_array, [5, ['a', list_common.linkedlist, 'zz', 'c', 'd'], 6, ['a', list_common.linkedlist, 'zz', 'c', 'yy', 'd'], 7, -1, ['a', list_common.linkedlist, 'zz', 'c', 'yy', 'd', 'dd'], 8, -1, ['aa', 'a', list_common.linkedlist, 'zz', 'c', 'yy', 'd', 'dd'], 9, ['42']], test_case);
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

	tester.List45 = function (errorCallback) {
		var test_case = 'LPUSHX, RPUSHX convert from ziplist to list';
		var result_array = new Array();
		var large = list_common.linkedlist;
		//convert when a large value is pushed
		create_ziplist('xlist', new Array('a'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.rpushx('xlist', large, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				assert_encoding('linkedlist', 'xlist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					create_ziplist('xlist', new Array('a'), function (err, res) {
						if (err) {
							errorCallback(err);
						}
						client.lpushx('xlist', large, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							assert_encoding('linkedlist', 'xlist', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								//  convert when the length threshold is exceeded
								create_ziplist('xlist', g.fillArray(256, 'a'), function (err, res) {
									if (err) {
										errorCallback(err);
									}
									client.rpushx('xlist', 'b', function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										assert_encoding('linkedlist', 'xlist', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											create_ziplist('xlist', g.fillArray(256, 'a'), function (err, res) {
												if (err) {
													errorCallback(err);
												}
												client.lpushx('xlist', 'b', function (err, res) {
													if (err) {
														errorCallback(err);
													}
													result_array.push(res);
													assert_encoding('linkedlist', 'xlist', function (err, res) {
														if (err) {
															errorCallback(err);
														}
														ut.assertDeepEqual(result_array, [2, 2, 257, 257], test_case);
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
	};

	tester.List46 = function (errorCallback) {
		var test_case = 'LINSERT convert from ziplist to list';
		var result_array = new Array();
		var large = list_common.linkedlist;
		//convert when a large value is inserted
		create_ziplist('xlist', new Array('a'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.linsert('xlist', 'before', 'a', large, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				assert_encoding('linkedlist', 'xlist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					create_ziplist('xlist', new Array('a'), function (err, res) {
						if (err) {
							errorCallback(err);
						}
						client.linsert('xlist', 'after', 'a', large, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							assert_encoding('linkedlist', 'xlist', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								//convert when the length threshold is exceeded
								create_ziplist('xlist', g.fillArray(256, 'a'), function (err, res) {
									if (err) {
										errorCallback(err);
									}
									client.linsert('xlist', 'before', 'a', 'a', function (err, res) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(res);
										assert_encoding('linkedlist', 'xlist', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											create_ziplist('xlist', g.fillArray(256, 'a'), function (err, res) {
												if (err) {
													errorCallback(err);
												}
												client.linsert('xlist', 'after', 'a', 'a', function (err, res) {
													if (err) {
														errorCallback(err);
													}
													result_array.push(res);
													assert_encoding('linkedlist', 'xlist', function (err, res) {
														if (err) {
															errorCallback(err);
														}
														//don't convert when the value could not be inserted
														create_ziplist('xlist', g.fillArray(256, 'a'), function (err, res) {
															if (err) {
																errorCallback(err);
															}
															client.linsert('xlist', 'before', 'foo', 'a', function (err, res) {
																if (err) {
																	errorCallback(err);
																}
																result_array.push(res);
																assert_encoding('ziplist', 'xlist', function (err, res) {
																	if (err) {
																		errorCallback(err);
																	}
																	create_ziplist('xlist', g.fillArray(256, 'a'), function (err, res) {
																		if (err) {
																			errorCallback(err);
																		}
																		client.linsert('xlist', 'after', 'foo', 'a', function (err, res) {
																			if (err) {
																				errorCallback(err);
																			}
																			result_array.push(res);
																			assert_encoding('ziplist', 'xlist', function (err, res) {
																				if (err) {
																					errorCallback(err);
																				}
																				ut.assertDeepEqual(result_array, [2, 2, 257, 257, -1, -1], test_case);
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
	};
	tester.List47_1 = function (errorCallback) {
		var test_case = 'LINDEX consistency test - ziplist';
		var type = 'ziplist';
		var num = 250;
		client.del('mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			g.asyncFor(0, num, function (loop) {
				var i = loop.iteration();
				client.rpush('mylist', i, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					loop.next();
				});
			}, function () {
				assert_encoding(type, 'mylist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					check_numbered_list_consistency('mylist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						ut.assertOk(res, null, test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List47_2 = function (errorCallback) {
		var test_case = 'LINDEX random access - ziplist';
		var type = 'ziplist';
		assert_encoding(type, 'mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			check_random_access_consistency('mylist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertOk(res, null, test_case);
				testEmitter.emit('next');
			});
		});

	};
	tester.List47_3 = function (errorCallback) {
		var test_case = 'Check if list is still ok after a DEBUG RELOAD - ziplist';
		var type = 'ziplist';
		client.debug('reload', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			assert_encoding(type, 'mylist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				check_numbered_list_consistency('mylist', function (err, res1) {
					if (err) {
						errorCallback(err);
					}
					check_random_access_consistency('mylist', function (err, res2) {
						if (err) {
							errorCallback(err);
						}
						ut.assertMany(
							[
								['ok',res1, null],
								['ok',res2, null]
							],test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List47_4 = function (errorCallback) {
		var test_case = 'LINDEX consistency test - linkedlist';
		var type = 'linkedlist';
		var num = 500;
		client.del('mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			g.asyncFor(0, num, function (loop) {
				var i = loop.iteration();
				client.rpush('mylist', i, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					loop.next();
				});
			}, function () {
				assert_encoding(type, 'mylist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					check_numbered_list_consistency('mylist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						ut.assertOk(res, null, test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List47_5 = function (errorCallback) {
		var test_case = 'LINDEX random access - linkedlist';
		var type = 'linkedlist';
		assert_encoding(type, 'mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			check_random_access_consistency('mylist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertOk(res, null, test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List47_6 = function (errorCallback) {
		var test_case = 'Check if list is still ok after a DEBUG RELOAD - linkedlist';
		var type = 'linkedlist';
		client.debug('reload', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			assert_encoding(type, 'mylist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				check_numbered_list_consistency('mylist', function (err, res1) {
					if (err) {
						errorCallback(err);
					}
					check_random_access_consistency('mylist', function (err, res2) {
						if (err) {
							errorCallback(err);
						}
						ut.assertMany(
							[
								['ok',res1, null],
								['ok',res2, null]
							],test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List48 = function (errorCallback) {
		var test_case = 'LLEN against non-list value error';
		client.del('mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.set('mylist', 'foobar', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.llen('mylist', function (err, res) {
					if (res) {
						errorCallback(res);
					}
					ut.assertOk(err, null, test_case);
					testEmitter.emit('next');
				});
			});
		});
	};
	tester.List49 = function (errorCallback) {
		var test_case = 'LLEN against non existing key';
		client.llen('not-a-key', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			ut.assertEqual(res, 0, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List50 = function (errorCallback) {
		var test_case = 'LINDEX against non-list value error';
		client.lindex('mylist', 0, function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk(err, null, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List51 = function (errorCallback) {
		var test_case = 'LINDEX against non existing key';
		client.lindex('not-a-key', 10, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			ut.assertEqual(res, null, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List52 = function (errorCallback) {
		var test_case = 'LPUSH against non-list value error';
		client.lpush('mylist', 0, function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk(err, null, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List53 = function (errorCallback) {
		var test_case = 'RPUSH against non-list value error';
		client.rpush('mylist', 0, function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk(err, null, test_case);
			testEmitter.emit('next');
		});
	};
	tester.List54 = function (errorCallback) {
		var test_case = 'RPOPLPUSH base case - ziplist';
		var result_array = new Array();
		var large = list_common.ziplist;
		client.del('mylist1', 'mylist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			create_ziplist('mylist1', new Array('a', large, 'c', 'd'), function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('mylist1', 'mylist2', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpoplpush('mylist1', 'mylist2', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('mylist1', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lrange('mylist2', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								assert_encoding('ziplist', 'mylist2', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									ut.assertDeepEqual(result_array, ['d', 'c', ['a', large],['c', 'd']], test_case);
									testEmitter.emit('next');
								});
							});
						});
					});
				});
			});
		});
	};

	tester.List55 = function (errorCallback) {
		var test_case = 'RPOPLPUSH with the same list as src and dst - ziplist';
		var result_array = new Array();
		var large = list_common.ziplist;
		create_ziplist('mylist', new Array('a', large, 'c'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 0, -1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.rpoplpush('mylist', 'mylist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lrange('mylist', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [['a', large, 'c'], 'c', ['c', 'a', large]], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List56 = function (errorCallback) {
		var test_case = 'RPOPLPUSH with ziplist source and existing target ziplist';
		var result_array = new Array();
		var large = list_common.ziplist;
		var otherlarge = list_common.ziplist;
		create_ziplist('srclist', new Array('a', 'b', 'c', large), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			create_ziplist('dstlist', new Array(otherlarge), function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('srclist', 'dstlist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpoplpush('srclist', 'dstlist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('srclist', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lrange('dstlist', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								ut.assertDeepEqual(result_array, [large, 'c', ['a', 'b'],
												['c', large, otherlarge]
											], test_case);
								testEmitter.emit('next');
							});
						});
					});
				});
			});
		});
	};

	tester.List57 = function (errorCallback) {
		var test_case = 'RPOPLPUSH with ziplist source and existing target linkedlist';
		var result_array = new Array();
		var large = list_common.ziplist;
		var otherlarge = list_common.linkedlist;
		create_ziplist('srclist', new Array('a', 'b', 'c', large), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			create_linkedlist('dstlist', new Array(otherlarge), function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('srclist', 'dstlist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpoplpush('srclist', 'dstlist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('srclist', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lrange('dstlist', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								ut.assertDeepEqual(result_array, [large, 'c', ['a', 'b'],
												['c', large, otherlarge]
											], test_case);
								testEmitter.emit('next');
							});
						});
					});
				});
			});
		});
	};

	tester.List58 = function (errorCallback) {
		var test_case = 'RPOPLPUSH base case - linkedlist';
		var result_array = new Array();
		var large = list_common.linkedlist;
		client.del('mylist1', 'mylist2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			create_linkedlist('mylist1', new Array('a', large, 'c', 'd'), function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('mylist1', 'mylist2', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpoplpush('mylist1', 'mylist2', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('mylist1', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lrange('mylist2', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								assert_encoding('ziplist', 'mylist2', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									ut.assertDeepEqual(result_array, ['d', 'c', ['a', large],
													['c', 'd']
												], test_case);
									testEmitter.emit('next');
								});
							});
						});
					});
				});
			});
		});
	};

	tester.List59 = function (errorCallback) {
		var test_case = 'RPOPLPUSH with the same list as src and dst - linkedlist';
		var result_array = new Array();
		var large = list_common.linkedlist;
		create_linkedlist('mylist', new Array('a', large, 'c'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 0, -1, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.rpoplpush('mylist', 'mylist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lrange('mylist', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [
										['a', large, 'c'], 'c', ['c', 'a', large]
									], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List60 = function (errorCallback) {
		var test_case = 'RPOPLPUSH with linkedlist source and existing target ziplist';
		var result_array = new Array();
		var large = list_common.linkedlist;
		var otherlarge = list_common.ziplist;
		create_linkedlist('srclist', new Array('a', 'b', 'c', large), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			create_ziplist('dstlist', new Array(otherlarge), function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('srclist', 'dstlist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpoplpush('srclist', 'dstlist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('srclist', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lrange('dstlist', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								assert_encoding('linkedlist', 'dstlist', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									ut.assertDeepEqual(result_array, [large, 'c', ['a', 'b'],
													['c', large, otherlarge]
												], test_case);
									testEmitter.emit('next');
								});
							});
						});
					});
				});
			});
		});
	};

	tester.List61 = function (errorCallback) {
		var test_case = 'RPOPLPUSH with linkedlist source and existing target linkedlist';
		var result_array = new Array();
		var large = list_common.linkedlist;
		var otherlarge = list_common.linkedlist;
		create_linkedlist('srclist', new Array('a', 'b', 'c', large), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			create_linkedlist('dstlist', new Array(otherlarge), function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('srclist', 'dstlist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.rpoplpush('srclist', 'dstlist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.lrange('srclist', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							client.lrange('dstlist', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								assert_encoding('linkedlist', 'dstlist', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									ut.assertDeepEqual(result_array, [large, 'c', ['a', 'b'],
													['c', large, otherlarge]
												], test_case);
									testEmitter.emit('next');
								});
							});
						});
					});
				});
			});
		});
	};

	tester.List62 = function (errorCallback) {
		var test_case = 'RPOPLPUSH against non existing key';
		var result_array = new Array();
		client.del('srclist', 'dstlist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.rpoplpush('srclist', 'dstlist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.exists('srclist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.exists('dstlist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [null, 0, 0], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List63 = function (errorCallback) {
		var test_case = 'RPOPLPUSH against non list dst key';
		client.del('srclist', 'dstlist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.set('srclist', 'x', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('srclist', 'dstlist', function (error, result) {
					assert_type('string', 'srclist');
					client.exists('newlist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						ut.assertMany(
							[
								['deepequal',res, 0],
								['ok',error, null]
							],test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List64 = function (errorCallback) {
		var test_case = 'RPOPLPUSH against non list src key';
		create_ziplist('srclist', new Array('a', 'b', 'c', 'd'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.set('dstlist', 'x', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.rpoplpush('srclist', 'dstlist', function (error, result) {
					assert_type('string', 'dstlist');
					client.lrange('srclist', 0, -1, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						ut.assertMany(
							[
								['deepequal',res, ['a', 'b', 'c', 'd']],
								['ok',error, null]
							],test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};
	tester.List65 = function (errorCallback) {
		var test_case = 'RPOPLPUSH against non existing src key';
		client.del('srclist', 'dstlist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.rpoplpush('srclist', 'dstlist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertEqual(res, null, test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List66 = function (errorCallback) {
		var test_case = 'Basic LPOP/RPOP - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		create_ziplist('mylist', new Array(large, 1, 2), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lpop('mylist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.rpop('mylist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lpop('mylist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('mylist', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							// pop on empty list
							client.lpop('mylist', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.rpop('mylist', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									ut.assertDeepEqual(result_array, [large, 2, 1, 0, null, null], test_case);
									testEmitter.emit('next');
								});
							});
						});
					});
				});
			});
		});
	};

	tester.List67 = function (errorCallback) {
		var test_case = 'Basic LPOP/RPOP - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		create_linkedlist('mylist', new Array(large, 1, 2), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lpop('mylist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.rpop('mylist', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lpop('mylist', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						client.llen('mylist', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							// pop on empty list
							client.lpop('mylist', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(res);
								client.rpop('mylist', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(res);
									ut.assertDeepEqual(result_array, [large, 2, 1, 0, null, null], test_case);
									testEmitter.emit('next');
								});
							});
						});
					});
				});
			});
		});
	};

	tester.List68 = function (errorCallback) {
		var test_case = 'LPOP/RPOP against non list value';
		client.set('notalist', 'foo', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lpop('notalist', function (error1, res) {
				if (res) {
					errorCallback(res);
				}
				client.rpop('notalist', function (error2, res) {
					if (res) {
						errorCallback(res);
					}
					ut.assertMany(
						[
							['ok','kind', error1],
							['ok','kind', error2]
						],test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List69 = function (errorCallback) {
		var test_case = 'LRANGE basics - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		create_ziplist('mylist', new Array(large, 1, 2, 3, 4, 5, 6, 7, 8, 9), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 1, -2, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.lrange('mylist', -3, -1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lrange('mylist', 4, 4, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [
										['1', '2', '3', '4', '5', '6', '7', '8'],
										['7', '8', '9'],
										['4']
									], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List70 = function (errorCallback) {
		var test_case = 'LRANGE inverted indexes - ziplist';
		var large = list_common.ziplist;
		create_ziplist('mylist', new Array(large, 1, 2, 3, 4, 5, 6, 7, 8, 9), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 6, 2, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertDeepEqual(res, [], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List71 = function (errorCallback) {
		var test_case = 'LRANGE out of range indexes including the full list - ziplist';
		var large = list_common.ziplist;
		create_ziplist('mylist', new Array(large, 1, 2, 3), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', -1000, 1000, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertDeepEqual(res, [large, '1', '2', '3'], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List72 = function (errorCallback) {
		var test_case = 'LRANGE out of range negative end index - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		create_ziplist('mylist', new Array(large, 1, 2, 3), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 0, -4, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.lrange('mylist', 0, -5, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					ut.assertDeepEqual(result_array, [[large],[]], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List73 = function (errorCallback) {
		var test_case = 'LRANGE basics - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		create_linkedlist('mylist', new Array(large, 1, 2, 3, 4, 5, 6, 7, 8, 9), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 1, -2, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.lrange('mylist', -3, -1, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					client.lrange('mylist', 4, 4, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						ut.assertDeepEqual(result_array, [
										['1', '2', '3', '4', '5', '6', '7', '8'],
										['7', '8', '9'],
										['4']
									], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};
	tester.List74 = function (errorCallback) {
		var test_case = 'LRANGE inverted indexes - linkedlist';
		var large = list_common.linkedlist;
		create_linkedlist('mylist', new Array(large, 1, 2, 3, 4, 5, 6, 7, 8, 9), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 6, 2, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertDeepEqual(res, [], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List75 = function (errorCallback) {
		var test_case = 'LRANGE out of range indexes including the full list - linkedlist';
		var large = list_common.linkedlist;
		create_linkedlist('mylist', new Array(large, 1, 2, 3), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', -1000, 1000, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				ut.assertDeepEqual(res, [large, '1', '2', '3'], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List76 = function (errorCallback) {
		var test_case = 'LRANGE out of range negative end index - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		create_linkedlist('mylist', new Array(large, 1, 2, 3), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrange('mylist', 0, -4, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(res);
				client.lrange('mylist', 0, -5, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(res);
					ut.assertDeepEqual(result_array, [[large],[]], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List77 = function (errorCallback) {
		var test_case = 'LRANGE against non existing key';
		client.lrange('nosuchkey', 0, 1, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			ut.assertDeepEqual(res, [], test_case);
			testEmitter.emit('next');

		});
	};

	tester.List78 = function (errorCallback) {
		var test_case = 'LTRIM basics - zipist';
		var large = list_common.ziplist;
		var result_array = new Array();
		var type = 'ziplist';
		trim_list(large, type, 0, 0, function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			trim_list(large, type, 0, 1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				trim_list(large, type, 0, 2, function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					trim_list(large, type, 1, 2, function (err, result) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(result);
						trim_list(large, type, 1, -1, function (err, result) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(result);
							trim_list(large, type, 1, -2, function (err, result) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(result);
								trim_list(large, type, -2, -1, function (err, result) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(result);
									trim_list(large, type, -1, -1, function (err, result) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(result);
										trim_list(large, type, -5, -1, function (err, result) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(result);
											trim_list(large, type, -10, 10, function (err, result) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(result);
												trim_list(large, type, 0, 5, function (err, result) {
													if (err) {
														errorCallback(err);
													}
													result_array.push(result);
													trim_list(large, type, 0, 10, function (err, result) {
														if (err) {
															errorCallback(err);
														}
														result_array.push(result);
														ut.assertDeepEqual(result_array, [
																		['1'],
																		['1', '2'],
																		['1', '2', '3'],
																		['2', '3'],
																		['2', '3', '4', large],
																		['2', '3', '4'],
																		['4', large],
																		[large],
																		['1', '2', '3', '4', large],
																		['1', '2', '3', '4', large],
																		['1', '2', '3', '4', large],
																		['1', '2', '3', '4', large]
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
					});
				});
			});
		});
	};

	tester.List79 = function (errorCallback) {
		var test_case = 'LTRIM out of range negative end index - zipist';
		var large = list_common.ziplist;
		var result_array = new Array();
		var type = 'ziplist';
		trim_list(large, type, 0, -5, function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			trim_list(large, type, 0, -6, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [['1'],[]], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List80 = function (errorCallback) {
		var test_case = 'LTRIM basics - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		var type = 'linkedlist';
		trim_list(large, type, 0, 0, function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			trim_list(large, type, 0, 1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				trim_list(large, type, 0, 2, function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					trim_list(large, type, 1, 2, function (err, result) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(result);
						trim_list(large, type, 1, -1, function (err, result) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(result);
							trim_list(large, type, 1, -2, function (err, result) {
								if (err) {
									errorCallback(err);
								}
								result_array.push(result);
								trim_list(large, type, -2, -1, function (err, result) {
									if (err) {
										errorCallback(err);
									}
									result_array.push(result);
									trim_list(large, type, -1, -1, function (err, result) {
										if (err) {
											errorCallback(err);
										}
										result_array.push(result);
										trim_list(large, type, -5, -1, function (err, result) {
											if (err) {
												errorCallback(err);
											}
											result_array.push(result);
											trim_list(large, type, -10, 10, function (err, result) {
												if (err) {
													errorCallback(err);
												}
												result_array.push(result);
												trim_list(large, type, 0, 5, function (err, result) {
													if (err) {
														errorCallback(err);
													}
													result_array.push(result);
													trim_list(large, type, 0, 10, function (err, result) {
														if (err) {
															errorCallback(err);
														}
														result_array.push(result);
														ut.assertDeepEqual(result_array, [
																		['1'],
																		['1', '2'],
																		['1', '2', '3'],
																		['2', '3'],
																		['2', '3', '4', large],
																		['2', '3', '4'],
																		['4', large],
																		[large],
																		['1', '2', '3', '4', large],
																		['1', '2', '3', '4', large],
																		['1', '2', '3', '4', large],
																		['1', '2', '3', '4', large]
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
					});
				});
			});
		});
	};

	tester.List81 = function (errorCallback) {
		var test_case = 'LTRIM out of range negative end index - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		var type = 'linkedlist';
		trim_list(large, type, 0, -5, function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			trim_list(large, type, 0, -6, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [['1'],[]], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List82 = function (errorCallback) {
		var test_case = 'LSET - ziplist';
		var large = list_common.ziplist;
		create_ziplist('mylist', new Array(99, 98, large, 96, 95), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lset('mylist', 1, 'foo', function (err, result) {
				if (err) {
					errorCallback(err);
				}
				client.lset('mylist', -1, 'bar', function (err, result) {
					if (err) {
						errorCallback(err);
					}
					client.lrange('mylist', 0, -1, function (err, result) {
						if (err) {
							errorCallback(err);
						}
						ut.assertDeepEqual(result, ['99', 'foo', large, '96', 'bar'], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List83 = function (errorCallback) {
		var test_case = 'LSET out of range index - ziplist';
		client.lset('mylist', 10, 'foo', function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk('range', err, test_case);
			testEmitter.emit('next');
		});
	};

	tester.List84 = function (errorCallback) {
		var test_case = 'LSET - linkedlist';
		var large = list_common.linkedlist;
		create_linkedlist('mylist', new Array(99, 98, large, 96, 95), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lset('mylist', 1, 'foo', function (err, result) {
				if (err) {
					errorCallback(err);
				}
				client.lset('mylist', -1, 'bar', function (err, result) {
					if (err) {
						errorCallback(err);
					}
					client.lrange('mylist', 0, -1, function (err, result) {
						if (err) {
							errorCallback(err);
						}
						ut.assertDeepEqual(result, ['99', 'foo', large, '96', 'bar'], test_case);
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List85 = function (errorCallback) {
		var test_case = 'LSET out of range index - linkedlist';
		client.lset('mylist', 10, 'foo', function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk('range', err, test_case);
			testEmitter.emit('next');
		});
	};

	tester.List86 = function (errorCallback) {
		var test_case = 'LSET against non existing key';
		client.lset('nosuchkey', 10, 'foo', function (err, res) {
			if (res) {
				errorCallback(res);
			}
			ut.assertOk('key', err, test_case);
			testEmitter.emit('next');
		});
	};

	tester.List87 = function (errorCallback) {
		var test_case = 'LSET against non list value';
		client.set('nolist', 'foobar', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lset('nolist', 0, 'foo', function (err, res) {
				if (res) {
					errorCallback(res);
				}
				ut.assertOk('value', err, test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List88 = function (errorCallback) {
		var test_case = 'LREM remove all the occurrences - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		create_ziplist('mylist', new Array(large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'bar', 'test', 'foo'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrem('mylist', 0, 'bar', function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				client.lrange('mylist', 0, -1, function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					ut.assertDeepEqual(result_array, [2, [large, 'foo', 'foobar', 'foobared', 'zap', 'test', 'foo']], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List89 = function (errorCallback) {
		var test_case = 'LREM remove the first occurrence - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		client.lrem('mylist', 1, 'foo', function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			client.lrange('mylist', 0, -1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [1, [large, 'foobar', 'foobared', 'zap', 'test', 'foo']], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List90 = function (errorCallback) {
		var test_case = 'LREM remove non existing element - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		client.lrem('mylist', 1, 'nosuchelement', function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			client.lrange('mylist', 0, -1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [0, [large, 'foobar', 'foobared', 'zap', 'test', 'foo']], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List91 = function (errorCallback) {
		var test_case = 'LREM starting from tail with negative count - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		create_ziplist('mylist', new Array(large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'bar', 'test', 'foo', 'foo'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrem('mylist', -1, 'bar', function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				client.lrange('mylist', 0, -1, function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					ut.assertDeepEqual(result_array, [1, [large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'test', 'foo', 'foo']], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List92 = function (errorCallback) {
		var test_case = 'LREM starting from tail with negative count (2) - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		client.lrem('mylist', -2, 'foo', function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			client.lrange('mylist', 0, -1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [2, [large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'test']], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List93 = function (errorCallback) {
		var test_case = 'LREM deleting objects that may be int encoded - ziplist';
		var large = list_common.ziplist;
		var result_array = new Array();
		create_ziplist('myotherlist', new Array(large, 1, 2, 3), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrem('myotherlist', 1, 2, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				client.llen('myotherlist', function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					ut.assertDeepEqual(result_array, [1, 3], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List94 = function (errorCallback) {
		var test_case = 'LREM remove all the occurrences - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		create_linkedlist('mylist', new Array(large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'bar', 'test', 'foo'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrem('mylist', 0, 'bar', function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				client.lrange('mylist', 0, -1, function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					ut.assertDeepEqual(result_array, [2, [large, 'foo', 'foobar', 'foobared', 'zap', 'test', 'foo']], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List95 = function (errorCallback) {
		var test_case = 'LREM remove the first occurrence - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		client.lrem('mylist', 1, 'foo', function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			client.lrange('mylist', 0, -1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [1, [large, 'foobar', 'foobared', 'zap', 'test', 'foo']], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List96 = function (errorCallback) {
		var test_case = 'LREM remove non existing element - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		client.lrem('mylist', 1, 'nosuchelement', function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			client.lrange('mylist', 0, -1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [0, [large, 'foobar', 'foobared', 'zap', 'test', 'foo']], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List97 = function (errorCallback) {
		var test_case = 'LREM starting from tail with negative count - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		create_linkedlist('mylist', new Array(large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'bar', 'test', 'foo', 'foo'), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrem('mylist', -1, 'bar', function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				client.lrange('mylist', 0, -1, function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					ut.assertDeepEqual(result_array, [1, [large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'test', 'foo', 'foo']], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List98 = function (errorCallback) {
		var test_case = 'LREM starting from tail with negative count (2) - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		client.lrem('mylist', -2, 'foo', function (err, result) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(result);
			client.lrange('mylist', 0, -1, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				ut.assertDeepEqual(result_array, [2, [large, 'foo', 'bar', 'foobar', 'foobared', 'zap', 'test']], test_case);
				testEmitter.emit('next');
			});
		});
	};

	tester.List99 = function (errorCallback) {
		var test_case = 'LREM deleting objects that may be int encoded - linkedlist';
		var large = list_common.linkedlist;
		var result_array = new Array();
		create_linkedlist('myotherlist', new Array(large, 1, 2, 3), function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.lrem('myotherlist', 1, 2, function (err, result) {
				if (err) {
					errorCallback(err);
				}
				result_array.push(result);
				client.llen('myotherlist', function (err, result) {
					if (err) {
						errorCallback(err);
					}
					result_array.push(result);
					ut.assertDeepEqual(result_array, [1, 3], test_case);
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.List100 = function (errorCallback) {
		var test_case = 'Regression for bug 593 - chaining BRPOPLPUSH with other blocking cmds';
		var result_array = new Array();
		client1.brpoplpush('a', 'b', 0, function (error1, result1) {});
		client1.brpoplpush('a', 'b', 0, function (error1, result1) {});
		client2.brpoplpush('b', 'c', 0, function (error2, result2) {});
		setTimeout(function () {
			client.lpush('a', 'data', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.ping(function (err, res) {
					if (err) {
						errorCallback(err);
					}
					ut.assertEqual(res, 'PONG', test_case);
					testEmitter.emit('next');
				});
			});
		}, 1000);
	};

	// 2.6 additions
	tester.List101 = function (errorCallback) {
		var test_case = 'R/LPOP against empty list';
		var empty_array = new Array();

		// pop an empty list
		client.lpop('mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			ut.assertDeepEqual(res, 'hellohellohellohello', test_case);
			testEmitter.emit('next');
		});
	};

	tester.List102 = function (errorCallback) {
		var test_case = 'BLPOP, LPUSH + DEL should not awake blocked client';
		client.del('list1', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.blpop('list1', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
			});
			setTimeout(function () {
				cli.multi()
				.lpush('list1', 'a')
				.del('list1')
				.exec(function (err, replies) {
					if (err) {
						errorCallback(err);
					}
					cli.del('list1', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						cli.lpush('list1', 'b', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							ut.assertDeepEqual(res, 1, test_case);
							testEmitter.emit('next');
						});
					});
				});
			}, 1000);
		});
	};
	tester.List103 = function (errorCallback) {
		var test_case = 'BLPOP, LPUSH + DEL + SET should not awake blocked client';
		client.del('list1', function (err, res) {
			if (err) {
				errorCallback(err);
			}

			client.blpop('list1', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
			});
			setTimeout(function () {
				cli.multi().lpush('list1', 'a').del('list1').set('list1', 'foo').exec(function (err, replies) {
					if (err) {
						errorCallback(err);
					}
					cli.del('list1', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						cli.lpush('list1', 'b', function (err, res) {
							if (err) {
								errorCallback(err);
							}
							ut.assertEqual(res, 1, test_case);
							testEmitter.emit('next');
						});
					});
				});
			}, 1000);
		});
	};

	tester.List104 = function (errorCallback) {
		var test_case = 'BLPOP with same key multiple times should work (issue #801)';
		client.del('list1', 'list2', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			//Data arriving after the BLPOP.

			client.blpop('list1', 'list2', 'list2', 'list1', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
			});
			setTimeout(function () {
				cli.lpush('list1', 'a', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					ut.assertDeepEqual(res, 1, test_case);
					//testEmitter.emit('next');
				});
			}, 1000);

			//Data already there.
			client.lpush('list1', 'a', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.lpush('list2', 'b', function (err, res) {
					if (err) {
						errorCallback(err);
					}
					client.blpop('list1', 'list2', 'list2', 'list1', 0, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						try {
							if (!assert.deepEqual(res, ['list1', 'a'], test_case)) {
								ut.pass(test_case);
							}
						} catch (e) {
							ut.fail(e, true);
						}
						//testEmitter.emit('next');
						client.blpop('list1', 'list2', 'list2', 'list1', 0, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							ut.assertDeepEqual(res, ['list2', 'b'], test_case);
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};

	tester.List105 = function (errorCallback) {
		var test_case = 'MULTI/EXEC is isolated from the point of view of BLPOP';
		client.del('list1', function (err, res) {
			if (err) {
				errorCallback(err);
			}

			client.blpop('list1', 0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
			});
			setTimeout(function () {
				cli.multi().lpush('list1', 'a').lpush('list1', 'b').lpush('list1', 'c').exec(function (err, replies) {
					if (err) {
						errorCallback(err);
					}
					ut.assertDeepEqual(replies, [1, 2, 3], test_case);
					testEmitter.emit('next');
				});
			}, 1000);
		});
	};

	tester.List106 = function (errorCallback) {
		var test_case = 'BRPOPLPUSH maintains order of elements after failure';
		var result_array = new Array();
		client.del('blist', 'target', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			result_array.push(res);
			client.set('target', 'nolist', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				//result_array.push(res);

				client.brpoplpush('blist', 'target', 0, function (err, res) {
					if (res) {
						errorCallback(res);
					}
				});
				setTimeout(function () {
					cli.rpush('blist', 'a', 'b', 'c', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						result_array.push(res);
						if (ut.match('wrong kind', err)) {
							flag = true;
						}
						cli.lrange('blist', 0, -1, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							result_array.push(res);
							ut.assertDeepEqual(result_array, [2, 3, ['a', 'b', 'c']], test_case);
							testEmitter.emit('next');
						});
					});
				}, 1000);
			});
		});
	};

	tester.List107 = function (errorCallback) {
		var test_case = 'LINSERT raise error on bad syntax';
		client.linsert('xlist', 'aft3r', 'aa', 42, function (err, res) {
			ut.assertOk('syntax error', err, test_case);
			testEmitter.emit('next');
		});
	};

	tester.List108 = function(errorCallback){
		var test_case = 'Timeout and invalid timeout error on BRPOPLPUSH';
		client.brpoplpush('a', 'b', -1, function (err1, res) {	
			client.brpoplpush('a','b', 0xffffffff, function (err2, res) {	
				ut.assertMany(
					[
						['ok','negative',err1],
						['ok','ERR timeout',err2]
					],test_case);
				testEmitter.emit('next');
			});		
		});
	}
	 
	tester.List109 = function(errorCallback){
		var test_case = 'LINDEX throw Error for Index out of range';
		client.lpush('mylist', 'bar', function (err, res) {	
			client.lindex('mylist', -1e-1, function (err1, res) {	
				client.lset('mylist',-1e-1, 0, function (err2, res) {
					client.lrange('mylist',0, -1e-1, function (err3, res) {	
						client.ltrim('mylist',0, -1e-1, function (err4, res) {
							client.lrem('mylist', -1e-1, function (err5, res) {
								ut.assertMany(
									[
										['ok','out of range',err1],
										['ok','out of range',err3],
										['ok','out of range',err2],
										['ok','out of range',err4],
										['ok','wrong number of arguments',err5]
									],test_case);
								testEmitter.emit('next');
							});
						});
					});
				});
			});		
		});
	}

	return list;

}
	());