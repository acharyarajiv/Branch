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

// static properties
Utility.test_pass = 0;
Utility.test_fail = 0;
Utility.fail_list = {};

// keeping local copy of includes for calls
// made to them from outside of test_helper's scope
var g = require('./global.js');
var async = require('async');

function Utility() {}

Utility.prototype.timeout = 0;

Utility.prototype.pass = function (msg, debug, logging) {
	if (debug === undefined) {
		debug = false;
	}
	if (logging === undefined) {
		logging = true;
	}
	Utility.test_pass += 1;
	if (debug) {
		console.log(msg);
	}
	if (logging) {
		log.info(msg);
	}
	this.console_log('pass', msg);

};
Utility.prototype.fail = function (msg, debug, logging) {
	if (debug === undefined) {
		debug = false;
	}
	if (logging === undefined) {
		logging = true;
	}
	Utility.test_fail += 1;
	if (debug) {
		console.log(msg);
	}
	if (msg.message === undefined) {
		if (logging) {
			var timestamp = new Date().getTime();
			var hrt = process.hrtime()[1];
			log.error(msg);
			Utility.fail_list[hrt] = msg;
		}
		this.console_log('fail', msg);
	} else {
		if (logging) {
			var timestamp = new Date().getTime();
			var hrt = process.hrtime()[1];
			msg = " Message:" + msg.message + "\n\tName:" + msg.name + "\n\tActual:" + msg.actual + "\n\tExpected:" + msg.expected + "\n\tOperator:" + msg.operator;
			log.error(msg);
			Utility.fail_list[hrt] = msg;
		}
		this.console_log('fail', msg.message);
	}

};
Utility.prototype.log_error = function (msg) {
	this.console_log('fail', msg.message);
};
Utility.prototype.getPassTests = function () {
	return Utility.test_pass;
};
Utility.prototype.getFailTests = function () {
	return Utility.test_fail;
};
Utility.prototype.getFailList = function () {
	return Utility.fail_list;
};
Utility.prototype.console_log = function (event, msg) {
	if (event == 'pass') {
		console.log("\x1b[32m [Pass] \x1b[0m- " + msg + "\n");
	} else {
		console.log("\x1b[31m [Fail] \x1b[0m- " + msg + "\n");
	}
};
Utility.prototype.match = function (patt, str) {
	var pattern = new RegExp(patt, 'g'); ;
	return pattern.test(str);
};
Utility.prototype.randpath = function (args) {
	var rand = Math.floor((Math.random() * (args.length)) + 1);
	return args[rand - 1];
}
Utility.prototype.randomValue = function () {
	var data = 0;
	var that = this;
	switch (that.randpath(new Array(1, 2, 3, 4))) {
	case 1:
		//Small enough to likely collide
		data = g.randomInt(1000);
		break;
	case 2:
		//32 bit compressible signed/unsigned
		var ch = that.randpath(new Array(1, 2));
		if (ch == 1)
			data = g.randomInt(2000000000);
		else
			data = g.randomInt(4000000000);
		break;
	case 3:
		//64 bit
		data = g.randomInt(1000000000000);
		break;
	case 4:
		// Random string
		var ch = that.randpath(new Array(1, 2, 3));
		if (ch == 1)
			data = that.randstring(0, 256, 'alpha');
		else if (ch == 2)
			data = that.randstring(0, 256, 'compr');
		else
			data = that.randstring(0, 256, 'binary');
		break;
	}
	return data;
}
Utility.prototype.randomKey = function () {
	var key = 0;
	var that = this;
	switch (that.randpath(new Array(1, 2, 3, 4))) {
	case 1:
		//Small enough to likely collide
		key = g.randomInt(1000);
		break;
	case 2:
		//32 bit compressible signed/unsigned
		var ch = that.randpath(new Array(1, 2));
		if (ch == 1)
			key = g.randomInt(2000000000);
		else
			key = g.randomInt(4000000000);
		break;
	case 3:
		//64 bit
		key = g.randomInt(1000000000000);
		break;
	case 4:
		// Random string
		var ch = that.randpath(new Array(1, 2));
		if (ch == 1)
			key = that.randstring(0, 256, 'alpha');
		else
			key = that.randstring(0, 256, 'compr');
		break;
	}
	return key;
}
Utility.prototype.randstring = function (min, max, type) {
	var minval = 0,
	maxval = 0;
	var len = (Math.floor((Math.random() * (max - min + 1)) + 1) + min);
	var output = '';
	if (type === 'binary') {
		minval = 0;
		maxval = 255;
	} else if (type === 'alpha') {
		minval = 48;
		maxval = 122;
	} else if (type === 'compr') {
		minval = 28;
		maxval = 52;
	} 
	while (len >= 0) {
		var cc = (Math.floor(Math.random() * (maxval - minval + 1)) + minval);
		output = output + (String.fromCharCode(cc));
		len -= 1;
	}
	return output.toString();
}
Utility.prototype.shift = function (obj, places) {
	var object = {};
	var keys = new Array();
	var vals = new Array();
	for (key in obj) {
		keys.push([key]);
		vals.push([obj[key]]);
	}
	for (var i = places; i < keys.length; i++) {
		object[keys[i]] = vals[i];
	}
	return object;
}
Utility.prototype.serverInfo = function (client, para, callback) {
	var result = null;
	client.info(function (err, res) {
		if (err) {
			callback(err, null)
		}
		var info = res.split('\r\n');
		for (line in info) {
			var data = info[line].split(':');
			if (data[0] === para) {
				result = data[1];
				break;
			}
		}
		if (result != null)
			callback(null, result);
		else
			callback(new Error(para + ' is not seen in INFO.'), null);
	});
}
Utility.prototype.getserverInfo = function (client, callback) {
	client.info(function (err, res) {
		if (err) {
			callback(err, null)
		}
		return callback(null, res);
	});
}
Utility.prototype.waitForBgsave = function (client, callback) {
	var that = this;
	g.asyncFor(0, -1, function (loop) {
		that.serverInfo(client, 'rdb_bgsave_in_progress', function (err, result) {
			if (err) {
				callback(err, null);
			}
			if (result == 1) {
				setTimeout(function () {
					loop.next();
				}, 1000);
			} else {
				loop.break();
			}
		});
	}, function () {
		callback(null, true);
	});
};
Utility.prototype.waitForBgrewriteaof = function (client, callback) {
	var that = this;
	g.asyncFor(0, -1, function (loop) {
		that.serverInfo(client, 'aof_rewrite_in_progress', function (err, result) {
			if (err) {
				callback(err, null);
			}
			if (result === 1) {
				setTimeout(function () {
					loop.next();
				}, 1000);
			} else {
				loop.break();
			}
		});
	}, function () {
		callback(null, true);
	});
};
Utility.prototype.wait_for_sync = function (client, callback) {
	var that = this;
	g.asyncFor(0, -1, function (loop) {
		that.serverInfo(client, 'master_link_status', function (err, result) {
			if (err) {
				callback(err, null);
			}
			if (result === 'down') {
				setTimeout(function () {
					loop.next();
				}, 10);
			} else {
				loop.break();
			}
		});
	}, function () {
		callback(null, true);
	});
};
Utility.prototype.findKeyWithType = function (client, type, callback) {
	var that = this;
	var result = '';
	g.asyncFor(0, 20, function (loop) {
		client.randomkey(function (err, k) {
			if (err) {
				callback(err, null);
			}
			if (k != null || k != '') {
				client.type(k, function (err, res) {
					if (err) {
						callback(err, null);
					}
					if (res === type) {
						result = k;
						loop.break();
					}
					loop.next();
				});
			} else {
				loop.next();
			}
		});
	}, function () {
		callback(null, result);
	});
};
Utility.prototype.randomInt = function (max) {
	return Math.random() * max;
}
Utility.prototype.randomSignedInt = function (max) {
	var i = this.randomInt(max);
	return (Math.random() > 0.5 ? -i : i);
}
Utility.prototype.createComplexDataset = function (client, ops, useexpire, callback) {
	var that = this;
	g.asyncFor(0, ops, function (loop) {
		var k = that.randomKey();
		var k2 = that.randomKey();
		var f = that.randomValue();
		var v = that.randomValue();
		var d = '',
		t = '';
		async.series({
			zero : function (async_cb) {
				if (useexpire != undefined && useexpire == 'useexpire') {
					if (Math.random() < 0.1) {
						client.expire(that.randomKey(), g.randomInt(2), function (err, res) {
							if (err) {
								callback(err, null);
							}
						});
					}
				}
				async_cb(null);
			},
			one : function (async_cb) {
				switch (that.randpath(new Array(1, 2, 3, 4, 5, 6))) {
				case 1:
					d = Math.random();
					break;
				case 2:
					d = Math.random();
					break;
				case 3:
					d = Math.random();
					break;
				case 4:
					d = Math.random();
					break;
				case 5:
					d = Math.random();
					break;
				case 6:
					//{set d +inf} {set d -inf} in TCL +inf -inf are very large values that can't represented. in JS the notion of Infinity if given by the below expressions.
					// d = 1.7976931348623157E+10308;
					// d = 1/0;
					// d = +inf/-inf
					// they, give Infinity as result, but when using the Redis zadd fails with Err - value is not a double;
					// So we tend to use less than Infinity and under permissible range.
					switch (that.randpath(new Array(1, 2))) {
					case 1:
						d = 1.7976931348623157E+300;
						break;
					case 2:
						d = -1.7976931348623157E+300;
						break;
					}
					break;
				}
				async_cb(null);
			},
			two : function (async_cb) {
				client.type(k, function (err, res) {
					if (err) {
						callback(err, null);
					}
					t = res;
					async_cb(null);
				});
			},
			three : function (async_cb) {
				if (t == 'none') {
					async.series({
						one : function (callback_inner) {
							switch (that.randpath(new Array(1, 2, 3, 4, 5, 6))) {
							case 1:
								client.set(k, v, function (err, res) {
									if (err) {
										callback(err, null);
									}
								});
								break;
							case 2:
								client.lpush(k, v, function (err, res) {
									if (err) {
										callback(err, null);
									}
								});
								break;
							case 3:
								client.sadd(k, v, function (err, res) {
									if (err) {
										callback(err, null);
									}
								});
								break;
							case 4:
								client.zadd(k, d, v, function (err, res) {
									if (err) {
										callback(err, null);
									}
								});
								break;
							case 5:
								client.hset(k, f, v, function (err, res) {
									if (err) {
										callback(err, null);
									}
								});
								break;
							case 6:
								client.del(k, function (err, res) {
									if (err) {
										callback(err, null);
									}
								});
								break;
							}
							callback_inner(null);
						},
						two : function (callback_inner) {
							client.type(k, function (err, res) {
								if (err) {
									callback(err, null);
								}
								t = res;
								callback_inner(null);
							});
						},
					}, function (err, results) {
						async_cb(null);
					});
				} else {
					//incase t is ne null
					async_cb(null);
				}
			},
			four : function (async_cb) {
				switch (t) {
				case 'string':
					//nothing to do
					break;
				case 'list':
					switch (that.randpath(new Array(1, 2, 3, 4, 5))) {
					case 1:
						client.lpush(k, v);
						break;
					case 2:
						client.rpush(k, v);
						break;
					case 3:
						client.lrem(k, 0, v);
						break;
					case 4:
						client.rpop(k);
						break;
					case 5:
						client.lpop(k);
						break;
					}
					break;
				case 'set':
					var c = that.randpath(new Array(1, 2, 3));
					if (c == 1) {
						client.sadd(k, v);
					} else if (c == 2) {
						client.srem(k, v);
					} else if (c == 3) {
						that.findKeyWithType(client, 'set', function (err, res) {
							if (err) {
								callback(err, null);
							}
							if (res != null || res != '') {
								var ch = that.randpath(new Array(1, 2, 3));
								if (ch == 1) {
									client.sunionstore(k2, k, res);
								} else if (ch == 2) {
									client.sinterstore(k2, k, res);
								} else if (ch == 3) {
									client.sdiffstore(k2, k, res);
								}
							}
						});
					}
					break;
				case 'zset':
					var c = that.randpath(new Array(1, 2, 3));
					if (c == 1) {
						client.zadd(k, d, v);
					} else if (c == 2) {
						client.zrem(k, v);
					} else if (c == 3) {
						that.findKeyWithType(client, 'zset', function (err, res) {
							if (err) {
								callback(err, null);
							}
							if (res != null || res != '') {
								var ch = that.randpath(new Array(1, 2));
								if (ch == 1) {
									client.zunionstore(k2, 2, k, res);
								} else if (ch == 2) {
									client.zinterstore(k2, 2, k, res);
								}
							}
						});
					}
					break;
				case 'hash':
					var c = that.randpath(new Array(1, 2));
					if (c == 1) {
						client.hset(k, f, v);
					} else if (c == 2) {
						client.hdel(k, f, v);
					}
					break;
				default:
					break;
				}
				
				async_cb(null);
			},

		}, function (err, results) {
			if (err) {
				callback(err);
			}
			loop.next();
		});

	}, function () {
		callback(null, true);
	});
};

