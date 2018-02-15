var ClickHouse = require ("../src/clickhouse");

var http = require ('http');
var url  = require ('url');
var qs   = require ('querystring');

var assert = require ("assert");

describe ("real server", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
		auth = process.env.CLICKHOUSE_AUTH || 'default:',
		dbCreated = false;
	const connectOpts = {host: host, port: port, auth: auth};

	it ("pings", function (done) {
		var ch = new ClickHouse (connectOpts);
		ch.ping (function (err, ok) {
			assert.ifError (err);
			assert.equal (ok, "Ok.\n", "ping response should be 'Ok.\\n'");
			done ();
		});
	});

	it ("pinging using promise interface", function () {
		var ch = new ClickHouse (connectOpts);
		return ch.pinging ();
	});

	it ("pinging using promise interface with bad connection option", function () {
		try {
            var ch = new ClickHouse();
            return ch.pinging().then(function () {
                return Promise.reject(new Error("Driver should throw without host name"))
            }, function (e) {
                return Promise.resolve();
            });
        } catch ( e ) {
			return Promise.resolve();
		}
	});

	it ("pings with options as host", function (done) {
		var ch = new ClickHouse (host);
		ch.ping (function (err, ok) {
			assert.ifError (err);
			assert.equal (ok, "Ok.\n", "ping response should be 'Ok.\\n'");
			done ();
		});
	});



	it ("returns error", function (done) {
		var ch = new ClickHouse (Object.assign({}, connectOpts, { useQueryString: true}));
		var stream = ch.query ("ABCDEFGHIJKLMN", {syncParser: true}, function (err, result) {
			// assert (err);
			// done ();
		});

		stream.on ('error', function (err) {
			assert (err);
			// console.log (err);
			done();
		});
	});

	it ("selects from system columns", function (done) {
		var ch = new ClickHouse (connectOpts);
		ch.query ("SELECT * FROM system.columns", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("selects from system columns no more than 10 rows throws exception", function (done) {
		var ch = new ClickHouse (Object.assign( {}, connectOpts, { queryOptions: {max_rows_to_read: 10}}));
		ch.query ("SELECT * FROM system.columns", function (err, result) {
			assert (err);

			done ();
		});
	});

	it ("creates a database", function (done) {
		var ch = new ClickHouse (connectOpts);
		ch.query ("CREATE DATABASE node_clickhouse_test", function (err, result) {
			assert (!err, err);

			dbCreated = true;
			// console.log (result);

			done ();
		});
	});

	it ("creates a table", function (done) {
		var ch = new ClickHouse (connectOpts);
		ch.query ("CREATE TABLE node_clickhouse_test.t (a UInt8) ENGINE = Memory", function (err, result) {
			assert (!err, err);

			done ();
		});
	});

	it ("drops a table", function (done) {
		var ch = new ClickHouse ( Object.assign({}, connectOpts, {queryOptions: {database: 'node_clickhouse_test'}}));
		ch.query ("DROP TABLE t", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("creates a table", function (done) {
		var ch = new ClickHouse ( Object.assign({}, connectOpts, {queryOptions: {database: 'node_clickhouse_test'}}));
		ch.query ("CREATE TABLE t (a UInt8) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts some data", function (done) {
		var ch = new ClickHouse (connectOpts);
		ch.query ("INSERT INTO t VALUES (1),(2),(3)", {queryOptions: {database: 'node_clickhouse_test'}}, function (err, result) {
			assert (!err, err);

			// let's wait a few seconds
			setTimeout (function () {done ()}, 500);
		});
	});

	it ("gets back data", function (done) {
		var ch = new ClickHouse (connectOpts);
		var rows = [];
		var stream = ch.query ("select a FROM t", {queryOptions: {database: 'node_clickhouse_test'}});

		stream.on ('data', function (row) {
			rows.push (row);
		});

		stream.on ('end', function () {

			done();
		});
	});


	after (function (done) {

		if (!dbCreated)
			return done ();

		var ch = new ClickHouse (connectOpts);
		ch.query ("DROP DATABASE node_clickhouse_test", function (err, result) {
			assert (!err);

			// console.log (result);

			done ();
		});
	});
});
