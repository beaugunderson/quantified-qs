var async = require('async');
var cheerio = require('cheerio');
var elongate = require('elongate');
var moment = require('moment');
var request = require('request');
var _ = require('lodash');

// From markdown
var RE_URL = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;

var getBody = exports.getBody = function (url, cb) {
  request.get(url, function (err, resp, body) {
    cb(err, body, resp.statusCode);
  });
};

var getTitle = exports.getTitle = function (body) {
  var $ = cheerio.load(body);

  return $('title').text() || '';
};

var addTweetUrls = exports.addTweetUrls = function (db, tweet, cb) {
  var createdAt = moment.utc(tweet.created_at, 'MMM D H:mm:ss Z YYYY')
    .format('YYYY-MM-DD HH:mm:ss');

  async.each(tweet.entities.urls, function (url, eachUrlCb) {
    elongate(url.expanded_url, function (err, expandedUrl) {
      if (err) {
        console.log('elongate() error:', url.expanded_url, err);

        // Use the original URL if we can't elongate it
        expandedUrl = url.expanded_url;
      }

      console.log(' ', url.expanded_url, expandedUrl);

      getBody(expandedUrl, function (err, body, statusCode) {
        var title = getTitle(body);

        db.query('INSERT INTO urls (tweet_id, user_id, user_name, ' +
          'created_at_datetime, retweet_count, url, title, status_code) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [tweet.id_str, tweet.user.id_str, tweet.user.screen_name, createdAt,
            (tweet.retweet_count || 0), expandedUrl, title, statusCode],
          function (err) {
          if (err && err.code !== 'ER_DUP_ENTRY') {
            console.log('SQL error:', err);
          } else if (!err) {
            console.log('+', url.expanded_url, expandedUrl);
          } else {
            console.log('#', url.expanded_url, expandedUrl);
          }
        });
      });

      eachUrlCb();
    });
  }, function (err) {
    cb(err);
  });
};

var addTweet = exports.addTweet = function (db, tweet, cb) {
  if (!tweet || !tweet.entities || !tweet.entities.urls) {
    return cb();
  }

  var matches = tweet.text.match(RE_URL);

  if (matches) {
    matches.forEach(function (match) {
      if (!_.some(tweet.entities.urls, { expanded_url: match }) &&
        !_.some(tweet.entities.urls, { url: match })) {
        console.log('!', match);

        tweet.entities.urls.push({
          expanded_url: match
        });
      }
    });
  }

  async.series([
    function (seriesCb) {
      addTweet(db, tweet.retweeted_status, seriesCb);
    },
    function (seriesCb) {
      addTweetUrls(db, tweet, seriesCb);
    }
  ],
  function (err) {
    cb(err);
  });
};