Utility.prototype.csvdump = function (client, callback) {
	var that = this;
	var o = new Array();
	client.keys('*', function (err, keys) {
		if (err) {
			callback(err, null);
		}
		keys.sort(that.sortFunction);
		g.asyncFor(0, keys.length, function (loop) {
			var i = loop.iteration();
			client.type(keys[i], function (err, type) {
				if (err) {
					callback(err, null);
				}
				o.push(that.csvstring(keys[i]));
				o.push(that.csvstring(type));
				if (type === 'string') {
					client.get(keys[i], function (err, res) {
						if (err) {
							callback(err, null);
						}
						o.push(that.csvstring(res));
						o.push('\n');
					});
				} else if (type === 'list') {
					client.lrange(keys[i], 0, -1, function (err, res) {
						o.push(res.map(function (val) {
								return that.csvstring(val);
							}));
						o.push('\n');
					});

				} else if (type === 'set') {
					client.smembers(keys[i], function (err, res) {
						res.sort(that.sortFunction);
						o.push(res.map(function (val) {
								return that.csvstring(val);
							}));
						o.push('\n');
					});
				} else if (type === 'zset') {
					client.zrange(keys[i], 0, -1, 'withscores', function (err, res) {
						o.push(res.map(function (val) {
								return that.csvstring(val);
							}));
						o.push('\n');
					});
				} else if (type === 'hash') {
					client.hgetall(keys[i], function (err, fields) {
						if (err) {
							callback(err, null);
						}
						var newfields = new Array();
						for (k in fields) {
							newfields[k] = fields[k];
						}
						fields = newfields.sort(that.sortFunction);
						for (kv in fields) {
							o.push(that.csvstring(kv[0]));
							o.push(that.csvstring(kv[1]));
						}
						o.push('\n');
					});
				}
				loop.next();
			});

		}, function () {
			callback(null, o);
		});
	});
};
Utility.prototype.csvstring = function (s) {
	return ("\"" + s + "\"");
};
Utility.prototype.roundFloat = function (f) {
	return sprintf('%.10f',parseFloat(f));
};
Utility.prototype.formatCommand = function (args) {
	var cmd = '*' + args.length + '\r\n';
	for (var i = 0; i < args.length; i++) {
		cmd += '$' + Buffer.byteLength(args[i]) + '\r\n' + args[i] + '\r\n';
	}
	return cmd;
};
Utility.prototype.expand = function (args) {
	var str = g.buffers_to_strings(args);
	return str;
};
Utility.prototype.print_srv = function () {
	// go over all keys and values in our dictionary
	for (key in g.srv) {
		if (g.srv.hasOwnProperty(key)) {
			for (k in g.srv[key]) {
				if (g.srv[key].hasOwnProperty(k)) {
					for (k1 in g.srv[key][k]) {
						if (g.srv[key][k].hasOwnProperty(k1)) {
							console.log(k1 + ' = ' + g.srv[key][k][k1]);
						}
					}
				}
			}
		}
	}
};
Utility.prototype.reconnect = function (r, c, s, callback) {
	try {
		var client = r.createClient(g.srv[c][s]['port'], g.srv[c][s]['host']);
		client.on('ready', function () {
			g.srv[c][s]['client'] = client;
			callback(null, client);
		});
	} catch (e) {
		callback(e, null);
	}

};
Utility.prototype.removeDuplicates = function (args) {
	var i,
	len = args.length,
	out = [],
	obj = {};
	for (i = 0; i < len; i++) {
		obj[args[i]] = 0;
	}
	for (i in obj) {
		out.push(i);
	}
	return out;
};
Utility.prototype.zlistAlikeSort = function (a, b) {
	if (a[0] > b[0])
		return 1;
	else if (a[0] < b[0])
		return -1;
	return (a[1].localeCompare(b[1]));

};
Utility.prototype.sortFunction = function (a, b) {
	if (a === '0' || b === '0')
		return (b === a) ? 0 : (a < b) ? 1 : -1;
	return (a < b) ? -1 : (a === b) ? 0 : 1;
};
Utility.prototype.compareArray = function (arr1, arr2) {
	if (arr1.length == arr2.length
    && arr1.every(function(u, i) {
        return u === arr2[i];
    })){
	   return true;
	} else 
	   return false;
};
// Wait for the specified condition to be true, with the specified number of
// max retries and delay between retries. Otherwise the 'elsescript' is
// executed.

