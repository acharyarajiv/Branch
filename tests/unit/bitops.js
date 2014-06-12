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

exports.Bitops = (function () {
  // private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  bitops = {},
  name = 'Bitops',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = '',
  client_pid = '';

  //public property
  bitops.debug_mode = false;

  //public method
  function fourDgtBinNum(n) {
    if (n == 0)
      return '0000';
    if (n > 0 && n < 10)
      return '000' + n;
    else if (n > 9 && n < 100)
      return '00' + n;
    else if (n > 99 && n < 1000)
      return '0' + n;
    else
      return n;
  }

  function decimalToHex(num) {
    if (num < 0)
      num = 0xFFFFFFFF + num + 1;
    return num.toString(16).toUpperCase();
  }

  function conv_bits(str) {
    var bin = '',
    hex_ASCII = '';
    for (var iStr = 0; iStr < str.length; iStr++) {
      val = str[iStr].charCodeAt(0);
      hex_ASCII = decimalToHex(val);
      for (var i = 0; i < hex_ASCII.toString().length; i++) {
        switch (hex_ASCII.toString()[i]) {
        case 'A':
          bin += fourDgtBinNum(parseInt(10).toString(2));
          break;
        case 'B':
          bin += fourDgtBinNum(parseInt(11).toString(2));
          break;
        case 'C':
          bin += fourDgtBinNum(parseInt(12).toString(2));
          break;
        case 'D':
          bin += fourDgtBinNum(parseInt(13).toString(2));
          break;
        case 'E':
          bin += fourDgtBinNum(parseInt(14).toString(2));
          break;
        case 'F':
          bin += fourDgtBinNum(parseInt(15).toString(2));
          break;
        default:
          bin += fourDgtBinNum(parseInt(hex_ASCII.toString()[i]).toString(2));
          break;

        }
      }
    }
    return bin.split('').reverse().join('');
  }

  function convBin_string(binNum) {
    var charSet = '';
    var singChar = ''
      binNum = binNum.split('').reverse().join('')
      for (var i = 0; i < binNum.length; i = i + 8) {
        singChar = binNum.substring(i, i + 8);
        charSet += String.fromCharCode(parseInt(singChar, 2).toString(10));
      }
      return charSet;
  }

  function count_bits(str) {
    var bin = conv_bits(str);
    return bin.split(/1/g).length - 1;
  }

  function simulate_bit_op(op, args) {
    var maxlen = 0;
    var j = 0;
    var count = args.length;
    var bin_Num = '';
    var bArray = {};
    for (var i = 0; i < count; i++) {
      bin_Num = conv_bits(args[i]);
      bArray[j] = bin_Num;
      if (bin_Num.toString().length > maxlen) {
        maxlen = bin_Num.toString().length;
      }
      j++;
    }
    for (var j = 0; j < count; j++) {
      if (bArray[j].toString().length < maxlen) {
        bArray[j] += g.fillString(maxlen - bArray[j].toString().length)
      }
    }

    var out = '',
    bit = '',
    bit2 = '';
    for (var x = 0; x < maxlen; x++) {
      bit = bArray[0].toString().substring(x, x + 1);
      if (op === 'not') {
        bit = (bit == '1') ? 0 : 1;
      }
      for (var j = 1; j < count; j++) {
        bit2 = parseInt(bArray[j].toString().substring(x, x + 1));
        switch (op) {
        case 'and':
          bit = bit & bit2;
          break;
        case 'or':
          bit = bit | bit2;
          break;
        case 'xor':
          bit = bit^bit2;
          break;
        }
      }
      out += bit;
    }
    return convBin_string(out);
  }

  bitops.start_test = function (cpid, callback) {
    testEmitter.on('start', function () {
      var tags = 'bitops';
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
      setTimeout(function () {
        var test_case_name = all_tests.shift()
          if (test_case_name) {
            tester[test_case_name](function (error) {
              ut.fail(error);
              testEmitter.emit('next');
            });
          } else {
            client.end();
            if (bitops.debug_mode) {
              log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
            }
            testEmitter.emit('end');
          }
      }, ut.timeout);
    });
    if (bitops.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  //test methods
  tester.Bitops1 = function (errorCallback) {
    var test_case = 'BITCOUNT returns 0 against non existing key';
    client.bitcount('no-key', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, '0', test_case);
      testEmitter.emit('next');
    });
  };

  tester.Bitops2 = function (errorCallback) {
    //var ipArray = ['','\xaa','\x00\x00\xff','foobar','123'];
    var ipArray = ['', 'xaa', 'x00x00xff', 'foobar', '123'];
    var num = 0;
    var test_case = '';
    var iLoopIndx = '';
    g.asyncFor(0, ipArray.length, function (loop) {
      iLoopIndx = loop.iteration();
      num++;
      test_case = 'BITCOUNT against test vector #' + num;
      client.set('str', ipArray[iLoopIndx], function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitcount('str', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          var bitCnt = count_bits(ipArray[iLoopIndx]);
          ut.assertEqual(res, bitCnt, test_case);
          loop.next();
        });
      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  tester.Bitops3 = function (errorCallback) {
    var test_case = 'BITCOUNT fuzzing without start/end';
    var str = '',
    bitCnt = 0,
    test_pass = true;
    g.asyncFor(0, 100, function (loop) {
      str = ut.randstring(0, 3000, 'alpha');
      client.set('str', str, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        bitCnt = count_bits(str);
        client.bitcount('str', function (err, res) {
          try {
            if (!assert.equal(res, bitCnt, test_case)) {
              loop.next();
            }
          } catch (e) {
            test_pass = false;
            ut.fail(e, true);
            loop.break();
          }
        });
      });
    }, function () {
      if (test_pass)
        ut.pass(test_case);
      testEmitter.emit('next');
    });
  };

  tester.Bitops3_1 = function (errorCallback) {
    var test_case = 'BITCOUNT fuzzing with start/end';
    var str = '',
    len = 0,
    start,
    end,
    bitCnt,
    error = false;
    g.asyncFor(0, 100, function (loop) {
      str = ut.randstring(0, 3000, 'alpha');
      client.set('str', str, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        len = str.length;
        start = parseInt(ut.randomInt(len) + 1);
        end = parseInt(ut.randomInt(len) + 1);
        //if true then swap
        if (start > end) {
          start = start + end;
          end = start - end;
          start = start - end;
        }
        bitCnt = count_bits(str.substring(start, end + 1));
        client.bitcount('str', start, end, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.equal(bitCnt, res, test_case))
              loop.next();
          } catch (e) {
            error = true;
            ut.fail(e);
            loop.break();
          }
        })
      });
    }, function () {
      if (!error)
        ut.pass(test_case);
      testEmitter.emit('next');
    })
  }

  tester.Bitops4 = function (errorCallback) {
    var test_case = 'BITCOUNT with start, end';
    var bitCnt1 = 0,
    bitCnt2 = 0,
    bitCnt3 = 0;
    client.set('s', 'foobar', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      bitCnt1 = count_bits('foobar');
      bitCnt2 = count_bits('ooba');
      bitCnt3 = count_bits('');
      client.bitcount('s', 0, -1, function (err, res1) {
        if (err) {
          errorCallback(err);
        }
        client.bitcount('s', 1, -2, function (err, res2) {
          if (err) {
            errorCallback(err);
          }
          client.bitcount('s', -2, 1, function (err, res3) {
            if (err) {
              errorCallback(err);
            }
            client.bitcount('s', 0, 1000, function (err, res4) {
              if (err) {
                errorCallback(err);
              }
              ut.assertMany(
                [
                  ['equal', res1, bitCnt1],
                  ['equal', res2, bitCnt2],
                  ['equal', res3, bitCnt3],
                  ['equal', res4, bitCnt1]
                ], test_case);
              testEmitter.emit('next');
            });
          });
        });
      });
    });
  };

  tester.Bitops5 = function (errorCallback) {
    var test_case = 'BITCOUNT syntax error #1';
    client.bitcount('s', 0, function (err, res) {
      ut.assertOk('syntax error', err, test_case)
      testEmitter.emit('next');
    });
  };

  tester.Bitops6 = function (errorCallback) {
    var test_case = 'BITCOUNT regression test for github issue #582';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.setbit('foo', 0, 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitcount('foo', 0, 4294967296, function (err, res) {
          ut.assertOk('out of range', err, test_case);
          testEmitter.emit('next');
        });
      });
    });
  };

  tester.Bitops7 = function (errorCallback) {
    var test_case = 'BITCOUNT misaligned prefix';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('str', 'ab', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitcount('str', 1, -1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 3, test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  tester.Bitops8 = function (errorCallback) {
    var test_case = 'BITCOUNT misaligned prefix + full words + remainder';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('str', '__PPxxxxxxxxxxxxxxxxRR__', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitcount('str', 2, -3, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          ut.assertEqual(res, 74, test_case);
          testEmitter.emit('next');
        });
      });
    });
  }

  tester.Bitops9 = function (errorCallback) {
    var test_case = 'BITOP NOT (empty string)';
    client.set('s', '');
    client.bitop('not', 'dest', 's', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.get('dest', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, null, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Bitops10 = function (errorCallback) {
    var test_case = 'BITOP NOT (known string)';
    client.set('s', '1');
    client.bitop('not', 'dest', 's', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getbit('dest', 7, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 0, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Bitops11 = function (errorCallback) {
    var test_case = 'BITOP where dest and target are the same key';
    client.set('s', '1');
    client.bitop('not', 's', 's', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.getbit('s', 7, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 0, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Bitops12 = function (errorCallback) {
    var test_case = 'BITOP AND|OR|XOR don\'t change the string with single input key';
    client.set('a', '\x01\x02\xff');
    client.bitop('and', 'res1', 'a', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitop('or', 'res2', 'a', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitop('xor', 'res3', 'a', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.get('res1', function (err, res1) {
            if (err) {
              errorCallback(err);
            }
            client.get('res2', function (err, res2) {
              if (err) {
                errorCallback(err);
              }
              client.get('res3', function (err, res3) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany(
                  [
                    ['equal', res1, '\x01\x02\xff'],
                    ['equal', res2, '\x01\x02\xff'],
                    ['equal', res3, '\x01\x02\xff']
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  tester.Bitops13 = function (errorCallback) {
    var test_case = 'BITOP missing key is considered a stream of zero';
    client.set('a', '\x01\x02\xff');
    client.bitop('and', 'no-suck-key', 'a', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitop('or', 'no-suck-key', 'a', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitop('xor', 'no-suck-key', 'a', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.get('res1', function (err, res1) {
            if (err) {
              errorCallback(err);
            }
            client.get('res2', function (err, res2) {
              if (err) {
                errorCallback(err);
              }
              client.get('res3', function (err, res3) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany(
                  [
                    ['equal', res1, '\x01\x02\xff'],
                    ['equal', res2, '\x01\x02\xff'],
                    ['equal', res3, '\x01\x02\xff']
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  tester.Bitops14 = function (errorCallback) {
    var test_case = 'BITOP shorter keys are zero-padded to the key with max length';
    client.set('a', '\x01\x02\xff\xff');
    client.set('b', '\x01\x02\xff');
    client.bitop('and', 'res1', 'a', 'b', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitop('or', 'res2', 'a', 'b', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitop('xor', 'res3', 'a', 'b', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.get('res1', function (err, res1) {
            if (err) {
              errorCallback(err);
            }
            client.get('res2', function (err, res2) {
              if (err) {
                errorCallback(err);
              }
              client.get('res3', function (err, res3) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany(
                  [
                    ['equal', res1, '\x01\x02\xff\x00\x00'],
                    ['equal', res2, '\x01\x02\xff\xff'],
                    ['equal', res3, '\x00\x00\x00\x00\xff']
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  };

  tester.Bitops15 = function (errorCallback) {
    var testArray = ['and', 'or', 'xor'];
    var test_case = '',
    ErrorMsg = '';
    var iLoopindx = 0,
    ivecLoopindx = 0;
    var vec = [],
    veckeys = [],
    str = '',
    numvec = 0;
    g.asyncFor(0, testArray.length, function (loop) {
      iLoopindx = loop.iteration();
      test_case = 'BITOP ' + testArray[iLoopindx] + ' fuzzing';
      g.asyncFor(0, 10, function (innerloop) {
        client.flushall();
        vec = [];
        veckeys = [];
        numvec = g.randomInt(10) + 1;
        g.asyncFor(0, numvec, function (vecloop) {
          ivecLoopindx = vecloop.iteration();
          //str = ut.randstring(0, 1000, 'alpha');
          str = g.randomInt(10);
          vec.push(str);
          veckeys.push('vector_' + ivecLoopindx);
          client.set('vector_' + ivecLoopindx, str, function (err, res) {
            vecloop.next();
          });
        }, function () {
          client.bitop(testArray[iLoopindx], 'target', veckeys, function (err, res) {
            if (err) {
              errorCallback(err);
            }
            var test = simulate_bit_op(testArray[iLoopindx], vec);
            var conv_String = conv_bits(test)
              iLen = conv_String.toString().length;
            strBit = '',
            iLoopIndex = 0;
            g.asyncFor(0, iLen, function (iloop) {
              iLoopIndex = iloop.iteration();
              client.getbit('target', (iLen - iLoopIndex - 1), function (err, res) {
                strBit += res.toString();
                iloop.next();
              });
            }, function () {
              try {
                if (!assert.equal(strBit, conv_String, test_case))
                  innerloop.next();
              } catch (e) {
                ErrorMsg = e;
                innerloop.break();
              }
            });
          });

        });
      }, function () {
        if (ErrorMsg === '') {
          ut.pass(test_case);
          loop.next();
        } else {
          ut.fail(ErrorMsg, true);
          loop.break();
        }
      });
    }, function () {
      testEmitter.emit('next');
    });
  };

  tester.Bitops16 = function (errorCallback) {
    var test_case = 'BITOP NOT fuzzing';
    var str = '',
    result = '',
    strBit = '',
    iLoopIndex = 0,
    iLen = 0,
    errormsg = '';
    g.asyncFor(0, 5, function (loop) {
      client.flushall();
      str = ut.randstring(0, 1000, 'alpha');
      client.set('str', str, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        client.bitop('not', 'target', 'str', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          result = simulate_bit_op('not', [str]);
          iLen = conv_bits(result).toString().length;
          strBit = '',
          iLoopIndex = 0;
          g.asyncFor(0, iLen, function (iloop) {
            iLoopIndex = iloop.iteration();
            client.getbit('target', (iLen - iLoopIndex - 1), function (err, res) {
              strBit += res.toString();
              iloop.next();
            });
          }, function () {
            try {
              if (!assert.equal(convBin_string(strBit), result, test_case))
                loop.next();
            } catch (e) {
              errormsg = e;
              loop.break();
            }

          });
        });
      })
    }, function () {
      if (errormsg === '')
        ut.pass(test_case);
      else
        ut.fail(errormsg, true);
      testEmitter.emit('next');
    });
  };

  tester.Bitops17 = function (errorCallback) {
    var test_case = 'BITOP with integer encoded source objects';
    client.set('a', 1);
    client.set('b', 2);
    client.bitop('xor', 'dest', 'a', 'b', 'a', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.get('dest', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 2, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Bitops18 = function (errorCallback) {
    var test_case = 'BITOP with non string source key';
    client.del('c');
    client.set('a', 1);
    client.set('b', 2);
    client.lpush('c', 'foo', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitop('xor', 'dest', 'a', 'b', 'c', 'd', function (err, res) {
        ut.assertOk('WRONGTYPE', err, test_case);
        testEmitter.emit('next');
      });
    });
  };

  tester.Bitops19 = function (errorCallback) {
    var test_case = 'BITOP with empty string after non empty string (issue #529)';
    client.flushdb();
    client.set('a', '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');
    client.bitop('or', 'x', 'a', 'b', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(res, 32, test_case);
      testEmitter.emit('next');
    });
  };

  tester.Bitops20 = function (errorCallback) {
    var test_case = "Bitop Command for Keys";
    var res_array = [];
    client.set('foo', 0);
    client.set('bar', 1);
    client.bitop('and', 'res', 'foo', 'bar', function (err, res) {
      client.get('res', function (err, res) {
        res_array.push(res);
        client.bitop('or', 'res', 'foo', 'bar', function (err, res) {
          client.get('res', function (err, res) {
            res_array.push(res);
            client.bitop('xor', 'res', 'foo', 'bar', function (err, res) {
              client.get('res', function (err, res) {
                res_array.push(res);
                client.bitop('not', 'res', 'bar', 'foo', function (err, res) {
                  ut.assertMany(
                    [
                      ['deepequal', res_array, [0, 1, '\u0001']],
                      ['ok', 'called with a single source key', err]
                    ], test_case);
                  testEmitter.emit('next');
                });
              });
            });
          });
        });
      });
    });
  }

  tester.Bitops21 = function (errorCallback) {
    var test_case = 'BITPOS bit=0 with empty key returns 0';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 0, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 0, test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops22 = function (errorCallback) {
    var test_case = 'BITPOS bit=1 with empty key returns -1';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, -1, test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops23 = function (errorCallback) {
    var test_case = 'BITPOS bit=0 with string less than 1 word works';
    client.set('str', "\xff\xf0\x00", function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 0, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 2, test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops24 = function (errorCallback) {
    var test_case = 'BITPOS bit=1 with string less than 1 word works';
    client.set('str', '\x00\x0f\x00', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 12, test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops25 = function (errorCallback) {
    var test_case = 'BITPOS bit=0 starting at unaligned address';
    client.set('str', '\xff\xf0\x00', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 0, 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 9, test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops26 = function (errorCallback) {
    var test_case = 'BITPOS bit=1 starting at unaligned address';
    client.set('str', '\x00\x0f\xff', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 1, 1, function (err, res) {
        if (err) {
          errorCallback(err);
        }
        ut.assertEqual(res, 12, test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops27 = function (errorCallback) {
    var test_case = 'BITPOS bit=0 unaligned+full word+reminder';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('str', '\xff\xff\xff', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        //# Prefix Followed by two (or four in 32 bit systems) full words
        client.append('str', '\xff\xff\xff\xff\xff\xff\xff\xff', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.append('str', '\xff\xff\xff\xff\xff\xff\xff\xff', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.append('str', '\xff\xff\xff\xff\xff\xff\xff\xff', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              //# First zero bit.
              client.append('str', '\x0f', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.bitpos('str', 0, function (err, res0) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.bitpos('str', 0, 1, function (err, res1) {
                    if (err) {
                      errorCallback(err);
                    }
                    client.bitpos('str', 0, 2, function (err, res2) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.bitpos('str', 0, 3, function (err, res3) {
                        if (err) {
                          errorCallback(err);
                        }
                        client.bitpos('str', 0, 4, function (err, res4) {
                          if (err) {
                            errorCallback(err);
                          }
                          client.bitpos('str', 0, 5, function (err, res5) {
                            if (err) {
                              errorCallback(err);
                            }
                            client.bitpos('str', 0, 6, function (err, res6) {
                              if (err) {
                                errorCallback(err);
                              }
                              client.bitpos('str', 0, 7, function (err, res7) {
                                if (err) {
                                  errorCallback(err);
                                }
                                client.bitpos('str', 0, 8, function (err, res8) {
                                  if (err) {
                                    errorCallback(err);
                                  }
                                  ut.assertMany([
                                      ['equal', res0, 2],
                                      ['equal', res1, 9],
                                      ['equal', res2, 18],
                                      ['equal', res3, 25],
                                      ['equal', res4, 34],
                                      ['equal', res5, 41],
                                      ['equal', res6, 50],
                                      ['equal', res7, 57],
                                      ['equal', res8, 66]
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
        });
      });
    });
  }

  tester.Bitops28 = function (errorCallback) {
    var test_case = 'BITPOS bit=1 unaligned+full word+reminder';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.set('str', '\x00\x00\x00', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        //# Prefix Followed by two (or four in 32 bit systems) full words
        client.append('str', '\x00\x00\x00\x00\x00\x00\x00\x00', function (err, res) {
          if (err) {
            errorCallback(err);
          }
          client.append('str', '\x00\x00\x00\x00\x00\x00\x00\x00', function (err, res) {
            if (err) {
              errorCallback(err);
            }
            client.append('str', '\x00\x00\x00\x00\x00\x00\x00\x00', function (err, res) {
              if (err) {
                errorCallback(err);
              }
              //# First zero bit.
              client.append('str', '\x0f', function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                client.bitpos('str', 1, function (err, res0) {
                  if (err) {
                    errorCallback(err);
                  }
                  client.bitpos('str', 1, 1, function (err, res1) {
                    if (err) {
                      errorCallback(err);
                    }
                    client.bitpos('str', 1, 2, function (err, res2) {
                      if (err) {
                        errorCallback(err);
                      }
                      client.bitpos('str', 1, 3, function (err, res3) {
                        if (err) {
                          errorCallback(err);
                        }
                        client.bitpos('str', 1, 4, function (err, res4) {
                          if (err) {
                            errorCallback(err);
                          }
                          client.bitpos('str', 1, 5, function (err, res5) {
                            if (err) {
                              errorCallback(err);
                            }
                            client.bitpos('str', 1, 6, function (err, res6) {
                              if (err) {
                                errorCallback(err);
                              }
                              client.bitpos('str', 1, 7, function (err, res7) {
                                if (err) {
                                  errorCallback(err);
                                }
                                client.bitpos('str', 1, 8, function (err, res8) {
                                  if (err) {
                                    errorCallback(err);
                                  }
                                  ut.assertMany([
                                      ['equal', res0, 220],
                                      ['equal', res1, 220],
                                      ['equal', res2, 220],
                                      ['equal', res3, 220],
                                      ['equal', res4, 220],
                                      ['equal', res5, 220],
                                      ['equal', res6, 220],
                                      ['equal', res7, 220],
                                      ['equal', res8, 220]
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
        });
      });
    });
  }

  tester.Bitops29 = function (errorCallback) {
    var test_case = 'BITPOS bit=1 returns -1 if string is all 0 bits';
    client.set('str', '', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var error = false;
      g.asyncFor(0, 20, function (loop) {
        client.bitpos('str', 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.equal(-1, res, test_case))
              loop.next();
          } catch (e) {
            error = true;
            ut.fail(e);
            loop.break();
          }
        });
      }, function () {
        if (!error)
          ut.pass(test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops30 = function (errorCallback) {
    var test_case = 'BITPOS bit=0 works with intervals';
    client.set('str', '\x00\xff\x00', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 0, 0, -1, function (err, res0) {
        if (err) {
          errorCallback(err);
        }
        client.bitpos('str', 0, 1, -1, function (err, res1) {
          if (err) {
            errorCallback(err);
          }
          client.bitpos('str', 0, 2, -1, function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            client.bitpos('str', 0, 2, 200, function (err, res3) {
              if (err) {
                errorCallback(err);
              }
              client.bitpos('str', 0, 1, 1, function (err, res4) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany([
                    ['equal', res0, 0],
                    ['equal', res1, 10],
                    ['equal', res2, 17],
                    ['equal', res3, 17],
                    ['equal', res4, 10]
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  }

  tester.Bitops31 = function (errorCallback) {
    var test_case = 'BITPOS bit=1 works with intervals';
    client.set('str', '\x00\xff\x00', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 1, 0, -1, function (err, res0) {
        if (err) {
          errorCallback(err);
        }
        client.bitpos('str', 1, 1, -1, function (err, res1) {
          if (err) {
            errorCallback(err);
          }
          client.bitpos('str', 1, 2, -1, function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            client.bitpos('str', 1, 2, 200, function (err, res3) {
              if (err) {
                errorCallback(err);
              }
              client.bitpos('str', 1, 1, 1, function (err, res4) {
                if (err) {
                  errorCallback(err);
                }
                ut.assertMany([
                    ['equal', res0, 8],
                    ['equal', res1, 8],
                    ['equal', res2, 16],
                    ['equal', res3, 16],
                    ['equal', res4, 8]
                  ], test_case);
                testEmitter.emit('next');
              });
            });
          });
        });
      });
    });
  }

  tester.Bitops32 = function (errorCallback) {
    var test_case = 'BITPOS bit=0 changes behavior if end is given';
    client.set('str', '\xff\xff\xff', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      client.bitpos('str', 0, function (err, res0) {
        if (err) {
          errorCallback(err);
        }
        client.bitpos('str', 0, 0, function (err, res1) {
          if (err) {
            errorCallback(err);
          }
          client.bitpos('str', 0, 0, -1, function (err, res2) {
            if (err) {
              errorCallback(err);
            }
            ut.assertMany([
                ['equal', res0, 2],
                ['equal', res1, 2],
                ['equal', res2, 2]
              ], test_case);
            testEmitter.emit('next');
          });
        });
      });
    });
  }

  tester.Bitops33 = function (errorCallback) {
    var test_case = 'BITPOS bit=1 fuzzy testing using SETBIT';
    client.del('str', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var max = 524288; //64k
      var first_one_pos = -1,
      pos = 0;
      var error = false;
      g.asyncFor(0, 1000, function (loop) {
        client.bitpos('str', 1, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.equal(res, first_one_pos, test_case)) {
              pos = parseInt(g.randomInt(max));
              client.setbit('str', pos, 1, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                if ((first_one_pos == -1) || (first_one_pos > pos)) {
                  //# Update the position of the first 1 bit in the array
                  //# if the bit we set is on the left of the previous one.
                  first_one_pos = pos;
                }
                loop.next();
              });
            }
          } catch (e) {
            error = true;
            ut.fail(e);
            loop.break();
          }
        });
      }, function () {
        if (!error)
          ut.pass(test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.Bitops34 = function (errorCallback) {
    var test_case = 'BITPOS bit=0 fuzzy testing using SETBIT';
    var max = 524288; //64k
    var first_one_pos = -1,
    pos = 0,
    error = false,
    str = '';
    var expr = parseInt(max / 8);
    for (var i = 0; i < expr; i++)
      str += '\xff';

    client.set('str', str, function (err, res) {
      if (err) {
        errorCallback(err);
      }
      g.asyncFor(0, 1000, function (loop) {
        client.bitpos('str', 0, function (err, res) {
          if (err) {
            errorCallback(err);
          }
          try {
            if (!assert.equal(res, 2, test_case)) {
              pos = parseInt(g.randomInt(max));
              client.setbit('str', pos, 0, function (err, res) {
                if (err) {
                  errorCallback(err);
                }
                if ((first_one_pos > pos)) {
                  //# Update the position of the first 1 bit in the array
                  //# if the bit we set is on the left of the previous one.
                  first_one_pos = pos;
                }
                loop.next();
              });
            }
          } catch (e) {
            error = true;
            ut.fail(e);
            loop.break();
          }
        });
      }, function () {
        if (!error)
          ut.pass(test_case);
        testEmitter.emit('next');
      });
    });
  }
  
  return bitops;
}
  ());
