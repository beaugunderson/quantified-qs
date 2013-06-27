var async = require('async');
var elongate = require('elongate');
var mysql = require('mysql');
var request = require('request');

var http = require('http');
var https = require('https');

var processing = require('./processing.js');

http.globalAgent.maxSockets = 100;
https.globalAgent.maxSockets = 100;

var db = mysql.createConnection({
  host: 'localhost',
  user: 'quantified_qs',
  database: 'quantified_qs',
  password: process.env.MYSQL_PASSWORD
});

var BASE_URL = 'https://api.twitter.com/1.1/search/tweets.json';

elongate = async.memoize(elongate);

function getPage(qs) {
  console.log('Fetching', (qs || 'first page'));

  if (!qs) {
    qs = '?q=%40quantifiedself&count=100&result_type=recent';
  }

  request.get({
    url: BASE_URL + qs,
    json: true,
    headers: {
      Authorization: 'Bearer ' + process.env.BEARER_TOKEN
    }
  }, function (err, res, body) {
    console.log('Got', body.statuses.length, 'tweets');

    async.each(body.statuses, function (tweet, eachTweetCb) {
      processing.addTweet(db, tweet, eachTweetCb);
    }, function () {
      if (body.search_metadata && body.search_metadata.next_results) {
        getPage(body.search_metadata.next_results);
      } else {
        console.log('All done');

        db.end();
      }
    });
  });
}

db.connect(function (err) {
  if (err) {
    console.log('Error connecting to database:', err);

    process.exit(1);
  }

  getPage();
});