Utility.prototype.wait_for_condition = function (m, d, func, cbt, cbf) {
	g.asyncFor(0, -1, function (loop) {
		if (m >= 0) {
			func(function (r) {
				if (r) {
					loop.break();
				} else {
					setTimeout(function () {
						--m;
						loop.next();
					}, d);
				}
			});
		} else {
			cbf();
		}
	}, function () {
		cbt();
	});
};
Utility.prototype.assertEqual = function (arg1,arg2,message,inLoop) {
	try {
		if (!assert.equal(arg1, arg2, message) && !inLoop) {
			this.pass(message);
		}
		return true;
	} catch (e) {
		this.fail(e,true);
		return false;
	}
};
Utility.prototype.assertOk = function (arg1,arg2,message,inLoop) {
	try {
		if(arg2 === null){
			if (!assert.ok(arg1, message) && !inLoop) {
				this.pass(message);
			}
		} else {
			if (!assert.ok(this.match(arg1, arg2), message) && !inLoop) {
				this.pass(message);
			}
		}
		return true;
	} catch (e) {
		this.fail(e,true);
		return false;
	}
};
Utility.prototype.assertDeepEqual = function (arg1,arg2,message,inLoop) {
	try {
		if (!assert.deepEqual(arg1, arg2, message) && !inLoop) {
			this.pass(message);
		}
		return true;
	} catch (e) {
		this.fail(e,true);
		return false;
	}
};
Utility.prototype.assertError = function (arg1,message,inLoop) {
	try {
		if (!assert.ifError(arg1, message) && !inLoop) {
			this.pass(message);
		}
		return true;
	} catch (e) {
		this.fail(e,true);
		return false;
	}
};
Utility.prototype.assertNotEqual = function (arg1,arg2,message,inLoop) {
	try {
		if (!assert.notEqual(arg1,arg2,message) && !inLoop) {
			this.pass(message);
		}
		return true;
	} catch (e) {
		this.fail(e,true);
		return false;
	}
};
Utility.prototype.assertMany = function (arg1,message) {
	var boolRes = true;
	for(var i = 0;i < arg1.length; i++){
		switch(arg1[i][0]){
			case 'equal':
				boolRes = this.assertEqual(arg1[i][1],arg1[i][2],message,boolRes);
			break;
			case 'deepequal':
				boolRes = this.assertDeepEqual(arg1[i][1],arg1[i][2],message,boolRes);
			break;
			case 'ok':
				boolRes = this.assertOk(arg1[i][1],arg1[i][2],message,boolRes);
			break;
			case 'error':
				boolRes = this.assertError(arg1[i][1],message,boolRes);
			break;
			case 'notequal':
				boolRes = this.assertNotEqual(arg1[i][1],arg1[i][2],message,boolRes);
			break;
			default:
				boolRes = this.assertEqual(arg1[i][1],arg1[i][2],message,boolRes);
			break;
		}
		if(!boolRes)
			break;			
	}
	if(boolRes)
		this.pass(message);
};
module.exports = Utility;