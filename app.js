var async = require('async');
var elongate = require('elongate');
var mysql = require('mysql');
var request = require('request');

var http = require('http');
var https = require('https');

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

  request.get({
    url: BASE_URL + (qs ||
      '?include_entities=true&q=%40quantifiedself&count=100&result_type=recent&rpp=100'),
    json: true,
    headers: {
      Authorization: "Bearer " + process.env.BEARER_TOKEN
    }
  }, function (err, res, body) {
    console.log('Got', body.statuses.length, 'tweets');

    async.each(body.statuses, function (tweet, eachTweetCb) {
      if (!tweet.entities || !tweet.entities.urls) {
        return eachTweetCb();
      }

      // TODO: Use an async queue here instead
      async.each(tweet.entities.urls, function (url, eachUrlCb) {
        elongate(url.expanded_url, function (err, expandedUrl) {
          db.query("INSERT INTO urls (tweet_id, user_id, user_name, " +
            "created_at, retweet_count, url) VALUES (?, ?, ?, ?, ?, ?)",
            [tweet.id_str, tweet.user.id_str, tweet.user.screen_name,
              tweet.created_at, tweet.retweet_count || 0, expandedUrl],
            function (err) {
            if (err && err.code !== 'ER_DUP_ENTRY') {
              console.log('SQL error:', err);
            } else if (!err) {
              console.log('Added entry for', expandedUrl, 'from',
                tweet.user.screen_name);
            }
          });

          eachUrlCb();
        });
      }, function () {
        eachTweetCb();
      });
    }, function () {
      if (body.search_data && body.search_data.next_results) {
        getPage(body.search_data.next_results);
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
