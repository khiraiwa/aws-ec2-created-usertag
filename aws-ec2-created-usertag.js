var Log4js = require('log4js');
Log4js.configure('log-config.json');
var systemLogger = Log4js.getLogger('system');

var AWS = require('aws-sdk');
var zlib = require('zlib');
var Promise = require('bluebird');
var fs = require('fs');

exports.handler = function(event, context) {
    systemLogger.info('Received event:');
    systemLogger.info(JSON.stringify(event, null, "  "));
    var srcBucket = event.Records[0].s3.bucket.name;
    var srcKey = event.Records[0].s3.object.key;
    var region_name = srcKey.split('/')[3];
    systemLogger.debug('bucket.name:', srcBucket);
    systemLogger.debug('s3.object.key:', srcKey);
    systemLogger.debug('region:', region_name);

    // s3, ec2はリージョンセット後に作成
    AWS.config.update({region: region_name});
    var s3 = new AWS.S3();
    var ec2 = new AWS.EC2();

    var params = {
        Bucket: srcBucket,
        Key: srcKey
    };

    new Promise(function(resolve, reject){
	systemLogger.info('Fetching compressed log from S3...:');
	s3.getObject(params, function(err, data){
	    if (err) {
		reject(err);
		return;
	    }
	    resolve(data);
	});
    }).then(function(response) {
	systemLogger.info("Uncompressing log...:");
	return new Promise(function(resolve, reject){
	    zlib.gunzip(response.Body, function(err, data){
		if (err) {
		    reject(err);
		    return;
		}
		resolve(data);
	    });
	});
    }).then(function(data) {
	var json = data.toString();
	systemLogger.info('CloudTrail JSON from S3:');
	var records;
	try {
	    records = JSON.parse(json);
	} catch (err) {
	    return Promise.reject('Unable to parse CloudTrail JSON: ' +  err);
	}
	var matchingRecords = records
		.Records
		.filter(function(record) {
		    return record.eventSource.match('ec2.amazonaws.com')
			&& record.eventName.match('RunInstances');
		});
	systemLogger.debug('Size:', matchingRecords.length);
	return Promise.all(matchingRecords.map(function(record){
	    systemLogger.info('Filtered JSON:');
	    systemLogger.debug(JSON.stringify(record));
	    var createUserArn = record.userIdentity.arn;
	    var items = record.responseElements.instancesSet.items;
	    for(var i = 0; i < items.length; i++) {
		var instanceId = items[i].instanceId;
		systemLogger.info('CreateTags to EC2: ', instanceId);
		var params = {
		    Resources: [instanceId],
		    Tags: [{Key: 'createUserArn', Value: createUserArn}]
		};
		return new Promise(function(resolve, reject){
		    ec2.createTags(params, function(err, data){
			if (err) {
			    reject(err);
			    return;
			}
			resolve(params);
		    });
		});
            }
	}));
    }).then(function(result) {
	systemLogger.info('Finish:', JSON.stringify(result, null, "  "));
	context.succeed();
    }).catch(function(err) {
	systemLogger.error('Reject:', err);
	context.fail();
    });
};

// ローカル実行用
if (!module.parent) {
    var file = './input.json';
    new Promise(function(resolve, reject){
	fs.readFile(file, function(err, data){
	    if (err) {
		reject(err);
		return;
	    }
	    resolve(data);
	});
    }).then(function(data){
	var hoge = (function() {
	    var hoge = function() {};
	    var p = hoge.prototype;
	    p.succeed = function() {};
	    p.done = function() {};
	    return hoge;
	})();

	var inputJson = JSON.parse(data);
	var mockedContext = new hoge();
	exports.handler(inputJson, mockedContext);
    }).catch(function(err) {
	systemLogger.error(err);
    });
}
