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

exports.rdb = (function () {
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  rdb = {},
  name = 'rdb',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = '',
  server_port = '',
  server_host = '',
  client_pid = '';

  rdb.debug_mode = false;

  function dirExistsSync(d) {
    try {
      fs.statSync(d);
      return true
    } catch (er) {
      return false
    }
  }

  rdb.start_test = function (cpid, callback) {

    //check if directory exists if not then create a new directory
    if (!dirExistsSync('./tests/tmp'))
      fs.mkdirSync('./tests/tmp');

    if (!dirExistsSync('./tests/tmp/server_rdb-encoding-test'))
      fs.mkdirSync('./tests/tmp/server_rdb-encoding-test');

    var server_path = './tests/tmp/server_rdb-encoding-test';
    //copy encodings.rdb and paste it in tests/tmp folder
    fs.createReadStream('tests/assets/encodings.rdb').pipe(fs.createWriteStream(server_path + '/encodings.rdb'));

    testEmitter.on('start', function () {
      var tags = 'rdb',
      overrides = {},
      args = {};
      args['name'] = name;
      args['tags'] = tags;
      overrides['dir'] = server_path;
      overrides['dbfilename'] = 'encodings.rdb';
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
        var test_case_name = all_tests.shift();
        if (test_case_name) {
          tester[test_case_name](function (error) {
            ut.fail(error);
            testEmitter.emit('next');
          });
        } else {
          client.end();
          if (rdb.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
          }
          testEmitter.emit('end');
        }
      }, ut.timeout);
    });
    if (rdb.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  tester.rdb1 = function (errorCallback) {
    var test_case = 'RDB encoding loading test';
    var result_Array = [];
    result_Array = ['"compressible"', '"string"', '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      '\n', '"hash"', '"hash"', '"b"', '"undefined"', '"a"', '"a"', '"c"', '"undefined"', '"a"', '"a"', '"b"', '"b"', '"c"', '"c"', '"b"', '"b"',
      '"c"', '"c"', '"d"', '"d"', '"e"', '"e"', '"a"', '"undefined"', '\n', '"hash_zipped"', '"hash"', '"a"', '"undefined"', '"b"',
      '"undefined"', '"c"', '"undefined"', '\n', '"list"', '"list"', ['"1"', '"2"', '"3"', '"a"', '"b"', '"c"', '"100000"', '"6000000000"',
        '"1"', '"2"', '"3"', '"a"', '"b"', '"c"', '"100000"', '"6000000000"', '"1"', '"2"', '"3"', '"a"', '"b"', '"c"', '"100000"', '"6000000000"'],
      '\n', '"list_zipped"', '"list"', ['"1"', '"2"', '"3"', '"a"', '"b"', '"c"', '"100000"', '"6000000000"'], '\n', '"number"', '"string"',
      '"10"', '\n', '"set"', '"set"', ['"1"', '"100000"', '"2"', '"3"', '"6000000000"', '"a"', '"b"', '"c"'], '\n', '"set_zipped_1"', '"set"',
      ['"1"', '"2"', '"3"', '"4"'], '\n', '"set_zipped_2"', '"set"', ['"100000"', '"200000"', '"300000"', '"400000"'], '\n',
      '"set_zipped_3"', '"set"', ['"1000000000"', '"2000000000"', '"3000000000"', '"4000000000"', '"5000000000"', '"6000000000"'],
      '\n', '"string"', '"string"', '"Hello World"', '\n', '"zset"', '"zset"', ['"a"', '"1"', '"b"', '"2"', '"c"', '"3"', '"aa"', '"10"', '"bb"',
        '"20"', '"cc"', '"30"', '"aaa"', '"100"', '"bbb"', '"200"', '"ccc"', '"300"', '"aaaa"', '"1000"', '"cccc"', '"123456789"', '"bbbb"',
        '"5000000000"'], '\n', '"zset_zipped"', '"zset"']
    client.select(0, function (err, res) {
      ut.csvdump(client, function (err, res) {
        ut.assertDeepEqual(res, result_Array, test_case);
        testEmitter.emit('next');
      });
    });

  }

  return rdb;
}

  ())