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

exports.memefficiency = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  memefficiency = {},
  name = 'memefficiency',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = {},
  result = [],
  local_result = [],
  global_result = [];

  //public property
  memefficiency.debug_mode = false;

  //public method
  memefficiency.start_test = function (client_pid, callback) {
    testEmitter.on('start', function () {
      var tags = 'memefficiency';
      var args = {};
      var overrides = {};
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
          if (memefficiency.debug_mode) {
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
    if (memefficiency.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  //procedure
  function test_memory_efficiency(range, callback) {
    client.flushall(function (err, result) {
      if (err) {
        callback(err, null);
      }
      ut.serverInfo(client, 'used_memory', function (err, base_mem) {
        if (err) {
          callback(err, null);
        }
        var written = 0,
        key = '',
        val = '',
        j;
        g.asyncFor(0, 10000, function (loop) {
          j = loop.iteration();
          key = 'key:' + j;
          val = g.fillString(Math.random() * range, 'A');
          client.set(key, val, function (err, res) {
            if (err) {
              callback(err);
            }
            written += key.toString().length;
            written += val.toString().length;
            written += 2;
            loop.next();
          });
        }, function () {
          ut.serverInfo(client, 'used_memory', function (err, current_mem) {
            if (err) {
              callback(err);
            }
            var used = current_mem - base_mem;
            var efficiency = written / used;
            callback(null, efficiency);
          });
        });
      });
    });
  };

  //private methods
  tester.mem1 = function (errorCallback) {
    var test_case = 'Memory Efficiency';
    var size_range = [32, 64, 128, 1024, 16384];
    var expected_min_efficiency = [0.15, 0.25, 0.35, 0.75, 0.82];
    g.asyncFor(0, size_range.length, function (loop) {
      i = loop.iteration();
      test_case = 'Memory efficiency with values in range ' + size_range[i];
      test_memory_efficiency(size_range[i], function (err, efficiency) {
        if (err) {
          errorCallback(err, null);
        }
        ut.assertOk((efficiency >= expected_min_efficiency[i]), null, test_case);
        loop.next();
      });
    },
      function () {
      testEmitter.emit('next');
    });
  };

  return memefficiency;

}
  ());
