var Twitter = require('ntwitter');
var mysql = require('mysql');

var processing = require('./processing.js');

var pool = mysql.createPool({
  host: 'localhost',
  user: 'quantified_qs',
  database: 'quantified_qs',
  password: process.env.MYSQL_PASSWORD
});

var twitter = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

var RE_RELEVANT = /quantified[\s_-]*self|self[\s_-]*quant/i;

function isTweetRelevant(tweet) {
  var relevant = false;

  relevant = relevant || RE_RELEVANT.test(tweet.text);

  tweet.entities.urls.forEach(function (url) {
    relevant = relevant || RE_RELEVANT.test(url.expanded_url);
  });

  tweet.entities.hashtags.forEach(function (hashtag) {
    relevant = relevant || RE_RELEVANT.test(hashtag.text);
  });

  return relevant;
}

function logTweet(tweet) {
  console.log(tweet.id_str, '@' + tweet.user.screen_name + ':', tweet.text);
}

twitter.stream('statuses/filter',
  {
    track: 'quantified self,quantifiedself'
  },
  function (stream) {
    stream.on('data', function (tweet) {
      logTweet(tweet);

      // Post-process matching
      if (!isTweetRelevant(tweet)) {
        console.log('Tweet was not relevant.');

        return;
      }

      pool.getConnection(function (err, db) {
        if (err) {
          console.log('Error getting database connection:', err);

          return;
        }

        processing.addTweet(db, tweet, function (err) {
          if (err) {
            console.log('Error adding tweet:', err);
          }

          db.end();
        });
      });
    });
  });
