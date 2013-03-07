exports.Bgsaveperf = (function () {
	//private properties
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	BgUtility = require('../support/bgutil.js'),
	bg = new BgUtility(),
	bgsaveperf = {},
	name = "BgsavePerf",
	client = "",
	tester = {},
	server_pid = "",
	all_tests = {},
	iter1 = 1000000,
	iter2 = 100,
	start = "",
	bgstart = "",
	elapsed = "";

	//public property
	bgsaveperf.debug_mode = false;

	//public method
	bgsaveperf.start_test = function (client_pid, callback) {
		testEmitter.on('start', function () {
			// write logic to start the server here.
			var tags = "bgsave";
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
					if (bgsaveperf.debug_mode) {
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

		if (bgsaveperf.debug_mode) {
			server.set_debug_mode(true);
		}

		testEmitter.emit('start');
	}

	//private methods


	tester.bgp1 = function (errorCallback) {
		var test_case = "BGSAVE string copy on write latency";
		ut.waitForBgsave(client, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.flushdb(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				console.log("\tMeasuring Bgsave for " + iter1 + " strings");
				start = new Date().getTime();
				bg.mset_loop(client, iter1, iter2, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					elapsed = new Date().getTime() - start;
					console.log("\tTime to create items : " + elapsed + " ms");
					start = new Date().getTime();
					client.set(500, 'xyz', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						elapsed = new Date().getTime() - start;
						console.log("\tTime to modify first value (no save) : " + elapsed + " ms");
						ut.waitForBgsave(client, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							bgstart = new Date().getTime();
							client.bgsave(function (err, res) {
								if (err) {
									errorCallback(err);
								}
								ut.waitForBgsave(client, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									elapsed = new Date().getTime() - bgstart;
									console.log("\tTime for RO bgsave to complete : " + elapsed + " ms");
									start = new Date().getTime();
									bgstart = new Date().getTime();
									client.bgsave(function (err, res) {
										if (err) {
											errorCallback(err);
										}
										elapsed = new Date().getTime() - start;
										console.log("\tTime to start bgsave : " + elapsed + " ms");
										start = new Date().getTime();
										client.set(502, 'xyz', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											elapsed = new Date().getTime() - start;
											console.log("\tTime to modify first value (saving) : " + elapsed + " ms");
											start = new Date().getTime();
											client.set(503, 'xyz', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												elapsed = new Date().getTime() - start;
												console.log("\tTime to modify second value (saving) : " + elapsed + " ms");
												ut.waitForBgsave(client, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													elapsed = new Date().getTime() - bgstart;
													console.log("\tTime for bgsave to complete : " + elapsed + " ms\n");
													client.flushdb(function (err, res) {
														if (err) {
															errorCallback(err);
														}
														try {
															if (!assert.equal(res, 'OK', test_case)) {
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
	};
	tester.bgp2 = function (errorCallback) {
		var test_case = "BGSAVE list copy on write latency";
		var key = "mylist";
		ut.waitForBgsave(client, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.flushdb(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				console.log("\tMeasuring Bgsave for " + iter1 + " strings in list");
				start = new Date().getTime();
				bg.rpush_loop(client, key, iter1, iter2, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					elapsed = new Date().getTime() - start;
					console.log("\tTime to create items : " + elapsed + " ms");
					start = new Date().getTime();
					client.rpush(key, 'abcdefghij', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						elapsed = new Date().getTime() - start;
						console.log("\tTime to modify first value (no save) : " + elapsed + " ms");
						ut.waitForBgsave(client, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							bgstart = new Date().getTime();
							client.bgsave(function (err, res) {
								if (err) {
									errorCallback(err);
								}
								ut.waitForBgsave(client, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									elapsed = new Date().getTime() - bgstart;
									console.log("\tTime for RO bgsave to complete : " + elapsed + " ms");
									start = new Date().getTime();
									bgstart = new Date().getTime();
									client.bgsave(function (err, res) {
										if (err) {
											errorCallback(err);
										}
										elapsed = new Date().getTime() - start;
										console.log("\tTime to start bgsave : " + elapsed + " ms");
										start = new Date().getTime();
										client.rpush(key, 'abcdefghij', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											elapsed = new Date().getTime() - start;
											console.log("\tTime to modify first value (saving) : " + elapsed + " ms");
											start = new Date().getTime();
											client.rpush(key, 'abcdefghij', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												elapsed = new Date().getTime() - start;
												console.log("\tTime to modify second value (saving) : " + elapsed + " ms");
												ut.waitForBgsave(client, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													elapsed = new Date().getTime() - bgstart;
													console.log("\tTime for bgsave to complete : " + elapsed + " ms\n");
													client.flushdb(function (err, res) {
														if (err) {
															errorCallback(err);
														}
														try {
															if (!assert.equal(res, 'OK', test_case)) {
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
	};
	tester.bgp3 = function (errorCallback) {
		var test_case = "BGSAVE hash dictionary copy on write latency";
		var key = "myhash";
		ut.waitForBgsave(client, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.flushdb(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				console.log("\tMeasuring Bgsave for " + iter1 + " strings in hash dictionary");
				start = new Date().getTime();
				bg.hmset_loop(client, key, iter1, iter2, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					elapsed = new Date().getTime() - start;
					console.log("\tTime to create items : " + elapsed + " ms");
					start = new Date().getTime();
					client.hset(key, 501, 'xyz', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						elapsed = new Date().getTime() - start;
						console.log("\tTime to modify first value (no save) : " + elapsed + " ms");
						ut.waitForBgsave(client, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							bgstart = new Date().getTime();
							client.bgsave(function (err, res) {
								if (err) {
									errorCallback(err);
								}
								ut.waitForBgsave(client, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									elapsed = new Date().getTime() - bgstart;
									console.log("\tTime for RO bgsave to complete : " + elapsed + " ms");
									start = new Date().getTime();
									bgstart = new Date().getTime();
									client.bgsave(function (err, res) {
										if (err) {
											errorCallback(err);
										}
										elapsed = new Date().getTime() - start;
										console.log("\tTime to start bgsave : " + elapsed + " ms");
										start = new Date().getTime();
										client.hset(key, 502, 'xyz', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											elapsed = new Date().getTime() - start;
											console.log("\tTime to modify first value (saving) : " + elapsed + " ms");
											start = new Date().getTime();
											client.hset(key, 503, 'xyz', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												elapsed = new Date().getTime() - start;
												console.log("\tTime to modify second value (saving) : " + elapsed + " ms");
												ut.waitForBgsave(client, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													elapsed = new Date().getTime() - bgstart;
													console.log("\tTime for bgsave to complete : " + elapsed + " ms\n");
													client.flushdb(function (err, res) {
														if (err) {
															errorCallback(err);
														}
														try {
															if (!assert.equal(res, 'OK', test_case)) {
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
	};
	tester.bgp4 = function (errorCallback) {
		var test_case = "BGSAVE large set copy on write latency";
		var key = "myset";
		ut.waitForBgsave(client, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.flushdb(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				console.log("\tMeasuring Bgsave for " + iter1 + " strings in set");
				start = new Date().getTime();
				bg.sadd_loop(client, key, iter1, iter2, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					elapsed = new Date().getTime() - start;
					console.log("\tTime to create items : " + elapsed + " ms");
					start = new Date().getTime();
					client.sadd(key, 'abc', function (err, res) {
						if (err) {
							errorCallback(err);
						}
						elapsed = new Date().getTime() - start;
						console.log("\tTime to modify first value (no save) : " + elapsed + " ms");
						ut.waitForBgsave(client, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							bgstart = new Date().getTime();
							client.bgsave(function (err, res) {
								if (err) {
									errorCallback(err);
								}
								ut.waitForBgsave(client, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									elapsed = new Date().getTime() - bgstart;
									console.log("\tTime for RO bgsave to complete : " + elapsed + " ms");
									start = new Date().getTime();
									bgstart = new Date().getTime();
									client.bgsave(function (err, res) {
										if (err) {
											errorCallback(err);
										}
										elapsed = new Date().getTime() - start;
										console.log("\tTime to start bgsave : " + elapsed + " ms");
										start = new Date().getTime();
										client.sadd(key, 'def', function (err, res) {
											if (err) {
												errorCallback(err);
											}
											elapsed = new Date().getTime() - start;
											console.log("\tTime to modify first value (saving) : " + elapsed + " ms");
											start = new Date().getTime();
											client.sadd(key, 'xyz', function (err, res) {
												if (err) {
													errorCallback(err);
												}
												elapsed = new Date().getTime() - start;
												console.log("\tTime to modify second value (saving) : " + elapsed + " ms");
												ut.waitForBgsave(client, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													elapsed = new Date().getTime() - bgstart;
													console.log("\tTime for bgsave to complete : " + elapsed + " ms\n");
													client.flushdb(function (err, res) {
														if (err) {
															errorCallback(err);
														}
														try {
															if (!assert.equal(res, 'OK', test_case)) {
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
	};
	tester.bgp5 = function (errorCallback) {
		var test_case = "BGSAVE large zset copy on write latency";
		var key = "myzset";
		ut.waitForBgsave(client, function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.flushdb(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				console.log("\tMeasuring Bgsave for " + iter1 + " strings in ordered set");
				start = new Date().getTime();
				bg.zadd_loop(client, key, iter1, iter2, function (err, res) {
					if (err) {
						errorCallback(err);
					}
					elapsed = new Date().getTime() - start;
					console.log("\tTime to create items : " + elapsed + " ms");
					start = new Date().getTime();
					client.zadd(key, 501, 9999, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						elapsed = new Date().getTime() - start;
						console.log("\tTime to modify first value (no save) : " + elapsed + " ms");
						ut.waitForBgsave(client, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							bgstart = new Date().getTime();
							client.bgsave(function (err, res) {
								if (err) {
									errorCallback(err);
								}
								ut.waitForBgsave(client, function (err, res) {
									if (err) {
										errorCallback(err);
									}
									elapsed = new Date().getTime() - bgstart;
									console.log("\tTime for RO bgsave to complete : " + elapsed + " ms");
									start = new Date().getTime();
									bgstart = new Date().getTime();
									client.bgsave(function (err, res) {
										if (err) {
											errorCallback(err);
										}
										elapsed = new Date().getTime() - start;
										console.log("\tTime to start bgsave : " + elapsed + " ms");
										start = new Date().getTime();
										client.zadd(key, 502, 9998, function (err, res) {
											if (err) {
												errorCallback(err);
											}
											elapsed = new Date().getTime() - start;
											console.log("\tTime to modify first value (saving) : " + elapsed + " ms");
											start = new Date().getTime();
											client.zadd(key, 503, 9997, function (err, res) {
												if (err) {
													errorCallback(err);
												}
												elapsed = new Date().getTime() - start;
												console.log("\tTime to modify second value (saving) : " + elapsed + " ms");
												ut.waitForBgsave(client, function (err, res) {
													if (err) {
														errorCallback(err);
													}
													elapsed = new Date().getTime() - bgstart;
													console.log("\tTime for bgsave to complete : " + elapsed + " ms\n");
													client.flushdb(function (err, res) {
														if (err) {
															errorCallback(err);
														}
														try {
															if (!assert.equal(res, 'OK', test_case)) {
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
	};

	return bgsaveperf;

}
	());