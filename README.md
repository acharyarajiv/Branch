# Prerequisites
* [Node v0.7.6x][0] or higher
* Redis Binaries 2.6 from [Github][1]
* [Git for Windows][2]
* [Python 2.7][3]
* Microsoft Visual C++ ([Express][4] version works well)

## Prerequisites installtion
* Install Node, Git and Pyhton.
* Make sure node, npm, git and python are present in Environment Path.
* Install [node-gyp][5](node.js native addon build tool) globally, by:
	<pre><code> npm install -g node-gyp </code></pre>

	
## Steps to Run the Tests
- Clone the project
- Complile the Redis Binaries as given in the README.
- Create a folder named redis and then create a folder named src inside redis(just created) of the test_suite.
- Copy the the binaries from the Debug folder to src folder, just created.
- Go back to the folder where test suite is present.
- Make sure package.json file exists in the current folder.
- To install the dependencies first, do
	 <pre><code> npm install </code></pre>
- To run the tests just, execute the below command
	 <pre><code> npm test </code></pre>

- Alternatively, the tests can be run as:
	 <pre><code> \redisnodetest\>node test_helper.js </code></pre>
	 
- Run the bgsave using the following:
	<pre><code> \redisnodetest\>node test_bgsave.js </code></pre>

- Run the bgsaveperf using the following:
	<pre><code> \redisnodetest\>node test_bgsaveperf.js </code></pre>

## Steps to Run the Tests from Grunt
- to run testsuite from grunt type
- <pre><code> \redisnodetest\>grunt </code></pre>


#### Known Issues
- one testcase in obuf-limit might fail

#### Note
- Test suite makes use of a [modified version of node_redis][6].
- Code coverage is 73.4%
- For replication testcases please make sure you have atleast 15gb of free hardrive space
- currently logs are are <pre><code>\tests\logs\results.log</code></pre>
- logging of all commands/data in and out or redis is encorporated, to enable , in test_helper.js set <pre><code>redis.log_to_file = true</code></pre>
- the debug log for above would be found at <pre><code>\tests\logs\redis-debug.log</code></pre>

[0]: http://nodejs.org/download/
[1]: https://github.com/MSOpenTech/redis
[2]: http://code.google.com/p/msysgit/downloads/list?q=full+installer+official+git
[3]: http://www.python.org/download/releases/2.7.3/
[4]: http://www.microsoft.com/visualstudio/en-us/products/2010-editions/visual-cpp-express
[5]: https://github.com/TooTallNate/node-gyp
[6]: https://github.com/nitesh123/node_redis
