var async = require('async');
var cheerio = require('cheerio');
var elongate = require('elongate');
var moment = require('moment');
var request = require('request');
var URI = require('URIjs');
var _ = require('lodash');

// From markdown
var RE_URL = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’]))/ig;

var RE_STRIP_DAY = /^(Mon|Wed|Tue|Thu|Fri|Sat|Sun) /;

var BAD_QS = [
  'awesm', 'cc', 'mn', '_r', 'a_dgi', 'ncid', 'partner', 'mod', 'gj', 'rv',
  'nl', 'feature', 'list', 'pg', 'refuse_cookie_error', 'smid', 'clickid',
  'goback', 'dq', 'seid', '_af', 'hl', 'srid', 'kid', 'a', 'trk', 'emc', 'm',
  's', 'ref', 'st', 's', 'sc', 'mbid', '_af_eid'
];

var getBody = exports.getBody = function (url, cb) {
  request.get(url, function (err, resp, body) {
    cb(err, body, (resp && resp.statusCode) || -1);
  });
};

var getTitle = exports.getTitle = function (body) {
  var $ = cheerio.load(body);

  return $('title').text() || '';
};

var transforms = [
  // Mobile NYT to web NYT
  function (url) {
    return url.replace('mobile.nytimes.com', 'www.nytimes.com');
  },
  // Get the real NYT URL
  function (url) {
    if (url.indexOf('myaccount.nytimes.com') !== -1) {
      url = url.replace('https://myaccount.nytimes.com/auth/login?URI=www-nc',
        'http://www');
      url = url.replace('&REFUSE_COOKIE_ERROR=SHOW_ERROR', '');
    }

    return url;
  },
  // Strip noisy query parameters
  function (url) {
    var urlObject = new URI(url);
    var queryObject = urlObject.query(true);

    console.log(JSON.stringify(queryObject, null, 2));

    queryObject = _.pick(queryObject, function (value, key) {
      return !key.match(/^utm_/) && BAD_QS.indexOf(key) === -1;
    });

    console.log(JSON.stringify(queryObject, null, 2));

    urlObject.setQuery(queryObject);

    return urlObject.toString();
  }
];

var addTweetUrls = exports.addTweetUrls = function (db, tweet, cb) {
  var strippedDate = tweet.created_at.replace(RE_STRIP_DAY, '');

  var createdAt = moment.utc(strippedDate, 'MMM D H:mm:ss Z YYYY')
    .format('YYYY-MM-DD HH:mm:ss');

  async.each(tweet.entities.urls, function (url, eachUrlCb) {
    elongate(url.expanded_url, function (err, expandedUrl) {
      if (err) {
        console.log('elongate() error:', url.expanded_url, err);

        // Use the original URL if we can't elongate it
        expandedUrl = url.expanded_url;
      }

      console.log(' ', url.expanded_url, expandedUrl);

      var newUrl = expandedUrl;
      var oldUrl;

      transforms.forEach(function (transformFn) {
        oldUrl = newUrl;
        newUrl = transformFn(oldUrl);

        if (oldUrl !== newUrl) {
          console.log('~', newUrl);
        }
      });

      getBody(newUrl, function (err, body, statusCode) {
        var title = getTitle(body);

        db.query('INSERT INTO urls (tweet_id, user_id, user_name, ' +
          'created_at_datetime, retweet_count, url, title, status_code) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [tweet.id_str, tweet.user.id_str, tweet.user.screen_name, createdAt,
            (tweet.retweet_count || 0), newUrl, title, statusCode],
          function (err) {
          if (err && err.code !== 'ER_DUP_ENTRY') {
            console.log('SQL error:', err);
          } else if (!err) {
            console.log('+', url.expanded_url, newUrl);
          } else {
            console.log('#', url.expanded_url, newUrl);
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
