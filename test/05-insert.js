var ClickHouse = require ("../src/clickhouse");

var assert = require ("assert");
var fs     = require ("fs");
var crypto = require ("crypto");

var encodeValue = require ('../src/process-db-value').encodeValue;
var encodeRow   = require ('../src/process-db-value').encodeRow;

function randomDate(start, end) {
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateData (format, fileName, cb) {
	var rs = fs.createWriteStream (fileName);
	for (var i = 0; i < 10; i++) {

		rs.write (
			encodeRow ([
				Math.ceil (Math.random () * 1000),
				Math.random () * 1000,
				crypto.randomBytes(20).toString('hex'),
				randomDate(new Date(2012, 0, 1), new Date())
			], format)
		);
	}

	rs.end (function () {
		cb ();
	});
}

describe ("insert data", function () {

	var server,
		host = process.env.CLICKHOUSE_HOST || '127.0.0.1',
		port = process.env.CLICKHOUSE_PORT || 8123,
        auth = process.env.CLICKHOUSE_AUTH || 'default:',
		dbCreated = false,
		dbName = 'node_clickhouse_test_insert';

	before (function () {
		var ch = new ClickHouse ({host: host, port: port, auth: auth});
		var okFn = function () {return Promise.resolve()};
		return ch.querying ("DROP DATABASE " + dbName).then (
			okFn, okFn
		).then (function () {
			return ch.querying ("CREATE DATABASE " + dbName);
		}).then (function (result) {
			dbCreated = true;
			// console.log (result);
			return Promise.resolve ();
		});
	});

	it ("creates a table", function (done) {
		var ch = new ClickHouse ({host: host, port: port, auth: auth, queryOptions: {database: dbName}});
		ch.query ("CREATE TABLE t (a UInt8) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts some prepared data using stream", function (done) {
		var ch = new ClickHouse ({host: host, port: port, auth: auth});
		var stream = ch.query ("INSERT INTO t", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			ch.query ("SELECT * FROM t", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

				assert.equal (result.data[0][0], 8);
				assert.equal (result.data[1][0], 73);
				assert.equal (result.data[2][0], 42);

				done ();

			});
		});

		stream.write ('8');
		stream.write ('73');
		stream.write (Buffer.from ? Buffer.from ('42') : new Buffer ('42'));
		stream.end ();
	});

	it ("inserts some data", function (done) {
		var ch = new ClickHouse ({host: host, port: port, auth: auth});
		ch.query ("INSERT INTO t VALUES (1),(2),(3)", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			done ();
		});
	});

	it ("creates a table 2", function (done) {
		var ch = new ClickHouse ({host: host, port: port, auth: auth, queryOptions: {database: dbName}});
		ch.query ("CREATE TABLE t2 (a UInt8, b Float32, x Nullable(String), z DateTime) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts data from array using stream", function (done) {
		var ch = new ClickHouse ({host: host, port: port, auth: auth});

		var now = new Date ();

		var stream = ch.query ("INSERT INTO t2", {queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			ch.query ("SELECT * FROM t2", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

				assert.equal (result.data[0][0], 1);
				assert.equal (result.data[0][1], 2.22);
				assert.equal (result.data[0][2], null);
				assert.equal (result.data[0][3], now.toISOString().replace (/\..*/, '').replace ('T', ' '));

				assert.equal (result.data[1][0], 20);
				assert.equal (result.data[1][1], 1.11);
				assert.equal (result.data[1][2], "wrqwefqwef");
				assert.equal (result.data[1][3], "2017-07-07 12:12:12");

				done ();

			});
		});

		stream.write ([1, 2.22, null, now]);
		stream.write ("20\t1.11\twrqwefqwef\t2017-07-07 12:12:12");

		// stream.write ([0, Infinity, null, new Date ()]);
		// stream.write ([23, NaN, "yyy", new Date ()]);

		stream.end ();
	});

	it ("creates a table 3", function (done) {
		var ch = new ClickHouse ({host: host, port: port, auth: auth, queryOptions: {database: dbName}});
		ch.query ("CREATE TABLE t3 (a UInt8, b Float32, x Nullable(String), z DateTime) ENGINE = Memory", function (err, result) {
			assert (!err);

			done ();
		});
	});

	it ("inserts data from array of objects using stream", function (done) {
		var ch = new ClickHouse ({host: host, port: port, auth: auth});

		var now = new Date ();

		var stream = ch.query ("INSERT INTO t3", {format: "JSONEachRow", queryOptions: {database: dbName}}, function (err, result) {
			assert (!err, err);

			ch.query ("SELECT * FROM t3", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

				assert.equal (result.data[0][0], 1);
				assert.equal (result.data[0][1], 2.22);
				assert.equal (result.data[0][2], null);
				assert.equal (result.data[0][3], now.toISOString().replace (/\..*/, '').replace ('T', ' '));

				assert.equal (result.data[1][0], 20);
				assert.equal (result.data[1][1], 1.11);
				assert.equal (result.data[1][2], "wrqwefqwef");
				assert.equal (result.data[1][3], "2017-07-07 12:12:12");

				done ();

			});
		});

		stream.write ({a: 1, b: 2.22, x: null, z: now});
		stream.write ({a: 20, b: 1.11, x: "wrqwefqwef", z: "2017-07-07 12:12:12"});

		// stream.write ([0, Infinity, null, new Date ()]);
		// stream.write ([23, NaN, "yyy", new Date ()]);

		stream.end ();
	});

	it.skip ("piping data from csv file", function (done) {

		this.timeout (5000);

		var ch = new ClickHouse ({host: host, port: port, auth: auth});

		var now = new Date ();
		var csvFileName = __filename.replace ('.js', '.csv');

		function processFileStream (fileStream) {
			var stream = ch.query ("INSERT INTO t3", {format: "CSV", queryOptions: {database: dbName}}, function (err, result) {

				assert (!err, err);

				ch.query ("SELECT * FROM t3", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

					assert (!err, err);

					done ();

				});

			});

			fileStream.pipe (stream);

			stream.on ('error', function (err) {
				// console.log (err);
			});
		}

		fs.stat (csvFileName, function (err, stat) {
			//if (err) {
				return generateData ('CSV', csvFileName, function () {
					processFileStream (fs.createReadStream (csvFileName));
				})
			//}

			processFileStream (fs.createReadStream (csvFileName));
		});

	});

	it ("piping data from tsv file", function (done) {

		this.timeout (5000);

		var ch = new ClickHouse ({host: host, port: port, auth: auth});

		var now = new Date ();
		var tsvFileName = __filename.replace ('.js', '.tsv');

		function processFileStream (fileStream) {
			var stream = ch.query ("INSERT INTO t3", {format: "TabSeparated", queryOptions: {database: dbName}}, function (err, result) {

				assert (!err, err);

				ch.query ("SELECT * FROM t3", {syncParser: true, queryOptions: {database: dbName}}, function (err, result) {

					assert (!err, err);

					done ();

				});
			});

			fileStream.pipe (stream);

			stream.on ('error', function (err) {
				// console.log (err);
			});
		}

		fs.stat (tsvFileName, function (err, stat) {
			//if (err) {
			return generateData ('TSV', tsvFileName, function () {
				processFileStream (fs.createReadStream (tsvFileName));
			})
			//}

			processFileStream (fs.createReadStream (tsvFileName));
		});

	});

	after (function (done) {

		if (!dbCreated)
			return done;

		var ch = new ClickHouse ({host: host, port: port, auth: auth});
		ch.query ("DROP DATABASE " + dbName, function (err, result) {
			assert (!err);

			// console.log (result);

			done ();
		});
	});

});
